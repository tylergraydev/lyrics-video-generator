#!/usr/bin/env python3
"""
Lyrics Video Generator - Desktop Application
=============================================
Launches the app as a native desktop window using PyWebView.
"""

import sys
import os
import threading
import socket
import time
from pathlib import Path

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
        return str(BASE_DIR / 'frontend' / 'dist')
    else:
        # Running as script - use the frontend dist folder
        return str(BASE_DIR / 'frontend' / 'dist')


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
    print("Starting Lyrics Video Generator...")

    # Find an available port
    port = find_free_port()
    print(f"Using port {port}")

    # Create the Flask app
    app = create_app()

    # Start the server in a background thread
    server = ServerThread(app, port)
    server.start()

    # Wait for server to be ready
    if not wait_for_server(port):
        print("Error: Server failed to start")
        sys.exit(1)

    print(f"Server started at http://127.0.0.1:{port}")

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
        print("Shutting down server...")
        server.shutdown()

    window.events.closing += on_closing

    # Start the webview (blocks until window is closed)
    webview.start(debug=False)

    print("Application closed")


if __name__ == '__main__':
    main()
