const { app, BrowserWindow } = require('electron');
require('electron-reload')(__dirname + "/dist/");

const createWindow = () => {
  const win = new BrowserWindow({
  });

  win.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});
