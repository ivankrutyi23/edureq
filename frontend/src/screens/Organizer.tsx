// Екрани організатора: мої заходи, керування заходом (огляд / учасники / статистика), форма заходу, сканер QR
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Check, Download, FileText, Minus, Pencil, Plus, ScanLine, Search, Trash2, TriangleAlert, UserCheck, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES } from '../api/mockDb';
import { api } from '../api/endpoints';
import type { CheckInResult, EventInput, RegistrationDto } from '../api/types';
import { EventCard, EventCardSkeleton } from '../components/EventCard';
import { EventCover } from '../components/EventCover';
import { ErrorState, Page, PageHeader } from '../components/layout';
import { Badge, Button, Checkmark, Chip, Confirm, CountUp, Empty, Field, Ring, Segmented, Sheet, Skeleton } from '../components/ui';
import { fmtDateTime, fmtTime, initials, toLocalInput } from '../lib/format';
import { useToast } from '../state/toast';
import { useAsync } from '../state/useAsync';

/* ---------------- Мої заходи ---------------- */
export function OrgHome() {
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.events({ mine: true }), []);
  const total = data?.length ?? 0;
  const regs = data?.reduce((s, e) => s + e.registered, 0) ?? 0;
  const done = data?.filter((e) => e.status === 'FINISHED') ?? [];
  const att = done.reduce((s, e) => s + e.attended, 0);
  const base = done.reduce((s, e) => s + e.registered, 0);
  const pct = base ? Math.round((100 * att) / base) : 0;

  return (
    <Page>
      <PageHeader title="Мої заходи" subtitle="Керуйте реєстраціями та відвідуваністю" />
      <div className="tiles">
        <motion.div className="tile tile--lime" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><b><CountUp value={total} /></b><span>заходів</span></motion.div>
        <motion.div className="tile" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}><b><CountUp value={regs} /></b><span>реєстрацій</span></motion.div>
        <motion.div className="tile tile--dark" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}><b><CountUp value={pct} suffix="%" /></b><span>відвідуваність</span></motion.div>
      </div>
      {error && !data && <ErrorState message={error} onRetry={reload} />}
      <div className="grid">
        {loading && !data && Array.from({ length: 2 }).map((_, i) => <EventCardSkeleton key={i} />)}
        {data?.map((ev, i) => <EventCard key={ev.id} ev={ev} index={i} onClick={() => nav(`/org/event/${ev.id}`)} />)}
      </div>
      {data && data.length === 0 && <Empty icon={<CalendarClock size={36} />} title="Ще немає заходів" text="Створіть перший захід і відкрийте реєстрацію." />}
      <motion.button className="fab" whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.06 }} onClick={() => nav('/org/new')} aria-label="Створити захід" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }}>
        <Plus size={26} strokeWidth={2.6} />
      </motion.button>
    </Page>
  );
}

/* ---------------- Керування заходом ---------------- */
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={d.label} className="bars__col">
          <span className="bars__val">{d.value}</span>
          <motion.i initial={{ height: 0 }} animate={{ height: `${(d.value / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}

export function OrgEvent() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const evId = Number(id);
  const [tab, setTab] = useState<'overview' | 'people' | 'stats'>('overview');
  const [q, setQ] = useState('');
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const ev = useAsync(() => api.event(evId), [evId]);
  const people = useAsync(() => api.eventRegistrations(evId), [evId]);
  const stats = useAsync(() => api.stats(evId), [evId]);

  const list = useMemo(
    () => (people.data ?? []).filter((r) => !q || (r.user!.fullName + r.user!.email).toLowerCase().includes(q.toLowerCase())),
    [people.data, q],
  );

  // Ручне відмічання присутності: оновлюємо рядок у списку без повного перезавантаження
  const mark = async (r: RegistrationDto) => {
    try {
      const res = await api.manualCheckIn(r.id);
      if (res.ok) {
        people.setData((d) => d && d.map((x) => (x.id === r.id ? { ...x, checkedInAt: res.at ?? new Date().toISOString() } : x)));
        stats.reload();
        toast(`${r.user!.fullName} відмічено`);
      } else toast('Присутність уже підтверджено', 'error');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const exportCsv = async () => {
    try {
      const csv = await api.exportCsv(evId);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `event-${evId}-participants.csv`;
      a.click();
      toast('Файл CSV сформовано');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const cancelEvent = async () => {
    setBusy(true);
    try {
      await api.deleteEvent(evId);
      toast('Захід скасовано');
      nav('/org', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };

  const e = ev.data;
  if (ev.error && !e) return <Page back><PageHeader title="Захід" back /><ErrorState message={ev.error} onRetry={ev.reload} /></Page>;

  return (
    <Page>
      <PageHeader title={e?.title ?? 'Захід'} subtitle={e ? fmtDateTime(e.startAt) : undefined} back="/org" />
      <Segmented id="orgtab" value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Огляд' }, { value: 'people', label: 'Учасники' }, { value: 'stats', label: 'Статистика' }]} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="stack">
          {tab === 'overview' && (e ? (
            <>
              <EventCover category={e.category} layoutId={`cover-${e.id}`} height={140} radius={24} />
              <div className="seatscard">
                <Ring value={e.registered / e.capacity} label={`${e.registered}`} sub={`з ${e.capacity}`} />
                <div><b>Реєстрації</b><p>Присутніх: {e.attended}. {e.capacity - e.registered > 0 ? `Вільно ${e.capacity - e.registered} місць` : 'Місць немає'}.</p></div>
              </div>
              <div className="actions">
                <Button block icon={<ScanLine size={18} />} onClick={() => nav(`/scanner?event=${e.id}`)} disabled={e.status !== 'PUBLISHED'}>Сканувати QR-квитки</Button>
                <Button block variant="soft" icon={<Pencil size={18} />} onClick={() => nav(`/org/edit/${e.id}`)}>Редагувати</Button>
                <Button block variant="ghost" icon={<Download size={18} />} onClick={exportCsv}>Експорт учасників (CSV)</Button>
                {e.status === 'PUBLISHED' && <Button block variant="danger" icon={<Trash2 size={18} />} onClick={() => setAskCancel(true)}>Скасувати захід</Button>}
              </div>
            </>
          ) : <Skeleton h={300} />)}

          {tab === 'people' && (
            <>
              <div className="field__box searchbox"><Search size={18} /><input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Пошук учасника" aria-label="Пошук учасника" /></div>
              {people.error && !people.data && <ErrorState message={people.error} onRetry={people.reload} />}
              {people.loading && !people.data && <><Skeleton h={64} /><Skeleton h={64} /></>}
              <div className="rows">
                {list.map((r, i) => (
                  <motion.div key={r.id} className="row" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                    <span className="avatar">{initials(r.user!.fullName)}</span>
                    <div className="row__main"><b>{r.user!.fullName}</b><small>{r.checkedInAt ? `Присутній з ${fmtTime(r.checkedInAt)}` : r.user!.email}</small></div>
                    {r.checkedInAt ? <Badge kind="info"><Check size={13} /> Є</Badge> : <Button size="sm" variant="soft" onClick={() => mark(r)}>Відмітити</Button>}
                  </motion.div>
                ))}
              </div>
              {people.data && list.length === 0 && <Empty icon={<Users size={34} />} title="Учасників не знайдено" />}
            </>
          )}

          {tab === 'stats' && (stats.data ? (
            <>
              <div className="tiles">
                <div className="tile tile--lime"><b><CountUp value={stats.data.registered} /></b><span>зареєстровано</span></div>
                <div className="tile"><b><CountUp value={stats.data.attended} /></b><span>присутніх</span></div>
                <div className="tile tile--dark"><b><CountUp value={stats.data.attendancePct} suffix="%" /></b><span>відвідуваність</span></div>
              </div>
              <div className="seatscard">
                <Ring value={stats.data.attendancePct / 100} label={`${stats.data.attendancePct}%`} sub="прийшли" size={104} />
                <div><b>Заповненість {Math.round((100 * stats.data.registered) / stats.data.capacity)}%</b><p>Місткість: {stats.data.capacity}. Відвідуваність рахується від кількості активних реєстрацій.</p></div>
              </div>
              <h3 className="sect">Реєстрації за днями</h3>
              <div className="card"><BarChart data={stats.data.byDay.length ? stats.data.byDay : [{ label: '—', value: 0 }]} /></div>
              <Button block variant="ghost" icon={<FileText size={18} />} onClick={exportCsv}>Завантажити звіт CSV</Button>
            </>
          ) : stats.error ? <ErrorState message={stats.error} onRetry={stats.reload} /> : <Skeleton h={260} />)}
        </motion.div>
      </AnimatePresence>

      <Confirm open={askCancel} danger loading={busy} title="Скасувати захід?" text="Захід отримає статус «Скасовано», нові реєстрації будуть неможливі. Цю дію не можна відмінити." confirmLabel="Скасувати захід" onClose={() => setAskCancel(false)} onConfirm={cancelEvent} />
    </Page>
  );
}

/* ---------------- Форма створення / редагування заходу ---------------- */
export function EventForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const toast = useToast();
  const existing = useAsync(() => (editing ? api.event(Number(id)) : Promise.resolve(null)), [id]);
  const [f, setF] = useState<EventInput>(() => {
    const s = new Date(Date.now() + 3 * 86400_000); s.setHours(14, 0, 0, 0);
    const e = new Date(s.getTime() + 2 * 3600_000);
    return { title: '', description: '', location: '', startAt: s.toISOString(), endAt: e.toISOString(), capacity: 30, category: CATEGORIES[0] };
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  // Підставляємо дані існуючого заходу при редагуванні
  useEffect(() => {
    const e = existing.data;
    if (e) setF({ title: e.title, description: e.description, location: e.location, startAt: e.startAt, endAt: e.endAt, capacity: e.capacity, category: e.category });
  }, [existing.data]);

  const errors = {
    title: f.title.trim().length < 3 ? 'Назва має містити щонайменше 3 символи' : null,
    location: !f.location.trim() ? 'Вкажіть місце проведення' : null,
    time: new Date(f.endAt) <= new Date(f.startAt) ? 'Час завершення має бути пізніше за початок' : !editing && new Date(f.startAt) < new Date() ? 'Початок має бути в майбутньому' : null,
    capacity: !Number.isInteger(f.capacity) || f.capacity < 1 ? 'Місткість — ціле число від 1' : existing.data && f.capacity < existing.data.registered ? `Не менше за кількість реєстрацій (${existing.data.registered})` : null,
  };
  const hasErr = Object.values(errors).some(Boolean);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched(true);
    if (hasErr) { toast('Перевірте поля форми', 'error'); return; }
    setBusy(true);
    try {
      const saved = editing ? await api.updateEvent(Number(id), f) : await api.createEvent(f);
      toast(editing ? 'Зміни збережено' : 'Захід створено та опубліковано');
      nav(`/org/event/${saved.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const bump = (d: number) => setF((x) => ({ ...x, capacity: Math.max(1, (Number(x.capacity) || 0) + d) }));

  return (
    <Page>
      <PageHeader title={editing ? 'Редагування' : 'Новий захід'} subtitle="Заповніть інформацію про захід" back />
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Назва" value={f.title} onChange={(v) => setF({ ...f, title: v })} placeholder="Наприклад: Вступ до React" error={touched ? errors.title : null} />
        <div>
          <div className="field__label" style={{ marginBottom: 8 }}>Категорія</div>
          <div className="chips">{CATEGORIES.map((c) => <Chip key={c} active={f.category === c} onClick={() => setF({ ...f, category: c })}>{c}</Chip>)}</div>
        </div>
        <Field label="Опис" multiline value={f.description} onChange={(v) => setF({ ...f, description: v })} placeholder="Про що буде захід" />
        <Field label="Місце проведення" value={f.location} onChange={(v) => setF({ ...f, location: v })} placeholder="Ауд. 301, корпус 2" error={touched ? errors.location : null} />
        <div className="two">
          <Field label="Початок" type="datetime-local" value={toLocalInput(f.startAt)} onChange={(v) => v && setF({ ...f, startAt: new Date(v).toISOString() })} />
          <Field label="Завершення" type="datetime-local" value={toLocalInput(f.endAt)} onChange={(v) => v && setF({ ...f, endAt: new Date(v).toISOString() })} error={touched ? errors.time : null} />
        </div>
        <div className="field">
          <span className="field__label">Місткість</span>
          <div className="stepper">
            <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => bump(-5)} aria-label="Менше"><Minus size={18} /></motion.button>
            <input type="number" inputMode="numeric" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} aria-label="Місткість" />
            <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => bump(5)} aria-label="Більше"><Plus size={18} /></motion.button>
          </div>
          {touched && errors.capacity && <div className="field__error">{errors.capacity}</div>}
        </div>
        <Button block type="submit" loading={busy}>{editing ? 'Зберегти зміни' : 'Опублікувати захід'}</Button>
      </form>
    </Page>
  );
}

/* ---------------- Сканер QR ---------------- */
const REASON: Record<string, string> = {
  INVALID: 'Недійсний QR-код',
  USED: 'Квиток уже використано',
  CANCELLED: 'Реєстрацію скасовано',
  OTHER_EVENT: 'Квиток на інший захід',
};

export function Scanner() {
  const [params] = useSearchParams();
  const toast = useToast();
  const events = useAsync(() => api.events({ mine: true }), []);
  const [sel, setSel] = useState<number | null>(params.get('event') ? Number(params.get('event')) : null);
  const [res, setRes] = useState<CheckInResult | null>(null);
  const [busy, setBusy] = useState(false);

  const active = (events.data ?? []).filter((e) => e.status === 'PUBLISHED');
  const evId = sel ?? active[0]?.id ?? null;
  const people = useAsync(() => (evId ? api.eventRegistrations(evId) : Promise.resolve([] as RegistrationDto[])), [evId]);
  const regs = people.data ?? [];
  const done = regs.filter((r) => r.checkedInAt).length;

  // Імітація сканування (в реальному застосунку токен надходить із камери пристрою)
  const scan = async (kind: 'valid' | 'used' | 'invalid') => {
    if (!evId) return;
    setBusy(true);
    try {
      let token = 'EDU-INVALID000';
      if (kind === 'valid') token = (regs.find((r) => !r.checkedInAt) ?? regs[0])?.qrToken ?? token;
      if (kind === 'used') {
        const t = regs.find((r) => r.checkedInAt) ?? regs[0];
        if (t && !t.checkedInAt) await api.checkIn(t.qrToken, evId);
        token = t?.qrToken ?? token;
      }
      const r = await api.checkIn(token, evId);
      setRes(r);
      try { navigator.vibrate?.(r.ok ? 60 : [60, 40, 60]); } catch { /* пристрій не підтримує вібрацію */ }
      people.reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Сканер" subtitle="Check-in учасників за QR-кодом" />
      {events.error && !events.data && <ErrorState message={events.error} onRetry={events.reload} />}
      {events.data && active.length === 0 && <Empty icon={<ScanLine size={36} />} title="Немає активних заходів" text="Створіть захід, щоб відмічати учасників." />}
      {active.length > 0 && (
        <>
          <div className="chips">{active.map((e) => <Chip key={e.id} active={e.id === evId} onClick={() => setSel(e.id)}>{e.title}</Chip>)}</div>
          <div className="scanner">
            <div className="scanner__frame">
              <i className="c c1" /><i className="c c2" /><i className="c c3" /><i className="c c4" />
              <motion.span className="scanner__line" animate={{ top: ['6%', '90%', '6%'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
              <ScanLine size={54} className="scanner__icon" />
            </div>
            <p>Наведіть камеру на QR-код квитка учасника</p>
          </div>
          <div className="counter"><div><b><CountUp value={done} /></b> / {regs.length} відмічено</div>
            <div className="bar"><motion.i animate={{ width: `${regs.length ? (100 * done) / regs.length : 0}%` }} /></div></div>
          <div className="simgrid">
            <Button block loading={busy} onClick={() => scan('valid')} icon={<UserCheck size={18} />}>Дійсний квиток</Button>
            <Button block variant="ghost" disabled={busy} onClick={() => scan('used')}>Вже використаний</Button>
            <Button block variant="ghost" disabled={busy} onClick={() => scan('invalid')}>Недійсний QR</Button>
          </div>
          <p className="sim-note">У демо-режимі камера імітується. У мобільному застосунку тут працює сканер камери пристрою.</p>
        </>
      )}
      <Sheet open={!!res} onClose={() => setRes(null)}>
        {res && (
          <div className="qrsheet">
            {res.ok ? <Checkmark /> : (
              <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1, x: [0, -8, 8, -6, 6, 0] }} transition={{ duration: 0.5 }} className="failmark"><X size={44} strokeWidth={3} /></motion.div>
            )}
            <h3>{res.ok ? 'Дозволено' : 'Відмова'}</h3>
            <p>{res.ok ? <>{res.fullName}<br /><small>Присутність підтверджено о {fmtTime(res.at!)}</small></> : <>{REASON[res.reason ?? 'INVALID']}{res.fullName && <><br /><small>{res.fullName}{res.at ? ` · вхід о ${fmtTime(res.at)}` : ''}</small></>}</>}</p>
            {!res.ok && <Badge kind="danger"><TriangleAlert size={13} /> Не пропускати без перевірки</Badge>}
            <Button block onClick={() => setRes(null)}>Далі</Button>
          </div>
        )}
      </Sheet>
    </Page>
  );
}
