import { BrowserWindow, ipcMain } from 'electron';
import type { AssistantManager } from '../assistant-manager';
import type { CreateAssistantData, UpdateAssistantData } from '../../shared/types';

let assistantManagerRef: AssistantManager | null = null;
let unsubscribeAssistantChange: (() => void) | null = null;

export function setAssistantManagerRef(manager: AssistantManager): void {
  assistantManagerRef = manager;
  unsubscribeAssistantChange?.();
  unsubscribeAssistantChange = manager.onCurrentChange((assistant) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('assistant:changed', assistant);
      }
    });
  });
}

export function registerAssistantHandlers(): void {
  ipcMain.handle('assistant:getCurrent', () => {
    return getAssistantManager().getCurrent();
  });

  ipcMain.handle('assistant:getList', () => {
    return getAssistantManager().getList();
  });

  ipcMain.handle('assistant:setCurrent', (_event, id: string) => {
    return getAssistantManager().setCurrent(id);
  });

  ipcMain.handle('assistant:create', (_event, data: CreateAssistantData) => {
    return getAssistantManager().create(data);
  });

  ipcMain.handle('assistant:update', (_event, id: string, data: UpdateAssistantData) => {
    return getAssistantManager().update(id, data);
  });

  ipcMain.handle('assistant:delete', (_event, id: string) => {
    return getAssistantManager().delete(id);
  });
}

function getAssistantManager(): AssistantManager {
  if (!assistantManagerRef) {
    throw new Error('Assistant manager is not initialized');
  }
  return assistantManagerRef;
}
