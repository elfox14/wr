import type { MatchEvent, Team } from './types';
import { eventMinute, eventSide } from './eventUtils';

export function bounded(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function timelineLeft(minute?: number | null) {
  if (minute === null || minute === undefined) return 0;
  return bounded((bounded(minute, 0, 90) / 90) * 100, 0, 100);
}

export function stableOffset(seed?: string | number | null, range = 8) {
  const text = String(seed ?? '0');
  const total = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (total % (range * 2 + 1)) - range;
}

export function ballPosition(event?: MatchEvent | null, home?: Team, away?: Team) {
  if (!event) return { left: 50, top: 50, label: 'منتصف الملعب', side: 'neutral' as const };

  const type = event.type.toLowerCase();
  const side = eventSide(event, home, away);
  const seed = event.id || event.minute || type;
  const vertical = bounded(50 + stableOffset(seed, 18), 16, 84);
  const homeAttackX = 84 + stableOffset(seed, 4);
  const awayAttackX = 16 + stableOffset(seed, 4);
  const attackX = side === 'away' ? awayAttackX : side === 'home' ? homeAttackX : 50 + stableOffset(seed, 12);

  if (type.includes('goal')) {
    return {
      left: side === 'away' ? 9 : side === 'home' ? 91 : 50,
      top: bounded(50 + stableOffset(seed, 9), 39, 61),
      label: 'داخل منطقة الجزاء',
      side,
    };
  }

  if (type.includes('corner')) {
    return {
      left: side === 'away' ? 4 : side === 'home' ? 96 : 50,
      top: (eventMinute(event) ?? 0) % 2 === 0 ? 9 : 91,
      label: 'زاوية الركنية',
      side,
    };
  }

  if (type.includes('danger')) {
    return {
      left: side === 'away' ? bounded(28 + stableOffset(seed, 5), 21, 35) : side === 'home' ? bounded(72 + stableOffset(seed, 5), 65, 79) : attackX,
      top: vertical,
      label: 'الثلث الهجومي',
      side,
    };
  }

  if (type.includes('shot')) {
    return {
      left: side === 'away' ? bounded(22 + stableOffset(seed, 5), 14, 31) : side === 'home' ? bounded(78 + stableOffset(seed, 5), 69, 86) : attackX,
      top: bounded(50 + stableOffset(seed, 16), 28, 72),
      label: 'أمام منطقة الجزاء',
      side,
    };
  }

  if (type.includes('yellow') || type.includes('red') || type.includes('card')) {
    return {
      left: side === 'away' ? 38 : side === 'home' ? 62 : 50,
      top: bounded(50 + stableOffset(seed, 20), 22, 78),
      label: 'منطقة الاحتكاك',
      side,
    };
  }

  if (type.includes('substitution')) {
    return {
      left: 50 + stableOffset(seed, 22),
      top: side === 'away' ? 8 : side === 'home' ? 92 : 50,
      label: 'خط التماس',
      side,
    };
  }

  return { left: 50, top: 50, label: 'مكان الحدث', side };
}
