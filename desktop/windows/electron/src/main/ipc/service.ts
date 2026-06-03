import { ipcMain } from 'electron';
import type { ProcessManager } from '../process-manager';

let processManagerRef: ProcessManager | null = null;

export function setProcessManagerRef(pm: ProcessManager): void {
  processManagerRef = pm;
}

export function registerServiceHandlers(): void {
  ipcMain.handle('service:getStatus', (_event, name: string) => {
    if (!processManagerRef) {
      return { name, state: 'pending', port: 0, restartCount: 0 };
    }
    return processManagerRef.getInfo(name);
  });

  ipcMain.handle('service:getAllStatus', () => {
    if (!processManagerRef) {
      return {};
    }
    return processManagerRef.getAllInfo();
  });
}
