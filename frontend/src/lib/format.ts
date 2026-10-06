// Допоміжні функції форматування дат і чисел (українська локаль)
const uk = 'uk-UA';

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(uk, { day: 'numeric', month: 'long' });

export const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString(uk, { day: '2-digit', month: 'short' }).replace('.', '');

export const fmtWeekday = (iso: string) =>
  new Date(iso).toLocaleDateString(uk, { weekday: 'long' });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(uk, { hour: '2-digit', minute: '2-digit' });

export const fmtRange = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;

export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

/** «Через 3 дні», «Сьогодні», «Завтра», «6 днів тому» */
export function relDays(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((+day - +today) / 86400_000);
  if (diff === 0) return 'Сьогодні';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчора';
  const n = Math.abs(diff);
  const word = n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дні' : 'днів';
  return diff > 0 ? `Через ${n} ${word}` : `${n} ${word} тому`;
}

/** Значення для <input type="datetime-local"> з ISO-рядка */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const roleLabel = { PARTICIPANT: 'Учасник', ORGANIZER: 'Організатор', ADMIN: 'Адміністратор' } as const;
