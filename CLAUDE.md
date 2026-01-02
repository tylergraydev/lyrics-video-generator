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
- **Backend**: Python 3.11+, Flask, WhisperX (speech recognition + forced alignment), MoviePy (video generation)
- **Frontend**: React 18, Vite, Tailwind CSS
- **AI Model**: WhisperX (Whisper + wav2vec2 forced alignment for accurate word timestamps)

## Current Status

### ✅ COMPLETED
1. **Core transcription engine** (`backend/lyrics_video_app.py`)
   - WhisperX integration with forced alignment for accurate word-level timestamps
   - Lyrics text alignment with transcribed audio
   - Timing data export to JSON format
   - Video generation with MoviePy

2. **Timeline Editor component** (`frontend/src/components/TimelineEditor.jsx`)
   - Visual timeline with draggable word/line blocks
   - Zoom controls
   - Playback simulation
   - JSON import/export
   - Selection and quick-adjust controls

3. **Flask API endpoints** (`backend/api_server.py`)
   - File upload, alignment, video generation endpoints

4. **Data structures** - Timing JSON format:
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

### 🔧 TODO - Priority Order

#### 1. Frontend Setup & Integration (Start Here)
- [ ] Initialize Vite React project in `frontend/`
- [ ] Install dependencies: `npm install`
- [ ] Set up Tailwind CSS
- [ ] Create API client (`frontend/src/api.js`) to call Flask backend

#### 2. File Upload Component
- [ ] Create `FileUpload.jsx` with drag-and-drop
- [ ] Accept: audio (mp3, wav, m4a, flac), image (jpg, png, webp), lyrics (.txt)
- [ ] Show file previews after upload
- [ ] POST to `/api/upload`

#### 3. Processing Status View
- [ ] Create `ProcessingView.jsx`
- [ ] Show spinner/progress during WhisperX alignment
- [ ] Poll `/api/timing/<job_id>` until ready, or implement SSE/WebSocket

#### 4. Connect Timeline Editor
- [ ] Load timing data from API into TimelineEditor
- [ ] Save edits back via PUT `/api/timing/<job_id>`
- [ ] Add "Generate Video" button that calls `/api/generate`

#### 5. Style Customization Panel
- [ ] Font size slider
- [ ] Text/stroke color pickers
- [ ] Position selector (center, bottom, top)
- [ ] Resolution dropdown

#### 6. Video Preview & Download
- [ ] Show generated video in `<video>` player
- [ ] Download button linking to `/api/download/<job_id>/output.mp4`

#### 7. App Router & State
- [ ] Create main App.jsx with step-based flow
- [ ] State: currentStep, jobId, timingData, settings
- [ ] Steps: Upload → Processing → Edit Timeline → Generate → Download

### 🔧 TODO - Backend Improvements (Lower Priority)
- [ ] Add progress streaming (SSE or WebSocket) for long-running tasks
- [ ] Add audio waveform generation for timeline visualization
- [ ] Automatic temp file cleanup (cron or on-demand)
- [ ] Better error messages and validation

## Key Files

```
lyrics_video_project/
├── CLAUDE.md                 # This file - project context for Claude Code
├── README.md                 # User documentation
├── backend/
│   ├── lyrics_video_app.py   # ✅ Core engine
│   ├── api_server.py         # ✅ Flask API  
│   └── requirements.txt      # ✅ Python deps
├── frontend/
│   ├── package.json          # 🔧 Create with Vite
│   ├── vite.config.js        # 🔧 Configure proxy to backend
│   ├── tailwind.config.js    # 🔧 Tailwind setup
│   ├── index.html            # 🔧 Entry point
│   ├── src/
│   │   ├── main.jsx          # 🔧 React entry
│   │   ├── App.jsx           # 🔧 Main app with routing
│   │   ├── api.js            # 🔧 API client
│   │   ├── components/
│   │   │   ├── TimelineEditor.jsx  # ✅ Done
│   │   │   ├── FileUpload.jsx      # 🔧 Create
│   │   │   ├── ProcessingView.jsx  # 🔧 Create
│   │   │   ├── StylePanel.jsx      # 🔧 Create
│   │   │   └── VideoPreview.jsx    # 🔧 Create
├── Dockerfile                # ✅ Done
└── docker-compose.yml        # ✅ Done
```

## API Reference

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/upload` | POST | FormData: audio, image, lyrics (text) | `{job_id, files}` |
| `/api/align` | POST | `{job_id, model_size?}` | `{success, timing}` |
| `/api/timing/<job_id>` | GET | - | Timing JSON |
| `/api/timing/<job_id>` | PUT | Timing JSON | `{success}` |
| `/api/generate` | POST | `{job_id, settings}` | `{success, download_url}` |
| `/api/download/<job_id>/<file>` | GET | - | File download |

## Development Commands

```bash
# Start backend (runs on :5000)
cd backend
pip install -r requirements.txt
python api_server.py

# Start frontend (runs on :5173, proxies /api to :5000)
cd frontend
npm install
npm run dev

# Test CLI directly
python backend/lyrics_video_app.py test.mp3 lyrics.txt bg.jpg out.mp4 --model base
```

## Implementation Notes

1. **WhisperX GPU**: Requires CUDA for reasonable speed. ~2GB VRAM for base model.

2. **Forced alignment**: This is what makes timestamps accurate. Uses wav2vec2 after Whisper.

3. **Timeline Editor**: Works standalone - can edit any timing JSON without backend.

4. **Video rendering**: Uses MoviePy + ffmpeg. Ensure ffmpeg is installed.

5. **File uploads**: Stored in temp directory, cleaned up after download.

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
  image.jpg                          POST /generate
```
