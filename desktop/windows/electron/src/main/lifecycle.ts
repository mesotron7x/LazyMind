import { app, BrowserWindow } from 'electron';
import type { ProcessManager } from './process-manager';
import type { ProxyServer } from './proxy';

let mainWindow: BrowserWindow | null = null;
let pm: ProcessManager | null = null;
let proxy: ProxyServer | null = null;
let cleanupPromise: Promise<void> | null = null;

export function initLifecycle(win: BrowserWindow, processManager: ProcessManager | null, proxyServer: ProxyServer): void {
  mainWindow = win;
  pm = processManager;
  proxy = proxyServer;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  win.on('close', () => {
    app.quit();
  });

  app.on('before-quit', async (event) => {
    if (!pm && !proxy) {
      return;
    }

    event.preventDefault();

    if (!cleanupPromise) {
      cleanupPromise = cleanup().finally(() => {
        pm = null;
        proxy = null;
        cleanupPromise = null;
        app.quit();
      });
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

async function cleanup(): Promise<void> {
  try {
    await pm?.stopAll();
  } catch (err) {
    console.error('Error stopping services:', err);
  }
  try {
    await proxy?.stop();
  } catch (err) {
    console.error('Error stopping proxy:', err);
  }
}
