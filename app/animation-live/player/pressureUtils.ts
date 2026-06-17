import type { PressureSide, Team } from './types';

export function pressureLeader(home: number, away: number): PressureSide {
  if (home <= 0 && away <= 0) return 'unknown';
  const diff = Math.abs(home - away);
  if (diff <= Math.max(3, (home + away) * 0.08)) return 'balanced';
  return home > away ? 'home' : 'away';
}

export function sideName(side: PressureSide, home?: Team, away?: Team) {
  if (side === 'home') return home?.name || 'الفريق الأول';
  if (side === 'away') return away?.name || 'الفريق الثاني';
  if (side === 'balanced') return 'متوازن';
  return 'غير متوفر';
}
