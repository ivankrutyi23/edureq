// Екран привітання та форма входу / реєстрації (валідація на клієнті + обробка помилок сервера)
import { motion } from 'framer-motion';
import { CalendarCheck2, Lock, Mail, Shield, Ticket, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Role } from '../api/types';
import { Logo, Page } from '../components/layout';
import { Button, Field, Segmented } from '../components/ui';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

/* Векторна ілюстрація: телефон із QR-квитком і плаваючі елементи */
function HeroArt() {
  const float = (d: number, a = 8) => ({ animate: { y: [0, -a, 0] }, transition: { duration: 3.2 + d, repeat: Infinity, ease: 'easeInOut' as const, delay: d } });
  return (
    <div className="hero-art">
      <svg viewBox="0 0 320 300" width="100%" aria-hidden>
        <circle cx="160" cy="150" r="128" fill="#9fe870" />
        <circle cx="262" cy="52" r="26" fill="#cdffad" />
        <circle cx="46" cy="236" r="18" fill="#163300" opacity="0.9" />
        <rect x="104" y="40" width="112" height="218" rx="22" fill="#163300" />
        <rect x="112" y="52" width="96" height="194" rx="14" fill="#fff" />
        <rect x="124" y="64" width="72" height="9" rx="4.5" fill="#163300" />
        <rect x="124" y="80" width="46" height="6" rx="3" fill="#9fe870" />
        {Array.from({ length: 7 }).map((_, r) =>
          Array.from({ length: 7 }).map((__, c) => ((r * 5 + c * 3 + r * c) % 3 !== 0 || (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2)) ? (
            <rect key={`${r}${c}`} x={128 + c * 9.5} y={104 + r * 9.5} width="7.5" height="7.5" rx="1.5" fill="#163300" />
          ) : null),
        )}
        <rect x="124" y="190" width="72" height="30" rx="15" fill="#9fe870" />
        <path d="M146 205l6 6 12-13" stroke="#163300" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <motion.div className="hero-chip hero-chip--a" {...float(0)}><Ticket size={16} /> QR-квиток</motion.div>
      <motion.div className="hero-chip hero-chip--b" {...float(0.8)}><CalendarCheck2 size={16} /> 24 місця</motion.div>
      <motion.div className="hero-chip hero-chip--c" {...float(1.4, 6)}><Shield size={16} /> Check-in</motion.div>
    </div>
  );
}

export function Welcome() {
  const nav = useNavigate();
  const { demo } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<Role | null>(null);

  const go = async (role: Role) => {
    setBusy(role);
    try {
      await demo(role);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <div className="welcome">
        <div className="welcome__top"><Logo size={36} /><b>EduReg</b></div>
        <HeroArt />
        <motion.h1 className="welcome__title" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          Реєстрація на заходи — <span>в один дотик</span>
        </motion.h1>
        <p className="welcome__text">Знаходьте лекції та майстер-класи, отримуйте QR-квиток і відмічайтеся на вході за секунду.</p>
        <div className="welcome__cta">
          <Button block onClick={() => nav('/auth?mode=register')}>Створити акаунт</Button>
          <Button block variant="ghost" onClick={() => nav('/auth?mode=login')}>Увійти</Button>
        </div>
        <div className="demo">
          <span>Швидкий демо-вхід</span>
          <div className="demo__row">
            {([['PARTICIPANT', 'Учасник'], ['ORGANIZER', 'Організатор'], ['ADMIN', 'Адмін']] as [Role, string][]).map(([r, l]) => (
              <Button key={r} size="sm" variant="soft" loading={busy === r} onClick={() => go(r)}>{l}</Button>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') === 'register' ? 'register' : 'login') as 'login' | 'register';
  const { login, register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Валідація: помилки обчислюються зі стану форми, показуються після першої спроби відправки
  const errors = {
    name: mode === 'register' && form.name.trim().length < 2 ? 'Вкажіть прізвище та ім’я' : null,
    email: !EMAIL.test(form.email) ? 'Введіть коректну адресу, наприклад name@mail.com' : null,
    password: form.password.length < 8 ? 'Пароль має містити щонайменше 8 символів' : null,
  };
  const set = (k: keyof typeof form) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setServerErr(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.email || errors.password) return;
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      toast(mode === 'login' ? 'Раді вас бачити!' : 'Акаунт створено');
    } catch (err) {
      setServerErr(err instanceof ApiError ? err.message : 'Сталася помилка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page back>
      <form className="auth" onSubmit={submit} noValidate>
        <div className="welcome__top"><Logo size={36} /><b>EduReg</b></div>
        <h1 className="auth__title">{mode === 'login' ? 'З поверненням' : 'Створіть акаунт'}</h1>
        <p className="auth__sub">{mode === 'login' ? 'Увійдіть, щоб переглянути свої квитки та заходи.' : 'Це займе менше хвилини.'}</p>
        <Segmented id="auth" value={mode} onChange={(v) => setParams({ mode: v })} options={[{ value: 'login', label: 'Вхід' }, { value: 'register', label: 'Реєстрація' }]} />
        <motion.div layout className="auth__fields">
          {mode === 'register' && <Field label="Прізвище та ім’я" icon={<User size={18} />} value={form.name} onChange={set('name')} placeholder="Коваль Ірина" autoComplete="name" error={touched ? errors.name : null} />}
          <Field label="Електронна пошта" icon={<Mail size={18} />} type="email" inputMode="email" value={form.email} onChange={set('email')} placeholder="name@mail.com" autoComplete="email" error={touched ? errors.email : null} />
          <Field label="Пароль" icon={<Lock size={18} />} type="password" value={form.password} onChange={set('password')} placeholder="Щонайменше 8 символів" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={touched ? errors.password : serverErr} hint={mode === 'login' ? 'Демо: demo1234' : undefined} />
          {serverErr && touched && !errors.password && <div className="field__error">{serverErr}</div>}
        </motion.div>
        <Button block type="submit" loading={busy}>{mode === 'login' ? 'Увійти' : 'Створити акаунт'}</Button>
        {mode === 'login' && <p className="auth__hint">Демо-акаунти: koval@edureg.test · melnyk@edureg.test · admin@edureg.test</p>}
      </form>
    </Page>
  );
}
