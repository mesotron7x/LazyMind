import { contextBridge, ipcRenderer } from 'electron';
import type { LazyMindDesktopAPI } from './api';

const api: LazyMindDesktopAPI = {
  getDataDir: () => ipcRenderer.invoke('datadir:get'),

  pickFolder: (options) => ipcRenderer.invoke('dialog:pickFolder', options),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  exportDiagnostics: () => ipcRenderer.invoke('diagnostics:export'),
  openLogDir: () => ipcRenderer.invoke('diagnostics:openLogDir'),

  getServiceStatus: (name) => ipcRenderer.invoke('service:getStatus', name),
  getAllServiceStatus: () => ipcRenderer.invoke('service:getAllStatus'),
  onServiceStatusChange: (callback) => {
    const handler = (_: unknown, statuses: Record<string, unknown>) => callback(statuses as any);
    ipcRenderer.on('service:status-changed', handler);
    return () => { ipcRenderer.removeListener('service:status-changed', handler); };
  },

  getCurrentAssistant: () => ipcRenderer.invoke('assistant:getCurrent'),
  setCurrentAssistant: (id) => ipcRenderer.invoke('assistant:setCurrent', id),
  getAssistantList: () => ipcRenderer.invoke('assistant:getList'),
  onAssistantChange: (callback) => {
    const handler = (_: unknown, assistant: unknown) => callback(assistant as any);
    ipcRenderer.on('assistant:changed', handler);
    return () => { ipcRenderer.removeListener('assistant:changed', handler); };
  },

  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  isPackaged: () => ipcRenderer.invoke('app:isPackaged'),
  getMode: () => ipcRenderer.invoke('app:getMode'),

  platform: process.platform as 'win32' | 'darwin' | 'linux',
};

contextBridge.exposeInMainWorld('lazymind', api);
