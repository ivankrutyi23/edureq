// Локальна «база даних» фейкового сервера. Структура повторює таблиці з лабораторної № 5.
// Дані зберігаються в localStorage, тому реєстрації не зникають після перезавантаження.
import type { EventStatus, RegStatus, Role } from './types';

export interface DbUser {
  id: number;
  fullName: string;
  email: string;
  password: string; // у демо – відкритий текст; у реальній системі – лише хеш
  role: Role;
  isActive: boolean;
  createdAt: string;
}
export interface DbEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  status: EventStatus;
  category: string;
  organizerId: number;
  hidden: boolean;
  createdAt: string;
}
export interface DbReg {
  id: number;
  eventId: number;
  userId: number;
  status: RegStatus;
  registeredAt: string;
  qrToken: string;
}
export interface DbCheckIn {
  id: number;
  registrationId: number;
  checkedInAt: string;
  checkedById: number;
  method: 'QR' | 'MANUAL';
}
export interface Db {
  users: DbUser[];
  events: DbEvent[];
  registrations: DbReg[];
  checkIns: DbCheckIn[];
  seq: { user: number; event: number; reg: number; check: number };
}

export const CATEGORIES = ['Лекція', 'Семінар', 'Майстер-клас', 'Конференція'];

const KEY = 'edureg.db.v2';

// Детермінований генератор псевдовипадкових чисел (однакові демо-дані при кожному скиданні)
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (dayOffset: number, hour: number, minute = 0, durationH = 2) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  const end = new Date(d.getTime() + durationH * 3600_000);
  return [d.toISOString(), end.toISOString()] as const;
};

function token(rand: () => number) {
  return 'EDU-' + Array.from({ length: 10 }, () => Math.floor(rand() * 36).toString(36)).join('').toUpperCase();
}

export function seed(): Db {
  const rand = rng(2026);
  const first = ['Андрій', 'Марія', 'Олег', 'Софія', 'Тарас', 'Ірина', 'Богдан', 'Наталя', 'Назар', 'Юлія', 'Максим', 'Вікторія'];
  const last = ['Мельник', 'Шевченко', 'Коваль', 'Бондар', 'Лисенко', 'Гончар', 'Ткач', 'Кравець'];
  const now = new Date().toISOString();

  const users: DbUser[] = [
    { id: 1, fullName: 'Адміністратор Системи', email: 'admin@edureg.test', password: 'demo1234', role: 'ADMIN', isActive: true, createdAt: now },
    { id: 2, fullName: 'Мельник Оксана', email: 'melnyk@edureg.test', password: 'demo1234', role: 'ORGANIZER', isActive: true, createdAt: now },
    { id: 3, fullName: 'Шевченко Андрій', email: 'shevchenko@edureg.test', password: 'demo1234', role: 'ORGANIZER', isActive: true, createdAt: now },
    { id: 4, fullName: 'Коваль Ірина', email: 'koval@edureg.test', password: 'demo1234', role: 'PARTICIPANT', isActive: true, createdAt: now },
  ];
  // Додаткові учасники для наповнення списків
  const used = new Set(['Коваль Ірина']);
  while (users.length < 52) {
    const name = `${last[Math.floor(rand() * last.length)]} ${first[Math.floor(rand() * first.length)]}`;
    if (used.has(name)) continue;
    used.add(name);
    const id = users.length + 1;
    users.push({ id, fullName: name, email: `user${id}@edureg.test`, password: 'demo1234', role: 'PARTICIPANT', isActive: id % 17 !== 0, createdAt: now });
  }

  const mk = (
    id: number, title: string, category: string, org: number, day: number, h: number, m: number,
    dur: number, capacity: number, location: string, description: string, status: EventStatus = 'PUBLISHED',
  ): DbEvent => {
    const [startAt, endAt] = iso(day, h, m, dur);
    return { id, title, category, organizerId: org, startAt, endAt, capacity, location, description, status, hidden: false, createdAt: now };
  };
  const events: DbEvent[] = [
    mk(1, 'Вступ до React Native', 'Майстер-клас', 2, 3, 14, 0, 2, 30, 'Ауд. 301, корпус 2', 'Практичне заняття: створюємо перший мобільний застосунок на React Native та запускаємо його на смартфоні. Ноутбук бажано мати з собою.'),
    mk(2, 'Основи REST API', 'Лекція', 3, 5, 10, 0, 1.5, 25, 'Ауд. 215, корпус 1', 'Як проєктувати вебсервіси: ресурси, HTTP-методи, коди відповідей, автентифікація за токеном.'),
    mk(3, 'Студентська конференція ІТ', 'Конференція', 2, 21, 9, 0, 8, 80, 'Актова зала', 'Щорічна конференція: доповіді студентів, стендові презентації та панельна дискусія з представниками IT-компаній.'),
    mk(4, 'Семінар з тестування ПЗ', 'Семінар', 3, 9, 15, 0, 1.5, 20, 'Ауд. 108, корпус 2', 'Модульні та інтеграційні тести, тест-кейси, баг-репорти. Розбираємо реальні приклади з проєктів.'),
    mk(5, 'Git для початківців', 'Майстер-клас', 2, 12, 16, 30, 2, 24, 'Комп’ютерний клас 12', 'Гілки, коміти, pull request. Працюємо в команді так, як це відбувається в індустрії.'),
    mk(6, 'UX-дизайн: від ідеї до прототипу', 'Лекція', 3, 16, 11, 0, 2, 60, 'Ауд. 401, корпус 3', 'Користувацькі сценарії, wireframe, прототип та оцінка зручності інтерфейсу.'),
    mk(7, 'День відкритих дверей кафедри', 'Конференція', 2, 28, 10, 0, 4, 60, 'Корпус 2, фойє', 'Знайомство з кафедрою, лабораторіями та студентськими проєктами для майбутніх студентів.'),
    mk(8, 'Хакатон «Smart Campus»', 'Семінар', 3, 35, 9, 0, 10, 40, 'Коворкінг-простір', 'Командний марафон: створюємо прототип сервісу для розумного кампусу за одну добу.'),
    mk(9, 'Вступ до Python', 'Лекція', 2, -6, 14, 0, 2, 40, 'Ауд. 301, корпус 2', 'Синтаксис, типи даних, функції та перші програми мовою Python.', 'FINISHED'),
    mk(10, 'Основи SQL', 'Семінар', 3, -13, 13, 0, 2, 30, 'Ауд. 215, корпус 1', 'Запити SELECT, об’єднання таблиць та проєктування бази даних.', 'FINISHED'),
  ];

  // Наповнюємо реєстраціями (кількість – частка від місткості)
  const fill: Record<number, number> = { 1: 22, 2: 25, 3: 48, 4: 9, 5: 11, 6: 37, 7: 29, 8: 24, 9: 31, 10: 26 };
  const registrations: DbReg[] = [];
  const checkIns: DbCheckIn[] = [];
  const participants = users.filter((u) => u.role === 'PARTICIPANT');
  let regId = 1;
  let checkId = 1;
  for (const ev of events) {
    const pool = [...participants].sort(() => rand() - 0.5);
    // Демо-учасник (Коваль Ірина) записаний на кілька заходів
    const mustHave = [1, 4, 9].includes(ev.id) ? [participants[0]] : [];
    const chosen = [...mustHave, ...pool.filter((u) => !mustHave.includes(u))].slice(0, Math.min(fill[ev.id], participants.length));
    for (const u of chosen) {
      const r: DbReg = {
        id: regId++, eventId: ev.id, userId: u.id, status: 'ACTIVE',
        registeredAt: new Date(new Date(ev.startAt).getTime() - (2 + rand() * 12) * 86400_000).toISOString(),
        qrToken: token(rand),
      };
      registrations.push(r);
      const past = ev.status === 'FINISHED';
      if (past && (u.id === 4 || rand() < 0.77)) {
        checkIns.push({ id: checkId++, registrationId: r.id, checkedInAt: new Date(new Date(ev.startAt).getTime() + rand() * 1800_000).toISOString(), checkedById: ev.organizerId, method: rand() < 0.9 ? 'QR' : 'MANUAL' });
      }
    }
  }
  // Скасована реєстрація демо-учасника
  registrations.push({ id: regId++, eventId: 5, userId: 4, status: 'CANCELLED', registeredAt: now, qrToken: token(rand) });
  return { users, events, registrations, checkIns, seq: { user: users.length + 1, event: events.length + 1, reg: regId, check: checkId } };
}

let cache: Db | null = null;

export function loadDb(): Db {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as Db;
      return cache;
    }
  } catch {
    /* localStorage може бути недоступним – працюємо в пам’яті */
  }
  cache = seed();
  saveDb();
  return cache;
}

export function saveDb() {
  try {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ігноруємо */
  }
}

export function resetDb() {
  cache = seed();
  saveDb();
}
