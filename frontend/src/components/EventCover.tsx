// Обкладинка заходу: градієнт + проста векторна графіка залежно від категорії
import { motion } from 'framer-motion';
import { Code2, Mic2, Presentation, Users } from 'lucide-react';

const THEME: Record<string, { bg: string; fg: string; shape: string; Icon: typeof Users }> = {
  'Лекція': { bg: 'linear-gradient(135deg,#163300 0%,#2f6b12 100%)', fg: '#9fe870', shape: '#9fe870', Icon: Presentation },
  'Семінар': { bg: 'linear-gradient(135deg,#9fe870 0%,#d9ffc2 100%)', fg: '#163300', shape: '#163300', Icon: Users },
  'Майстер-клас': { bg: 'linear-gradient(135deg,#0d3b2e 0%,#1f9a64 100%)', fg: '#cdffad', shape: '#cdffad', Icon: Code2 },
  'Конференція': { bg: 'linear-gradient(135deg,#ffe46b 0%,#9fe870 100%)', fg: '#163300', shape: '#163300', Icon: Mic2 },
};

export function EventCover({ category, layoutId, height = 150, radius = 24, large }: {
  category: string; layoutId?: string; height?: number; radius?: number; large?: boolean;
}) {
  const t = THEME[category] ?? THEME['Лекція'];
  const Icon = t.Icon;
  return (
    <motion.div layoutId={layoutId} style={{ height, borderRadius: radius, background: t.bg, position: 'relative', overflow: 'hidden', flex: 'none' }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
        <circle cx="330" cy="40" r="90" fill={t.shape} opacity="0.16" />
        <circle cx="360" cy="150" r="46" fill={t.shape} opacity="0.2" />
        <rect x="-30" y="120" width="190" height="120" rx="40" fill={t.shape} opacity="0.12" transform="rotate(-14 60 180)" />
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 8 }).map((__, c) => <circle key={`${r}-${c}`} cx={24 + c * 14} cy={24 + r * 14} r="1.8" fill={t.shape} opacity="0.35" />),
        )}
      </svg>
      <div style={{ position: 'absolute', right: large ? 28 : 18, bottom: large ? 24 : 16, color: t.fg, opacity: 0.95 }}>
        <Icon size={large ? 64 : 44} strokeWidth={1.6} />
      </div>
    </motion.div>
  );
}
