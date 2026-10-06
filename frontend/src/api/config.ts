// Визначення джерела даних: справжній сервер (FastAPI) або вбудований демо-режим (mock).
// На Render фронтенд і API працюють на одному хості: у config.js задано відносну адресу '/api/v1'.
// Пріоритет адреси сервера:
//   1) параметр URL ?api=https://…  (api=off – примусово демо; api=reset – скинути збережене);
//   2) значення, збережене в localStorage (поле «Сервер» у демо-оболонці);
//   3) public/config.js  (window.EDUREG_CONFIG.apiUrl) – адреса за замовчуванням;
//   4) змінна середовища VITE_API_URL під час збірки.
// Перед використанням адреса перевіряється запитом GET /health: якщо сервер недоступний, застосунок
// автоматично працює в демо-режимі.

export type ApiMode = 'mock' | 'server';
export interface ApiState {
  mode: ApiMode;
  base: string; // повна адреса API, напр. https://edureg-api.onrender.com/api/v1
  note: string; // пояснення для інтерфейсу (чому обрано цей режим)
}

declare global {
  interface Window {
    EDUREG_CONFIG?: { apiUrl?: string; mode?: 'app' | 'showcase' };
  }
}

const KEY = 'edureg.api';
let state: ApiState = { mode: 'mock', base: '', note: 'Демо-режим (дані в браузері)' };
export const apiState = (): ApiState => state;

export const normalizeBase = (url: string): string => {
  let u = url.trim().replace(/\/+$/, '');
  if (!/\/api\/v\d+$/.test(u)) u += '/api/v1';
  return u;
};

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v: string | null) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* ігноруємо */ } },
};

export const savedApiUrl = () => { const v = store.get(); return v && v !== 'off' ? v : ''; };
export const forceMock = () => store.set('off'); // примусово демо-режим (до скидання)
export const saveApiUrl = (v: string | null) => store.set(v ? normalizeBase(v) : null);

function candidate(): { url: string; forced: boolean } | null {
  const q = new URLSearchParams(window.location.search).get('api');
  if (q === 'off' || q === 'mock') return null;
  if (q === 'reset') store.set(null);
  else if (q) { store.set(normalizeBase(q)); return { url: normalizeBase(q), forced: true }; }
  const saved = store.get();
  if (saved === 'off') return null;
  if (saved) return { url: saved, forced: true };
  const cfg = window.EDUREG_CONFIG?.apiUrl || (import.meta.env.VITE_API_URL as string | undefined);
  return cfg ? { url: normalizeBase(cfg), forced: false } : null;
}

async function ping(base: string, timeoutMs: number): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(base + '/health', { signal: ctl.signal });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.service === 'edureg-api'; // переконуємось, що це саме наш сервер
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Визначає режим роботи. onWaiting викликається, якщо сервер «прокидається» довше 3 с (безкоштовний хостинг). */
export async function resolveApi(onWaiting?: () => void): Promise<ApiState> {
  const c = candidate();
  if (!c) {
    state = { mode: 'mock', base: '', note: 'Демо-режим (дані в браузері)' };
  } else {
    const timer = setTimeout(() => onWaiting?.(), 3000);
    const abs = new URL(c.url, window.location.origin).toString().replace(/\/$/, ''); // підтримка відносної адреси /api/v1
    const ok = await ping(abs, 60_000);
    clearTimeout(timer);
    state = ok
      ? { mode: 'server', base: abs, note: `Сервер: ${new URL(abs).host}` }
      : { mode: 'mock', base: '', note: 'Сервер недоступний – демо-режим' };
  }
  try { window.parent?.postMessage({ type: 'edureg-api', ...state }, '*'); } catch { /* поза iframe */ }
  return state;
}
