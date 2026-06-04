import type { ProxyServer } from './proxy';
import type { AssistantInfo, CreateAssistantData, UpdateAssistantData } from '../shared/types';
import { DEFAULT_PORTS } from '../shared/constants';

export interface AssistantManager {
  initialize(): Promise<void>;
  getCurrent(): AssistantInfo | null;
  setCurrent(id: string): Promise<void>;
  getList(): Promise<AssistantInfo[]>;
  create(data: CreateAssistantData): Promise<AssistantInfo>;
  update(id: string, data: UpdateAssistantData): Promise<AssistantInfo>;
  delete(id: string): Promise<void>;
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

    const text = await res.text();
    const json = text ? JSON.parse(text) as Record<string, any> : {};
    if (!res.ok) {
      const message = json.message || json.error || `Assistant API failed with ${res.status}`;
      throw new Error(message);
    }

    return (json.data as Record<string, any>) ?? json;
  }

  function setCurrentAssistant(assistant: AssistantInfo, notify = true): void {
    currentAssistant = assistant;
    proxyServer.setCurrentAssistant(assistant.id, assistant.username);
    if (notify) {
      notifyListeners(assistant);
    }
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
      const listResult = await fetchJSON('/assistants');
      const assistants = (listResult.assistants || []) as AssistantInfo[];
      const target = assistants.find((assistant) => assistant.id === defaultAssistant.id) || assistants[0] || defaultAssistant;

      setCurrentAssistant(target, false);
    },

    getCurrent(): AssistantInfo | null {
      return currentAssistant;
    },

    async setCurrent(id: string): Promise<void> {
      const result = await fetchJSON(`/assistants/${id}`);
      const assistant: AssistantInfo = result.assistant;
      setCurrentAssistant(assistant);
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
      const assistant: AssistantInfo = result.assistant;
      setCurrentAssistant(assistant);
      return assistant;
    },

    async update(id: string, data: UpdateAssistantData): Promise<AssistantInfo> {
      const result = await fetchJSON(`/assistants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      const assistant: AssistantInfo = result.assistant;
      if (currentAssistant?.id === assistant.id) {
        setCurrentAssistant(assistant);
      }
      return assistant;
    },

    async delete(id: string): Promise<void> {
      const listResult = await fetchJSON('/assistants');
      const assistants = (listResult.assistants || []) as AssistantInfo[];
      const target = assistants.find((assistant) => assistant.id === id);
      if (!target) {
        throw new Error('Assistant not found');
      }
      if (assistants.length <= 1 || target.username === 'astronomer') {
        throw new Error('The default assistant cannot be deleted');
      }

      await fetchJSON(`/assistants/${id}`, { method: 'DELETE' });

      if (currentAssistant?.id === id) {
        const remainingResult = await fetchJSON('/assistants');
        const remaining = (remainingResult.assistants || []) as AssistantInfo[];
        if (remaining.length === 0) {
          currentAssistant = null;
          return;
        }
        setCurrentAssistant(remaining[0]);
      }
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
