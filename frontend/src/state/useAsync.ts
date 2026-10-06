// Хук для асинхронних запитів: керує станами «завантаження / дані / помилка» та повторним запитом.
// Під час повторного завантаження попередні дані не зникають (немає «блимання» інтерфейсу).
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true; // захист від оновлення стану після демонтування компонента
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, loading: false, error: e.message })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater: (d: T | null) => T | null) => setState((s) => ({ ...s, data: updater(s.data) })), []);
  return { ...state, reload, setData };
}
