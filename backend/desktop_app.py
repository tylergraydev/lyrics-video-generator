#!/usr/bin/env python3
"""
Lyrics Video Generator - Desktop Application
=============================================
Launches the app as a native desktop window using PyWebView.
"""

# CRITICAL: Must be first before ANY other imports for PyInstaller on macOS
import sys
import multiprocessing
if __name__ == '__main__':
    multiprocessing.freeze_support()

import os
import threading
import socket
import time
import logging
from datetime import datetime
from pathlib import Path


def setup_logging():
    """Set up logging to both console and file."""
    # Create logs directory in user's home folder
    if sys.platform == 'win32':
        log_dir = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'LyricsVideoGenerator' / 'logs'
    else:
        log_dir = Path.home() / '.lyrics_video_generator' / 'logs'

    log_dir.mkdir(parents=True, exist_ok=True)

    # Create log file with timestamp
    log_file = log_dir / f'app_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

    # Also keep a 'latest.log' symlink/copy for easy access
    latest_log = log_dir / 'latest.log'

    # Set up logging format
    log_format = '%(asctime)s [%(levelname)s] %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'

    # Configure root logger
    logging.basicConfig(
        level=logging.DEBUG,
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )

    # Also write to latest.log
    try:
        latest_handler = logging.FileHandler(latest_log, mode='w', encoding='utf-8')
        latest_handler.setFormatter(logging.Formatter(log_format, date_format))
        logging.getLogger().addHandler(latest_handler)
    except Exception:
        pass  # Ignore if we can't create latest.log

    logger = logging.getLogger(__name__)
    logger.info(f"Log file: {log_file}")
    logger.info(f"Latest log: {latest_log}")

    return logger, log_file


# Set up logging immediately
logger, LOG_FILE = setup_logging()

# Ensure we can import from the backend directory
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    BASE_DIR = Path(sys._MEIPASS)
    BACKEND_DIR = BASE_DIR / 'backend'
else:
    # Running as script
    BACKEND_DIR = Path(__file__).parent
    BASE_DIR = BACKEND_DIR.parent

# Add backend to path for imports
sys.path.insert(0, str(BACKEND_DIR))

import webview
from werkzeug.serving import make_server


def find_free_port():
    """Find an available port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


def wait_for_server(port, timeout=30):
    """Wait for the server to start accepting connections."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=1):
                return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            time.sleep(0.1)
    return False


class ServerThread(threading.Thread):
    """Thread to run the Flask server."""

    def __init__(self, app, port):
        super().__init__(daemon=True)
        self.server = make_server('127.0.0.1', port, app, threaded=True)
        self.port = port

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()


def get_static_folder():
    """Get the path to the frontend static files."""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        static_path = BASE_DIR / 'frontend' / 'dist'
    else:
        # Running as script - use the frontend dist folder
        static_path = BASE_DIR / 'frontend' / 'dist'

    # Debug: Log static folder info
    logger.debug(f"Static folder: {static_path}")
    logger.debug(f"Static folder exists: {static_path.exists()}")
    if static_path.exists():
        try:
            files = list(static_path.iterdir())
            logger.debug(f"Static folder contents: {[f.name for f in files]}")
            assets_path = static_path / 'assets'
            if assets_path.exists():
                asset_files = list(assets_path.iterdir())
                logger.debug(f"Assets folder contents: {[f.name for f in asset_files]}")
        except Exception as e:
            logger.error(f"Error listing files: {e}")

    return str(static_path)


def create_app():
    """Create and configure the Flask app for desktop use."""
    # Import here to avoid circular imports
    from api_server import app

    # Update static folder to point to frontend build
    static_folder = get_static_folder()
    app.static_folder = static_folder
    app.static_url_path = ''

    # Override the root route to serve index.html
    @app.route('/')
    def serve_index():
        from flask import send_from_directory
        return send_from_directory(static_folder, 'index.html')

    # Serve static assets
    @app.route('/<path:path>')
    def serve_static(path):
        from flask import send_from_directory
        # Try to serve as static file first
        try:
            return send_from_directory(static_folder, path)
        except:
            # Fall back to index.html for SPA routing
            return send_from_directory(static_folder, 'index.html')

    return app


def main():
    """Main entry point for the desktop application."""
    logger.info("Starting Lyrics Video Generator...")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Platform: {sys.platform}")
    logger.info(f"Frozen: {getattr(sys, 'frozen', False)}")
    if getattr(sys, 'frozen', False):
        logger.info(f"Executable: {sys.executable}")
        logger.info(f"MEIPASS: {sys._MEIPASS}")

    # Find an available port
    port = find_free_port()
    logger.info(f"Using port {port}")

    # Create the Flask app
    app = create_app()

    # Start the server in a background thread
    server = ServerThread(app, port)
    server.start()

    # Wait for server to be ready
    if not wait_for_server(port):
        logger.error("Server failed to start")
        sys.exit(1)

    logger.info(f"Server started at http://127.0.0.1:{port}")

    # Create the webview window
    window = webview.create_window(
        title='Lyrics Video Generator',
        url=f'http://127.0.0.1:{port}',
        width=1400,
        height=900,
        min_size=(1024, 768),
        resizable=True,
        text_select=True,
    )

    def on_closing():
        """Cleanup when window is closed."""
        logger.info("Shutting down server...")
        server.shutdown()

    window.events.closing += on_closing

    # Start the webview (blocks until window is closed)
    webview.start(debug=False)

    logger.info("Application closed")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        # On Windows, keep the console open so user can see the error
        if sys.platform == 'win32':
            print(f"\n\nFatal error occurred. See log file for details:\n{LOG_FILE}\n")
            input("Press Enter to exit...")
        raise
