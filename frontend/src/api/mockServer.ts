// Фейковий REST-сервер у браузері. Має ті самі кінцеві точки, що й майбутній бекенд на FastAPI
// (див. таблицю кінцевих точок у лабораторній № 4), тому для переходу на реальний API
// достатньо вказати змінну середовища VITE_API_URL.
import { CATEGORIES, loadDb, saveDb, type Db, type DbEvent, type DbReg, type DbUser } from './mockDb';
import type { CheckInResult, EventDto, EventInput, EventStats, RegistrationDto, User } from './types';

export interface HttpResult {
  status: number;
  data: unknown;
}

const ok = (data: unknown, status = 200): HttpResult => ({ status, data });
const fail = (status: number, detail: string): HttpResult => ({ status, data: { detail } });

const pub = (u: DbUser): User => ({
  id: u.id, fullName: u.fullName, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt,
});

const userOf = (db: Db, token: string | null): DbUser | null => {
  if (!token?.startsWith('mock.')) return null;
  const u = db.users.find((x) => x.id === Number(token.slice(5)));
  return u && u.isActive ? u : null;
};

function activeRegs(db: Db, eventId: number) {
  return db.registrations.filter((r) => r.eventId === eventId && r.status === 'ACTIVE');
}

function toEvent(db: Db, e: DbEvent, me: DbUser | null): EventDto {
  const regs = activeRegs(db, e.id);
  const ids = new Set(regs.map((r) => r.id));
  const org = db.users.find((u) => u.id === e.organizerId)!;
  const mine = me ? regs.find((r) => r.userId === me.id) : undefined;
  return {
    id: e.id, title: e.title, description: e.description, location: e.location, startAt: e.startAt, endAt: e.endAt,
    capacity: e.capacity, status: e.status, category: e.category, hidden: e.hidden,
    organizer: { id: org.id, fullName: org.fullName },
    registered: regs.length,
    attended: db.checkIns.filter((c) => ids.has(c.registrationId)).length,
    myRegistrationId: mine?.id ?? null,
  };
}

function toReg(db: Db, r: DbReg, withEvent = false, withUser = false): RegistrationDto {
  const c = db.checkIns.find((x) => x.registrationId === r.id);
  const out: RegistrationDto = {
    id: r.id, eventId: r.eventId, userId: r.userId, status: r.status, registeredAt: r.registeredAt,
    qrToken: r.qrToken, checkedInAt: c?.checkedInAt ?? null,
  };
  if (withEvent) out.event = toEvent(db, db.events.find((e) => e.id === r.eventId)!, db.users.find((u) => u.id === r.userId) ?? null);
  if (withUser) {
    const u = db.users.find((x) => x.id === r.userId)!;
    out.user = { id: u.id, fullName: u.fullName, email: u.email };
  }
  return out;
}

function validateEvent(b: Partial<EventInput>): string | null {
  if (!b.title || b.title.trim().length < 3) return 'Назва має містити щонайменше 3 символи';
  if (!b.location || !b.location.trim()) return 'Вкажіть місце проведення';
  if (!b.startAt || !b.endAt) return 'Вкажіть дату та час початку й завершення';
  if (new Date(b.endAt) <= new Date(b.startAt)) return 'Час завершення має бути пізніше за час початку';
  if (!Number.isInteger(b.capacity) || (b.capacity as number) < 1) return 'Місткість має бути цілим числом не менше 1';
  if (!b.category || !CATEGORIES.includes(b.category)) return 'Оберіть категорію';
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function handle(method: string, rawPath: string, body: any, token: string | null): HttpResult {
  const db = loadDb();
  const url = new URL(rawPath, 'http://mock');
  const path = url.pathname;
  const q = url.searchParams;
  const me = userOf(db, token);
  let m: RegExpMatchArray | null;

  // ---- автентифікація
  if (method === 'POST' && path === '/auth/register') {
    if (!body?.fullName || String(body.fullName).trim().length < 2) return fail(422, 'Вкажіть прізвище та ім’я');
    if (!EMAIL.test(body.email ?? '')) return fail(422, 'Некоректна адреса електронної пошти');
    if ((body.password ?? '').length < 8) return fail(422, 'Пароль має містити щонайменше 8 символів');
    if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) return fail(409, 'Користувач із такою поштою вже існує');
    const u: DbUser = {
      id: db.seq.user++, fullName: body.fullName.trim(), email: body.email.trim(), password: body.password,
      role: 'PARTICIPANT', isActive: true, createdAt: new Date().toISOString(),
    };
    db.users.push(u);
    saveDb();
    return ok({ token: `mock.${u.id}`, user: pub(u) }, 201);
  }
  if (method === 'POST' && path === '/auth/login') {
    const u = db.users.find((x) => x.email.toLowerCase() === String(body?.email ?? '').toLowerCase());
    if (!u || u.password !== body?.password) return fail(401, 'Неправильна пошта або пароль');
    if (!u.isActive) return fail(403, 'Обліковий запис заблоковано адміністратором');
    return ok({ token: `mock.${u.id}`, user: pub(u) });
  }
  if (!me) return fail(401, 'Потрібно увійти в систему');
  if (method === 'GET' && path === '/users/me') return ok(pub(me));
  if (method === 'GET' && path === '/categories') return ok(CATEGORIES);

  // ---- заходи
  if (method === 'GET' && path === '/events') {
    const text = (q.get('q') ?? '').toLowerCase();
    const cat = q.get('category');
    const mine = q.get('mine') === '1';
    const all = q.get('all') === '1' && me.role === 'ADMIN';
    let list = db.events.filter((e) => (all ? true : !e.hidden));
    if (mine) list = list.filter((e) => e.organizerId === me.id);
    if (text) list = list.filter((e) => (e.title + ' ' + e.location).toLowerCase().includes(text));
    if (cat) list = list.filter((e) => e.category === cat);
    if (q.get('upcoming') === '1') list = list.filter((e) => e.status === 'PUBLISHED' && new Date(e.endAt) > new Date());
    // майбутні заходи – за зростанням дати, завершені – у кінці списку (від найновіших)
    const now = Date.now();
    list.sort((a, b) => {
      const fa = +new Date(a.endAt) >= now, fb = +new Date(b.endAt) >= now;
      if (fa !== fb) return fa ? -1 : 1;
      return fa ? +new Date(a.startAt) - +new Date(b.startAt) : +new Date(b.startAt) - +new Date(a.startAt);
    });
    return ok(list.map((e) => toEvent(db, e, me)));
  }
  if (method === 'POST' && path === '/events') {
    if (me.role !== 'ORGANIZER' && me.role !== 'ADMIN') return fail(403, 'Недостатньо прав для створення заходу');
    const err = validateEvent(body);
    if (err) return fail(422, err);
    const e: DbEvent = {
      id: db.seq.event++, title: body.title.trim(), description: (body.description ?? '').trim(), location: body.location.trim(),
      startAt: body.startAt, endAt: body.endAt, capacity: body.capacity, status: 'PUBLISHED', category: body.category,
      organizerId: me.id, hidden: false, createdAt: new Date().toISOString(),
    };
    db.events.push(e);
    saveDb();
    return ok(toEvent(db, e, me), 201);
  }
  if ((m = path.match(/^\/events\/(\d+)$/))) {
    const e = db.events.find((x) => x.id === Number(m![1]));
    if (!e || (e.hidden && me.role !== 'ADMIN' && e.organizerId !== me.id)) return fail(404, 'Захід не знайдено');
    if (method === 'GET') return ok(toEvent(db, e, me));
    const owner = e.organizerId === me.id || me.role === 'ADMIN';
    if (method === 'PATCH') {
      if (!owner) return fail(403, 'Редагувати можна лише власні заходи');
      if (me.role === 'ADMIN' && typeof body?.hidden === 'boolean' && Object.keys(body).length === 1) {
        e.hidden = body.hidden; // модерація: приховування заходу
      } else {
        const merged = { ...e, ...body };
        const err = validateEvent(merged);
        if (err) return fail(422, err);
        if (merged.capacity < activeRegs(db, e.id).length) return fail(409, 'Місткість не може бути меншою за кількість реєстрацій');
        Object.assign(e, { title: merged.title.trim(), description: merged.description ?? '', location: merged.location.trim(), startAt: merged.startAt, endAt: merged.endAt, capacity: merged.capacity, category: merged.category });
      }
      saveDb();
      return ok(toEvent(db, e, me));
    }
    if (method === 'DELETE') {
      if (!owner) return fail(403, 'Недостатньо прав');
      if (me.role === 'ADMIN') {
        db.events = db.events.filter((x) => x.id !== e.id);
        db.registrations = db.registrations.filter((r) => r.eventId !== e.id);
      } else {
        e.status = 'CANCELLED';
      }
      saveDb();
      return ok({ ok: true });
    }
  }

  // ---- реєстрації
  if (method === 'POST' && (m = path.match(/^\/events\/(\d+)\/registrations$/))) {
    const e = db.events.find((x) => x.id === Number(m![1]));
    if (!e || e.hidden) return fail(404, 'Захід не знайдено');
    if (e.status !== 'PUBLISHED' || new Date(e.startAt) < new Date()) return fail(409, 'Реєстрація на цей захід закрита');
    const regs = activeRegs(db, e.id);
    if (regs.some((r) => r.userId === me.id)) return fail(409, 'Ви вже зареєстровані на цей захід');
    if (regs.length >= e.capacity) return fail(409, 'Вільних місць більше немає');
    // повторна реєстрація після скасування відновлює старий запис (UNIQUE event_id + user_id)
    let r = db.registrations.find((x) => x.eventId === e.id && x.userId === me.id);
    const t = 'EDU-' + crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), '').slice(0, 10).toUpperCase();
    if (r) { r.status = 'ACTIVE'; r.qrToken = t; r.registeredAt = new Date().toISOString(); }
    else {
      r = { id: db.seq.reg++, eventId: e.id, userId: me.id, status: 'ACTIVE', registeredAt: new Date().toISOString(), qrToken: t };
      db.registrations.push(r);
    }
    saveDb();
    return ok(toReg(db, r, true), 201);
  }
  if (method === 'GET' && path === '/registrations/my') {
    const list = db.registrations.filter((r) => r.userId === me.id).sort((a, b) => b.id - a.id);
    return ok(list.map((r) => toReg(db, r, true)));
  }
  if (method === 'DELETE' && (m = path.match(/^\/registrations\/(\d+)$/))) {
    const r = db.registrations.find((x) => x.id === Number(m![1]));
    if (!r || r.userId !== me.id) return fail(404, 'Реєстрацію не знайдено');
    const e = db.events.find((x) => x.id === r.eventId)!;
    if (new Date(e.startAt) < new Date()) return fail(409, 'Захід уже розпочався, скасування неможливе');
    if (db.checkIns.some((c) => c.registrationId === r.id)) return fail(409, 'Присутність уже підтверджено');
    r.status = 'CANCELLED';
    saveDb();
    return ok(toReg(db, r, true));
  }
  if (method === 'GET' && (m = path.match(/^\/events\/(\d+)\/registrations$/))) {
    const e = db.events.find((x) => x.id === Number(m![1]));
    if (!e) return fail(404, 'Захід не знайдено');
    if (e.organizerId !== me.id && me.role !== 'ADMIN') return fail(403, 'Список доступний лише організатору');
    const list = activeRegs(db, e.id).map((r) => toReg(db, r, false, true));
    list.sort((a, b) => a.user!.fullName.localeCompare(b.user!.fullName, 'uk'));
    return ok(list);
  }

  // ---- check-in
  const doCheckIn = (r: DbReg, method: 'QR' | 'MANUAL'): CheckInResult => {
    const u = db.users.find((x) => x.id === r.userId)!;
    if (r.status !== 'ACTIVE') return { ok: false, reason: 'CANCELLED', fullName: u.fullName };
    const prev = db.checkIns.find((c) => c.registrationId === r.id);
    if (prev) return { ok: false, reason: 'USED', fullName: u.fullName, at: prev.checkedInAt };
    const c = { id: db.seq.check++, registrationId: r.id, checkedInAt: new Date().toISOString(), checkedById: me.id, method };
    db.checkIns.push(c);
    saveDb();
    return { ok: true, fullName: u.fullName, at: c.checkedInAt };
  };
  if (method === 'POST' && path === '/checkin') {
    if (me.role === 'PARTICIPANT') return fail(403, 'Check-in доступний лише організатору');
    const r = db.registrations.find((x) => x.qrToken === body?.qrToken);
    if (!r) return ok({ ok: false, reason: 'INVALID' } as CheckInResult);
    const e = db.events.find((x) => x.id === r.eventId)!;
    if (body?.eventId && body.eventId !== e.id) return ok({ ok: false, reason: 'OTHER_EVENT', fullName: db.users.find((u) => u.id === r.userId)!.fullName } as CheckInResult);
    if (e.organizerId !== me.id && me.role !== 'ADMIN') return fail(403, 'Це не ваш захід');
    return ok(doCheckIn(r, 'QR'));
  }
  if (method === 'POST' && (m = path.match(/^\/registrations\/(\d+)\/checkin$/))) {
    const r = db.registrations.find((x) => x.id === Number(m![1]));
    if (!r) return fail(404, 'Реєстрацію не знайдено');
    if (me.role === 'PARTICIPANT') return fail(403, 'Недостатньо прав');
    return ok(doCheckIn(r, 'MANUAL'));
  }

  // ---- статистика та експорт
  if (method === 'GET' && (m = path.match(/^\/events\/(\d+)\/stats$/))) {
    const e = db.events.find((x) => x.id === Number(m![1]));
    if (!e) return fail(404, 'Захід не знайдено');
    const ev = toEvent(db, e, me);
    const regs = activeRegs(db, e.id);
    const days: Record<string, number> = {};
    regs.forEach((r) => {
      const k = new Date(r.registeredAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      days[k] = (days[k] ?? 0) + 1;
    });
    const byDay = Object.entries(days).slice(-7).map(([label, value]) => ({ label, value }));
    const stats: EventStats = {
      capacity: e.capacity, registered: ev.registered, attended: ev.attended,
      attendancePct: ev.registered ? Math.round((100 * ev.attended) / ev.registered) : 0, byDay,
    };
    return ok(stats);
  }
  if (method === 'GET' && (m = path.match(/^\/events\/(\d+)\/export$/))) {
    const e = db.events.find((x) => x.id === Number(m![1]));
    if (!e) return fail(404, 'Захід не знайдено');
    const rows = activeRegs(db, e.id).map((r) => {
      const u = db.users.find((x) => x.id === r.userId)!;
      const c = db.checkIns.find((x) => x.registrationId === r.id);
      return `"${u.fullName}",${u.email},${new Date(r.registeredAt).toISOString()},${c ? 'так' : 'ні'}`;
    });
    return ok(['ПІБ,Email,Дата реєстрації,Присутній', ...rows].join('\n'));
  }

  // ---- адміністрування
  if (path.startsWith('/admin/')) {
    if (me.role !== 'ADMIN') return fail(403, 'Доступно лише адміністратору');
    if (method === 'GET' && path === '/admin/users') return ok(db.users.map(pub));
    if (method === 'PATCH' && (m = path.match(/^\/admin\/users\/(\d+)$/))) {
      const u = db.users.find((x) => x.id === Number(m![1]));
      if (!u) return fail(404, 'Користувача не знайдено');
      if (u.id === me.id) return fail(409, 'Не можна змінювати власний обліковий запис');
      if (typeof body?.isActive === 'boolean') u.isActive = body.isActive;
      if (body?.role) u.role = body.role;
      saveDb();
      return ok(pub(u));
    }
  }
  return fail(404, 'Ресурс не знайдено');
}
