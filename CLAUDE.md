# Lyrics Video Generator

## Project Overview
A web application that generates synchronized lyrics videos from audio files, lyrics text, and background images. Users upload their files, the app uses AI to detect when words are sung, and outputs an MP4 video with the lyrics displayed in sync with the music.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Upload View │→ │ Timeline Editor │→ │ Export/Download     │ │
│  └─────────────┘  └─────────────────┘  └─────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────┐
│                        BACKEND (Python/Flask)                    │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ WhisperX     │  │ Lyrics        │  │ MoviePy Video        │ │
│  │ Transcriber  │→ │ Aligner       │→ │ Generator            │ │
│  └──────────────┘  └───────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack
- **Backend**: Python 3.11+, Flask, WhisperX (speech recognition + forced alignment), MoviePy (video generation), librosa (waveform extraction)
- **Frontend**: React 18, Vite, Tailwind CSS
- **AI Model**: WhisperX (Whisper + wav2vec2 forced alignment for accurate word timestamps)

## Current Status

### ✅ COMPLETED

#### Backend
1. **Core transcription engine** (`backend/lyrics_video_app.py`)
   - WhisperX integration with forced alignment for accurate word-level timestamps
   - DTW (Dynamic Time Warping) for global sequence alignment
   - Phonetic matching (Soundex) for fuzzy word matching
   - Timing data export to JSON format
   - Video generation with MoviePy
   - Waveform peak extraction with librosa

2. **Flask API** (`backend/api_server.py`)
   - All endpoints implemented (see API Reference below)
   - Separate alignment audio support (vocals-only for better transcription)
   - Automatic temp file cleanup (on startup + hourly background thread)
   - Waveform generation and caching

#### Frontend
1. **FileUpload.jsx** - Drag-and-drop upload with:
   - Audio, image, and lyrics file validation
   - Two modes: "New Project" (alignment) and "Import Timing JSON" (skip alignment)
   - File previews and size display

2. **TimelineEditor.jsx** - Visual timeline editor with:
   - Draggable word/line blocks
   - Zoom controls
   - Audio playback sync
   - Waveform visualization background
   - JSON import/export
   - Selection and quick-adjust controls
   - Keyboard shortcuts (Space, arrows, C to chop)

3. **PreviewEditor/** - Real-time preview system with:
   - Canvas-based rendering
   - Font family selection
   - Orientation picker (horizontal/vertical)
   - Text box positioning with drag/resize
   - Audio sync with playback controls

4. **StylePanel.jsx** - Style customization:
   - Font size slider
   - Text/stroke color pickers
   - Position selector
   - Resolution dropdown

5. **VideoPreview.jsx** - Download screen:
   - HTML5 video player
   - Download button
   - Reset/create another option

6. **App.jsx** - Main app with:
   - Step-based flow: Upload → Processing → Edit → Generate → Download
   - Two edit tabs: Preview & Style, Timeline Editor
   - Full state management (jobId, timingData, settings, waveform, etc.)

7. **api.js** - Complete API client for all endpoints

### 🔧 TODO - Lower Priority
- [ ] Add progress streaming (SSE or WebSocket) for long-running alignment tasks
- [ ] Add test coverage
- [ ] User documentation

## Key Files

```
lyrics_video_project/
├── CLAUDE.md                 # This file - project context
├── README.md                 # User documentation
├── backend/
│   ├── lyrics_video_app.py   # ✅ Core engine + waveform extraction
│   ├── api_server.py         # ✅ Flask API + cleanup logic
│   ├── desktop_app.py        # ✅ Desktop wrapper
│   └── requirements.txt      # ✅ Python deps (whisperx, moviepy, librosa, flask)
├── frontend/
│   ├── package.json          # ✅ Dependencies (React, Vite, Tailwind)
│   ├── vite.config.js        # ✅ Vite config with API proxy to :5001
│   ├── tailwind.config.js    # ✅ Tailwind setup
│   ├── index.html            # ✅ Entry point
│   ├── src/
│   │   ├── main.jsx          # ✅ React entry
│   │   ├── App.jsx           # ✅ Main app with routing
│   │   ├── api.js            # ✅ API client
│   │   ├── index.css         # ✅ Tailwind imports
│   │   ├── components/
│   │   │   ├── TimelineEditor.jsx  # ✅ Timeline with waveform
│   │   │   ├── FileUpload.jsx      # ✅ Upload handler
│   │   │   ├── StylePanel.jsx      # ✅ Style controls
│   │   │   ├── VideoPreview.jsx    # ✅ Download screen
│   │   │   └── PreviewEditor/      # ✅ Preview system
│   │   │       ├── index.js
│   │   │       ├── PreviewEditor.jsx
│   │   │       ├── PreviewCanvas.jsx
│   │   │       ├── PreviewControls.jsx
│   │   │       ├── FontPicker.jsx
│   │   │       └── OrientationPicker.jsx
├── Dockerfile                # ✅ Done
└── docker-compose.yml        # ✅ Done
```

## API Reference

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/health` | GET | - | `{status, service}` |
| `/api/upload` | POST | FormData: audio, image, lyrics, alignment_audio? | `{job_id, files}` |
| `/api/align` | POST | `{job_id, model_size?}` | `{success, timing, waveform}` |
| `/api/timing/<job_id>` | GET | - | Timing JSON |
| `/api/timing/<job_id>` | PUT | Timing JSON | `{success}` |
| `/api/import-timing` | POST | FormData: audio, image, timing | `{job_id, files, timing}` |
| `/api/generate` | POST | `{job_id, settings}` | `{success, download_url}` |
| `/api/download/<job_id>/<file>` | GET | - | File download |
| `/api/audio/<job_id>` | GET | - | Audio stream |
| `/api/waveform/<job_id>` | GET | - | `{peaks, duration, sample_rate}` |
| `/api/jobs/<job_id>` | DELETE | - | `{success}` |

## Timing JSON Format

```json
{
  "title": "Song Name",
  "duration": 180.5,
  "lines": [
    {
      "text": "Hello world",
      "start": 2.0,
      "end": 4.5,
      "words": [
        {"word": "Hello", "start": 2.0, "end": 2.5, "confidence": 0.95},
        {"word": "world", "start": 2.6, "end": 4.5, "confidence": 0.92}
      ]
    }
  ]
}
```

## Development Commands

```bash
# Start backend (runs on :5001)
cd backend
pip install -r requirements.txt
python api_server.py

# Start frontend (runs on :5173, proxies /api to :5001)
cd frontend
npm install
npm run dev

# Test CLI directly
python backend/lyrics_video_app.py test.mp3 lyrics.txt bg.jpg out.mp4 --model base
```

## Implementation Notes

1. **WhisperX GPU**: Requires CUDA for reasonable speed. ~2GB VRAM for base model. Falls back to CPU on Apple Silicon (MPS supported for alignment).

2. **Forced alignment**: Uses wav2vec2 after Whisper for accurate word-level timestamps.

3. **Separate alignment audio**: Upload vocals-only audio for better transcription accuracy while using full mix for the video.

4. **Waveform visualization**: Extracted using librosa RMS energy, displayed as canvas in timeline editor.

5. **Auto cleanup**: Old job files (>24 hours) are automatically cleaned on server startup and hourly.

6. **Video rendering**: Uses MoviePy + ffmpeg. Ensure ffmpeg is installed.

7. **File uploads**: Stored in system temp directory (`/tmp/lyrics_video_uploads` and `/tmp/lyrics_video_outputs`).

## User Flow

```
┌──────────┐     ┌────────────┐     ┌──────────────┐     ┌──────────┐
│  Upload  │ ──▶ │ Processing │ ──▶ │   Timeline   │ ──▶ │ Download │
│  Files   │     │ (WhisperX) │     │    Editor    │     │  Video   │
└──────────┘     └────────────┘     └──────────────┘     └──────────┘
     │                 │                   │                   │
     │                 │                   │                   │
  audio.mp3      POST /align         drag to adjust      GET /download
  lyrics.txt     ~30-120 sec         PUT /timing          output.mp4
  image.jpg      + waveform          POST /generate
```
