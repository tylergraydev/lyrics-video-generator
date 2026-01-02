# 🎵 Lyrics Video Generator

Create synchronized lyrics videos from any song. Upload your audio, paste the lyrics, add a background image, and get a professional lyrics video with accurate word timing.

## Features

- **AI-Powered Sync**: Uses WhisperX with forced alignment for ~50ms word-level accuracy
- **Visual Timeline Editor**: Drag words and lines to fine-tune timing
- **Customizable Styling**: Fonts, colors, positions, and animations
- **Multiple Languages**: Supports 99+ languages
- **Export to MP4**: High-quality video output

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- FFmpeg: `apt install ffmpeg` (Linux) or `brew install ffmpeg` (Mac)
- CUDA GPU recommended (CPU works but is slow)

### Setup

**1. Backend:**
```bash
cd backend
pip install -r requirements.txt
python api_server.py  # Runs on http://localhost:5000
```

**2. Frontend:**
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

**3. Open http://localhost:5173**

### CLI Only (No Web Interface)

```bash
python backend/lyrics_video_app.py song.mp3 lyrics.txt background.jpg output.mp4
```

## Usage

1. **Upload** - Audio file + lyrics.txt + background image
2. **Wait** - AI aligns lyrics to audio (~30-120 seconds)
3. **Edit** - Adjust timing in the visual timeline editor
4. **Generate** - Create and download your MP4

## Lyrics Format

```text
[Verse 1]
Hello world it's a beautiful day
The sun is shining in every way

[Chorus]
La la la singing along
```

Section headers in `[brackets]` are ignored. One line per lyric line.

## CLI Options

```bash
python backend/lyrics_video_app.py audio.mp3 lyrics.txt bg.jpg output.mp4 \
    --model small \           # tiny, base, small, medium, large-v3
    --language en \           # auto-detected if omitted
    --font-size 60 \
    --text-color white \
    --resolution 1920x1080
```

## Tech Stack

- **Backend**: Python, Flask, WhisperX, MoviePy
- **Frontend**: React, Vite, Tailwind CSS
- **AI**: Whisper + wav2vec2 forced alignment

## License

MIT
