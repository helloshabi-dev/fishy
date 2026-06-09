const { contextBridge, ipcRenderer } = require('electron');

// Preload script for safe context isolation
window.addEventListener('DOMContentLoaded', () => {
  console.log('Fishy Wallpaper Loaded Successfully!');
});

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onGlobalMouseMove: (callback) => ipcRenderer.on('global-mouse-move', (event, data) => callback(data)),
  onToggleSettingsGlobal: (callback) => ipcRenderer.on('toggle-settings-global', () => callback()),
  setAutoStart: (enabled) => ipcRenderer.send('set-autostart', enabled),
  quitApp: () => ipcRenderer.send('quit-app')
});
