const { app, BrowserWindow, screen, globalShortcut, ipcMain, shell, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

// Optimize memory usage by disabling unnecessary Chromium subsystems
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow;

function createWallpaperWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const winOptions = {
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  if (process.platform === 'win32') {
    winOptions.type = 'desktop';
  }

  mainWindow = new BrowserWindow(winOptions);

  // Make it cover the absolute entire screen, not just the work area (ignoring taskbars/menu bars)
  const bounds = primaryDisplay.bounds;
  mainWindow.setBounds(bounds);

  // Platform specific configurations for perfect background placement
  if (process.platform === 'darwin') {
    // On macOS, set window level to desktop so it sits behind desktop icons
    mainWindow.setAlwaysOnTop(true, 'desktop', -1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else if (process.platform === 'win32') {
    // On Windows, skipTaskbar and always-on-bottom are handled by type: 'desktop'
    mainWindow.setAlwaysOnTop(false);
  }

  // Load the index.html from our local build
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    // Send initial power state to trigger throttling / pause early if needed
    let isLocked = false;
    try {
      isLocked = powerMonitor.isLockedScreen();
    } catch (e) {}
    mainWindow.webContents.send('power-state-change', {
      isOnBattery: powerMonitor.isOnBatteryPower(),
      isLocked: isLocked
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWallpaperWindow();

  // Register IPC message channel to dynamically ignore mouse events for true desktop click-through
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });

  ipcMain.on('set-settings-panel-open', (event, isOpen) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (isOpen) {
        if (process.platform === 'darwin') {
          mainWindow.setAlwaysOnTop(true, 'floating');
        }
        mainWindow.focus();
      } else {
        if (process.platform === 'darwin') {
          mainWindow.setAlwaysOnTop(true, 'desktop', -1);
        }
      }
    }
  });

  // Register IPC channel to configure application autostart on login dynamically
  ipcMain.on('set-autostart', (event, enabled) => {
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe')
      });
    }
  });

  // Profiles Folder Directory & IPC Handlers
  const profilesDir = path.join(app.getPath('userData'), 'profiles');
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  ipcMain.on('open-profiles-folder', () => {
    shell.openPath(profilesDir);
  });

  ipcMain.handle('save-profile-file', async (event, profile) => {
    try {
      const safeName = (profile.name || 'Fish').replace(/[^a-zA-Z0-9_-]/g, '_');
      
      // 1. Determine a unique, collision-free filename
      let baseName = safeName;
      let counter = 1;
      let newFilename = `${baseName}.json`;
      let newFilePath = path.join(profilesDir, newFilename);

      while (fs.existsSync(newFilePath)) {
        try {
          const existingData = JSON.parse(fs.readFileSync(newFilePath, 'utf8'));
          if (existingData.id === profile.id) {
            // It's the same fish, safe to overwrite
            break;
          }
        } catch (e) {
          // If file is corrupted, safe to overwrite
          break;
        }
        // Collision with a different fish! Suffix it
        counter++;
        newFilename = `${baseName}_${counter}.json`;
        newFilePath = path.join(profilesDir, newFilename);
      }

      // 2. Clean up any old files that belonged to this fish ID (e.g. from renaming)
      const files = fs.readdirSync(profilesDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== newFilename) {
          const filePath = path.join(profilesDir, file);
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed && parsed.id === profile.id) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            // Ignore corrupted/read-error files
          }
        }
      }

      fs.writeFileSync(newFilePath, JSON.stringify(profile, null, 2), 'utf8');
      return { success: true, filename: newFilename };
    } catch (err) {
      console.error('Failed to save profile file:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-profile-file', async (event, id) => {
    try {
      const files = fs.readdirSync(profilesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(profilesDir, file);
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed && parsed.id === id) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
      return { success: true };
    } catch (err) {
      console.error('Failed to delete profile file:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('load-profile-files', async () => {
    try {
      if (!fs.existsSync(profilesDir)) {
        fs.mkdirSync(profilesDir, { recursive: true });
      }
      const profiles = [];
      const files = fs.readdirSync(profilesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = fs.readFileSync(path.join(profilesDir, file), 'utf8');
            const profile = JSON.parse(data);
            if (profile) {
              if (!profile.id) {
                profile.id = 'fish_' + Math.random().toString(36).substr(2, 9);
              }
              profiles.push(profile);
            }
          } catch (e) {
             console.error(`Failed to parse profile file ${file}:`, e);
          }
        }
      }
      return profiles;
    } catch (err) {
      console.error('Failed to load profile files:', err);
      return [];
    }
  });


  // Poll global cursor position and send to the web contents for interactive fish movement
  const mousePollInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const point = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      const x = point.x - bounds.x;
      const y = point.y - bounds.y;
      mainWindow.webContents.send('global-mouse-move', { x, y });
    }
  }, 30);

  // Register global shortcut to easily toggle interactive settings mode
  globalShortcut.register('CommandOrControl+Alt+S', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-settings-global');
    }
  });

  // Track power state and dispatch to renderer to adjust performance dynamically
  const sendPowerState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      let isLocked = false;
      try {
        isLocked = powerMonitor.isLockedScreen();
      } catch (e) {}
      mainWindow.webContents.send('power-state-change', {
        isOnBattery: powerMonitor.isOnBatteryPower(),
        isLocked: isLocked
      });
    }
  };

  powerMonitor.on('on-battery', sendPowerState);
  powerMonitor.on('on-ac', sendPowerState);
  powerMonitor.on('lock-screen', sendPowerState);
  powerMonitor.on('unlock-screen', sendPowerState);
  powerMonitor.on('suspend', sendPowerState);
  powerMonitor.on('resume', sendPowerState);


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWallpaperWindow();
    }
  });
});

app.on('will-quit', () => {
  // Unregister all shortcuts when app closes
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
