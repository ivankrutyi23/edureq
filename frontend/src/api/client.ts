// HTTP-клієнт. Усі запити до сервера проходять через одну функцію request():
//  – додає токен авторизації;
//  – обробляє асинхронну відповідь та помилки (мережеві й HTTP);
//  – залежно від режиму (див. config.ts) звертається до справжнього сервера або до вбудованого mock-сервера.
import { apiState } from './config';
import { handle } from './mockServer';

export const usingMock = () => apiState().mode === 'mock';

const TOKEN_KEY = 'edureg.token';
const OFFLINE_KEY = 'edureg.offline';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ігноруємо */ }
};
export const isOffline = () => {
  try { return localStorage.getItem(OFFLINE_KEY) === '1'; } catch { return false; }
};
export const setOffline = (v: boolean) => {
  try { v ? localStorage.setItem(OFFLINE_KEY, '1') : localStorage.removeItem(OFFLINE_KEY); } catch { /* ігноруємо */ }
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const { mode, base } = apiState();
  let status: number;
  let data: unknown;
  try {
    if (mode === 'mock') {
      await sleep(260 + Math.random() * 320); // імітація мережевої затримки
      if (isOffline()) throw new TypeError('Failed to fetch');
      ({ status, data } = handle(method, path, body, token));
    } else {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 60_000); // запас на «холодний старт» безкоштовного хостингу
      try {
        const res = await fetch(base + path, {
          method,
          signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        status = res.status;
        const ct = res.headers.get('content-type') ?? '';
        data = ct.includes('json') ? await res.json() : await res.text();
      } finally {
        clearTimeout(timer);
      }
    }
  } catch {
    throw new ApiError(0, 'Немає з’єднання із сервером. Перевірте мережу та повторіть спробу.');
  }
  if (status >= 400) {
    // сервер повертає {"status": 404, "message": "..."}; mock-сервер – {"detail": "..."}
    const d = data as { message?: unknown; detail?: unknown };
    const msg = typeof d?.message === 'string' ? d.message : typeof d?.detail === 'string' ? d.detail : null;
    throw new ApiError(status, msg ?? 'Сталася помилка. Спробуйте пізніше.');
  }
  return data as T;
}
