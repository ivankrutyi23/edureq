// Вибір режиму відображення:
//  – ?app=1, вікно вужче за 820 px, перегляд усередині iframe або режим app (Render) → власне застосунок;
//  – інакше (великий екран) → демонстраційна оболонка з вибором пристрою.
import { useEffect, useState } from 'react';
import type { Role } from './api/types';
import { AppRoot } from './AppRoot';
import { DeviceShowcase } from './shell/DeviceShowcase';

const useNarrow = () => {
  const [n, setN] = useState(() => window.innerWidth < 820);
  useEffect(() => {
    const f = () => setN(window.innerWidth < 820);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return n;
};

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const narrow = useNarrow();
  const embedded = window.top !== window;
  // На Render (config.js: mode 'app') одразу відкривається застосунок; ?showcase=1 повертає демо-оболонку
  const appMode = window.EDUREG_CONFIG?.mode === 'app' && params.get('showcase') !== '1';
  const isApp = params.get('app') === '1' || embedded || narrow || appMode;

  if (!isApp) return <DeviceShowcase />;
  const sb = params.get('sb');
  const as = params.get('as')?.toUpperCase();
  return (
    <AppRoot
      statusBar={sb === 'ios' || sb === 'android' ? sb : undefined}
      autoRole={as === 'PARTICIPANT' || as === 'ORGANIZER' || as === 'ADMIN' ? (as as Role) : undefined}
    />
  );
}
