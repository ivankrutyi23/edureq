// Каркас інтерфейсу: рядок стану, навігація (нижня панель / бічна колонка), сторінка, шапка
import { motion } from 'framer-motion';
import { ArrowLeft, Battery, CalendarCheck2, CalendarDays, ScanLine, ShieldCheck, Signal, Ticket, User, Users, Wifi, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../api/types';

/* Імітація системного рядка стану смартфона (показується лише всередині рамки пристрою) */
export function StatusBar({ kind }: { kind: 'ios' | 'android' }) {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 20_000);
    return () => clearInterval(i);
  }, []);
  const time = t.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`statusbar statusbar--${kind}`} aria-hidden>
      <b>{time}</b>
      <span className="statusbar__icons"><Signal size={15} /><Wifi size={15} /><Battery size={19} /></span>
    </div>
  );
}

/* Пункти навігації залежно від ролі користувача */
const NAV: Record<Role, { to: string; label: string; icon: LucideIcon }[]> = {
  PARTICIPANT: [
    { to: '/events', label: 'Заходи', icon: CalendarDays },
    { to: '/tickets', label: 'Квитки', icon: Ticket },
    { to: '/profile', label: 'Профіль', icon: User },
  ],
  ORGANIZER: [
    { to: '/org', label: 'Мої заходи', icon: CalendarCheck2 },
    { to: '/scanner', label: 'Сканер', icon: ScanLine },
    { to: '/profile', label: 'Профіль', icon: User },
  ],
  ADMIN: [
    { to: '/admin/users', label: 'Користувачі', icon: Users },
    { to: '/admin/events', label: 'Модерація', icon: ShieldCheck },
    { to: '/profile', label: 'Профіль', icon: User },
  ],
};

export function Nav({ role }: { role: Role }) {
  const { pathname } = useLocation();
  return (
    <nav className="nav" aria-label="Основна навігація">
      <div className="nav__logo"><Logo size={34} /><b>EduReg</b></div>
      {NAV[role].map((n) => {
        const active = pathname.startsWith(n.to);
        const Icon = n.icon;
        return (
          <NavLink key={n.to} to={n.to} className={`nav__item ${active ? 'nav__item--active' : ''}`}>
            <span className="nav__icon">
              {active && <motion.span layoutId="nav-pill" className="nav__pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <Icon size={22} strokeWidth={active ? 2.5 : 2} style={{ position: 'relative' }} />
            </span>
            <span className="nav__label">{n.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="EduReg">
      <rect width="64" height="64" rx="16" fill="#9fe870" />
      <path d="M16 22a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v6a4 4 0 0 0 0 8v6a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4v-6a4 4 0 0 0 0-8z" fill="#163300" />
      <path d="M26 32l5 5 9-10" fill="none" stroke="#9fe870" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Сторінка зі слайд-анімацією переходу; виходить із потоку, щоб працювала спільна анімація обкладинок */
export function Page({ children, back }: { children: ReactNode; back?: boolean }) {
  return (
    <motion.div className="page" initial={{ opacity: 0, x: back ? -28 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: back ? 28 : -28, position: 'absolute' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      <div className="page__inner">{children}</div>
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="phead">
      {back && (
        <motion.button whileTap={{ scale: 0.9 }} className="phead__back" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="Назад">
          <ArrowLeft size={22} />
        </motion.button>
      )}
      <div className="phead__text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div className="errorbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <b>Не вдалося завантажити дані</b>
      <p>{message}</p>
      <button className="btn btn--dark btn--sm" onClick={onRetry}>Спробувати ще раз</button>
    </motion.div>
  );
}
