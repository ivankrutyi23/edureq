// Типи даних, які передаються між клієнтом і REST API (відповідають БД з лабораторної № 5)

export type Role = 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN';
export type EventStatus = 'PUBLISHED' | 'CANCELLED' | 'FINISHED';
export type RegStatus = 'ACTIVE' | 'CANCELLED';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface EventDto {
  id: number;
  title: string;
  description: string;
  location: string;
  startAt: string; // ISO-рядок
  endAt: string;
  capacity: number;
  status: EventStatus;
  category: string;
  organizer: { id: number; fullName: string };
  registered: number; // кількість активних реєстрацій
  attended: number; // кількість підтверджених присутностей
  hidden: boolean; // приховано модератором
  myRegistrationId: number | null; // реєстрація поточного користувача (якщо є)
}

export interface RegistrationDto {
  id: number;
  eventId: number;
  userId: number;
  status: RegStatus;
  registeredAt: string;
  qrToken: string;
  checkedInAt: string | null;
  event?: EventDto;
  user?: { id: number; fullName: string; email: string };
}

export interface EventInput {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  category: string;
}

export interface EventStats {
  capacity: number;
  registered: number;
  attended: number;
  attendancePct: number;
  byDay: { label: string; value: number }[];
}

export interface CheckInResult {
  ok: boolean;
  fullName?: string;
  reason?: 'INVALID' | 'USED' | 'CANCELLED' | 'OTHER_EVENT';
  at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
