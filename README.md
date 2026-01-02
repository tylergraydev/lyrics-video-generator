# Lyrics Video Generator

Create synchronized lyrics videos from any song. Upload your audio, paste the lyrics, add a background image, and get a professional lyrics video with accurate word timing.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Web-lightgrey.svg)

## Features

- **AI-Powered Sync**: Uses WhisperX with forced alignment for ~50ms word-level accuracy
- **Visual Timeline Editor**: Drag words and lines to fine-tune timing
- **Customizable Styling**: Fonts, colors, sizes, and positioning
- **Multiple Languages**: Supports 99+ languages via Whisper
- **Export to MP4**: High-quality video output in any resolution
- **Desktop App**: Native application for macOS and Windows

## Download Desktop App

Get the latest release from the [Releases page](../../releases).

| Platform | Download |
|----------|----------|
| macOS | `Lyrics-Video-Generator-macOS.dmg` |
| Windows | `Lyrics-Video-Generator-Windows.zip` |

### Installation

**macOS:**
1. Download the `.dmg` file
2. Open and drag to Applications
3. First launch: Right-click → Open (to bypass Gatekeeper)

**Windows:**
1. Download and extract the `.zip` file
2. Run `Lyrics Video Generator.exe`
3. Allow through Windows SmartScreen if prompted

---

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- FFmpeg: `apt install ffmpeg` (Linux) or `brew install ffmpeg` (Mac)
- CUDA GPU recommended (CPU works but is slow)

### Run Locally

**1. Backend:**
```bash
cd backend
pip install -r requirements.txt
python api_server.py  # Runs on http://localhost:5001
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
- **Desktop**: PyWebView, PyInstaller
- **AI**: Whisper + wav2vec2 forced alignment

## Building Desktop App

See [BUILD.md](BUILD.md) for detailed instructions.

```bash
# Install build dependencies
pip install -r backend/requirements-desktop.txt

# Build for current platform
python build.py
```

Output:
- macOS: `dist/Lyrics Video Generator.app`
- Windows: `dist/Lyrics Video Generator.exe`

## System Requirements

| | Minimum | Recommended |
|---|---------|-------------|
| RAM | 8 GB | 16 GB |
| Storage | 4 GB | 8 GB |
| GPU | - | NVIDIA with CUDA |

## Troubleshooting

**macOS: "App is damaged"**
```bash
xattr -cr "/Applications/Lyrics Video Generator.app"
```

**Slow processing**: Use a smaller Whisper model (`--model base` instead of `large-v2`)

**Video generation fails**: Ensure ffmpeg is installed and check disk space

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
