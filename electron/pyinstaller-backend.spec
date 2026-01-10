# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for the Flask backend (headless, no GUI).
This is spawned by Electron as a subprocess.
"""

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata

SPEC_DIR = Path(SPECPATH)
BACKEND_DIR = SPEC_DIR.parent / 'backend'

block_cipher = None

# Hidden imports for the ML stack
hidden_imports = [
    'flask',
    'flask_cors',
    'werkzeug',
    'werkzeug.serving',
    'jinja2',
    'whisperx',
    'faster_whisper',
    'ctranslate2',
    'torch',
    'torchaudio',
    'moviepy',
    'moviepy.editor',
    'PIL',
    'PIL.Image',
    'numpy',
    'scipy',
    'librosa',
    'soundfile',
    'audioread',
    'imageio',
    'imageio_ffmpeg',
    'proglog',
]

# Collect submodules
hidden_imports += collect_submodules('torch')
hidden_imports += collect_submodules('torchaudio')
hidden_imports += collect_submodules('whisperx')
hidden_imports += collect_submodules('moviepy')
hidden_imports += collect_submodules('ctranslate2')
hidden_imports += collect_submodules('librosa')
hidden_imports += collect_submodules('imageio')
hidden_imports += collect_submodules('imageio_ffmpeg')

# Data files
datas = []
datas += collect_data_files('torch')
datas += collect_data_files('torchaudio')
datas += collect_data_files('whisperx')
datas += collect_data_files('ctranslate2')
datas += collect_data_files('imageio')
datas += collect_data_files('imageio_ffmpeg')

# Package metadata (needed for packages that use importlib.metadata)
datas += copy_metadata('imageio')
datas += copy_metadata('imageio_ffmpeg')
datas += copy_metadata('moviepy')
datas += copy_metadata('flask')
datas += copy_metadata('librosa')

a = Analysis(
    [str(BACKEND_DIR / 'api_server.py')],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'IPython',
        'notebook',
        'pytest',
        'webview',  # Exclude PyWebView - not needed
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='api_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Keep console for logging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='api_server',
)
