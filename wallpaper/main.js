const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require('electron');
const path = require('path');

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
