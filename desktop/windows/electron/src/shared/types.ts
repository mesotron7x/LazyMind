export type ServiceState = 'pending' | 'starting' | 'healthy' | 'stopping' | 'stopped' | 'failed';

export interface ServiceStatus {
  name: string;
  state: ServiceState;
  port?: number;
  pid?: number;
  error?: string;
  startedAt?: number;
  healthCheckedAt?: number;
}

export interface DataDirPaths {
  root: string;
  config: string;
  data: string;
  vector: string;
  segment: string;
  uploads: string;
  scanned: string;
  cache: string;
  logs: string;
  diagnostics: string;
  crash: string;
  backups: string;
  defaultDocs: string;
}

export interface AssistantInfo {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  description: string;
  createdAt: string;
}

export interface CreateAssistantData {
  username: string;
  displayName: string;
  avatar: string;
  description: string;
}

export interface UpdateAssistantData {
  displayName?: string;
  avatar?: string;
  description?: string;
}

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

declare global {
  interface Window {
    lazymind: LazyMindDesktopAPI;
  }
}
