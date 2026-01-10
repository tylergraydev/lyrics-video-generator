// Preload script for Electron
// This runs in a sandboxed context before the renderer process

const { contextBridge } = require('electron');

// Expose any APIs to the renderer process here if needed
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
