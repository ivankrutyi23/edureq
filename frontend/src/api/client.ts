// HTTP-клієнт. Усі запити до сервера проходять через одну функцію request():
//  – додає токен авторизації;
//  – обробляє асинхронну відповідь та помилки (мережеві й HTTP);
//  – у демо-режимі (без VITE_API_URL) спрямовує запит до фейкового сервера з імітацією затримки.
import { handle } from './mockServer';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
export const USING_MOCK = !API_URL;

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
  let status: number;
  let data: unknown;
  try {
    if (USING_MOCK) {
      await sleep(260 + Math.random() * 320); // імітація мережевої затримки
      if (isOffline()) throw new TypeError('Failed to fetch');
      ({ status, data } = handle(method, path, body, token));
    } else {
      const res = await fetch(API_URL + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      status = res.status;
      const ct = res.headers.get('content-type') ?? '';
      data = ct.includes('json') ? await res.json() : await res.text();
    }
  } catch {
    throw new ApiError(0, 'Немає з’єднання із сервером. Перевірте мережу та повторіть спробу.');
  }
  if (status >= 400) {
    const detail = (data as { detail?: unknown })?.detail;
    throw new ApiError(status, typeof detail === 'string' ? detail : 'Сталася помилка. Спробуйте пізніше.');
  }
  return data as T;
}
