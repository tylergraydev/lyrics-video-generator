#!/usr/bin/env python3
"""
Build script for Lyrics Video Generator desktop app.
Cross-platform build script that works on macOS and Windows.

Usage:
    python build.py           # Build for current platform
    python build.py --clean   # Clean build artifacts first
"""

import subprocess
import sys
import os
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
FRONTEND_DIR = PROJECT_ROOT / 'frontend'
BACKEND_DIR = PROJECT_ROOT / 'backend'
DIST_DIR = PROJECT_ROOT / 'dist'
BUILD_DIR = PROJECT_ROOT / 'build'


def run_command(cmd, cwd=None, check=True):
    """Run a command and print output."""
    print(f"\n>>> Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, check=check)
    return result.returncode == 0


def clean():
    """Remove build artifacts."""
    print("\n=== Cleaning build artifacts ===")
    for folder in [DIST_DIR, BUILD_DIR]:
        if folder.exists():
            print(f"Removing {folder}")
            shutil.rmtree(folder)


def check_dependencies():
    """Check that required tools are installed."""
    print("\n=== Checking dependencies ===")

    # Check Node.js
    try:
        subprocess.run(['node', '--version'], capture_output=True, check=True)
        print("Node.js: OK")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: Node.js not found. Install from https://nodejs.org")
        return False

    # Check npm
    try:
        subprocess.run(['npm', '--version'], capture_output=True, check=True)
        print("npm: OK")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: npm not found")
        return False

    # Check Python packages
    required_packages = ['pyinstaller', 'webview', 'flask']
    for pkg in required_packages:
        try:
            __import__(pkg if pkg != 'webview' else 'webview')
            print(f"{pkg}: OK")
        except ImportError:
            print(f"ERROR: {pkg} not installed. Run: pip install {pkg}")
            return False

    return True


def build_frontend():
    """Build the React frontend."""
    print("\n=== Building frontend ===")

    # Install dependencies if needed
    node_modules = FRONTEND_DIR / 'node_modules'
    if not node_modules.exists():
        print("Installing npm dependencies...")
        if not run_command(['npm', 'install'], cwd=FRONTEND_DIR):
            return False

    # Build the frontend
    print("Building React app...")
    return run_command(['npm', 'run', 'build'], cwd=FRONTEND_DIR)


def build_desktop_app():
    """Build the desktop application with PyInstaller."""
    print("\n=== Building desktop application ===")

    spec_file = PROJECT_ROOT / 'lyrics_video.spec'
    if not spec_file.exists():
        print(f"ERROR: Spec file not found: {spec_file}")
        return False

    return run_command([
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--noconfirm',
        str(spec_file)
    ], cwd=PROJECT_ROOT)


def post_build_info():
    """Print post-build information."""
    print("\n" + "=" * 60)
    print("BUILD COMPLETE!")
    print("=" * 60)

    if sys.platform == 'darwin':
        app_path = DIST_DIR / 'Lyrics Video Generator.app'
        if app_path.exists():
            print(f"\nmacOS app bundle: {app_path}")
            print("\nTo run: open 'dist/Lyrics Video Generator.app'")
            print("To distribute: zip the .app bundle or create a DMG")
    else:
        exe_path = DIST_DIR / 'Lyrics Video Generator.exe'
        if exe_path.exists():
            print(f"\nWindows executable: {exe_path}")
            print("\nTo run: double-click the .exe file")
            print("To distribute: zip the executable or create an installer with NSIS/Inno Setup")

    print("\n" + "=" * 60)


def main():
    """Main build process."""
    print("=" * 60)
    print("Lyrics Video Generator - Desktop Build")
    print("=" * 60)

    # Parse arguments
    if '--clean' in sys.argv:
        clean()

    # Check dependencies
    if not check_dependencies():
        print("\nERROR: Missing dependencies. Install them and try again.")
        sys.exit(1)

    # Build frontend
    if not build_frontend():
        print("\nERROR: Frontend build failed")
        sys.exit(1)

    # Build desktop app
    if not build_desktop_app():
        print("\nERROR: Desktop app build failed")
        sys.exit(1)

    post_build_info()


if __name__ == '__main__':
    main()
