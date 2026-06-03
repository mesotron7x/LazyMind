import { DataDirPaths, ServiceStatus, AssistantInfo } from '../shared/types';

export interface LazyMindDesktopAPI {
  getDataDir(): Promise<DataDirPaths>;
  pickFolder(options?: { title?: string }): Promise<string | null>;
  openPath(path: string): Promise<void>;
  exportDiagnostics(): Promise<string>;
  openLogDir(): Promise<void>;
  getServiceStatus(name: string): Promise<ServiceStatus>;
  getAllServiceStatus(): Promise<Record<string, ServiceStatus>>;
  onServiceStatusChange(callback: (statuses: Record<string, ServiceStatus>) => void): () => void;
  getCurrentAssistant(): Promise<AssistantInfo | null>;
  setCurrentAssistant(id: string): Promise<void>;
  getAssistantList(): Promise<AssistantInfo[]>;
  onAssistantChange(callback: (assistant: AssistantInfo) => void): () => void;
  getVersion(): Promise<string>;
  isPackaged(): Promise<boolean>;
  getMode(): Promise<'desktop' | 'cloud'>;
  platform: 'win32' | 'darwin' | 'linux';
}
