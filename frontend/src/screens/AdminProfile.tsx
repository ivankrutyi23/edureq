// Екрани адміністратора (користувачі, модерація заходів) та профіль користувача
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogOut, RotateCcw, Search, Server, ShieldCheck, Trash2, Users, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/endpoints';
import { isOffline, setOffline, usingMock } from '../api/client';
import { apiState } from '../api/config';
import { resetDb } from '../api/mockDb';
import type { Role, User } from '../api/types';
import { ErrorState, Page, PageHeader } from '../components/layout';
import { Badge, Button, Confirm, Empty, Segmented, Sheet, Skeleton, Switch } from '../components/ui';
import { initials, roleLabel } from '../lib/format';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { useAsync } from '../state/useAsync';

/* ---------------- Користувачі ---------------- */
export function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => api.users(), []);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(12);
  const [edit, setEdit] = useState<User | null>(null);

  const list = useMemo(() => (data ?? []).filter((u) => !q || (u.fullName + u.email).toLowerCase().includes(q.toLowerCase())), [data, q]);

  const patch = async (u: User, b: { isActive?: boolean; role?: Role }) => {
    try {
      const saved = await api.patchUser(u.id, b);
      setData((d) => d && d.map((x) => (x.id === u.id ? saved : x)));
      setEdit(saved);
      toast('Зміни збережено');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Page>
      <PageHeader title="Користувачі" subtitle={data ? `Усього: ${data.length}` : 'Керування ролями та доступом'} />
      <div className="field__box searchbox"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за ім’ям або поштою" aria-label="Пошук" /></div>
      {error && !data && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <div className="stack"><Skeleton h={64} /><Skeleton h={64} /><Skeleton h={64} /></div>}
      <div className="rows">
        {list.slice(0, limit).map((u, i) => (
          <motion.button key={u.id} className="row row--btn" onClick={() => u.id !== me!.id && setEdit(u)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
            <span className={`avatar ${u.isActive ? '' : 'avatar--off'}`}>{initials(u.fullName)}</span>
            <div className="row__main"><b>{u.fullName}</b><small>{u.email}</small></div>
            {!u.isActive ? <Badge kind="danger">Заблоковано</Badge> : <Badge kind={u.role === 'ADMIN' ? 'dark' : u.role === 'ORGANIZER' ? 'info' : undefined}>{roleLabel[u.role]}</Badge>}
          </motion.button>
        ))}
      </div>
      {list.length > limit && <Button block variant="soft" onClick={() => setLimit(limit + 15)}>Показати ще</Button>}
      {data && list.length === 0 && <Empty icon={<Users size={34} />} title="Нікого не знайдено" />}
      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <div className="stack">
            <div className="usersheet"><span className="avatar avatar--lg">{initials(edit.fullName)}</span><div><b>{edit.fullName}</b><small>{edit.email}</small></div></div>
            <div><div className="field__label" style={{ marginBottom: 8 }}>Роль</div>
              <Segmented id="role" value={edit.role} onChange={(r) => patch(edit, { role: r })} options={[{ value: 'PARTICIPANT', label: 'Учасник' }, { value: 'ORGANIZER', label: 'Організатор' }, { value: 'ADMIN', label: 'Адмін' }]} /></div>
            <div className="setting"><div><b>Обліковий запис активний</b><small>Заблокований користувач не може увійти</small></div><Switch on={edit.isActive} onChange={(v) => patch(edit, { isActive: v })} label="Активний" /></div>
            <Button block variant="ghost" onClick={() => setEdit(null)}>Готово</Button>
          </div>
        )}
      </Sheet>
    </Page>
  );
}

/* ---------------- Модерація заходів ---------------- */
export function AdminEvents() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => api.events({ all: true }), []);
  const [del, setDel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (id: number, hidden: boolean) => {
    try {
      await api.updateEvent(id, { hidden });
      setData((d) => d && d.map((e) => (e.id === id ? { ...e, hidden } : e)));
      toast(hidden ? 'Захід приховано від учасників' : 'Захід знову видимий');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const remove = async () => {
    if (del == null) return;
    setBusy(true);
    try {
      await api.deleteEvent(del);
      setData((d) => d && d.filter((e) => e.id !== del));
      toast('Захід видалено');
      setDel(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Модерація" subtitle="Заходи, що порушують правила, можна приховати" />
      {error && !data && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <div className="stack"><Skeleton h={78} /><Skeleton h={78} /></div>}
      <div className="rows">
        {data?.map((e, i) => (
          <motion.div key={e.id} layout className="row row--event" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
            <div className="row__main"><b>{e.title}</b><small>{e.category} · {e.organizer.fullName} · {e.registered}/{e.capacity}</small>
              <div className="ecard__tags" style={{ marginTop: 6 }}>{e.hidden && <Badge kind="warn">Приховано</Badge>}{e.status === 'CANCELLED' && <Badge kind="danger">Скасовано</Badge>}{e.status === 'FINISHED' && <Badge kind="info">Завершено</Badge>}</div></div>
            <motion.button whileTap={{ scale: 0.88 }} className="iconbtn" onClick={() => toggle(e.id, !e.hidden)} aria-label={e.hidden ? 'Показати' : 'Приховати'}>{e.hidden ? <Eye size={19} /> : <EyeOff size={19} />}</motion.button>
            <motion.button whileTap={{ scale: 0.88 }} className="iconbtn iconbtn--danger" onClick={() => setDel(e.id)} aria-label="Видалити"><Trash2 size={19} /></motion.button>
          </motion.div>
        ))}
      </div>
      <Confirm open={del != null} danger loading={busy} title="Видалити захід?" text="Захід і всі його реєстрації буде видалено без можливості відновлення." confirmLabel="Видалити" onClose={() => setDel(null)} onConfirm={remove} />
    </Page>
  );
}

/* ---------------- Профіль ---------------- */
export function Profile() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [off, setOff] = useState(isOffline());
  const [ask, setAsk] = useState(false);
  if (!user) return null;
  return (
    <Page>
      <PageHeader title="Профіль" />
      <motion.div className="profile" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <span className="avatar avatar--xl">{initials(user.fullName)}</span>
        <h2>{user.fullName}</h2>
        <p>{user.email}</p>
        <Badge kind={user.role === 'ADMIN' ? 'dark' : undefined}><ShieldCheck size={13} /> {roleLabel[user.role]}</Badge>
      </motion.div>

      {usingMock() ? (
        <>
          <h3 className="sect">Налаштування демо</h3>
          <div className="card setting-list">
            <div className="setting"><div><b><WifiOff size={15} style={{ verticalAlign: -2 }} /> Імітувати втрату мережі</b><small>Покаже, як застосунок обробляє помилки запитів</small></div>
              <Switch on={off} onChange={(v) => { setOff(v); setOffline(v); toast(v ? 'Мережу вимкнено (імітація)' : 'Мережу відновлено'); }} label="Імітація втрати мережі" /></div>
            <div className="setting"><div><b><RotateCcw size={15} style={{ verticalAlign: -2 }} /> Скинути демо-дані</b><small>Відновити початковий набір заходів</small></div>
              <Button size="sm" variant="soft" onClick={() => setAsk(true)}>Скинути</Button></div>
          </div>
        </>
      ) : (
        <>
          <h3 className="sect">З’єднання</h3>
          <div className="card setting-list">
            <div className="setting"><div><b><Server size={15} style={{ verticalAlign: -2 }} /> Підключено до сервера</b><small>{apiState().base}</small></div><Badge kind="info">онлайн</Badge></div>
          </div>
        </>
      )}
      <div className="about">EduReg · версія 1.0 · {usingMock() ? 'демо-режим (mock API)' : apiState().note}</div>
      <Button block variant="dark" icon={<LogOut size={18} />} onClick={logout}>Вийти з акаунта</Button>
      <Confirm open={ask} title="Скинути демо-дані?" text="Усі зміни (реєстрації, нові заходи) буде втрачено, а початкові дані — відновлено." confirmLabel="Скинути" onClose={() => setAsk(false)}
        onConfirm={() => { resetDb(); logout(); setAsk(false); }} />
    </Page>
  );
}
