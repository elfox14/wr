import type { EventCategory, EventFilterKey, EventSide, MatchEvent, Team } from './types';

export function eventCategory(type: string): EventCategory {
  const value = type.toLowerCase();
  if (value.includes('goal')) return 'goals';
  if (value.includes('corner')) return 'corners';
  if (value.includes('yellow') || value.includes('red') || value.includes('card')) return 'cards';
  if (value.includes('danger')) return 'danger';
  if (value.includes('shot') || value.includes('on-target') || value.includes('off-target')) return 'shots';
  return 'other';
}

export function eventMatchesFilter(event: MatchEvent, filter: EventFilterKey) {
  if (filter === 'all') return true;
  return eventCategory(event.type) === filter;
}

export function eventIcon(type: string) {
  const value = type.toLowerCase();
  if (value.includes('goal')) return '⚽';
  if (value.includes('corner')) return '🚩';
  if (value.includes('yellow')) return '🟨';
  if (value.includes('red')) return '🟥';
  if (value.includes('danger')) return '🔥';
  if (value.includes('shot')) return '🎯';
  if (value.includes('substitution')) return '🔁';
  return '•';
}

export function eventLabel(type: string) {
  const value = type.toLowerCase();
  if (value.includes('goal')) return 'هدف';
  if (value.includes('corner')) return 'ركنية';
  if (value.includes('yellow')) return 'بطاقة صفراء';
  if (value.includes('red')) return 'بطاقة حمراء';
  if (value.includes('danger')) return 'هجمة خطيرة';
  if (value.includes('shot')) return 'تسديدة';
  if (value.includes('substitution')) return 'تبديل';
  return 'حدث';
}

export function cleanEventDetail(detail?: string | null) {
  return String(detail || '')
    .replace(/FOOTBALL_DATA_FALLBACK|FOOTBALL_DATA|ISPORTS_TIMELINE|ISPORTS_PAGE|ISPORTS/gi, '')
    .replace(/football-data\.org/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function eventMinute(event?: MatchEvent | null) {
  const value = Number(event?.minute);
  return Number.isFinite(value) ? value : null;
}

export function eventSide(event?: MatchEvent | null, home?: Team, away?: Team): EventSide {
  const text = `${event?.detail || ''} ${event?.sourceName || ''}`.toLowerCase();
  const awayName = String(away?.name || '').toLowerCase();
  const awayCode = String(away?.code || '').toLowerCase();
  const homeName = String(home?.name || '').toLowerCase();
  const homeCode = String(home?.code || '').toLowerCase();
  if ((awayName && text.includes(awayName)) || (awayCode && text.includes(awayCode)) || text.includes('away') || text.includes('الضيف')) return 'away';
  if ((homeName && text.includes(homeName)) || (homeCode && text.includes(homeCode)) || text.includes('home') || text.includes('صاحب الأرض') || text.includes('صاحب الارض')) return 'home';
  return 'neutral';
}

export function sortEventsByMinute(a: MatchEvent, b: MatchEvent) {
  const ma = eventMinute(a) ?? 999;
  const mb = eventMinute(b) ?? 999;
  if (ma !== mb) return ma - mb;
  return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
}
