#!/usr/bin/env python3
"""
Lyrics Video Generator - Web API
================================
Flask backend that handles file uploads and video generation.
"""

import os
import sys
import uuid
import json
import time
import shutil
import tempfile
import threading
import logging
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Set up logging to file (works even when console=False on Windows)
def setup_api_logging():
    """Set up file logging for the API server."""
    if sys.platform == 'win32':
        log_dir = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'LyricsVideoGenerator' / 'logs'
    else:
        log_dir = Path.home() / '.lyrics_video_generator' / 'logs'

    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / 'api_server.log'

    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__), log_file

logger, API_LOG_FILE = setup_api_logging()
logger.info(f"API server starting - log file: {API_LOG_FILE}")

# Import project manager
from projects import ProjectManager

# Import our core library
from lyrics_video_app import (
    LyricsAligner,
    LyricsVideoGenerator,
    LyricsTimingData,
    generate_lyrics_video,
    extract_waveform_peaks
)

app = Flask(__name__, static_folder='web_ui/build', static_url_path='')
CORS(app)

# Configuration
UPLOAD_FOLDER = Path(tempfile.gettempdir()) / 'lyrics_video_uploads'
OUTPUT_FOLDER = Path(tempfile.gettempdir()) / 'lyrics_video_outputs'
ALLOWED_AUDIO = {'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'}
ALLOWED_IMAGE = {'jpg', 'jpeg', 'png', 'webp', 'gif'}

UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

# Initialize project manager
project_manager = ProjectManager()

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max

# Cleanup configuration
CLEANUP_MAX_AGE_HOURS = 24  # Remove files older than this


def cleanup_old_files(max_age_hours=CLEANUP_MAX_AGE_HOURS):
    """
    Remove job folders older than max_age_hours.
    Called on startup and periodically by background thread.
    """
    max_age_seconds = max_age_hours * 3600
    now = time.time()
    cleaned = 0

    for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
        if not folder.exists():
            continue

        for job_folder in folder.iterdir():
            if job_folder.is_dir():
                try:
                    mtime = job_folder.stat().st_mtime
                    if now - mtime > max_age_seconds:
                        shutil.rmtree(job_folder)
                        cleaned += 1
                        print(f"[Cleanup] Removed old job: {job_folder.name}")
                except Exception as e:
                    print(f"[Cleanup] Error removing {job_folder}: {e}")

    return cleaned


def cleanup_thread():
    """Background thread that cleans old files every hour."""
    while True:
        time.sleep(3600)  # 1 hour
        try:
            cleaned = cleanup_old_files()
            if cleaned > 0:
                print(f"[Cleanup] Background cleanup removed {cleaned} old job(s)")
        except Exception as e:
            print(f"[Cleanup] Background cleanup error: {e}")


def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def generate_job_id():
    return str(uuid.uuid4())[:8]


@app.route('/')
def serve_app():
    """Serve the React frontend."""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/api/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'lyrics-video-generator'})


@app.route('/api/upload', methods=['POST'])
def upload_files():
    """
    Upload audio, image, and lyrics files.
    Returns a job ID for tracking the processing.

    Supports two audio files:
    - 'audio' or 'video_audio': Audio for the final video (full mix)
    - 'alignment_audio': Vocals-only audio for better alignment accuracy (optional)

    If only 'audio' is provided, it's used for both alignment and video.
    """
    job_id = generate_job_id()
    job_folder = UPLOAD_FOLDER / job_id
    job_folder.mkdir(exist_ok=True)

    result = {'job_id': job_id, 'files': {}}

    # Handle main audio file (used for video, and alignment if no separate alignment audio)
    # Accept either 'audio' or 'video_audio' for the main audio
    audio_file = request.files.get('audio') or request.files.get('video_audio')
    if audio_file and audio_file.filename and allowed_file(audio_file.filename, ALLOWED_AUDIO):
        filename = secure_filename(audio_file.filename)
        audio_path = job_folder / f"audio_{filename}"
        audio_file.save(audio_path)
        result['files']['audio'] = str(audio_path)

    # Handle alignment audio (vocals-only for better transcription accuracy)
    if 'alignment_audio' in request.files:
        align_audio = request.files['alignment_audio']
        if align_audio.filename and allowed_file(align_audio.filename, ALLOWED_AUDIO):
            filename = secure_filename(align_audio.filename)
            align_audio_path = job_folder / f"alignment_audio_{filename}"
            align_audio.save(align_audio_path)
            result['files']['alignment_audio'] = str(align_audio_path)

    # Handle image file
    if 'image' in request.files:
        image = request.files['image']
        if image.filename and allowed_file(image.filename, ALLOWED_IMAGE):
            filename = secure_filename(image.filename)
            image_path = job_folder / f"image_{filename}"
            image.save(image_path)
            result['files']['image'] = str(image_path)

    # Handle lyrics (as text in form data)
    if 'lyrics' in request.form:
        lyrics_text = request.form['lyrics']
        lyrics_path = job_folder / 'lyrics.txt'
        lyrics_path.write_text(lyrics_text)
        result['files']['lyrics'] = str(lyrics_path)

    return jsonify(result)


@app.route('/api/align', methods=['POST'])
def align_lyrics():
    """
    Align lyrics with audio using Whisper.

    Request body:
        {
            "job_id": "abc123",
            "model_size": "small"  // optional, defaults to 'small' for good accuracy
        }

    Uses alignment_audio if available (vocals-only for better accuracy),
    otherwise falls back to the main audio file.

    Returns timing data JSON.
    """
    data = request.get_json()
    job_id = data.get('job_id')
    model_size = data.get('model_size', 'large-v2')

    if not job_id:
        return jsonify({'error': 'Missing job_id'}), 400

    job_folder = UPLOAD_FOLDER / job_id

    # Find uploaded files - prefer alignment_audio for transcription
    alignment_audio_files = list(job_folder.glob('alignment_audio_*'))
    audio_files = list(job_folder.glob('audio_*'))
    lyrics_file = job_folder / 'lyrics.txt'

    # Use alignment audio if available, otherwise use main audio
    if alignment_audio_files:
        audio_path = str(alignment_audio_files[0])
        print(f"Using alignment audio for transcription: {audio_path}")
    elif audio_files:
        audio_path = str(audio_files[0])
        print(f"Using main audio for transcription: {audio_path}")
    else:
        return jsonify({'error': 'No audio file found'}), 400

    if not lyrics_file.exists():
        return jsonify({'error': 'No lyrics file found'}), 400

    lyrics_text = lyrics_file.read_text()

    try:
        # Perform alignment
        logger.info(f"Starting alignment for job {job_id}")
        logger.info(f"Audio path: {audio_path}")
        logger.info(f"Model size: {model_size}")
        logger.info(f"Lyrics length: {len(lyrics_text)} chars")

        logger.info("Creating LyricsAligner...")
        aligner = LyricsAligner(model_size=model_size)
        logger.info("LyricsAligner created successfully")

        logger.info("Starting align_lyrics...")
        timing_data = aligner.align_lyrics(audio_path, lyrics_text, f"Job {job_id}")
        logger.info("Alignment completed successfully")

        # Save timing data
        timing_path = job_folder / 'timing.json'
        timing_data.to_json(str(timing_path))

        # Return timing data
        with open(timing_path) as f:
            timing_json = json.load(f)

        # Extract waveform for visualization
        waveform = None
        try:
            waveform = extract_waveform_peaks(audio_path)
            if waveform:
                # Save waveform for later retrieval
                waveform_path = job_folder / 'waveform.json'
                with open(waveform_path, 'w') as f:
                    json.dump(waveform, f)
        except Exception as wf_err:
            logger.warning(f"Could not extract waveform: {wf_err}")

        return jsonify({
            'success': True,
            'timing': timing_json,
            'waveform': waveform
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Alignment failed: {e}")
        logger.error(f"Full traceback:\n{error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 500


@app.route('/api/timing/<job_id>', methods=['GET', 'PUT'])
def manage_timing(job_id):
    """Get or update timing data for a job."""
    job_folder = UPLOAD_FOLDER / job_id
    timing_path = job_folder / 'timing.json'

    if request.method == 'GET':
        if not timing_path.exists():
            return jsonify({'error': 'Timing data not found'}), 404

        with open(timing_path) as f:
            return jsonify(json.load(f))

    elif request.method == 'PUT':
        # Update timing data
        timing_data = request.get_json()
        with open(timing_path, 'w') as f:
            json.dump(timing_data, f, indent=2)

        return jsonify({'success': True})


@app.route('/api/import-timing', methods=['POST'])
def import_timing():
    """
    Import a timing JSON file directly, skipping the alignment step.
    Expects FormData with:
        - audio (or video_audio): audio file for the final video
        - image: image file
        - timing: timing JSON file
    """
    job_id = generate_job_id()
    job_folder = UPLOAD_FOLDER / job_id
    job_folder.mkdir(exist_ok=True)

    result = {'job_id': job_id, 'files': {}}

    # Handle audio file (accept either 'audio' or 'video_audio')
    audio_file = request.files.get('audio') or request.files.get('video_audio')
    if audio_file and audio_file.filename and allowed_file(audio_file.filename, ALLOWED_AUDIO):
        filename = secure_filename(audio_file.filename)
        audio_path = job_folder / f"audio_{filename}"
        audio_file.save(audio_path)
        result['files']['audio'] = str(audio_path)
    else:
        return jsonify({'error': 'Audio file required'}), 400

    # Handle image file
    if 'image' in request.files:
        image = request.files['image']
        if image.filename and allowed_file(image.filename, ALLOWED_IMAGE):
            filename = secure_filename(image.filename)
            image_path = job_folder / f"image_{filename}"
            image.save(image_path)
            result['files']['image'] = str(image_path)
    else:
        return jsonify({'error': 'Image file required'}), 400

    # Handle timing JSON file
    if 'timing' in request.files:
        timing_file = request.files['timing']
        if timing_file.filename:
            try:
                timing_data = json.load(timing_file)
                # Validate basic structure
                if 'lines' not in timing_data or 'duration' not in timing_data:
                    return jsonify({'error': 'Invalid timing JSON: missing "lines" or "duration"'}), 400

                timing_path = job_folder / 'timing.json'
                with open(timing_path, 'w') as f:
                    json.dump(timing_data, f, indent=2)
                result['files']['timing'] = str(timing_path)
                result['timing'] = timing_data
            except json.JSONDecodeError as e:
                return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    else:
        return jsonify({'error': 'Timing JSON file required'}), 400

    return jsonify(result)


# Font name to system font path mapping (platform-specific)
if sys.platform == 'win32':
    # Windows font paths (C:\Windows\Fonts)
    FONT_MAP = {
        'Arial': 'C:/Windows/Fonts/arialbd.ttf',
        'Impact': 'C:/Windows/Fonts/impact.ttf',
        'Georgia': 'C:/Windows/Fonts/georgiab.ttf',
        'Verdana': 'C:/Windows/Fonts/verdanab.ttf',
        'Times New Roman': 'C:/Windows/Fonts/timesbd.ttf',
        'Courier New': 'C:/Windows/Fonts/courbd.ttf',
        'Trebuchet MS': 'C:/Windows/Fonts/trebucbd.ttf',
        'Comic Sans MS': 'C:/Windows/Fonts/comicbd.ttf',
    }
else:
    # macOS font paths
    FONT_MAP = {
        'Arial': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        'Impact': '/System/Library/Fonts/Supplemental/Impact.ttf',
        'Georgia': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
        'Verdana': '/System/Library/Fonts/Supplemental/Verdana Bold.ttf',
        'Times New Roman': '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf',
        'Courier New': '/System/Library/Fonts/Courier New Bold.ttf',
        'Trebuchet MS': '/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf',
        'Comic Sans MS': '/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf',
    }


@app.route('/api/generate', methods=['POST'])
def generate_video():
    """
    Generate the final video.

    Request body:
        {
            "job_id": "abc123",
            "settings": {
                "font_size": 60,
                "font": "Arial",
                "text_color": "white",
                "resolution": "1920x1080",
                "custom_position": {"x": 0.5, "y": 0.5},  // optional, normalized 0-1
                "fps": 24
            }
        }
    """
    data = request.get_json()
    job_id = data.get('job_id')
    settings = data.get('settings', {})

    if not job_id:
        return jsonify({'error': 'Missing job_id'}), 400

    job_folder = UPLOAD_FOLDER / job_id
    output_folder = OUTPUT_FOLDER / job_id
    output_folder.mkdir(exist_ok=True)

    # Find files
    audio_files = list(job_folder.glob('audio_*'))
    image_files = list(job_folder.glob('image_*'))
    timing_file = job_folder / 'timing.json'

    if not all([audio_files, image_files, timing_file.exists()]):
        return jsonify({'error': 'Missing required files'}), 400

    audio_path = str(audio_files[0])
    image_path = str(image_files[0])
    output_path = str(output_folder / 'output.mp4')

    try:
        # Load timing data
        timing_data = LyricsTimingData.from_json(str(timing_file))

        # Parse settings
        resolution = tuple(map(int, settings.get('resolution', '1920x1080').split('x')))

        # Get font path from font name
        font_name = settings.get('font', 'Arial')
        font_path = FONT_MAP.get(font_name, FONT_MAP['Arial'])

        # Calculate position and text width from text_box
        text_box = settings.get('text_box')
        text_width = None  # Width for text wrapping

        if text_box and isinstance(text_box, dict):
            # Convert normalized 0-1 coordinates to pixel position
            x_pos = int(text_box.get('x', 0.5) * resolution[0])
            y_pos = int(text_box.get('y', 0.5) * resolution[1])
            position = (x_pos, y_pos)
            # Calculate text width for wrapping (with some padding)
            text_width = int(text_box.get('width', 0.8) * resolution[0] * 0.95)
        else:
            # Default centered position with 80% width
            position = ('center', 'center')
            text_width = int(resolution[0] * 0.8)

        # Create generator with settings
        generator = LyricsVideoGenerator(
            font=font_path,
            font_size=settings.get('font_size', 60),
            text_color=settings.get('text_color', 'white'),
            highlight_color=settings.get('highlight_color', 'yellow'),
            stroke_color=settings.get('stroke_color', 'black'),
            stroke_width=settings.get('stroke_width', 3),
            position=position,
            text_width=text_width
        )

        # Generate video
        generator.generate_video(
            timing_data=timing_data,
            audio_path=audio_path,
            image_path=image_path,
            output_path=output_path,
            resolution=resolution,
            fps=settings.get('fps', 24)
        )

        return jsonify({
            'success': True,
            'output_path': output_path,
            'download_url': f'/api/download/{job_id}/output.mp4'
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/download/<job_id>/<filename>')
def download_file(job_id, filename):
    """Download a generated file."""
    output_folder = OUTPUT_FOLDER / job_id
    file_path = output_folder / secure_filename(filename)

    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/audio/<job_id>')
def get_audio(job_id):
    """Stream audio file for playback in timeline editor."""
    job_folder = UPLOAD_FOLDER / job_id
    audio_files = list(job_folder.glob('audio_*'))

    if not audio_files:
        return jsonify({'error': 'Audio file not found'}), 404

    return send_file(
        audio_files[0],
        mimetype='audio/mpeg'
    )


@app.route('/api/waveform/<job_id>')
def get_waveform(job_id):
    """
    Get waveform peaks for timeline visualization.
    Returns cached waveform if available, otherwise generates it.
    """
    job_folder = UPLOAD_FOLDER / job_id
    waveform_path = job_folder / 'waveform.json'

    # Return cached waveform if available
    if waveform_path.exists():
        with open(waveform_path) as f:
            return jsonify(json.load(f))

    # Generate waveform if not cached
    audio_files = list(job_folder.glob('audio_*'))
    if not audio_files:
        return jsonify({'error': 'Audio file not found'}), 404

    try:
        waveform = extract_waveform_peaks(str(audio_files[0]))
        if waveform:
            # Cache for future requests
            with open(waveform_path, 'w') as f:
                json.dump(waveform, f)
            return jsonify(waveform)
        else:
            return jsonify({'error': 'Could not extract waveform'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    """Clean up job files."""
    job_folder = UPLOAD_FOLDER / job_id
    output_folder = OUTPUT_FOLDER / job_id

    if job_folder.exists():
        shutil.rmtree(job_folder)
    if output_folder.exists():
        shutil.rmtree(output_folder)

    return jsonify({'success': True})


# =============================================================================
# Project Management Endpoints
# =============================================================================

@app.route('/api/projects', methods=['GET'])
def list_projects():
    """List all saved projects."""
    projects = project_manager.list_projects()
    return jsonify({'projects': projects})


@app.route('/api/projects', methods=['POST'])
def create_project():
    """
    Create a new project from an active job.

    Request body:
        {
            "name": "My Song",
            "job_id": "abc123",
            "settings": { ... },  // optional styling settings
            "waveform": { ... }   // optional waveform data
        }
    """
    data = request.get_json()
    name = data.get('name')
    job_id = data.get('job_id')
    settings = data.get('settings')
    waveform = data.get('waveform')

    if not name:
        return jsonify({'error': 'Project name is required'}), 400
    if not job_id:
        return jsonify({'error': 'job_id is required'}), 400

    job_folder = UPLOAD_FOLDER / job_id
    if not job_folder.exists():
        return jsonify({'error': 'Job not found'}), 404

    # Load timing data if exists
    timing_path = job_folder / 'timing.json'
    timing = None
    if timing_path.exists():
        with open(timing_path, 'r') as f:
            timing = json.load(f)

    # Load waveform if not provided and exists on disk
    if not waveform:
        waveform_path = job_folder / 'waveform.json'
        if waveform_path.exists():
            with open(waveform_path, 'r') as f:
                waveform = json.load(f)

    try:
        project = project_manager.create_project(
            name=name,
            job_dir=job_folder,
            timing=timing,
            settings=settings,
            waveform=waveform,
        )
        return jsonify({'success': True, 'project': project})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get full project data including timing and settings."""
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project)


@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """
    Update project data.

    Request body (all fields optional):
        {
            "name": "New Name",
            "timing": { ... },
            "settings": { ... },
            "status": "completed"
        }
    """
    data = request.get_json()

    project = project_manager.update_project(
        project_id=project_id,
        name=data.get('name'),
        timing=data.get('timing'),
        settings=data.get('settings'),
        status=data.get('status'),
    )

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    return jsonify({'success': True, 'project': project})


@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project and all its files."""
    success = project_manager.delete_project(project_id)
    if not success:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify({'success': True})


@app.route('/api/projects/<project_id>/open', methods=['POST'])
def open_project(project_id):
    """
    Load a project into a temp job for editing.

    Creates a new job from the project files and returns
    the job_id along with timing, settings, and waveform data.
    """
    # Create a new job for this editing session
    job_id = generate_job_id()
    job_folder = UPLOAD_FOLDER / job_id

    result = project_manager.open_project(project_id, job_folder)
    if not result:
        return jsonify({'error': 'Project not found'}), 404

    result['job_id'] = job_id
    return jsonify(result)


@app.route('/api/projects/<project_id>/audio', methods=['GET'])
def get_project_audio(project_id):
    """Stream audio file from project storage."""
    audio_path = project_manager.get_project_file_path(project_id, 'audio')
    if not audio_path:
        return jsonify({'error': 'Audio file not found'}), 404

    return send_file(audio_path, mimetype='audio/mpeg')


@app.route('/api/projects/<project_id>/image', methods=['GET'])
def get_project_image(project_id):
    """Get background image from project storage."""
    image_path = project_manager.get_project_file_path(project_id, 'image')
    if not image_path:
        return jsonify({'error': 'Image file not found'}), 404

    # Determine mimetype from extension
    ext = image_path.suffix.lower()
    mimetypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
    }
    mimetype = mimetypes.get(ext, 'image/jpeg')

    return send_file(image_path, mimetype=mimetype)


# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 100MB.'}), 413


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Required for PyInstaller on macOS/Windows
    import multiprocessing
    multiprocessing.freeze_support()

    # Check if running from Electron
    is_electron = os.environ.get('ELECTRON_RUN') == '1'

    print("=" * 50)
    print("Lyrics Video Generator API")
    if is_electron:
        print("(Running as Electron backend)")
    print("=" * 50)
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Output folder: {OUTPUT_FOLDER}")

    # Run cleanup on startup
    print("[Startup] Cleaning old job files...")
    cleaned = cleanup_old_files()
    if cleaned > 0:
        print(f"[Startup] Removed {cleaned} old job(s)")
    else:
        print("[Startup] No old jobs to clean")

    # Start background cleanup thread
    cleanup = threading.Thread(target=cleanup_thread, daemon=True, name="CleanupThread")
    cleanup.start()
    print("[Startup] Background cleanup thread started (runs hourly)")

    print("Starting server at http://localhost:5001")
    print("=" * 50)
    sys.stdout.flush()

    # When running from Electron, disable debug/reloader to avoid subprocess issues
    if is_electron:
        app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)
    else:
        app.run(host='0.0.0.0', port=5001, debug=True)
