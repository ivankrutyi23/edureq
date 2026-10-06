// Типізовані функції доступу до REST API (CRUD для заходів, реєстрації, check-in, адміністрування)
import { request } from './client';
import type { AuthResponse, CheckInResult, EventDto, EventInput, EventStats, RegistrationDto, Role, User } from './types';

export const api = {
  // автентифікація
  login: (email: string, password: string) => request<AuthResponse>('POST', '/auth/login', { email, password }),
  register: (fullName: string, email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/register', { fullName, email, password }),
  me: () => request<User>('GET', '/users/me'),

  // заходи (Read / Create / Update / Delete)
  events: (p: { q?: string; category?: string; mine?: boolean; all?: boolean; upcoming?: boolean } = {}) => {
    const s = new URLSearchParams();
    if (p.q) s.set('q', p.q);
    if (p.category) s.set('category', p.category);
    if (p.mine) s.set('mine', '1');
    if (p.all) s.set('all', '1');
    if (p.upcoming) s.set('upcoming', '1');
    return request<EventDto[]>('GET', `/events?${s}`);
  },
  event: (id: number) => request<EventDto>('GET', `/events/${id}`),
  createEvent: (b: EventInput) => request<EventDto>('POST', '/events', b),
  updateEvent: (id: number, b: Partial<EventInput> & { hidden?: boolean }) => request<EventDto>('PATCH', `/events/${id}`, b),
  deleteEvent: (id: number) => request<{ ok: boolean }>('DELETE', `/events/${id}`),

  // реєстрації
  registerForEvent: (id: number) => request<RegistrationDto>('POST', `/events/${id}/registrations`),
  cancelRegistration: (id: number) => request<RegistrationDto>('DELETE', `/registrations/${id}`),
  myRegistrations: () => request<RegistrationDto[]>('GET', '/registrations/my'),
  eventRegistrations: (id: number) => request<RegistrationDto[]>('GET', `/events/${id}/registrations`),

  // присутність, статистика, експорт
  checkIn: (qrToken: string, eventId: number) => request<CheckInResult>('POST', '/checkin', { qrToken, eventId }),
  manualCheckIn: (regId: number) => request<CheckInResult>('POST', `/registrations/${regId}/checkin`),
  stats: (id: number) => request<EventStats>('GET', `/events/${id}/stats`),
  exportCsv: (id: number) => request<string>('GET', `/events/${id}/export`),

  // адміністратор
  users: () => request<User[]>('GET', '/admin/users'),
  patchUser: (id: number, b: { isActive?: boolean; role?: Role }) => request<User>('PATCH', `/admin/users/${id}`, b),
};
