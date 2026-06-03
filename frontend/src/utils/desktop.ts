const DESKTOP_USER_STORAGE_KEY = 'lazymind:user';

export function isDesktopMode(): boolean {
  return typeof window !== 'undefined' && 'lazymind' in window;
}

export function getDesktopApiBaseUrl(): string {
  if (!isDesktopMode()) return '';
  return 'http://127.0.0.1:5023';
}

export async function desktopAutoLogin(): Promise<boolean> {
  if (!isDesktopMode()) return false;

  const existing = localStorage.getItem(DESKTOP_USER_STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed?.token) return true;
    } catch {
      // corrupted, re-fetch
    }
  }

  const baseUrl = getDesktopApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/authservice/desktop/identity`);
    const json = await res.json();
    const data = json.data ?? json;
    if (!data.token) return false;

    const payload = decodeJwtPayload(data.token);
    const userInfo = {
      token: data.token,
      username: (payload?.username as string) || 'astronomer',
      userId: data.defaultAssistantId || (payload?.sub as string) || '',
      role: 'user',
      loginType: 'desktop',
      dynamic: false,
      timestamp: Date.now(),
    };
    localStorage.setItem(DESKTOP_USER_STORAGE_KEY, JSON.stringify(userInfo));
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
