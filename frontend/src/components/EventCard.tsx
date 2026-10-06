// Картка заходу для списків (UI-компонент із власним станом відображення)
import { motion } from 'framer-motion';
import { CalendarDays, MapPin } from 'lucide-react';
import type { EventDto } from '../api/types';
import { fmtDateShort, fmtTime, relDays } from '../lib/format';
import { EventCover } from './EventCover';
import { Badge } from './ui';

export function EventCard({ ev, index = 0, onClick }: { ev: EventDto; index?: number; onClick: () => void }) {
  const left = ev.capacity - ev.registered;
  const past = ev.status === 'FINISHED' || new Date(ev.endAt) < new Date();
  const pct = Math.min(100, Math.round((100 * ev.registered) / ev.capacity));
  return (
    <motion.article
      className="ecard" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, type: 'spring', stiffness: 260, damping: 26 }}
      whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }}
    >
      <EventCover category={ev.category} layoutId={`cover-${ev.id}`} height={132} radius={20} />
      <div className="ecard__body">
        <div className="ecard__tags">
          <Badge>{ev.category}</Badge>
          {ev.status === 'CANCELLED' && <Badge kind="danger">Скасовано</Badge>}
          {ev.myRegistrationId && <Badge kind="dark">Ви зареєстровані</Badge>}
          {ev.hidden && <Badge kind="warn">Приховано</Badge>}
        </div>
        <h3 className="ecard__title">{ev.title}</h3>
        <div className="ecard__meta"><CalendarDays size={15} /> {fmtDateShort(ev.startAt)} · {fmtTime(ev.startAt)} <span className="dot" /> {relDays(ev.startAt)}</div>
        <div className="ecard__meta"><MapPin size={15} /> {ev.location}</div>
        <div className="ecard__seats">
          <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.2 }} className={pct >= 100 ? 'bar--full' : pct > 80 ? 'bar--warn' : ''} /></div>
          <span>{past ? `Відвідало ${ev.attended} з ${ev.registered}` : left <= 0 ? 'Місць немає' : `Вільно ${left} з ${ev.capacity}`}</span>
        </div>
      </div>
    </motion.article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="ecard" style={{ padding: 0 }}>
      <div className="skeleton" style={{ height: 132, borderRadius: 20 }} />
      <div className="ecard__body">
        <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 99 }} />
        <div className="skeleton" style={{ height: 22, width: '80%' }} />
        <div className="skeleton" style={{ height: 14, width: '60%' }} />
      </div>
    </div>
  );
}
