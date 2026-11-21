let memorySessionToken: string | null = null;

// Clean up any legacy localStorage token entries from earlier builds
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('pa_session_token');
  }
} catch {
  // Ignore storage access errors
}

export function getSessionToken(): string | null {
  return memorySessionToken;
}

export function setSessionToken(token: string | null): void {
  memorySessionToken = token && token.trim() ? token.trim() : null;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
