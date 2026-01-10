#!/bin/bash
# Build script for Lyrics Video Generator
# Creates cross-platform installers using Electron + Python

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Lyrics Video Generator - Full Build"
echo "============================================"

# Detect OS
case "$(uname -s)" in
    Darwin*)    OS="mac" ;;
    Linux*)     OS="linux" ;;
    MINGW*|CYGWIN*|MSYS*) OS="win" ;;
    *)          OS="unknown" ;;
esac

echo "Detected OS: $OS"
echo ""

# Step 1: Build Frontend
echo ">>> Step 1: Building frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build
echo "Frontend built successfully"
echo ""

# Step 2: Build Python Backend with PyInstaller
echo ">>> Step 2: Building Python backend..."
cd "$PROJECT_ROOT"

# Create output directory
mkdir -p "$PROJECT_ROOT/backend-dist/$OS"

# Run PyInstaller
python3 -m PyInstaller \
    --clean \
    --noconfirm \
    --distpath "$PROJECT_ROOT/backend-dist/$OS" \
    --workpath "$PROJECT_ROOT/build/pyinstaller" \
    "$SCRIPT_DIR/pyinstaller-backend.spec"

echo "Python backend built successfully"
echo ""

# Step 3: Install Electron dependencies
echo ">>> Step 3: Installing Electron dependencies..."
cd "$SCRIPT_DIR"
npm install
echo ""

# Step 4: Build Electron app
echo ">>> Step 4: Building Electron installer..."
if [ "$OS" = "mac" ]; then
    npm run build:mac
elif [ "$OS" = "win" ]; then
    npm run build:win
elif [ "$OS" = "linux" ]; then
    npm run build:linux
else
    echo "Unknown OS, building for current platform..."
    npm run build
fi

echo ""
echo "============================================"
echo "  Build Complete!"
echo "============================================"
echo ""
echo "Installers are in: $SCRIPT_DIR/dist/"
ls -la "$SCRIPT_DIR/dist/" 2>/dev/null || echo "(dist folder will be created)"
