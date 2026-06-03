/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_HIDE_EVO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    BASENAME?: string;
    lazymind?: {
      getDataDir(): Promise<any>;
      pickFolder(options?: { title?: string }): Promise<string | null>;
      openPath(path: string): Promise<void>;
      exportDiagnostics(): Promise<string>;
      openLogDir(): Promise<void>;
      getServiceStatus(name: string): Promise<any>;
      getAllServiceStatus(): Promise<Record<string, any>>;
      onServiceStatusChange(callback: (statuses: Record<string, any>) => void): () => void;
      getCurrentAssistant(): Promise<any>;
      setCurrentAssistant(id: string): Promise<void>;
      getAssistantList(): Promise<any[]>;
      onAssistantChange(callback: (assistant: any) => void): () => void;
      getVersion(): Promise<string>;
      isPackaged(): Promise<boolean>;
      getMode(): Promise<'desktop' | 'cloud'>;
      platform: 'win32' | 'darwin' | 'linux';
    };
  }
}

export {};
