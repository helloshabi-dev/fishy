const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'icon-generator.html'));

  ipcMain.on('save-icon', (event, dataUrl) => {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buildDir = path.join(__dirname, 'build');
    
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir);
    }
    
    fs.writeFileSync(path.join(buildDir, 'icon.png'), base64Data, 'base64');
    console.log('App icon generated successfully at build/icon.png!');
    app.quit();
  });
});
