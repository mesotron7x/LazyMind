import { app, ipcMain } from 'electron';

export function registerAppInfoHandlers(): void {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:isPackaged', () => {
    return app.isPackaged;
  });

  ipcMain.handle('app:getMode', () => {
    return 'desktop';
  });

  ipcMain.handle('datadir:get', () => {
    const { getDataDir } = require('../data-dir');
    return getDataDir();
  });
}
