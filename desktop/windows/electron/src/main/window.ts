import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { getRendererURL } from './protocol';
import { getResourcesDir } from './runtime';
import { PROTOCOL_SCHEME } from '../shared/constants';

const PRELOAD_PATH = path.join(__dirname, '../../preload/preload/index.js');

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'LazyMind',
    icon: path.join(getResourcesDir(), 'icons', 'icon.ico'),
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  win.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    const devPort = process.env.VITE_DEV_PORT || '5173';
    if (
      parsed.protocol !== `${PROTOCOL_SCHEME}:` &&
      parsed.origin !== `http://localhost:${devPort}`
    ) {
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.loadURL(getRendererURL());
  return win;
}

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const splashPath = path.join(getResourcesDir(), 'splash.html');
  splash.loadFile(splashPath);
  splash.show();
  return splash;
}
