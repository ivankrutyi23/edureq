// Набір повторно використовуваних UI-компонентів (кнопки, поля, листи, індикатори)
import { AnimatePresence, animate, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';

/* ---------- Кнопка ---------- */
type BtnProps = Omit<ComponentProps<typeof motion.button>, 'children'> & {
  variant?: 'primary' | 'dark' | 'soft' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};
export function Button({ variant = 'primary', size = 'md', block, loading, icon, children, className = '', ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`btn btn--${variant} ${size === 'sm' ? 'btn--sm' : ''} ${block ? 'btn--block' : ''} ${className}`}
      {...rest}
      disabled={loading || rest.disabled}
    >
      {loading ? <span className="spinner" /> : icon}
      {children}
    </motion.button>
  );
}

/* ---------- Поле введення з валідацією ---------- */
type FieldProps = {
  label: string;
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
  multiline?: boolean;
} & Omit<ComponentProps<'input'>, 'onChange'> & { onChange: (v: string) => void };

export function Field({ label, error, hint, icon, multiline, onChange, ...rest }: FieldProps) {
  const id = useMemo(() => 'f' + Math.random().toString(36).slice(2, 8), []);
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      {/* при появі помилки блок «трусимо» – видимий зворотний зв’язок */}
      <motion.div
        key={error ?? 'ok'}
        animate={error ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={`field__box ${error ? 'field__box--error' : ''}`}
      >
        {icon}
        {multiline ? (
          <textarea id={id} {...(rest as ComponentProps<'textarea'>)} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input id={id} {...rest} onChange={(e) => onChange(e.target.value)} />
        )}
      </motion.div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.div className="field__error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      {!error && hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

/* ---------- Чіп, перемикач, сегментований вибір ---------- */
export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} className={`chip ${active ? 'chip--active' : ''}`} onClick={onClick} type="button">
      {children}
    </motion.button>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'switch--on' : ''}`} onClick={() => onChange(!on)}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className="switch__knob" />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, id }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" className={`segmented__item ${o.value === value ? 'segmented__item--active' : ''}`} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={`seg-${id}`} className="segmented__pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span style={{ position: 'relative' }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Скелетон та порожній стан ---------- */
export const Skeleton = ({ h = 120, w = '100%', r }: { h?: number; w?: number | string; r?: number }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />
);

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </motion.div>
  );
}

/* ---------- Нижній лист (на широких екранах – діалог) ---------- */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet" role="dialog" aria-modal="true"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="sheet__grip" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Діалог підтвердження: дозволяє користувачу скасувати небезпечну дію */
export function Confirm({ open, title, text, confirmLabel, danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; text: string; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="confirm">
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="confirm__row">
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Кільце заповнення (кількість місць) ---------- */
export function Ring({ value, size = 96, stroke = 10, label, sub }: { value: number; size?: number; stroke?: number; label: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const full = value >= 1;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8f0e2" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={full ? '#d03238' : value > 0.8 ? '#e0a100' : '#163300'}
          initial={{ pathLength: 0 }} animate={{ pathLength: Math.min(1, value) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring__label"><b>{label}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/* ---------- Анімоване число ---------- */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value]);
  return <>{n}{suffix}</>;
}

/* ---------- Анімована «галочка» успіху ---------- */
export function Checkmark({ size = 88, color = '#163300', bg = '#9fe870' }: { size?: number; color?: string; bg?: string }) {
  return (
    <motion.svg width={size} height={size} viewBox="0 0 88 88" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
      <circle cx="44" cy="44" r="42" fill={bg} />
      <motion.path d="M26 45l12 12 24-26" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
    </motion.svg>
  );
}

/* ---------- Конфеті ---------- */
export function Confetti({ show }: { show: boolean }) {
  const pieces = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({
      i, x: (Math.random() - 0.5) * 360, y: -80 - Math.random() * 220, rot: Math.random() * 540,
      c: ['#9fe870', '#163300', '#cdffad', '#ffd11a', '#1a6b86'][i % 5], d: 0.9 + Math.random() * 0.7,
    })),
    [],
  );
  return (
    <AnimatePresence>
      {show && (
        <div className="confetti" aria-hidden>
          {pieces.map((p) => (
            <motion.i key={p.i} style={{ background: p.c }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: [0, p.y, p.y + 420], opacity: [1, 1, 0], rotate: p.rot }}
              transition={{ duration: p.d + 0.6, ease: 'easeOut' }} />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export const Badge = ({ kind, children }: { kind?: 'danger' | 'warn' | 'info' | 'dark'; children: ReactNode }) => (
  <span className={`badge ${kind ? `badge--${kind}` : ''}`}>{children}</span>
);

export const CheckIcon = Check;
