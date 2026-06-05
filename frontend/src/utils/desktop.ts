const DESKTOP_USER_STORAGE_KEY = 'lazymind:user';
const AUTH_USER_CHANGE_EVENT = 'lazymind:user-change';

export interface DesktopAssistantInfo {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  createdAt?: string;
}

export function isDesktopMode(): boolean {
  return typeof window !== 'undefined' && 'lazymind' in window;
}

export function getDesktopApiBaseUrl(): string {
  if (!isDesktopMode()) return '';
  return 'http://127.0.0.1:5023';
}

function readDesktopUserInfo(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(DESKTOP_USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function syncDesktopAssistantAuth(
  assistant: DesktopAssistantInfo,
  token?: string,
): void {
  const current = readDesktopUserInfo();
  const nextToken = token || current?.token || '';

  const userInfo = {
    ...current,
    token: nextToken,
    username: assistant.username,
    userId: assistant.id,
    role: 'system-admin',
    loginType: 'desktop',
    displayName: assistant.displayName || assistant.username,
    dynamic: false,
    timestamp: Date.now(),
  };

  localStorage.setItem(DESKTOP_USER_STORAGE_KEY, JSON.stringify(userInfo));
  window.dispatchEvent(new Event(AUTH_USER_CHANGE_EVENT));
}

export async function desktopAutoLogin(): Promise<boolean> {
  if (!isDesktopMode()) return false;

  const existing = readDesktopUserInfo();
  if (existing?.token) {
    try {
      const assistant = await window.lazymind?.getCurrentAssistant();
      if (assistant?.id) {
        syncDesktopAssistantAuth(assistant);
      }
    } catch (err) {
      console.warn('[desktop] current assistant sync skipped:', err);
    }
    return true;
  }

  const baseUrl = getDesktopApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/authservice/desktop/identity`);
    const json = await res.json();
    const data = json.data ?? json;
    if (!data.token) return false;

    const payload = decodeJwtPayload(data.token);
    const assistant = await window.lazymind?.getCurrentAssistant();
    syncDesktopAssistantAuth(
      assistant?.id
        ? assistant
        : {
            id: data.defaultAssistantId || (payload?.sub as string) || '',
            username: (payload?.username as string) || 'astronomer',
            displayName: (payload?.username as string) || 'astronomer',
          },
      data.token,
    );
    return true;
  } catch (err) {
    console.error('[desktop] auto-login failed:', err);
    return false;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
