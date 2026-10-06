// Глобальний стан автентифікації (React Context). Токен зберігається в localStorage,
// поточний користувач завантажується при старті через GET /users/me.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/endpoints';
import { getToken, setToken } from '../api/client';
import type { Role, User } from '../api/types';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  demo: (role: Role) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

const DEMO: Record<Role, string> = {
  PARTICIPANT: 'koval@edureg.test',
  ORGANIZER: 'melnyk@edureg.test',
  ADMIN: 'admin@edureg.test',
};

export function AuthProvider({ children, autoRole }: { children: ReactNode; autoRole?: Role }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Відновлення сесії при запуску застосунку
  useEffect(() => {
    (async () => {
      try {
        if (autoRole) {
          const r = await api.login(DEMO[autoRole], 'demo1234'); // параметр ?as= для демонстрацій
          setToken(r.token);
          setUser(r.user);
        } else if (getToken()) {
          setUser(await api.me());
        }
      } catch {
        setToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, [autoRole]);

  const accept = useCallback((r: { token: string; user: User }) => {
    setToken(r.token);
    setUser(r.user);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      ready,
      login: async (email, password) => accept(await api.login(email, password)),
      register: async (name, email, password) => accept(await api.register(name, email, password)),
      demo: async (role) => accept(await api.login(DEMO[role], 'demo1234')),
      logout: () => {
        setToken(null);
        setUser(null);
      },
    }),
    [user, ready, accept],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
