const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.info('App starting...');

let mainWindow;
let pythonProcess;
const PORT = 5001;

// Get the path to resources based on whether we're in dev or production
function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', relativePath);
}

// Get the Python executable path
function getPythonPath() {
  const platform = process.platform;

  if (app.isPackaged) {
    // Production: use bundled Python executable
    // PyInstaller creates a folder with the executable inside
    if (platform === 'win32') {
      return path.join(process.resourcesPath, 'backend', 'api_server', 'api_server.exe');
    } else {
      return path.join(process.resourcesPath, 'backend', 'api_server', 'api_server');
    }
  } else {
    // Development: use system Python
    return null; // Will use python3 command
  }
}

// Start the Python backend server
function startPythonBackend() {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();

    if (pythonPath) {
      // Production: run bundled executable
      log.info(`Starting bundled Python backend: ${pythonPath}`);
      pythonProcess = spawn(pythonPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ELECTRON_RUN: '1' }
      });
    } else {
      // Development: run with python3
      const scriptPath = path.join(__dirname, '..', 'backend', 'api_server.py');
      log.info(`Starting Python backend in dev mode: ${scriptPath}`);
      pythonProcess = spawn('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ELECTRON_RUN: '1' }
      });
    }

    pythonProcess.stdout.on('data', (data) => {
      log.info(`Python: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      log.error(`Python Error: ${data}`);
    });

    pythonProcess.on('error', (err) => {
      log.error('Failed to start Python backend:', err);
      reject(err);
    });

    pythonProcess.on('close', (code) => {
      log.info(`Python backend exited with code ${code}`);
      pythonProcess = null;
    });

    // Wait for server to be ready
    waitForServer(PORT, 60000)
      .then(() => {
        log.info('Python backend is ready');
        resolve();
      })
      .catch(reject);
  });
}

// Wait for the server to start accepting connections
function waitForServer(port, timeout) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function check() {
      const req = http.request({
        host: '127.0.0.1',
        port: port,
        path: '/api/health',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(check, 500);
        }
      });

      req.end();
    }

    check();
  });
}

// Stop the Python backend
function stopPythonBackend() {
  if (pythonProcess) {
    log.info('Stopping Python backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#1a1a2e'
  });

  // Load the app
  if (app.isPackaged) {
    // Production: load from bundled frontend
    const frontendPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(frontendPath);
  } else {
    // Development: load from Flask server
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    await startPythonBackend();
    createWindow();
  } catch (err) {
    log.error('Failed to start application:', err);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the application backend.\n\n${err.message}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopPythonBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
  stopPythonBackend();
});
