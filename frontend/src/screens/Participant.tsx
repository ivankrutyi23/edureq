// Екрани учасника: перелік заходів, картка заходу з реєстрацією, мої квитки
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Clock, MapPin, QrCode, Search, Settings2, Ticket, UserRound, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES } from '../api/mockDb';
import { api } from '../api/endpoints';
import type { RegistrationDto } from '../api/types';
import { EventCard, EventCardSkeleton } from '../components/EventCard';
import { EventCover } from '../components/EventCover';
import { ErrorState, Page, PageHeader } from '../components/layout';
import { Badge, Button, Checkmark, Chip, Confetti, Confirm, Empty, Ring, Segmented, Sheet, Skeleton } from '../components/ui';
import { fmtDate, fmtDateTime, fmtRange, fmtTime, fmtWeekday, relDays } from '../lib/format';
import { useAuth } from '../state/auth';
import { useAsync } from '../state/useAsync';
import { useToast } from '../state/toast';

/* ---------------- Перелік заходів ---------------- */
export function EventsScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [cat, setCat] = useState<string>('');

  // «debounce»: запит надсилається через 350 мс після останнього введеного символу
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading, error, reload } = useAsync(() => api.events({ q: dq, category: cat, upcoming: true }), [dq, cat]);
  const first = !dq && !cat ? data?.[0] : undefined;
  const list = first ? data!.slice(1) : data ?? [];
  const firstName = user!.fullName.split(' ')[1] ?? user!.fullName;

  return (
    <Page>
      <PageHeader title={`Привіт, ${firstName}!`} subtitle="Оберіть захід і зареєструйтесь" />
      <div className="field__box searchbox">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук заходів і місць" aria-label="Пошук" />
        {q && <button onClick={() => setQ('')} aria-label="Очистити"><X size={18} /></button>}
      </div>
      <div className="chips">
        <Chip active={!cat} onClick={() => setCat('')}>Усі</Chip>
        {CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>

      {first && (
        <motion.div className="nextcard" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onClick={() => nav(`/event/${first.id}`)} role="button">
          <Badge kind="dark">Найближчий захід</Badge>
          <h2>{first.title}</h2>
          <p><Clock size={16} /> {relDays(first.startAt)} · {fmtTime(first.startAt)} <MapPin size={16} /> {first.location}</p>
          <Button variant="dark" size="sm">Докладніше</Button>
        </motion.div>
      )}

      {error && !data && <ErrorState message={error} onRetry={reload} />}
      <div className="grid">
        {loading && !data && Array.from({ length: 3 }).map((_, i) => <EventCardSkeleton key={i} />)}
        {list.map((ev, i) => <EventCard key={ev.id} ev={ev} index={i} onClick={() => nav(`/event/${ev.id}`)} />)}
      </div>
      {data && data.length === 0 && (
        <Empty icon={<Search size={36} />} title="Нічого не знайдено" text="Спробуйте змінити запит або категорію." action={<Button variant="soft" size="sm" onClick={() => { setQ(''); setCat(''); }}>Скинути фільтри</Button>} />
      )}
    </Page>
  );
}

/* ---------------- Картка заходу + реєстрація ---------------- */
export function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data: ev, loading, error, reload, setData } = useAsync(() => api.event(Number(id)), [id]);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [ticket, setTicket] = useState<RegistrationDto | null>(null);
  const [boom, setBoom] = useState(false);

  // Реєстрація: оновлюємо локальний стан одразу після відповіді сервера, помилки показуємо тостом
  const register = async () => {
    if (!ev) return;
    setBusy(true);
    try {
      const reg = await api.registerForEvent(ev.id);
      setData((e) => e && { ...e, registered: e.registered + 1, myRegistrationId: reg.id });
      setTicket(reg);
      setBoom(true);
      setTimeout(() => setBoom(false), 2400);
    } catch (e) {
      toast((e as Error).message, 'error');
      reload(); // синхронізуємо дані (можливо, місця вже закінчились)
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!ev?.myRegistrationId) return;
    setBusy(true);
    try {
      await api.cancelRegistration(ev.myRegistrationId);
      setData((e) => e && { ...e, registered: e.registered - 1, myRegistrationId: null });
      toast('Реєстрацію скасовано, місце звільнено');
      setConfirmCancel(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openTicket = async () => {
    const list = await api.myRegistrations();
    const reg = list.find((r) => r.id === ev!.myRegistrationId);
    if (reg) setTicket(reg);
  };

  if (error && !ev) return <Page back><PageHeader title="Захід" back /><ErrorState message={error} onRetry={reload} /></Page>;
  const left = ev ? ev.capacity - ev.registered : 0;
  const started = ev ? new Date(ev.startAt) < new Date() : false;
  const closed = !!ev && (ev.status !== 'PUBLISHED' || started);
  const owner = ev && (ev.organizer.id === user!.id || user!.role === 'ADMIN');

  return (
    <Page>
      <div className="detail">
        <div className="detail__cover">
          {ev ? <EventCover category={ev.category} layoutId={`cover-${ev.id}`} height={210} radius={28} large /> : <Skeleton h={210} r={28} />}
          <motion.button whileTap={{ scale: 0.9 }} className="detail__back" onClick={() => nav(-1)} aria-label="Назад"><ArrowLeft size={22} /></motion.button>
        </div>
        {!ev || loading && !ev ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}><Skeleton h={30} w="70%" /><Skeleton h={18} w="50%" /><Skeleton h={140} /></div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="ecard__tags" style={{ marginTop: 18 }}>
              <Badge>{ev.category}</Badge>
              {ev.status === 'CANCELLED' && <Badge kind="danger">Скасовано</Badge>}
              {ev.status === 'FINISHED' && <Badge kind="info">Завершено</Badge>}
              {ev.myRegistrationId && <Badge kind="dark">Ви зареєстровані</Badge>}
            </div>
            <h1 className="detail__title">{ev.title}</h1>

            <div className="infos">
              <div className="info"><span><CalendarDays size={20} /></span><div><small>Дата</small><b>{fmtDate(ev.startAt)}, {fmtWeekday(ev.startAt)}</b></div></div>
              <div className="info"><span><Clock size={20} /></span><div><small>Час</small><b>{fmtRange(ev.startAt, ev.endAt)}</b></div></div>
              <div className="info"><span><MapPin size={20} /></span><div><small>Місце</small><b>{ev.location}</b></div></div>
              <div className="info"><span><UserRound size={20} /></span><div><small>Організатор</small><b>{ev.organizer.fullName}</b></div></div>
            </div>

            <div className="seatscard">
              <Ring value={ev.registered / ev.capacity} label={left > 0 ? String(left) : '0'} sub="вільно" />
              <div>
                <b>{left > 0 ? `Залишилось ${left} місць` : 'Усі місця зайняті'}</b>
                <p>Зареєстровано {ev.registered} із {ev.capacity} · {relDays(ev.startAt)}</p>
              </div>
            </div>

            <h3 className="sect">Про захід</h3>
            <p className="desc">{ev.description}</p>
            <div style={{ height: 96 }} />
          </motion.div>
        )}
      </div>

      {ev && (
        <div className="cta">
          {user!.role === 'PARTICIPANT' ? (
            ev.myRegistrationId ? (
              <>
                <Button block icon={<QrCode size={18} />} onClick={openTicket}>Мій квиток</Button>
                {!started && <Button variant="danger" onClick={() => setConfirmCancel(true)}>Скасувати</Button>}
              </>
            ) : (
              <Button block loading={busy} disabled={closed || left <= 0} onClick={register} icon={<Ticket size={18} />}>
                {ev.status === 'CANCELLED' ? 'Захід скасовано' : started ? 'Реєстрацію закрито' : left <= 0 ? 'Місць немає' : 'Зареєструватися'}
              </Button>
            )
          ) : owner ? (
            <Button block variant="dark" icon={<Settings2 size={18} />} onClick={() => nav(`/org/event/${ev.id}`)}>Керувати заходом</Button>
          ) : null}
        </div>
      )}

      <Confetti show={boom} />
      <Sheet open={!!ticket} onClose={() => setTicket(null)}>
        {ticket && ev && <TicketSheet reg={ticket} title={ev.title} when={fmtDateTime(ev.startAt)} fresh={boom} onClose={() => setTicket(null)} onAll={() => nav('/tickets')} />}
      </Sheet>
      <Confirm open={confirmCancel} danger loading={busy} title="Скасувати реєстрацію?" text="Місце буде звільнено, а QR-квиток стане недійсним. Ви зможете зареєструватися повторно, якщо залишаться місця." confirmLabel="Скасувати реєстрацію" onClose={() => setConfirmCancel(false)} onConfirm={cancel} />
    </Page>
  );
}

/* Вміст нижнього листа з QR-квитком */
function TicketSheet({ reg, title, when, fresh, onClose, onAll }: { reg: RegistrationDto; title: string; when: string; fresh?: boolean; onClose: () => void; onAll: () => void }) {
  return (
    <div className="qrsheet">
      {fresh && <Checkmark />}
      <h3>{fresh ? 'Ви зареєстровані!' : 'Ваш QR-квиток'}</h3>
      <p>{title}<br /><small>{when}</small></p>
      <motion.div className="qrbox" initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.1 }}>
        <QRCodeSVG value={reg.qrToken} size={188} fgColor="#163300" bgColor="#ffffff" level="M" />
      </motion.div>
      <code>{reg.qrToken}</code>
      <div className="confirm__row">
        <Button variant="ghost" onClick={onClose}>Закрити</Button>
        <Button onClick={() => { onClose(); onAll(); }}>Мої квитки</Button>
      </div>
    </div>
  );
}

/* ---------------- Мої квитки ---------------- */
export function TicketsScreen() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [open, setOpen] = useState<RegistrationDto | null>(null);
  const { data, loading, error, reload } = useAsync(() => api.myRegistrations(), []);
  const isUpcoming = (r: RegistrationDto) => r.status === 'ACTIVE' && !!r.event && r.event.status === 'PUBLISHED' && new Date(r.event.endAt) > new Date();
  const list = (data ?? []).filter((r) => (tab === 'active' ? isUpcoming(r) : !isUpcoming(r)));

  return (
    <Page>
      <PageHeader title="Мої квитки" subtitle="Покажіть QR-код на вході" />
      <Segmented id="tickets" value={tab} onChange={setTab} options={[{ value: 'active', label: 'Активні' }, { value: 'past', label: 'Минулі' }]} />
      {error && !data && <ErrorState message={error} onRetry={reload} />}
      <div className="grid grid--tickets">
        {loading && !data && <><Skeleton h={150} /><Skeleton h={150} /></>}
        <AnimatePresence mode="popLayout">
          {list.map((r, i) => {
            const e = r.event!;
            const status = r.status === 'CANCELLED' ? ['Скасовано', 'danger'] : r.checkedInAt ? ['Відвідано', 'info'] : isUpcoming(r) ? ['Активний', undefined] : ['Не відвідано', 'warn'];
            return (
              <motion.div key={r.id} layout className={`ticket ${isUpcoming(r) ? '' : 'ticket--muted'}`}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.05 }}
                whileTap={isUpcoming(r) ? { scale: 0.98 } : undefined} onClick={() => isUpcoming(r) && setOpen(r)} role="button">
                <div className="ticket__date"><b>{new Date(e.startAt).getDate()}</b><span>{new Date(e.startAt).toLocaleDateString('uk-UA', { month: 'short' }).replace('.', '')}</span></div>
                <div className="ticket__main">
                  <Badge kind={status[1] as 'danger' | 'warn' | 'info' | undefined}>{status[0]}</Badge>
                  <h3>{e.title}</h3>
                  <p><Clock size={14} /> {fmtTime(e.startAt)} · <MapPin size={14} /> {e.location}</p>
                </div>
                {isUpcoming(r) && <div className="ticket__qr"><QRCodeSVG value={r.qrToken} size={54} fgColor="#163300" /></div>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {data && list.length === 0 && (
        <Empty icon={<Ticket size={36} />} title={tab === 'active' ? 'Немає активних квитків' : 'Історія порожня'}
          text={tab === 'active' ? 'Зареєструйтесь на захід — квиток з’явиться тут.' : 'Тут зберігатимуться відвідані та скасовані заходи.'}
          action={tab === 'active' ? <Button size="sm" onClick={() => nav('/events')}>До заходів</Button> : undefined} />
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && <TicketSheet reg={open} title={open.event!.title} when={fmtDateTime(open.event!.startAt)} onClose={() => setOpen(null)} onAll={() => {}} />}
      </Sheet>
    </Page>
  );
}
