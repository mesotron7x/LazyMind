import type { ProxyServer } from './proxy';
import type { AssistantInfo } from '../shared/types';
import { DEFAULT_PORTS } from '../shared/constants';

export interface AssistantManager {
  initialize(): Promise<void>;
  getCurrent(): AssistantInfo | null;
  setCurrent(id: string): Promise<void>;
  getList(): Promise<AssistantInfo[]>;
  create(data: { username: string; displayName: string; avatar: string; description: string }): Promise<AssistantInfo>;
  onCurrentChange(callback: (assistant: AssistantInfo) => void): () => void;
}

export function createAssistantManager(proxyServer: ProxyServer): AssistantManager {
  let currentAssistant: AssistantInfo | null = null;
  const listeners: ((assistant: AssistantInfo) => void)[] = [];
  const baseURL = `http://127.0.0.1:${DEFAULT_PORTS.auth}/api/authservice/desktop`;

  async function fetchJSON(path: string, options?: RequestInit): Promise<Record<string, any>> {
    const res = await fetch(`${baseURL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
    const json = await res.json() as Record<string, any>;
    return (json.data as Record<string, any>) ?? json;
  }

  function notifyListeners(assistant: AssistantInfo): void {
    for (const cb of listeners) {
      cb(assistant);
    }
  }

  return {
    async initialize(): Promise<void> {
      const bootstrapResult = await fetchJSON('/bootstrap', { method: 'POST' });
      const defaultAssistant: AssistantInfo = bootstrapResult.defaultAssistant;

      currentAssistant = defaultAssistant;
      proxyServer.setCurrentAssistant(defaultAssistant.id, defaultAssistant.username);
    },

    getCurrent(): AssistantInfo | null {
      return currentAssistant;
    },

    async setCurrent(id: string): Promise<void> {
      const result = await fetchJSON(`/assistants/${id}`);
      const assistant: AssistantInfo = result.assistant;
      currentAssistant = assistant;
      proxyServer.setCurrentAssistant(assistant.id, assistant.username);
      notifyListeners(assistant);
    },

    async getList(): Promise<AssistantInfo[]> {
      const result = await fetchJSON('/assistants');
      return result.assistants;
    },

    async create(data): Promise<AssistantInfo> {
      const result = await fetchJSON('/assistants', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result.assistant;
    },

    onCurrentChange(callback: (assistant: AssistantInfo) => void): () => void {
      listeners.push(callback);
      return () => {
        const i = listeners.indexOf(callback);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
}
