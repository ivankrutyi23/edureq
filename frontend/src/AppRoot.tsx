// Корінь клієнтського застосунку: заставка, маршрути за ролями, анімовані переходи між екранами
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from './api/types';
import { Logo, Nav, StatusBar } from './components/layout';
import { AdminEvents, AdminUsers, Profile } from './screens/AdminProfile';
import { EventForm, OrgEvent, OrgHome, Scanner } from './screens/Organizer';
import { EventDetail, EventsScreen, TicketsScreen } from './screens/Participant';
import { AuthScreen, Welcome } from './screens/Welcome';
import { AuthProvider, useAuth } from './state/auth';
import { ToastProvider } from './state/toast';

export interface AppProps {
  statusBar?: 'ios' | 'android'; // показувати імітацію системного рядка стану
  autoRole?: Role; // автоматичний демо-вхід (для демонстрацій і скріншотів)
}

const HOME: Record<Role, string> = { PARTICIPANT: '/events', ORGANIZER: '/org', ADMIN: '/admin/users' };

function Splash() {
  return (
    <motion.div className="splash" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <motion.div initial={{ scale: 0.3, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
        <Logo size={96} />
      </motion.div>
      <motion.b initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>EduReg</motion.b>
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>Реєстрація на освітні заходи</motion.span>
    </motion.div>
  );
}

function Routed() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const [splash, setSplash] = useState(() => {
    if (new URLSearchParams(window.location.search).has('nosplash')) return false; // для автоматичних знімків екрана
    try { return !sessionStorage.getItem('edureg.splash'); } catch { return true; }
  });
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => {
      setSplash(false);
      try { sessionStorage.setItem('edureg.splash', '1'); } catch { /* ігноруємо */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [splash]);

  const showSplash = splash || !ready;
  const role = user?.role;

  return (
    <>
      <AnimatePresence>{showSplash && <Splash key="splash" />}</AnimatePresence>
      {ready && (
        <div className={`app__body ${user ? '' : 'app__body--guest'}`}>
          {user && <Nav role={user.role} />}
          <main className="app__main">
            {/* mode="sync": екран, що йде, ще видимий під час появи нового – це дає змогу працювати спільній анімації обкладинок */}
            <AnimatePresence mode="sync" initial={false}>
              <Routes location={location} key={location.pathname.split('/').slice(0, 3).join('/')}>
                {!user && <>
                  <Route path="/" element={<Welcome />} />
                  <Route path="/auth" element={<AuthScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>}
                {user && <>
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/event/:id" element={<EventDetail />} />
                  {role === 'PARTICIPANT' && <>
                    <Route path="/events" element={<EventsScreen />} />
                    <Route path="/tickets" element={<TicketsScreen />} />
                  </>}
                  {role === 'ORGANIZER' && <>
                    <Route path="/org" element={<OrgHome />} />
                    <Route path="/org/event/:id" element={<OrgEvent />} />
                    <Route path="/org/new" element={<EventForm />} />
                    <Route path="/org/edit/:id" element={<EventForm />} />
                    <Route path="/scanner" element={<Scanner />} />
                  </>}
                  {role === 'ADMIN' && <>
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/events" element={<AdminEvents />} />
                  </>}
                  <Route path="*" element={<Navigate to={HOME[role!]} replace />} />
                </>}
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      )}
    </>
  );
}

export function AppRoot({ statusBar, autoRole }: AppProps) {
  return (
    <AuthProvider autoRole={autoRole}>
      <ToastProvider>
        <div className="app" data-embedded={statusBar ? '1' : '0'}>
          {statusBar && <StatusBar kind={statusBar} />}
          <Routed />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
