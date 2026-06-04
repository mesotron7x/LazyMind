import { app, BrowserWindow } from 'electron';
import type { ProcessManager } from './process-manager';
import type { ProxyServer } from './proxy';

let mainWindow: BrowserWindow | null = null;
let pm: ProcessManager | null = null;
let proxy: ProxyServer | null = null;

export function initLifecycle(win: BrowserWindow, processManager: ProcessManager | null, proxyServer: ProxyServer): void {
  mainWindow = win;
  pm = processManager;
  proxy = proxyServer;

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

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
    if (pm || proxy) {
      event.preventDefault();
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
      pm = null;
      proxy = null;
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
