// API 客户端

const API_BASE = '/api/v1';

// 递归将 snake_case 键名转为 camelCase
function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys) as T;
  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[toCamelCase(key)] = transformKeys(value);
    }
    return result as T;
  }
  return obj;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return transformKeys(data) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
