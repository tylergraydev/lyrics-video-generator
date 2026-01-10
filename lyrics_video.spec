# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Lyrics Video Generator
Build with: pyinstaller lyrics_video.spec
"""

import sys
import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata

# Determine the project root
SPEC_DIR = Path(SPECPATH)
PROJECT_ROOT = SPEC_DIR

block_cipher = None

# Collect all necessary data files and hidden imports
# WhisperX and related AI libraries have many hidden dependencies
hidden_imports = [
    # Flask and web
    'flask',
    'flask_cors',
    'werkzeug',
    'werkzeug.serving',
    'jinja2',

    # PyWebView
    'webview',

    # WhisperX dependencies
    'whisperx',
    'faster_whisper',
    'ctranslate2',

    # PyTorch (many hidden imports)
    'torch',
    'torchaudio',
    'torch.utils',
    'torch.utils.data',

    # MoviePy
    'moviepy',
    'moviepy.editor',
    'moviepy.video',
    'moviepy.audio',

    # Image processing
    'PIL',
    'PIL.Image',

    # Utilities
    'numpy',
    'scipy',
    'librosa',
    'soundfile',
    'audioread',
    'imageio',
    'imageio_ffmpeg',
    'proglog',

    # PyTorch Lightning (needed by pyannote)
    'pytorch_lightning',
    'lightning_fabric',
    'lightning_fabric.utilities',
    'pyannote',
    'pyannote.audio',
    'pyannote.core',
]

# Collect submodules for complex packages
hidden_imports += collect_submodules('torch')
hidden_imports += collect_submodules('torchaudio')
hidden_imports += collect_submodules('whisperx')
hidden_imports += collect_submodules('moviepy')
hidden_imports += collect_submodules('ctranslate2')
hidden_imports += collect_submodules('librosa')
hidden_imports += collect_submodules('imageio')
hidden_imports += collect_submodules('imageio_ffmpeg')
hidden_imports += collect_submodules('pytorch_lightning')
hidden_imports += collect_submodules('lightning_fabric')
hidden_imports += collect_submodules('pyannote')

# Data files to include
datas = [
    # Frontend build
    (str(PROJECT_ROOT / 'frontend' / 'dist'), 'frontend/dist'),

    # Backend Python files
    (str(PROJECT_ROOT / 'backend' / 'lyrics_video_app.py'), 'backend'),
    (str(PROJECT_ROOT / 'backend' / 'api_server.py'), 'backend'),
]

# Collect data files from packages that need them
datas += collect_data_files('torch')
datas += collect_data_files('torchaudio')
datas += collect_data_files('whisperx')
datas += collect_data_files('ctranslate2')
datas += collect_data_files('imageio')
datas += collect_data_files('imageio_ffmpeg')
datas += collect_data_files('lightning_fabric')
datas += collect_data_files('pytorch_lightning')
datas += collect_data_files('pyannote')

# Package metadata (needed for packages that use importlib.metadata)
# Be defensive - some packages may not have metadata on all platforms
def safe_copy_metadata(package):
    try:
        return copy_metadata(package)
    except Exception:
        return []

datas += safe_copy_metadata('imageio')
datas += safe_copy_metadata('imageio_ffmpeg')
datas += safe_copy_metadata('moviepy')
datas += safe_copy_metadata('flask')
datas += safe_copy_metadata('librosa')
datas += safe_copy_metadata('numpy')
datas += safe_copy_metadata('pillow')
datas += safe_copy_metadata('decorator')
datas += safe_copy_metadata('proglog')
datas += safe_copy_metadata('tqdm')
datas += safe_copy_metadata('scipy')
datas += safe_copy_metadata('soundfile')
datas += safe_copy_metadata('lightning_fabric')
datas += safe_copy_metadata('pytorch_lightning')
datas += safe_copy_metadata('pyannote.audio')
datas += safe_copy_metadata('pyannote.core')
datas += safe_copy_metadata('pyannote.pipeline')

# Analysis
a = Analysis(
    [str(PROJECT_ROOT / 'backend' / 'desktop_app.py')],
    pathex=[str(PROJECT_ROOT / 'backend')],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[str(PROJECT_ROOT / 'runtime_hook.py')],
    excludes=[
        # Exclude unnecessary modules to reduce size
        'tkinter',
        'matplotlib',
        'IPython',
        'notebook',
        'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# For macOS: Create an app bundle
if sys.platform == 'darwin':
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name='Lyrics Video Generator',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        console=False,  # No console window
        disable_windowed_traceback=False,
        argv_emulation=True,
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
        name='Lyrics Video Generator',
    )

    app = BUNDLE(
        coll,
        name='Lyrics Video Generator.app',
        icon=None,  # Add icon path here if you have one
        bundle_identifier='com.lyricsvideomaker.app',
        info_plist={
            'CFBundleName': 'Lyrics Video Generator',
            'CFBundleDisplayName': 'Lyrics Video Generator',
            'CFBundleVersion': '1.0.0',
            'CFBundleShortVersionString': '1.0.0',
            'NSHighResolutionCapable': True,
            'LSMinimumSystemVersion': '10.15',
        },
    )

# For Windows: Create a single executable
else:
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name='Lyrics Video Generator',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,  # No console window
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=None,  # Add .ico path here for Windows
    )
