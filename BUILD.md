# Building the Desktop Application

This guide explains how to package the Lyrics Video Generator as a standalone desktop application for macOS and Windows.

## Prerequisites

### All Platforms
- Python 3.10+
- Node.js 18+
- npm

### Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-desktop.txt
```

### Platform-Specific Requirements

**macOS:**
- No additional requirements (uses system WebKit)

**Windows:**
- Microsoft Edge WebView2 Runtime (usually pre-installed on Windows 10/11)
- If building on Windows, you may need Visual C++ Build Tools

## Building

### Quick Build (Current Platform)

```bash
# macOS
./build.sh

# Windows
build.bat

# Or cross-platform:
python build.py
```

### Clean Build

```bash
python build.py --clean
```

### What the Build Does

1. **Builds the React frontend** → `frontend/dist/`
2. **Packages with PyInstaller** → `dist/`
   - macOS: Creates `Lyrics Video Generator.app`
   - Windows: Creates `Lyrics Video Generator.exe`

## Output

After a successful build:

| Platform | Output | Location |
|----------|--------|----------|
| macOS | App bundle | `dist/Lyrics Video Generator.app` |
| Windows | Executable | `dist/Lyrics Video Generator.exe` |

## Distribution

### macOS

Option 1: Zip the app bundle
```bash
cd dist
zip -r "Lyrics Video Generator.zip" "Lyrics Video Generator.app"
```

Option 2: Create a DMG (requires create-dmg)
```bash
brew install create-dmg
create-dmg \
  --volname "Lyrics Video Generator" \
  --window-size 600 400 \
  --icon "Lyrics Video Generator.app" 150 200 \
  --app-drop-link 450 200 \
  "Lyrics Video Generator.dmg" \
  "dist/Lyrics Video Generator.app"
```

### Windows

Option 1: Zip the executable
```cmd
cd dist
powershell Compress-Archive -Path "Lyrics Video Generator.exe" -DestinationPath "Lyrics Video Generator.zip"
```

Option 2: Create an installer with Inno Setup or NSIS

## Cross-Platform Building

To build for both platforms, you need to build ON each platform:

1. **Build macOS version** on a Mac
2. **Build Windows version** on Windows (or in a Windows VM/CI)

PyInstaller cannot cross-compile.

## Troubleshooting

### Build Errors

**"ModuleNotFoundError"**
- Make sure all dependencies are installed: `pip install -r requirements.txt -r requirements-desktop.txt`

**"pywebview not found"**
- Install it: `pip install pywebview`

**Large file size (3-5 GB)**
- This is expected due to PyTorch/WhisperX. These AI models are large.
- To reduce size, you could use a smaller Whisper model or move inference to a cloud service.

### Runtime Errors

**"Could not start server"**
- Check if another instance is running
- Check firewall settings

**Windows: "WebView2 not found"**
- Install Microsoft Edge WebView2 Runtime from Microsoft

**macOS: "App is damaged"**
- This happens with unsigned apps. Run: `xattr -cr "Lyrics Video Generator.app"`

## Development Mode

For development, run the frontend and backend separately:

```bash
# Terminal 1: Backend
cd backend
python api_server.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

Or test the desktop app without building:

```bash
cd backend
python desktop_app.py
```
