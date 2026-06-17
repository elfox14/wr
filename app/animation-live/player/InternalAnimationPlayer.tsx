'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Goal, Radio, RefreshCw } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type Snapshot = Record<string, any> | null;
type EventSide = 'home' | 'away' | 'neutral';
type PressureSide = 'home' | 'away' | 'balanced' | 'unknown';
type EventFilterKey = 'all' | 'goals' | 'corners' | 'shots' | 'cards' | 'danger';
type EventCategory = Exclude<EventFilterKey, 'all'> | 'other';
type MatchEvent = { id: string; minute?: number | null; type: string; detail: string; playerName?: string | null; sourceName?: string | null; createdAt?: string | null };
type LiveStatsResponse = {
  ok: boolean;
  updatedAt?: string;
  hasStats?: boolean;
  sourceStatus?: { primary?: string; statsProvider?: string; mode?: string };
  match?: { id: string; animationMatchId?: number; status: string; matchDate?: string | null; homeScore: number; awayScore: number; homeTeam: Team; awayTeam: Team };
  latest?: Snapshot;
  history?: Snapshot[];
  error?: string;
};
type LiveEventsResponse = { ok: boolean; updatedAt?: string; events?: MatchEvent[]; error?: string };
type PressureWindow = { available: boolean; home: number; away: number; homeEvents: number; awayEvents: number; leader: PressureSide };
type PressureModel = { home: number; away: number; leader: PressureSide; rhythm: string; danger: string; window5: PressureWindow; window15: PressureWindow };
type MomentumDefinition = { key: string; label: string; start: number; end: number };
type MomentumSegment = MomentumDefinition & { available: boolean; home: number; away: number; homeEvents: number; awayEvents: number; homeDangerEvents: number; awayDangerEvents: number; leader: PressureSide; rating: string; topEvent: MatchEvent | null };

const STATS_POLL_MS = 60_000;
const EVENTS_POLL_MS = 30_000;
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const EVENT_FILTERS: { key: EventFilterKey; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'goals', label: 'الأهداف' },
  { key: 'corners', label: 'الركنيات' },
  { key: 'shots', label: 'التسديدات' },
  { key: 'cards', label: 'الكروت' },
  { key: 'danger', label: 'الهجمات الخطيرة' },
];
const MOMENTUM_SEGMENTS: MomentumDefinition[] = [
  { key: 'm0_15', label: '0–15', start: 0, end: 15 },
  { key: 'm15_30', label: '15–30', start: 15, end: 30 },
  { key: 'm30_ht', label: '30–HT', start: 30, end: 45 },
  { key: 'm45_60', label: '45–60', start: 45, end: 60 },
  { key: 'm60_75', label: '60–75', start: 60, end: 75 },
  { key: 'm75_90', label: '75–90+', start: 75, end: 130 },
];

function normalizeStatus(status?: string | null) { return String(status || '').toUpperCase(); }
function isFinishedStatus(status?: string | null) { return FINISHED_STATUSES.includes(normalizeStatus(status)); }
function isHalfTimeStatus(status?: string | null) { return HALF_TIME_STATUSES.includes(normalizeStatus(status)); }
function displayMatchStatus(status?: string | null) {
  const value = normalizeStatus(status);
  if (isFinishedStatus(value)) return 'انتهت';
  if (isHalfTimeStatus(value)) return 'استراحة';
  if (['IN_PLAY', 'LIVE', '1H', '2H', 'ET'].includes(value)) return 'مباشرة الآن';
  if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(value)) return 'قادمة';
  return value || '—';
}
function n(snapshot: Snapshot, key: string) {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
}
function ar(value: number | null | undefined, fallback = '٠') { return value === null || value === undefined ? fallback : value.toLocaleString('ar-EG'); }
function formatDate(value?: string | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return date.toLocaleString('ar-EG', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function sourceLabel(provider?: string | null) {
  const value = String(provider || '').toUpperCase();
  if (value === 'ISPORTS_COMBINED') return 'iSports Combined';
  if (value === 'ISPORTS_REMOTE_LIVE') return 'iSports Visual Stats';
  if (value === 'ISPORTS_FLASH') return 'iSports FlashData';
  if (value === 'ISPORTS_TIMELINE') return 'iSports Timeline';
  if (value === 'FOOTBALL_DATA') return 'Football-Data';
  return value ? value.replace(/_/g, ' ') : 'قاعدة البيانات';
}
function hasAnyStat(snapshot: Snapshot) {
  if (!snapshot) return false;
  return ['homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget', 'homeCorners', 'awayCorners'].some((key) => n(snapshot, key) !== null);
}
function resolvedSnapshot(data: LiveStatsResponse | null): Snapshot {
  if (hasAnyStat(data?.latest || null)) return data?.latest || null;
  return (data?.history || []).slice().reverse().find(hasAnyStat) || data?.latest || null;
}
function eventIcon(type: string) {
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
function eventLabel(type: string) {
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
function eventCategory(type: string): EventCategory {
  const value = type.toLowerCase();
  if (value.includes('goal')) return 'goals';
  if (value.includes('corner')) return 'corners';
  if (value.includes('yellow') || value.includes('red') || value.includes('card')) return 'cards';
  if (value.includes('danger')) return 'danger';
  if (value.includes('shot') || value.includes('on-target') || value.includes('off-target')) return 'shots';
  return 'other';
}
function eventMatchesFilter(event: MatchEvent, filter: EventFilterKey) {
  if (filter === 'all') return true;
  return eventCategory(event.type) === filter;
}
function cleanEventDetail(detail?: string | null) {
  return String(detail || '').replace(/FOOTBALL_DATA_FALLBACK|FOOTBALL_DATA|ISPORTS_TIMELINE|ISPORTS_PAGE|ISPORTS/gi, '').replace(/football-data\.org/gi, '').replace(/\s+/g, ' ').trim();
}
function eventMinute(event?: MatchEvent | null) {
  const value = Number(event?.minute);
  return Number.isFinite(value) ? value : null;
}
function bounded(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function timelineLeft(minute?: number | null) {
  if (minute === null || minute === undefined) return 0;
  return bounded((bounded(minute, 0, 90) / 90) * 100, 0, 100);
}
function stableOffset(seed?: string | number | null, range = 8) {
  const text = String(seed ?? '0');
  const total = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (total % (range * 2 + 1)) - range;
}
function eventSide(event?: MatchEvent | null, home?: Team, away?: Team): EventSide {
  const text = `${event?.detail || ''} ${event?.sourceName || ''}`.toLowerCase();
  const awayName = String(away?.name || '').toLowerCase();
  const awayCode = String(away?.code || '').toLowerCase();
  const homeName = String(home?.name || '').toLowerCase();
  const homeCode = String(home?.code || '').toLowerCase();
  if ((awayName && text.includes(awayName)) || (awayCode && text.includes(awayCode)) || text.includes('away') || text.includes('الضيف')) return 'away';
  if ((homeName && text.includes(homeName)) || (homeCode && text.includes(homeCode)) || text.includes('home') || text.includes('صاحب الأرض') || text.includes('صاحب الارض')) return 'home';
  return 'neutral';
}
function sortEventsByMinute(a: MatchEvent, b: MatchEvent) {
  const ma = eventMinute(a) ?? 999;
  const mb = eventMinute(b) ?? 999;
  if (ma !== mb) return ma - mb;
  return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
}
function pressureLeader(home: number, away: number): PressureSide {
  if (home <= 0 && away <= 0) return 'unknown';
  const diff = Math.abs(home - away);
  if (diff <= Math.max(3, (home + away) * 0.08)) return 'balanced';
  return home > away ? 'home' : 'away';
}
function pressureEventWeight(type: string) {
  const category = eventCategory(type);
  if (category === 'goals') return 10;
  if (category === 'danger') return 6;
  if (category === 'shots') return 4;
  if (category === 'corners') return 3;
  if (category === 'cards') return 1;
  return 1;
}
function pressureWindow(events: MatchEvent[], currentMinute: number | null, span: number, home: Team, away: Team): PressureWindow {
  const eventMinutes = events.map(eventMinute).filter((value): value is number => value !== null);
  const anchor = currentMinute ?? (eventMinutes.length ? Math.max(...eventMinutes) : null);
  if (anchor === null) return { available: false, home: 0, away: 0, homeEvents: 0, awayEvents: 0, leader: 'unknown' };
  const initial: PressureWindow = { available: false, home: 0, away: 0, homeEvents: 0, awayEvents: 0, leader: 'unknown' };
  return events.reduce<PressureWindow>((acc, event) => {
    const minuteValue = eventMinute(event);
    if (minuteValue === null || minuteValue < anchor - span || minuteValue > anchor) return acc;
    const side = eventSide(event, home, away);
    const weight = pressureEventWeight(event.type);
    if (side === 'home') { acc.home += weight; acc.homeEvents += 1; }
    if (side === 'away') { acc.away += weight; acc.awayEvents += 1; }
    acc.available = true;
    acc.leader = pressureLeader(acc.home, acc.away);
    return acc;
  }, initial);
}
function calculatePressureModel(snapshot: Snapshot, events: MatchEvent[], currentMinute: number | null, homeTeam: Team, awayTeam: Team): PressureModel {
  const homeBase = (n(snapshot, 'homeAttacks') ?? 0) + ((n(snapshot, 'homeDangerousAttacks') ?? 0) * 3) + ((n(snapshot, 'homeShots') ?? 0) * 4) + ((n(snapshot, 'homeShotsOnTarget') ?? 0) * 6) + ((n(snapshot, 'homeCorners') ?? 0) * 2);
  const awayBase = (n(snapshot, 'awayAttacks') ?? 0) + ((n(snapshot, 'awayDangerousAttacks') ?? 0) * 3) + ((n(snapshot, 'awayShots') ?? 0) * 4) + ((n(snapshot, 'awayShotsOnTarget') ?? 0) * 6) + ((n(snapshot, 'awayCorners') ?? 0) * 2);
  const window5 = pressureWindow(events, currentMinute, 5, homeTeam, awayTeam);
  const window15 = pressureWindow(events, currentMinute, 15, homeTeam, awayTeam);
  const homePressure = homeBase + (window15.home * 2) + (window5.home * 2);
  const awayPressure = awayBase + (window15.away * 2) + (window5.away * 2);
  const leader = pressureLeader(homePressure, awayPressure);
  const rhythmScore = window15.available ? window15.home + window15.away : ((homeBase + awayBase) / Math.max(1, currentMinute ?? 90)) * 15;
  const rhythm = rhythmScore >= 35 ? 'عالي' : rhythmScore >= 18 ? 'متوسط' : 'هادئ';
  const maxPressure = Math.max(homePressure, awayPressure);
  const danger = maxPressure >= 220 ? 'مرتفعة' : maxPressure >= 110 ? 'متوسطة' : 'منخفضة';
  return { home: Math.round(homePressure), away: Math.round(awayPressure), leader, rhythm, danger, window5, window15 };
}
function momentumRating(total: number) {
  if (total >= 18) return 'ضغط عالي';
  if (total >= 8) return 'ضغط متوسط';
  if (total > 0) return 'ضغط منخفض';
  return 'غير متوفر';
}
function calculateMomentumSegments(events: MatchEvent[], homeTeam: Team, awayTeam: Team): MomentumSegment[] {
  return MOMENTUM_SEGMENTS.map((segment) => {
    const segmentEvents = events.filter((event) => {
      const minuteValue = eventMinute(event);
      if (minuteValue === null) return false;
      return minuteValue >= segment.start && minuteValue < segment.end;
    }).sort(sortEventsByMinute);
    const initial = { home: 0, away: 0, homeEvents: 0, awayEvents: 0, homeDangerEvents: 0, awayDangerEvents: 0, topEvent: null as MatchEvent | null };
    const result = segmentEvents.reduce<typeof initial>((acc, event) => {
      const side = eventSide(event, homeTeam, awayTeam);
      const weight = pressureEventWeight(event.type);
      if (side === 'home') { acc.home += weight; acc.homeEvents += 1; if (eventCategory(event.type) === 'danger') acc.homeDangerEvents += 1; }
      if (side === 'away') { acc.away += weight; acc.awayEvents += 1; if (eventCategory(event.type) === 'danger') acc.awayDangerEvents += 1; }
      if (!acc.topEvent || pressureEventWeight(event.type) > pressureEventWeight(acc.topEvent.type)) acc.topEvent = event;
      return acc;
    }, initial);
    const total = result.home + result.away;
    return { ...segment, ...result, available: segmentEvents.length > 0, leader: pressureLeader(result.home, result.away), rating: momentumRating(total) };
  });
}
function sideName(side: PressureSide, home?: Team, away?: Team) {
  if (side === 'home') return home?.name || 'الفريق الأول';
  if (side === 'away') return away?.name || 'الفريق الثاني';
  if (side === 'balanced') return 'متوازن';
  return 'غير متوفر';
}
function windowLabel(window: PressureWindow) {
  if (!window.available) return 'غير متوفر';
  return `${ar(window.home)} - ${ar(window.away)}`;
}
function ballPosition(event?: MatchEvent | null, home?: Team, away?: Team) {
  if (!event) return { left: 50, top: 50, label: 'منتصف الملعب', side: 'neutral' as EventSide };
  const type = event.type.toLowerCase();
  const side = eventSide(event, home, away);
  const seed = event.id || event.minute || type;
  const vertical = bounded(50 + stableOffset(seed, 18), 16, 84);
  const homeAttackX = 84 + stableOffset(seed, 4);
  const awayAttackX = 16 + stableOffset(seed, 4);
  const attackX = side === 'away' ? awayAttackX : side === 'home' ? homeAttackX : 50 + stableOffset(seed, 12);
  if (type.includes('goal')) return { left: side === 'away' ? 9 : side === 'home' ? 91 : 50, top: bounded(50 + stableOffset(seed, 9), 39, 61), label: 'داخل منطقة الجزاء', side };
  if (type.includes('corner')) return { left: side === 'away' ? 4 : side === 'home' ? 96 : 50, top: (eventMinute(event) ?? 0) % 2 === 0 ? 9 : 91, label: 'زاوية الركنية', side };
  if (type.includes('danger')) return { left: side === 'away' ? bounded(28 + stableOffset(seed, 5), 21, 35) : side === 'home' ? bounded(72 + stableOffset(seed, 5), 65, 79) : attackX, top: vertical, label: 'الثلث الهجومي', side };
  if (type.includes('shot')) return { left: side === 'away' ? bounded(22 + stableOffset(seed, 5), 14, 31) : side === 'home' ? bounded(78 + stableOffset(seed, 5), 69, 86) : attackX, top: bounded(50 + stableOffset(seed, 16), 28, 72), label: 'أمام منطقة الجزاء', side };
  if (type.includes('yellow') || type.includes('red') || type.includes('card')) return { left: side === 'away' ? 38 : side === 'home' ? 62 : 50, top: bounded(50 + stableOffset(seed, 20), 22, 78), label: 'منطقة الاحتكاك', side };
  if (type.includes('substitution')) return { left: 50 + stableOffset(seed, 22), top: side === 'away' ? 8 : side === 'home' ? 92 : 50, label: 'خط التماس', side };
  return { left: 50, top: 50, label: 'مكان الحدث', side };
}
function flagUrl(team: Team) { return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80); }
function TeamName({ team, fallback, align }: { team: Team; fallback: string; align: 'right' | 'left' }) {
  const name = team?.name || fallback;
  const flag = flagUrl(team);
  return <div className={`flex min-w-0 items-center gap-2 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}><span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-[10px] font-black text-[#FFD700]">{flag ? <img src={flag} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : team?.code || '---'}</span><span className="min-w-0"><span className="block truncate text-base font-black text-white md:text-xl">{name}</span><span className="mt-0.5 block text-[10px] font-bold uppercase text-gray-500">{team?.code || '---'}</span></span></div>;
}
function MiniStat({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 text-xs font-black"><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{ar(home)}</span><span className="text-center text-gray-500">{label}</span><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{ar(away)}</span></div></div>;
}
function StatRow({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homePct = total > 0 ? Math.max(6, Math.round((h / total) * 100)) : 50;
  const awayPct = total > 0 ? Math.max(6, Math.round((a / total) * 100)) : 50;
  const empty = home === null && away === null;
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 grid grid-cols-[44px_1fr_44px] items-center gap-3 text-xs font-black"><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{ar(home)}</span><span className="text-center text-gray-400">{label}</span><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{ar(away)}</span></div><div className="grid grid-cols-2 gap-2"><div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${empty ? 'opacity-25' : ''}`} style={{ width: `${homePct}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${empty ? 'opacity-25' : ''}`} style={{ width: `${awayPct}%` }} /></div></div></div>;
}
function IntelligenceTile({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${accent ? 'border-[#FFD700]/25 bg-[#FFD700]/10' : 'border-white/10 bg-black/25'}`}><div className="text-[10px] font-black text-gray-500">{label}</div><div className={`mt-1 text-lg font-black ${accent ? 'text-[#FFD700]' : 'text-white'}`}>{value}</div>{hint ? <div className="mt-1 text-[10px] font-bold text-gray-500">{hint}</div> : null}</div>;
}
function MomentumCard({ segment, home, away, onSelectEvent }: { segment: MomentumSegment; home: Team; away: Team; onSelectEvent: (id: string) => void }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-[#FFD700]">د {segment.label}</span><span className="text-[10px] font-black text-gray-500">{segment.rating}</span></div><div className="text-sm font-black text-white">الأكثر ضغطًا: <span className="text-[#FFD700]">{sideName(segment.leader, home, away)}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400"><div>أحداث ضغط: <span className="text-white">{segment.available ? `${ar(segment.homeEvents)} - ${ar(segment.awayEvents)}` : 'غير متوفر'}</span></div><div>هجمات خطيرة: <span className="text-white">{segment.available ? `${ar(segment.homeDangerEvents)} - ${ar(segment.awayDangerEvents)}` : 'غير متوفر'}</span></div></div><div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-5 text-gray-300"><span className="font-black text-gray-500">أهم حدث: </span>{segment.topEvent ? <button type="button" onClick={() => onSelectEvent(segment.topEvent!.id)} className="text-right font-bold text-[#0FF0FC] hover:text-[#FFD700]">{segment.topEvent.minute ? `د${segment.topEvent.minute} - ` : ''}{eventIcon(segment.topEvent.type)} {eventLabel(segment.topEvent.type)}</button> : 'غير متوفر'}</div></div>;
}

export default function InternalAnimationPlayer({ matchId = '', dbMatchId = '' }: { matchId?: string; dbMatchId?: string }) {
  const [stats, setStats] = useState<LiveStatsResponse | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilterKey>('all');
  const [isReplaying, setIsReplaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => { const params = new URLSearchParams(); if (matchId) params.set('matchId', matchId); if (dbMatchId) params.set('dbMatchId', dbMatchId); return params.toString(); }, [matchId, dbMatchId]);

  async function fetchStats() {
    if (!query) return;
    try {
      const response = await fetch(`/api/matches/live-stats?${query}&t=${Date.now()}`, { cache: 'no-store' });
      const json: LiveStatsResponse = await response.json();
      setStats(json);
      setError(json?.ok ? null : json?.error || 'تعذر تحميل بيانات المباراة');
    } catch (err: any) { setError(err?.message || 'تعذر تحميل بيانات المباراة'); }
    finally { setLoading(false); }
  }
  async function fetchEvents() {
    if (!query) return;
    try {
      const response = await fetch(`/api/matches/live-events?${query}&t=${Date.now()}`, { cache: 'no-store' });
      const json: LiveEventsResponse = await response.json();
      if (json?.ok) setEvents(json.events || []);
    } catch {}
  }
  useEffect(() => {
    if (!query) { setLoading(false); setError('لا يوجد معرف مباراة متاح للعرض.'); return; }
    fetchStats(); fetchEvents();
    const statsTimer = window.setInterval(fetchStats, STATS_POLL_MS);
    const eventsTimer = window.setInterval(fetchEvents, EVENTS_POLL_MS);
    return () => { window.clearInterval(statsTimer); window.clearInterval(eventsTimer); };
  }, [query]);

  const latest = resolvedSnapshot(stats);
  const match = stats?.match;
  const filteredEvents = useMemo(() => events.filter((event) => eventMatchesFilter(event, eventFilter)), [events, eventFilter]);
  const replayEvents = useMemo(() => filteredEvents.slice().sort(sortEventsByMinute), [filteredEvents]);
  const filterCounts = useMemo(() => EVENT_FILTERS.reduce((acc, filter) => {
    acc[filter.key] = filter.key === 'all' ? events.length : events.filter((event) => eventMatchesFilter(event, filter.key)).length;
    return acc;
  }, {} as Record<EventFilterKey, number>), [events]);
  const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) || filteredEvents[0] || null;
  const ball = ballPosition(selectedEvent, match?.homeTeam || null, match?.awayTeam || null);
  const homeScore = n(latest, 'homeScore') ?? match?.homeScore ?? 0;
  const awayScore = n(latest, 'awayScore') ?? match?.awayScore ?? 0;
  const minute = n(latest, 'minute') ?? (isFinishedStatus(match?.status) ? 90 : null);
  const provider = sourceLabel(latest?.provider || stats?.sourceStatus?.statsProvider);
  const pressure = useMemo(() => calculatePressureModel(latest, events, minute, match?.homeTeam || null, match?.awayTeam || null), [latest, events, minute, match?.homeTeam, match?.awayTeam]);
  const momentumSegments = useMemo(() => calculateMomentumSegments(events, match?.homeTeam || null, match?.awayTeam || null), [events, match?.homeTeam, match?.awayTeam]);

  useEffect(() => {
    if (!filteredEvents.length) { if (selectedEventId) setSelectedEventId(null); return; }
    if (!selectedEventId || !filteredEvents.some((event) => event.id === selectedEventId)) setSelectedEventId(filteredEvents[0].id);
  }, [filteredEvents, selectedEventId]);
  useEffect(() => {
    if (!isReplaying) return;
    if (!replayEvents.length) { setIsReplaying(false); return; }
    const currentIndex = selectedEventId ? replayEvents.findIndex((event) => event.id === selectedEventId) : -1;
    if (currentIndex < 0) { setSelectedEventId(replayEvents[0].id); return; }
    const timer = window.setTimeout(() => {
      if (currentIndex >= replayEvents.length - 1) setIsReplaying(false);
      else setSelectedEventId(replayEvents[currentIndex + 1].id);
    }, 1300);
    return () => window.clearTimeout(timer);
  }, [isReplaying, replayEvents, selectedEventId]);

  function selectEvent(id: string) { setIsReplaying(false); setSelectedEventId(id); }
  function startReplay() { if (!replayEvents.length) return; setSelectedEventId(replayEvents[0].id); setIsReplaying(true); }
  function changeFilter(filter: EventFilterKey) { setIsReplaying(false); setEventFilter(filter); }

  if (loading) return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">جاري تحميل المشغل...</div>;
  if (error) return <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200"><AlertTriangle className="mb-2" /> {error}</div>;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="flex flex-col gap-4">
          <div className="order-1 rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><TeamName team={match?.homeTeam || null} fallback="الفريق الأول" align="right" /><div className="rounded-3xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-3xl font-black text-[#FFD700] tabular-nums sm:px-6 sm:text-4xl">{ar(homeScore)} - {ar(awayScore)}</div><TeamName team={match?.awayTeam || null} fallback="الفريق الثاني" align="left" /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"><div className="text-[10px] font-black text-gray-500">موعد المباراة</div><div className="mt-1 text-sm font-black text-white">{formatDate(match?.matchDate)}</div></div><div className="rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-3 py-2"><div className="text-[10px] font-black text-[#00FF88]/80">الحالة</div><div className="mt-1 text-sm font-black text-[#00FF88]">{displayMatchStatus(match?.status)} {minute ? `- ${ar(minute)}′` : ''}</div></div><div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2"><div className="text-[10px] font-black text-[#FFD700]/80">مصدر البيانات</div><div className="mt-1 text-sm font-black text-[#FFD700]">{provider}</div></div></div>
          </div>

          <div className="order-4 rounded-3xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.045] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-black text-white">Match Intelligence</div><div className="mt-1 text-[11px] font-bold text-gray-500">مؤشر تقديري من الهجمات، الهجمات الخطيرة، التسديدات، الركنيات، وآخر الأحداث المتاحة.</div></div><span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">ليس رقمًا رسميًا</span></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><IntelligenceTile label="الفريق الأخطر حاليًا" value={sideName(pressure.leader, match?.homeTeam, match?.awayTeam)} hint={`${ar(pressure.home)} - ${ar(pressure.away)} مؤشر ضغط`} accent /><IntelligenceTile label="رتم المباراة" value={pressure.rhythm} hint="هادئ / متوسط / عالي" /><IntelligenceTile label="الخطورة اللحظية" value={pressure.danger} hint="منخفضة / متوسطة / مرتفعة" /><IntelligenceTile label="آخر ٥ دقائق" value={windowLabel(pressure.window5)} hint={pressure.window5.available ? `${ar(pressure.window5.homeEvents)} - ${ar(pressure.window5.awayEvents)} أحداث مرصودة` : 'غير متوفر من الأحداث'} /><IntelligenceTile label="آخر ١٥ دقيقة" value={windowLabel(pressure.window15)} hint={pressure.window15.available ? `${ar(pressure.window15.homeEvents)} - ${ar(pressure.window15.awayEvents)} أحداث مرصودة` : 'غير متوفر من الأحداث'} /><IntelligenceTile label="ضغط الفريق الأول" value={ar(pressure.home)} hint={match?.homeTeam?.name || 'الفريق الأول'} /><IntelligenceTile label="ضغط الفريق الثاني" value={ar(pressure.away)} hint={match?.awayTeam?.name || 'الفريق الثاني'} /><IntelligenceTile label="مصدر الذكاء" value="Live + Events" hint="بدون تخزين جديد في قاعدة البيانات" /></div>
          </div>

          <div className="order-5 rounded-3xl border border-[#FFD700]/20 bg-[#FFD700]/[0.04] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-black text-white">Match Momentum</div><div className="mt-1 text-[11px] font-bold text-gray-500">فترات السيطرة محسوبة من الأحداث المحفوظة. أرقام الهجمات التفصيلية لكل فترة تظهر غير متوفر إن لم تصل من المصدر.</div></div><span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">تقسيم 15 دقيقة</span></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{momentumSegments.map((segment) => <MomentumCard key={segment.key} segment={segment} home={match?.homeTeam || null} away={match?.awayTeam || null} onSelectEvent={selectEvent} />)}</div>
          </div>

          <div className="order-2 rounded-3xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2">{EVENT_FILTERS.map((filter) => { const active = eventFilter === filter.key; return <button key={filter.key} type="button" onClick={() => changeFilter(filter.key)} className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${active ? 'border-[#FFD700]/70 bg-[#FFD700]/15 text-[#FFD700]' : 'border-white/10 bg-black/25 text-gray-300 hover:border-[#0FF0FC]/45 hover:text-white'}`}>{filter.label} <span className="text-[10px] opacity-70">{ar(filterCounts[filter.key])}</span></button>; })}</div><button type="button" onClick={startReplay} disabled={!replayEvents.length || isReplaying} className="rounded-full border border-[#00FF88]/35 bg-[#00FF88]/10 px-4 py-1.5 text-[11px] font-black text-[#00FF88] transition hover:bg-[#00FF88]/15 disabled:cursor-not-allowed disabled:opacity-45">{isReplaying ? 'Replay يعمل...' : '▶ Replay الأحداث'}</button></div>
            <div className="relative h-[420px] overflow-hidden rounded-3xl border border-emerald-300/25 bg-[linear-gradient(90deg,rgba(15,121,67,0.95),rgba(14,145,79,0.95))] shadow-inner"><div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.045)_0,rgba(255,255,255,0.045)_1px,transparent_1px,transparent_14.285%)]" /><div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" /><div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" /><div className="absolute left-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2 border-white/45" /><div className="absolute right-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2 border-white/45" /><div className="absolute left-[15%] top-[20%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[25%] top-[40%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[18%] top-[65%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[38%] top-[52%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute right-[15%] top-[20%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[25%] top-[40%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[18%] top-[65%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[38%] top-[52%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out" style={{ left: `${ball.left}%`, top: `${ball.top}%` }}><div className="absolute inset-0 h-14 w-14 -translate-x-1 -translate-y-1 animate-ping rounded-full bg-[#FFD700]/25" /><div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black text-xl shadow-[0_0_35px_rgba(255,255,255,0.55)]">{selectedEvent ? eventIcon(selectedEvent.type) : '⚽'}</div><div className="absolute left-1/2 top-14 w-40 -translate-x-1/2 rounded-full border border-black/20 bg-black/75 px-3 py-1 text-center text-[10px] font-black text-white">{ball.label}</div></div><div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">الدقيقة: <span className="text-[#FFD700]">{ar(selectedEvent?.minute ?? minute, '—')}</span></div><div className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">الحالة: <span className="text-[#FFD700]">{displayMatchStatus(match?.status)}</span></div><div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/60 p-3"><div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><Radio size={14} /> الحدث المحدد على الملعب</div><p className="mt-1 text-sm leading-6 text-white">{selectedEvent ? `${eventIcon(selectedEvent.type)} ${selectedEvent.minute ? `د${selectedEvent.minute} - ` : ''}${eventLabel(selectedEvent.type)}: ${cleanEventDetail(selectedEvent.detail)}` : 'اختر فلترًا به أحداث أو اضغط على أي حدث من القائمة لإظهاره على الملعب.'}</p></div></div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3"><div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-black text-gray-300"><span>Timeline الأحداث 0–90</span><span className="text-[#FFD700]">{replayEvents.length ? `${ar(replayEvents.length)} حدث` : 'لا توجد أحداث في هذا الفلتر'}</span></div><div className="relative h-16 px-2"><div className="absolute left-2 right-2 top-7 h-1 rounded-full bg-white/15" />{[0, 15, 30, 45, 60, 75, 90].map((mark) => <div key={mark} className="absolute top-5 h-5 w-px bg-white/20" style={{ left: `${timelineLeft(mark)}%` }} />)}{replayEvents.map((event) => { const active = event.id === selectedEvent?.id; return <button key={event.id} type="button" onClick={() => selectEvent(event.id)} title={`${event.minute ? `د${event.minute}` : 'حدث'} - ${eventLabel(event.type)}`} className={`absolute top-4 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border text-xs transition ${active ? 'z-20 scale-110 border-[#FFD700] bg-[#FFD700] text-black shadow-[0_0_24px_rgba(255,215,0,0.45)]' : 'z-10 border-white/40 bg-black/80 text-white hover:border-[#0FF0FC] hover:bg-[#0FF0FC]/20'}`} style={{ left: `${timelineLeft(eventMinute(event))}%` }}>{eventIcon(event.type)}</button>; })}<div className="absolute bottom-0 left-2 right-2 flex justify-between text-[10px] font-black text-gray-500"><span>0</span><span>15</span><span>30</span><span>HT</span><span>60</span><span>75</span><span>90+</span></div></div></div>
          </div>

          <div className="order-3 rounded-3xl border border-white/10 bg-black/20 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-white"><span className="inline-flex items-center gap-2"><BarChart3 size={18} className="text-[#0FF0FC]" /> إحصائيات المباراة</span><span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-gray-400"><RefreshCw size={12} /> تحديث كل دقيقة</span></div><div className="grid gap-3 sm:grid-cols-3"><MiniStat label="ركنيات" home={n(latest, 'homeCorners')} away={n(latest, 'awayCorners')} accent /><MiniStat label="صفراء" home={n(latest, 'homeYellowCards')} away={n(latest, 'awayYellowCards')} /><MiniStat label="حمراء" home={n(latest, 'homeRedCards')} away={n(latest, 'awayRedCards')} /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><StatRow label="الاستحواذ" home={n(latest, 'homePossession')} away={n(latest, 'awayPossession')} /><StatRow label="الهجمات" home={n(latest, 'homeAttacks')} away={n(latest, 'awayAttacks')} /><StatRow label="الهجمات الخطيرة" home={n(latest, 'homeDangerousAttacks')} away={n(latest, 'awayDangerousAttacks')} accent /><StatRow label="التسديدات" home={n(latest, 'homeShots')} away={n(latest, 'awayShots')} /><StatRow label="على المرمى" home={n(latest, 'homeShotsOnTarget')} away={n(latest, 'awayShotsOnTarget')} accent /><StatRow label="خارج المرمى" home={n(latest, 'homeShotsOffTarget')} away={n(latest, 'awayShotsOffTarget')} /></div></div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-black text-white">الأحداث والحالة</h3><Goal className="text-[#FFD700]" size={22} /></div><div className="mb-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-3"><div className="text-[10px] font-black text-[#FFD700]/80">الأخطر الآن</div><div className="mt-1 text-base font-black text-[#FFD700]">{sideName(pressure.leader, match?.homeTeam, match?.awayTeam)}</div><div className="mt-1 text-[10px] font-bold text-gray-400">الرتم: {pressure.rhythm} · الخطورة: {pressure.danger}</div></div><div className="mb-3 grid grid-cols-2 gap-2 text-[10px] font-black sm:grid-cols-3 xl:grid-cols-2">{EVENT_FILTERS.map((filter) => { const active = eventFilter === filter.key; return <button key={filter.key} type="button" onClick={() => changeFilter(filter.key)} className={`rounded-xl border px-2 py-2 transition ${active ? 'border-[#FFD700]/60 bg-[#FFD700]/12 text-[#FFD700]' : 'border-white/10 bg-white/[0.035] text-gray-400 hover:text-white'}`}>{filter.label} · {ar(filterCounts[filter.key])}</button>; })}</div><div className="max-h-[860px] space-y-2 overflow-y-auto pr-1">{filteredEvents.length ? filteredEvents.map((event) => { const active = event.id === selectedEvent?.id; return <button key={event.id} type="button" onClick={() => selectEvent(event.id)} className={`block w-full rounded-xl border p-3 text-right transition ${active ? 'border-[#FFD700]/60 bg-[#FFD700]/12 shadow-[0_0_24px_rgba(255,215,0,0.10)]' : 'border-white/8 bg-white/[0.035] hover:border-[#0FF0FC]/35 hover:bg-white/[0.06]'}`}><div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><span>{eventIcon(event.type)}</span>{event.minute ? `د${event.minute}` : 'حدث'}<span className="mr-auto rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] text-gray-400">اضغط للعرض</span></div><p className="mt-1 text-sm leading-6 text-gray-200">{cleanEventDetail(event.detail)}</p></button>; }) : <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لا توجد أحداث محفوظة لهذا الفلتر.</div>}</div><div className="mt-3 flex items-center gap-2 rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-3 py-2 text-[11px] font-bold text-[#00FF88]"><CheckCircle2 size={14} /> الفلتر والـ Replay والضغط اللحظي يعملون من البيانات المحفوظة فقط.</div></aside>
      </div>
    </section>
  );
}
