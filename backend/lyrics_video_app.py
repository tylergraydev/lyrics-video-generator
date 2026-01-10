#!/usr/bin/env python3
"""
Lyrics Video Generator
======================
Generates synchronized lyrics videos from audio, lyrics, and background image.

Uses WhisperX (Whisper + forced alignment) for accurate word-level timestamps
and MoviePy for video generation. Outputs an editable timing JSON that can be
tweaked before final render.

WhisperX improves on vanilla Whisper by using phoneme-based forced alignment
with wav2vec2, providing much more accurate word-level timestamps.

Alignment improvements:
- DTW (Dynamic Time Warping) for global sequence alignment
- Segment-based timing anchors from WhisperX
- Phonetic matching (Soundex) for fuzzy word matching
- Reduced search windows for more precise matching
"""

import json
import re
import os
import sys
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, List, Tuple
import subprocess
import numpy as np

# Fix for PyTorch 2.6+ weights_only security change
# Must be set before importing torch
os.environ['TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD'] = '1'

# Check for required packages and install if missing (skip if bundled with PyInstaller)
def check_and_install_packages():
    """Install required packages if not present."""
    # Skip in bundled PyInstaller environment
    if getattr(sys, 'frozen', False):
        return

    packages = [
        ('whisperx', 'whisperx'),
        ('moviepy', 'moviepy'),
        ('PIL', 'pillow'),
        ('torch', 'torch'),
    ]

    for module, package in packages:
        try:
            __import__(module if module != 'PIL' else 'PIL')
        except ImportError:
            print(f"Installing {package}...")
            subprocess.check_call([
                sys.executable, '-m', 'pip', 'install',
                package, '--user', '-q'
            ])

check_and_install_packages()

import torch

import whisperx
from moviepy import (
    ImageClip, TextClip, CompositeVideoClip,
    AudioFileClip, concatenate_videoclips, vfx
)
from PIL import Image


@dataclass
class TimedWord:
    """A word with its timing information."""
    word: str
    start: float
    end: float
    confidence: float = 1.0


@dataclass
class TimedLine:
    """A line of lyrics with timing information."""
    text: str
    start: float
    end: float
    words: list[TimedWord]


# ==============================================================================
# Alignment Helper Functions
# ==============================================================================

def soundex(word: str) -> str:
    """
    Generate Soundex code for phonetic matching.
    Soundex encodes words by sound, helping match words that sound similar
    but may be spelled differently (common in transcription errors).
    """
    if not word:
        return ""

    word = word.upper()
    # Keep first letter
    first_letter = word[0]

    # Soundex mapping
    mapping = {
        'B': '1', 'F': '1', 'P': '1', 'V': '1',
        'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
        'D': '3', 'T': '3',
        'L': '4',
        'M': '5', 'N': '5',
        'R': '6',
        'A': '0', 'E': '0', 'I': '0', 'O': '0', 'U': '0', 'H': '0', 'W': '0', 'Y': '0'
    }

    # Convert to Soundex digits
    coded = first_letter
    prev_code = mapping.get(first_letter, '0')

    for char in word[1:]:
        code = mapping.get(char, '0')
        if code != '0' and code != prev_code:
            coded += code
        prev_code = code

    # Pad or truncate to 4 characters
    coded = (coded + '000')[:4]
    return coded


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


def word_similarity(word1: str, word2: str) -> float:
    """
    Calculate similarity between two words using multiple methods.
    Returns a score from 0.0 (no match) to 1.0 (perfect match).
    """
    if not word1 or not word2:
        return 0.0

    w1 = re.sub(r'[^\w]', '', word1.lower())
    w2 = re.sub(r'[^\w]', '', word2.lower())

    if not w1 or not w2:
        return 0.0

    # Exact match
    if w1 == w2:
        return 1.0

    # One contains the other (handles contractions like "don't" -> "dont")
    if w1 in w2 or w2 in w1:
        return 0.9

    # Soundex match (phonetically similar)
    if len(w1) >= 2 and len(w2) >= 2:
        if soundex(w1) == soundex(w2):
            return 0.85

    # Levenshtein similarity
    max_len = max(len(w1), len(w2))
    distance = levenshtein_distance(w1, w2)
    lev_similarity = 1 - (distance / max_len)

    # Prefix match (first 3 characters)
    if len(w1) >= 3 and len(w2) >= 3:
        if w1[:3] == w2[:3]:
            return max(0.7, lev_similarity)

    return lev_similarity


def dtw_align(lyrics_words: List[str], transcribed_words: List[dict],
              similarity_threshold: float = 0.5) -> List[Tuple[int, int, float]]:
    """
    Use Dynamic Time Warping to align lyrics words with transcribed words.

    DTW finds the optimal alignment between two sequences, handling cases where:
    - Words are inserted/deleted in transcription
    - Words are split or merged
    - Timing is non-linear (e.g., faster choruses, slower verses)

    Args:
        lyrics_words: List of words from lyrics
        transcribed_words: List of dicts with 'word', 'start', 'end', 'score'
        similarity_threshold: Minimum similarity to consider a match

    Returns:
        List of (lyrics_idx, transcribed_idx, similarity) tuples
    """
    n = len(lyrics_words)
    m = len(transcribed_words)

    if n == 0 or m == 0:
        return []

    # Build similarity matrix
    sim_matrix = np.zeros((n, m))
    for i, lw in enumerate(lyrics_words):
        for j, tw in enumerate(transcribed_words):
            sim_matrix[i, j] = word_similarity(lw, tw['word'])

    # DTW cost matrix (we want to maximize similarity, so use negative cost)
    # Cost = 1 - similarity (lower is better)
    cost = 1 - sim_matrix

    # DTW algorithm
    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0

    # Track path
    path = np.zeros((n + 1, m + 1, 2), dtype=int)

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = cost[i-1, j-1]

            # Standard DTW moves: diagonal, horizontal, vertical
            candidates = [
                (dtw[i-1, j-1] + c, (i-1, j-1)),      # Match
                (dtw[i-1, j] + 0.5, (i-1, j)),        # Skip lyrics word (insertion)
                (dtw[i, j-1] + 0.3, (i, j-1)),        # Skip transcribed word (deletion)
            ]

            best_cost, best_prev = min(candidates, key=lambda x: x[0])
            dtw[i, j] = best_cost
            path[i, j] = best_prev

    # Backtrack to find alignment
    alignments = []
    i, j = n, m

    while i > 0 and j > 0:
        prev_i, prev_j = path[i, j]

        if prev_i == i - 1 and prev_j == j - 1:
            # Diagonal move = match
            sim = sim_matrix[i-1, j-1]
            if sim >= similarity_threshold:
                alignments.append((i-1, j-1, sim))

        i, j = prev_i, prev_j

    alignments.reverse()
    return alignments


def segment_based_alignment(
    lyrics_lines: List[str],
    segments: List[dict],
    audio_duration: float
) -> List[Tuple[int, float, float]]:
    """
    Align lyrics lines to transcription segments.

    Uses segment boundaries from WhisperX as timing anchors, then
    matches lyrics lines to segments based on text similarity.

    Args:
        lyrics_lines: List of lyrics line strings
        segments: WhisperX segments with 'text', 'start', 'end'
        audio_duration: Total audio duration

    Returns:
        List of (line_idx, start_time, end_time) tuples
    """
    if not segments:
        # Fallback to even distribution
        line_duration = audio_duration / max(len(lyrics_lines), 1)
        return [(i, i * line_duration, (i + 1) * line_duration)
                for i in range(len(lyrics_lines))]

    # Build segment text similarity matrix
    n_lines = len(lyrics_lines)
    n_segments = len(segments)

    # Calculate similarity between each line and segment
    sim_matrix = np.zeros((n_lines, n_segments))

    for i, line in enumerate(lyrics_lines):
        line_words = set(re.sub(r'[^\w\s]', '', line.lower()).split())
        for j, seg in enumerate(segments):
            seg_words = set(re.sub(r'[^\w\s]', '', seg.get('text', '').lower()).split())

            if line_words and seg_words:
                # Jaccard similarity
                intersection = len(line_words & seg_words)
                union = len(line_words | seg_words)
                sim_matrix[i, j] = intersection / union if union > 0 else 0

    # Assign segments to lines while maintaining order
    line_timings = []
    used_segments = set()

    for i in range(n_lines):
        # Find best matching segment not yet used, preferring segments in order
        best_seg = None
        best_score = -1

        # Search window: start from expected position
        expected_seg = int((i / n_lines) * n_segments)
        search_range = max(3, n_segments // 4)

        for offset in range(search_range + 1):
            for j in [expected_seg + offset, expected_seg - offset]:
                if 0 <= j < n_segments and j not in used_segments:
                    # Score combines similarity and position proximity
                    position_bonus = 1 - abs(j - expected_seg) / n_segments
                    score = sim_matrix[i, j] * 0.7 + position_bonus * 0.3

                    if score > best_score:
                        best_score = score
                        best_seg = j

        if best_seg is not None and best_score > 0.2:
            used_segments.add(best_seg)
            seg = segments[best_seg]
            line_timings.append((i, seg['start'], seg['end']))
        else:
            # Interpolate timing from neighbors
            if line_timings:
                prev_start, prev_end = line_timings[-1][1], line_timings[-1][2]
                gap = (audio_duration - prev_end) / (n_lines - i)
                line_timings.append((i, prev_end, prev_end + gap))
            else:
                gap = audio_duration / n_lines
                line_timings.append((i, i * gap, (i + 1) * gap))

    return line_timings


@dataclass
class LyricsTimingData:
    """Complete timing data for a song."""
    title: str
    duration: float
    lines: list[TimedLine]

    def to_json(self, path: str):
        """Save timing data to JSON for editing."""
        data = {
            'title': self.title,
            'duration': self.duration,
            'lines': [
                {
                    'text': line.text,
                    'start': line.start,
                    'end': line.end,
                    'words': [asdict(w) for w in line.words]
                }
                for line in self.lines
            ]
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"✓ Timing data saved to: {path}")
    
    @classmethod
    def from_json(cls, path: str) -> 'LyricsTimingData':
        """Load timing data from JSON."""
        with open(path) as f:
            data = json.load(f)
        
        lines = []
        for line_data in data['lines']:
            words = [TimedWord(**w) for w in line_data['words']]
            lines.append(TimedLine(
                text=line_data['text'],
                start=line_data['start'],
                end=line_data['end'],
                words=words
            ))
        
        return cls(
            title=data['title'],
            duration=data['duration'],
            lines=lines
        )


class LyricsAligner:
    """Aligns provided lyrics with audio using WhisperX transcription + forced alignment."""
    
    def __init__(self, model_size: str = "small", device: str = None, compute_type: str = "float16"):
        """
        Initialize the aligner with a WhisperX model.

        Args:
            model_size: Whisper model size ('tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3')
                       Default 'small' provides good balance of speed/accuracy.
                       Use 'medium' or 'large-v2' for better accuracy on complex audio.
            device: Device to use ('cuda', 'mps', or 'cpu'). Auto-detected if None.
            compute_type: Compute type for faster-whisper ('float16', 'int8', 'float32')
        """
        # Auto-detect device: CUDA > MPS > CPU
        if device:
            self.device = device
        elif torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            # MPS available but faster-whisper (CTranslate2) doesn't support it yet
            # Use CPU for transcription, but alignment can use MPS
            self.device = "cpu"
            self.mps_available = True
            print("Apple Silicon (MPS) detected - using CPU for transcription, MPS for alignment")
        else:
            self.device = "cpu"

        self.mps_available = getattr(self, 'mps_available', False)
        self.compute_type = compute_type if self.device == "cuda" else "float32"
        
        print(f"Loading WhisperX model ({model_size}) on {self.device}...")
        self.model = whisperx.load_model(
            model_size, 
            self.device, 
            compute_type=self.compute_type
        )
        print("✓ Model loaded")
        
        self.model_size = model_size
        self._align_model = None
        self._align_metadata = None
        self._align_device = "mps" if self.mps_available else self.device
    
    def _load_align_model(self, language_code: str):
        """Load the alignment model for a specific language."""
        if self._align_model is None or self._current_lang != language_code:
            # Use MPS for alignment if available (wav2vec2 supports MPS)
            align_device = "mps" if self.mps_available else self.device
            print(f"Loading alignment model for language: {language_code} on {align_device}...")
            self._align_model, self._align_metadata = whisperx.load_align_model(
                language_code=language_code,
                device=align_device
            )
            self._current_lang = language_code
            self._align_device = align_device
            print("✓ Alignment model loaded")
    
    def transcribe_with_timestamps(self, audio_path: str, language: str = None) -> dict:
        """
        Transcribe audio and get word-level timestamps using WhisperX.
        
        WhisperX performs:
        1. VAD (Voice Activity Detection) to find speech segments
        2. Whisper transcription on those segments  
        3. Forced alignment with wav2vec2 for accurate word timestamps
        """
        print(f"Transcribing audio: {audio_path}")
        
        # Load audio
        audio = whisperx.load_audio(audio_path)
        
        # Transcribe with Whisper
        result = self.model.transcribe(audio, batch_size=16, language=language)
        detected_language = result.get("language", language or "en")
        print(f"✓ Transcription complete (detected language: {detected_language})")
        
        # Load alignment model and perform forced alignment
        self._load_align_model(detected_language)
        
        print("Performing forced alignment for word-level timestamps...")
        result = whisperx.align(
            result["segments"],
            self._align_model,
            self._align_metadata,
            audio,
            self._align_device,
            return_char_alignments=False
        )
        print("✓ Forced alignment complete")
        
        return result
    
    def align_lyrics(
        self,
        audio_path: str,
        lyrics_text: str,
        title: str = "Untitled",
        language: str = None
    ) -> LyricsTimingData:
        """
        Align provided lyrics with audio timestamps using WhisperX + DTW.

        This improved method:
        1. Transcribes audio with WhisperX (Whisper + forced alignment)
        2. Uses segment boundaries as timing anchors for lines
        3. Uses Dynamic Time Warping (DTW) for global word alignment
        4. Applies phonetic matching (Soundex) for fuzzy word matching

        Args:
            audio_path: Path to audio file
            lyrics_text: Full lyrics text (lines separated by newlines)
            title: Song title for the output
            language: Language code (e.g., 'en', 'es'). Auto-detected if None.

        Returns:
            LyricsTimingData with timing for each line and word
        """
        # Transcribe audio with WhisperX
        result = self.transcribe_with_timestamps(audio_path, language)

        # Get segments for line-level timing anchors
        segments = result.get('segments', [])

        # Extract all words with timestamps from transcription
        transcribed_words = []
        for segment in segments:
            for word_info in segment.get('words', []):
                if 'start' in word_info and 'end' in word_info:
                    transcribed_words.append({
                        'word': word_info.get('word', '').strip(),
                        'start': word_info['start'],
                        'end': word_info['end'],
                        'score': word_info.get('score', 1.0)
                    })

        print(f"Found {len(transcribed_words)} words with timestamps from {len(segments)} segments")

        # Parse lyrics into lines (skip empty lines and section headers like [Verse])
        lyrics_lines = [
            line.strip() for line in lyrics_text.strip().split('\n')
            if line.strip() and not line.strip().startswith('[')
        ]

        # Get audio duration
        audio_clip = AudioFileClip(audio_path)
        audio_duration = audio_clip.duration
        audio_clip.close()

        # STEP 1: Get line-level timing anchors using segment matching
        print("Aligning lines to segments...")
        line_timings = segment_based_alignment(lyrics_lines, segments, audio_duration)

        # STEP 2: Flatten all lyrics words for DTW alignment
        all_lyrics_words = []
        word_to_line_map = []  # Maps word index to (line_idx, word_idx_in_line)

        for line_idx, line in enumerate(lyrics_lines):
            words = line.split()
            for word_idx, word in enumerate(words):
                all_lyrics_words.append(word)
                word_to_line_map.append((line_idx, word_idx))

        # STEP 3: Use DTW to globally align lyrics words with transcribed words
        print("Performing DTW alignment...")
        dtw_alignments = dtw_align(all_lyrics_words, transcribed_words, similarity_threshold=0.4)

        # Build a map from (line_idx, word_idx) to transcribed word timing
        word_timing_map = {}
        for lyrics_idx, trans_idx, similarity in dtw_alignments:
            line_idx, word_idx = word_to_line_map[lyrics_idx]
            tw = transcribed_words[trans_idx]
            word_timing_map[(line_idx, word_idx)] = {
                'start': tw['start'],
                'end': tw['end'],
                'confidence': similarity * tw.get('score', 1.0)
            }

        print(f"DTW aligned {len(dtw_alignments)}/{len(all_lyrics_words)} words")

        # STEP 4: Build timed lines using DTW results + segment anchors as fallback
        timed_lines = []

        for line_idx, line in enumerate(lyrics_lines):
            line_words = line.split()
            line_timed_words = []

            # Get line timing anchor
            line_anchor = next((t for t in line_timings if t[0] == line_idx), None)
            if line_anchor:
                anchor_start, anchor_end = line_anchor[1], line_anchor[2]
            else:
                # Fallback to even distribution
                anchor_start = (line_idx / len(lyrics_lines)) * audio_duration
                anchor_end = ((line_idx + 1) / len(lyrics_lines)) * audio_duration

            for word_idx, lyric_word in enumerate(line_words):
                timing = word_timing_map.get((line_idx, word_idx))

                if timing:
                    # Use DTW-aligned timing
                    timed_word = TimedWord(
                        word=lyric_word,
                        start=timing['start'],
                        end=timing['end'],
                        confidence=timing['confidence']
                    )
                else:
                    # Interpolate within line anchor bounds
                    word_progress = word_idx / max(len(line_words), 1)
                    est_start = anchor_start + (anchor_end - anchor_start) * word_progress
                    # Use previous word's end time if available
                    if line_timed_words:
                        est_start = max(est_start, line_timed_words[-1].end + 0.05)
                    est_end = est_start + 0.25  # Reasonable word duration

                    timed_word = TimedWord(
                        word=lyric_word,
                        start=est_start,
                        end=est_end,
                        confidence=0.3  # Low confidence for interpolated
                    )

                line_timed_words.append(timed_word)

            if line_timed_words:
                # Calculate line start/end from actual word timings
                line_start = line_timed_words[0].start
                line_end = line_timed_words[-1].end

                timed_lines.append(TimedLine(
                    text=line,
                    start=line_start,
                    end=line_end,
                    words=line_timed_words
                ))

        # STEP 5: Post-process to fix timing issues
        timed_lines = self._post_process_timing(timed_lines, audio_duration)

        # Calculate alignment statistics
        total_words = sum(len(line.words) for line in timed_lines)
        high_confidence = sum(1 for line in timed_lines for w in line.words if w.confidence > 0.5)
        print(f"✓ Aligned {total_words} words ({high_confidence} high-confidence, {total_words - high_confidence} estimated)")

        return LyricsTimingData(
            title=title,
            duration=audio_duration,
            lines=timed_lines
        )

    def _post_process_timing(self, timed_lines: list, duration: float) -> list:
        """
        Post-process timing data to fix common issues.

        Each line is processed INDEPENDENTLY - no forcing sequential order.
        This way a bad match on line 2 won't cascade to lines 3, 4, 5, etc.

        Key fix: Detect words with outlier timing and re-estimate based on
        the first word's start (which is usually accurate) + reasonable duration.
        """
        # Reasonable speaking rate: ~3-4 words per second for sung lyrics
        AVG_WORD_DURATION = 0.35  # seconds per word
        GAP_BETWEEN_WORDS = 0.08  # small gap between words
        MAX_LINE_DURATION = 8.0   # max seconds for any single line

        for line in timed_lines:
            if not line.words:
                continue

            # First word's start is usually accurate - use it as anchor
            first_word_start = line.words[0].start
            num_words = len(line.words)

            # Expected line duration based on word count
            expected_line_duration = num_words * (AVG_WORD_DURATION + GAP_BETWEEN_WORDS)
            max_reasonable_end = first_word_start + min(expected_line_duration * 2, MAX_LINE_DURATION)

            # Check if the line has outlier words (end time way beyond expected)
            last_word_end = line.words[-1].end
            line_seems_broken = (last_word_end - first_word_start) > max_reasonable_end - first_word_start

            if line_seems_broken:
                # Re-estimate all word timings based on first word + even spacing
                current_time = first_word_start
                for word in line.words:
                    word.start = current_time
                    word.end = current_time + AVG_WORD_DURATION
                    word.confidence = min(word.confidence, 0.4)  # Mark as re-estimated
                    current_time = word.end + GAP_BETWEEN_WORDS
            else:
                # Line seems OK - just do basic cleanup
                word_prev_end = None
                for word in line.words:
                    # Clamp to duration
                    word.start = max(0, min(word.start, duration - 0.1))
                    word.end = max(0, min(word.end, duration))

                    # Within a line, words should be sequential
                    if word_prev_end is not None and word.start < word_prev_end:
                        word.start = word_prev_end + 0.02

                    # Cap word duration (max 1.5 seconds per word)
                    if word.end - word.start > 1.5:
                        word.end = word.start + 0.4

                    # Ensure end > start
                    if word.end <= word.start:
                        word.end = word.start + 0.2

                    word_prev_end = word.end

            # Recalculate line timing from words
            line.start = line.words[0].start
            line.end = line.words[-1].end

        return timed_lines


class LyricsVideoGenerator:
    """Generates lyrics videos with synchronized text overlays."""
    
    def __init__(
        self,
        font: str = "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        font_size: int = 60,
        text_color: str = "white",
        highlight_color: str = "yellow",
        stroke_color: str = "black",
        stroke_width: int = 3,
        position: tuple = ('center', 'center'),
        fade_duration: float = 0.3,
        text_width: int = None
    ):
        """
        Initialize the video generator with styling options.

        Args:
            font: Font name for lyrics text
            font_size: Size of lyrics text
            text_color: Color for inactive lyrics
            highlight_color: Color for currently sung word
            stroke_color: Outline color for text
            stroke_width: Outline width
            position: Position of text ('center', 'center') or pixel coordinates
            fade_duration: Duration of fade in/out for lines
            text_width: Width for text wrapping (None = auto based on resolution)
        """
        self.font = font
        self.font_size = font_size
        self.text_color = text_color
        self.highlight_color = highlight_color
        self.stroke_color = stroke_color
        self.stroke_width = stroke_width
        self.position = position
        self.fade_duration = fade_duration
        self.text_width = text_width
    
    def generate_video(
        self,
        timing_data: LyricsTimingData,
        audio_path: str,
        image_path: str,
        output_path: str,
        fps: int = 24,
        resolution: tuple = (1920, 1080),
        highlight_mode: str = "line",  # "line", "word", or "karaoke"
        line_display_buffer: float = 0.5  # Show line this many seconds before it starts
    ):
        """
        Generate the lyrics video.
        
        Args:
            timing_data: LyricsTimingData with timing information
            audio_path: Path to audio file
            image_path: Path to background image
            output_path: Output video path
            fps: Frames per second
            resolution: Video resolution (width, height)
            highlight_mode: How to highlight current lyrics
            line_display_buffer: Seconds to show line before it starts
        """
        print(f"Generating video: {output_path}")
        print(f"  Resolution: {resolution[0]}x{resolution[1]}")
        print(f"  FPS: {fps}")
        print(f"  Highlight mode: {highlight_mode}")
        
        # Load and resize background image
        bg_clip = ImageClip(image_path)
        bg_clip = bg_clip.resized(resolution)
        bg_clip = bg_clip.with_duration(timing_data.duration)
        
        # Create text clips for each line
        text_clips = []
        
        for line in timing_data.lines:
            # Calculate display timing
            display_start = max(0, line.start - line_display_buffer)
            display_end = line.end + self.fade_duration
            
            if highlight_mode == "line":
                # Simple mode: show full line
                # Use text_width if specified, otherwise default to resolution with safe margins
                # Safe margin = 5% on each side = 10% total, so use 90% of width
                safe_margin_x = int(resolution[0] * 0.05)
                safe_margin_y = int(resolution[1] * 0.05)
                max_safe_width = resolution[0] - (2 * safe_margin_x)
                max_safe_height = resolution[1] - (2 * safe_margin_y)

                clip_width = self.text_width if self.text_width else max_safe_width
                # Ensure clip_width doesn't exceed safe bounds
                clip_width = min(clip_width, max_safe_width)

                # Start with configured font size, reduce if text is too tall
                current_font_size = self.font_size
                min_font_size = max(20, self.font_size // 3)  # Don't go below 1/3 of original or 20px

                while current_font_size >= min_font_size:
                    txt_clip = TextClip(
                        text=line.text,
                        font=self.font,
                        font_size=current_font_size,
                        color=self.text_color,
                        stroke_color=self.stroke_color,
                        stroke_width=self.stroke_width,
                        method='caption',
                        size=(clip_width, None)
                    )

                    clip_w, clip_h = txt_clip.size

                    # Check if text fits within safe vertical bounds
                    if clip_h <= max_safe_height:
                        break

                    # Text too tall, try smaller font
                    txt_clip.close()
                    current_font_size = int(current_font_size * 0.85)

                # Final size check
                clip_w, clip_h = txt_clip.size

                # Handle positioning - if tuple of numbers, center the clip at that position
                if isinstance(self.position, tuple) and len(self.position) == 2:
                    pos_x, pos_y = self.position
                    # Check if both are numbers (not strings like 'center')
                    if not isinstance(pos_x, str) and not isinstance(pos_y, str):
                        # Custom pixel position - center the clip at this point
                        centered_x = int(pos_x) - clip_w / 2
                        centered_y = int(pos_y) - clip_h / 2

                        # Clamp position to keep text within safe bounds
                        centered_x = max(safe_margin_x, min(centered_x, resolution[0] - clip_w - safe_margin_x))
                        centered_y = max(safe_margin_y, min(centered_y, resolution[1] - clip_h - safe_margin_y))

                        txt_clip = txt_clip.with_position((centered_x, centered_y))
                    else:
                        # String position like ('center', 'center')
                        txt_clip = txt_clip.with_position(self.position)
                else:
                    txt_clip = txt_clip.with_position(self.position)
                txt_clip = txt_clip.with_start(display_start)
                txt_clip = txt_clip.with_duration(display_end - display_start)
                txt_clip = txt_clip.with_effects([
                    vfx.CrossFadeIn(self.fade_duration),
                    vfx.CrossFadeOut(self.fade_duration)
                ])
                text_clips.append(txt_clip)
                
            elif highlight_mode == "karaoke":
                # Karaoke mode: highlight each word as it's sung
                for word in line.words:
                    # Create highlighted word
                    txt_clip = TextClip(
                        text=word.word,
                        font=self.font,
                        font_size=self.font_size,
                        color=self.highlight_color,
                        stroke_color=self.stroke_color,
                        stroke_width=self.stroke_width
                    )
                    # Position would need word-level positioning logic
                    txt_clip = txt_clip.with_position(self.position)
                    txt_clip = txt_clip.with_start(word.start)
                    txt_clip = txt_clip.with_duration(word.end - word.start)
                    text_clips.append(txt_clip)
        
        # Composite all clips
        final_clip = CompositeVideoClip(
            [bg_clip] + text_clips,
            size=resolution
        )
        
        # Add audio
        audio = AudioFileClip(audio_path)
        final_clip = final_clip.with_audio(audio)
        
        # Write output
        print("Rendering video...")
        final_clip.write_videofile(
            output_path,
            fps=fps,
            codec='libx264',
            audio_codec='aac',
            threads=4,
            preset='medium',
            logger=None
        )
        
        # Cleanup
        final_clip.close()
        audio.close()
        bg_clip.close()
        
        print(f"✓ Video saved to: {output_path}")


def extract_waveform_peaks(audio_path: str, num_peaks: int = 2000) -> dict:
    """
    Extract waveform peaks for visualization.

    Uses librosa to load audio and compute RMS energy, then downsamples
    to the requested number of peaks for efficient frontend rendering.

    Args:
        audio_path: Path to audio file
        num_peaks: Number of peaks to return (default 2000)

    Returns:
        dict with 'peaks' (list of floats 0-1), 'duration', 'sample_rate'
    """
    try:
        import librosa
    except ImportError:
        print("Warning: librosa not installed, skipping waveform generation")
        return None

    print(f"Extracting waveform from: {audio_path}")

    # Load audio with librosa (mono, resampled to 22050 Hz)
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = len(y) / sr

    # Calculate frame size to get approximately num_peaks frames
    # Each frame will become one peak
    hop_length = max(1, len(y) // num_peaks)

    # Compute RMS energy for each frame
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

    # Normalize to 0-1 range
    if rms.max() > 0:
        peaks = (rms / rms.max()).tolist()
    else:
        peaks = [0.0] * len(rms)

    # Ensure we have exactly num_peaks (or close to it)
    if len(peaks) > num_peaks:
        # Downsample by taking every nth element
        step = len(peaks) / num_peaks
        peaks = [peaks[int(i * step)] for i in range(num_peaks)]

    print(f"✓ Extracted {len(peaks)} waveform peaks")

    return {
        'peaks': peaks,
        'duration': duration,
        'sample_rate': sr
    }


def generate_lyrics_video(
    audio_path: str,
    lyrics_path: str,
    image_path: str,
    output_path: str,
    timing_json_path: Optional[str] = None,
    use_existing_timing: bool = False,
    model_size: str = "small",
    language: str = None,
    device: str = None,
    **video_options
) -> str:
    """
    Main function to generate a lyrics video.
    
    Args:
        audio_path: Path to the song audio file
        lyrics_path: Path to text file with lyrics
        image_path: Path to background image
        output_path: Where to save the output video
        timing_json_path: Path to save/load timing JSON (for editing)
        use_existing_timing: If True, load timing from JSON instead of regenerating
        model_size: WhisperX model size for transcription
        language: Language code (e.g., 'en'). Auto-detected if None.
        device: Device to use ('cuda' or 'cpu'). Auto-detected if None.
        **video_options: Additional options for video generation
        
    Returns:
        Path to the generated video
    """
    # Validate inputs
    for path, name in [(audio_path, "Audio"), (lyrics_path, "Lyrics"), (image_path, "Image")]:
        if not os.path.exists(path):
            raise FileNotFoundError(f"{name} file not found: {path}")
    
    # Read lyrics
    with open(lyrics_path, 'r') as f:
        lyrics_text = f.read()
    
    # Set default timing JSON path
    if timing_json_path is None:
        timing_json_path = output_path.rsplit('.', 1)[0] + '_timing.json'
    
    # Get or generate timing data
    if use_existing_timing and os.path.exists(timing_json_path):
        print(f"Loading existing timing from: {timing_json_path}")
        timing_data = LyricsTimingData.from_json(timing_json_path)
    else:
        # Align lyrics with audio using WhisperX
        aligner = LyricsAligner(model_size=model_size, device=device)
        title = Path(audio_path).stem
        timing_data = aligner.align_lyrics(audio_path, lyrics_text, title, language=language)
        
        # Save timing for editing
        timing_data.to_json(timing_json_path)
    
    # Generate video
    generator = LyricsVideoGenerator(**video_options)
    generator.generate_video(
        timing_data=timing_data,
        audio_path=audio_path,
        image_path=image_path,
        output_path=output_path
    )
    
    return output_path


# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate synchronized lyrics videos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python lyrics_video_app.py song.mp3 lyrics.txt background.jpg output.mp4
  
  # With custom options
  python lyrics_video_app.py song.mp3 lyrics.txt bg.jpg out.mp4 --font-size 80 --highlight-color cyan
  
  # Edit timing and re-render
  python lyrics_video_app.py song.mp3 lyrics.txt bg.jpg out.mp4 --use-existing-timing
        """
    )
    
    parser.add_argument("audio", help="Path to audio file (mp3, wav, etc.)")
    parser.add_argument("lyrics", help="Path to lyrics text file")
    parser.add_argument("image", help="Path to background image")
    parser.add_argument("output", help="Output video path (mp4)")
    
    parser.add_argument("--timing-json", help="Path for timing JSON file")
    parser.add_argument("--use-existing-timing", action="store_true",
                       help="Use existing timing JSON instead of regenerating")
    parser.add_argument("--model", default="small",
                       choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
                       help="WhisperX model size (default: small for better accuracy)")
    parser.add_argument("--language", default=None,
                       help="Language code (e.g., 'en', 'es'). Auto-detected if not specified.")
    parser.add_argument("--device", default=None,
                       choices=["cuda", "cpu"],
                       help="Device to use. Auto-detected if not specified.")
    
    parser.add_argument("--font-size", type=int, default=60)
    parser.add_argument("--text-color", default="white")
    parser.add_argument("--highlight-color", default="yellow")
    parser.add_argument("--resolution", default="1920x1080",
                       help="Video resolution (e.g., 1920x1080)")
    parser.add_argument("--fps", type=int, default=24)
    
    args = parser.parse_args()
    
    # Parse resolution
    res = tuple(map(int, args.resolution.split('x')))
    
    generate_lyrics_video(
        audio_path=args.audio,
        lyrics_path=args.lyrics,
        image_path=args.image,
        output_path=args.output,
        timing_json_path=args.timing_json,
        use_existing_timing=args.use_existing_timing,
        model_size=args.model,
        language=args.language,
        device=args.device,
        font_size=args.font_size,
        text_color=args.text_color,
        highlight_color=args.highlight_color,
        resolution=res,
        fps=args.fps
    )
