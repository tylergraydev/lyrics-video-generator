@echo off
REM Build script for Windows
REM Usage: build.bat [--clean]

echo ========================================
echo Lyrics Video Generator - Windows Build
echo ========================================

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

REM Run the Python build script
python build.py %*
