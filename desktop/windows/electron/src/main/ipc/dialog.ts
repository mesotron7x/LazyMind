import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import { getDataDir } from '../data-dir';

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:pickFolder', async (event, options?: { title?: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      title: options?.title || '选择文件夹',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('shell:openPath', async (_event, targetPath: string) => {
    if (typeof targetPath !== 'string') {
      throw new Error('Invalid path parameter');
    }

    const dataDir = getDataDir();
    const resolved = path.resolve(targetPath);
    const normalizedResolved = path.normalize(resolved);
    const allowedPrefixes = [
      path.normalize(path.resolve(dataDir.root)),
      path.normalize(path.resolve(dataDir.logs)),
    ];

    const isAllowed = allowedPrefixes.some((prefix) =>
      normalizedResolved.startsWith(prefix + path.sep) || normalizedResolved === prefix
    );

    if (!isAllowed) {
      throw new Error('Access denied: path is outside allowed directories');
    }

    await shell.openPath(resolved);
  });
}
