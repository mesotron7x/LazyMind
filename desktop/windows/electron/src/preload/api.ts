import {
  DataDirPaths,
  ServiceStatus,
  AssistantInfo,
  CreateAssistantData,
  UpdateAssistantData,
} from '../shared/types';

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
  createAssistant(data: CreateAssistantData): Promise<AssistantInfo>;
  updateAssistant(id: string, data: UpdateAssistantData): Promise<AssistantInfo>;
  deleteAssistant(id: string): Promise<void>;
  onAssistantChange(callback: (assistant: AssistantInfo) => void): () => void;
  getVersion(): Promise<string>;
  isPackaged(): Promise<boolean>;
  getMode(): Promise<'desktop' | 'cloud'>;
  platform: 'win32' | 'darwin' | 'linux';
}
