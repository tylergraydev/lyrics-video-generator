#!/usr/bin/env python3
"""
Lyrics Video Generator - Web API
================================
Flask backend that handles file uploads and video generation.
"""

import os
import uuid
import json
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import our core library
from lyrics_video_app import (
    LyricsAligner, 
    LyricsVideoGenerator, 
    LyricsTimingData,
    generate_lyrics_video
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

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max


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
    """
    job_id = generate_job_id()
    job_folder = UPLOAD_FOLDER / job_id
    job_folder.mkdir(exist_ok=True)
    
    result = {'job_id': job_id, 'files': {}}
    
    # Handle audio file
    if 'audio' in request.files:
        audio = request.files['audio']
        if audio.filename and allowed_file(audio.filename, ALLOWED_AUDIO):
            filename = secure_filename(audio.filename)
            audio_path = job_folder / f"audio_{filename}"
            audio.save(audio_path)
            result['files']['audio'] = str(audio_path)
    
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

    Returns timing data JSON.
    """
    data = request.get_json()
    job_id = data.get('job_id')
    model_size = data.get('model_size', 'large-v2')
    
    if not job_id:
        return jsonify({'error': 'Missing job_id'}), 400
    
    job_folder = UPLOAD_FOLDER / job_id
    
    # Find uploaded files
    audio_files = list(job_folder.glob('audio_*'))
    lyrics_file = job_folder / 'lyrics.txt'
    
    if not audio_files:
        return jsonify({'error': 'No audio file found'}), 400
    if not lyrics_file.exists():
        return jsonify({'error': 'No lyrics file found'}), 400
    
    audio_path = str(audio_files[0])
    lyrics_text = lyrics_file.read_text()
    
    try:
        # Perform alignment
        aligner = LyricsAligner(model_size=model_size)
        timing_data = aligner.align_lyrics(audio_path, lyrics_text, f"Job {job_id}")
        
        # Save timing data
        timing_path = job_folder / 'timing.json'
        timing_data.to_json(str(timing_path))
        
        # Return timing data
        with open(timing_path) as f:
            timing_json = json.load(f)
        
        return jsonify({
            'success': True,
            'timing': timing_json
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        - audio: audio file
        - image: image file
        - timing: timing JSON file
    """
    job_id = generate_job_id()
    job_folder = UPLOAD_FOLDER / job_id
    job_folder.mkdir(exist_ok=True)

    result = {'job_id': job_id, 'files': {}}

    # Handle audio file
    if 'audio' in request.files:
        audio = request.files['audio']
        if audio.filename and allowed_file(audio.filename, ALLOWED_AUDIO):
            filename = secure_filename(audio.filename)
            audio_path = job_folder / f"audio_{filename}"
            audio.save(audio_path)
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


# Font name to system font path mapping
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


@app.route('/api/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    """Clean up job files."""
    import shutil
    
    job_folder = UPLOAD_FOLDER / job_id
    output_folder = OUTPUT_FOLDER / job_id
    
    if job_folder.exists():
        shutil.rmtree(job_folder)
    if output_folder.exists():
        shutil.rmtree(output_folder)
    
    return jsonify({'success': True})


# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 100MB.'}), 413


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("Lyrics Video Generator API")
    print("=" * 50)
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Output folder: {OUTPUT_FOLDER}")
    print("Starting server at http://localhost:5001")
    print("=" * 50)

    app.run(host='0.0.0.0', port=5001, debug=True)
