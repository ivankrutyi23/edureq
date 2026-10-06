// Демонстраційна оболонка: застосунок у рамці смартфона/планшета/ноутбука.
// Застосунок завантажується в <iframe>, тому в ньому працюють справжні медіа-запити:
// зміна пристрою або повернення екрана одразу перебудовує адаптивну верстку.
import { motion } from 'framer-motion';
import { CalendarCheck2, ExternalLink, Laptop, QrCode, RotateCw, ScanLine, ShieldCheck, Smartphone, Tablet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { forceMock, saveApiUrl, savedApiUrl } from '../api/config';
import { Logo } from '../components/layout';
import { byId, DEVICES, type Device } from './devices';

type Start = 'guest' | 'participant' | 'organizer' | 'admin';
const STARTS: { id: Start; label: string }[] = [
  { id: 'guest', label: 'Гість' },
  { id: 'participant', label: 'Учасник' },
  { id: 'organizer', label: 'Організатор' },
  { id: 'admin', label: 'Адмін' },
];
const KIND_ICON = { phone: Smartphone, tablet: Tablet, laptop: Laptop };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [s, setS] = useState({ w: 800, h: 700 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setS({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setS({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, s] as const;
}

function Frame({ dev, landscape, src }: { dev: Device; landscape: boolean; src: string }) {
  const [stageRef, stage] = useSize<HTMLDivElement>();
  const W = landscape && dev.kind !== 'laptop' ? dev.h : dev.w;
  const H = landscape && dev.kind !== 'laptop' ? dev.w : dev.h;
  const chrome = dev.kind === 'laptop' ? 36 : 0; // рядок браузера
  const totalW = W + dev.bezel * 2;
  const totalH = H + dev.bezel * 2 + chrome + (dev.kind === 'laptop' ? 18 : 0);
  const scale = Math.min(1, (stage.w - 32) / totalW, (stage.h - 32) / totalH);

  return (
    <div className="stage" ref={stageRef}>
      <motion.div className="scaler" animate={{ width: totalW * scale, height: totalH * scale }} transition={{ type: 'spring', stiffness: 140, damping: 22 }}>
        <motion.div className={`device device--${dev.kind} device--${dev.os}`} style={{ transformOrigin: 'top left', scale }}
          animate={{ width: totalW, height: totalH - (dev.kind === 'laptop' ? 18 : 0), borderRadius: dev.kind === 'laptop' ? 18 : dev.radius + dev.bezel }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}>
          {dev.kind === 'laptop' && (
            <div className="browserbar"><i /><i /><i /><span>https://ivankrutyi23.github.io/edureq/</span></div>
          )}
          <motion.div className="device__screen" animate={{ borderRadius: dev.kind === 'laptop' ? 6 : dev.radius }} style={dev.kind === 'laptop' ? undefined : { inset: dev.bezel }}>
            <iframe title="EduReg" src={src} />
            {dev.notch === 'island' && <span className={`notch notch--island ${landscape ? 'notch--land' : ''}`} />}
            {dev.notch === 'punch' && <span className={`notch notch--punch ${landscape ? 'notch--land' : ''}`} />}
          </motion.div>
          {dev.kind === 'phone' && <><i className="btn-side btn-side--a" /><i className="btn-side btn-side--b" /></>}
        </motion.div>
        {dev.kind === 'laptop' && <div className="laptop-base" style={{ width: (totalW + 60) * scale, height: 16 * scale, bottom: -16 * scale }} />}
      </motion.div>
    </div>
  );
}

export function DeviceShowcase() {
  const [devId, setDevId] = useState('iphone15');
  const [landscape, setLandscape] = useState(false);
  const [start, setStart] = useState<Start>('guest');
  const [apiInfo, setApiInfo] = useState<{ mode: string; note: string } | null>(null);
  const [url, setUrl] = useState(savedApiUrl());
  const [rk, setRk] = useState(0); // змінюється, щоб перезавантажити застосунок у рамці
  const dev = byId(devId);

  // Застосунок у рамці повідомляє, який режим даних він обрав (сервер чи демо)
  useEffect(() => {
    const f = (e: MessageEvent) => {
      if (e.data?.type === 'edureg-api') setApiInfo({ mode: e.data.mode, note: e.data.note });
    };
    window.addEventListener('message', f);
    return () => window.removeEventListener('message', f);
  }, []);
  const reload = () => { setApiInfo(null); setRk((k) => k + 1); };
  const connect = () => { saveApiUrl(url.trim() || null); reload(); };
  const demo = () => { forceMock(); setUrl(''); reload(); };
  const phoneLike = dev.kind !== 'laptop';

  useEffect(() => { if (!phoneLike) setLandscape(false); }, [phoneLike]);

  const base = window.location.origin + window.location.pathname;
  const q = new URLSearchParams({ app: '1', ...(dev.kind !== 'laptop' ? { sb: dev.os === 'android' ? 'android' : 'ios' } : {}), ...(start !== 'guest' ? { as: start } : {}) });
  const src = `${base}?${q}#/`;
  const standalone = `${base}?app=1${start !== 'guest' ? `&as=${start}` : ''}#/`;

  return (
    <div className="showcase">
      <aside className="showcase__panel">
        <div className="brand"><Logo size={44} /><span>EduReg</span></div>
        <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>Мобільний застосунок для <em>реєстрації</em> на освітні заходи</motion.h1>
        <p className="lead">Інтерактивна демонстрація фронтенду. Усі дані тестові (mock API), але інтерфейс працює як у справжньому застосунку.</p>

        <div className="ctl">
          <h3>Пристрій</h3>
          <div className="devlist">
            {DEVICES.map((d) => {
              const Icon = KIND_ICON[d.kind];
              return (
                <button key={d.id} className={`devbtn ${devId === d.id ? 'devbtn--on' : ''}`} onClick={() => setDevId(d.id)}>
                  {devId === d.id && <motion.span layoutId="devpill" className="devbtn__pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <Icon size={17} /><span>{d.name}</span><small>{d.w}×{d.h}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ctl ctl--row">
          <div>
            <h3>Орієнтація</h3>
            <button className="rotbtn" disabled={!phoneLike} onClick={() => setLandscape((v) => !v)}>
              <motion.span animate={{ rotate: landscape ? 90 : 0 }}><RotateCw size={18} /></motion.span>
              {landscape ? 'Альбомна' : 'Портретна'}
            </button>
          </div>
          <div>
            <h3>Увійти як</h3>
            <div className="starts">
              {STARTS.map((s) => <button key={s.id} className={start === s.id ? 'on' : ''} onClick={() => setStart(s.id)}>{s.label}</button>)}
            </div>
          </div>
        </div>

        <div className="ctl">
          <h3>Джерело даних</h3>
          <div className={`apibadge ${apiInfo?.mode === 'server' ? 'apibadge--server' : ''}`}><i /> {apiInfo?.note ?? 'Визначення режиму…'}</div>
          <div className="apirow">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://edureg-api.onrender.com" aria-label="Адреса сервера" />
            <button onClick={connect}>Підключити</button>
            <button className="ghost" onClick={demo}>Демо</button>
          </div>
        </div>

        <ul className="feat">
          <li><CalendarCheck2 size={18} /> Пошук і реєстрація на заходи</li>
          <li><QrCode size={18} /> Персональний QR-квиток</li>
          <li><ScanLine size={18} /> Check-in за QR для організатора</li>
          <li><ShieldCheck size={18} /> Ролі: учасник, організатор, адміністратор</li>
        </ul>

        <div className="openrow">
          <a className="open" href={standalone} target="_blank" rel="noreferrer"><ExternalLink size={17} /> Відкрити повноекранно</a>
          <div className="qr"><QRCodeSVG value={standalone} size={72} fgColor="#163300" /><small>Скануйте телефоном</small></div>
        </div>
      </aside>

      <section className="showcase__stage">
        <Frame dev={dev} landscape={landscape} src={src} key={`${start}-${rk}`} />
        <div className="caption">{dev.name} · {landscape && phoneLike ? `${dev.h}×${dev.w}` : `${dev.w}×${dev.h}`}</div>
      </section>
    </div>
  );
}
