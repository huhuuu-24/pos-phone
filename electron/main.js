import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900
  });


  win.loadFile(path.join(__dirname, '../dist/index.html'));

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.log('Load failed:', errorCode, errorDescription);
  });
}

app.whenReady().then(createWindow);
