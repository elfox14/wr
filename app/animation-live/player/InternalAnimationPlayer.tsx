'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Goal, Radio } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type Snapshot = Record<string, any> | null;
type MatchEvent = {
  id: string;
  minute?: number | null;
  type: string;
  detail: string;
  playerName?: string | null;
  sourceName?: string | null;
  createdAt?: string | null;
};

type LiveStatsResponse = {
  ok: boolean;
  updatedAt?: string;
  pollingSeconds?: number;
  hasStats?: boolean;
  sourceStatus?: { mode?: string; isportsBlocked?: boolean; blockedUntil?: string; reason?: string; primary?: string; statsProvider?: string };
  match?: {
    id: string;
    animationMatchId?: number;
    status: string;
    matchDate?: string | null;
    homeScore: number;
    awayScore: number;
    homeTeam: Team;
    awayTeam: Team;
  };
  latest?: Snapshot;
  history?: Snapshot[];
  sync?: { status?: string; error?: string; note?: string; providerStatus?: number; blockedUntil?: string; reason?: string };
  error?: string;
};

type LiveEventsResponse = { ok: boolean; updatedAt?: string; pollingSeconds?: number; events?: MatchEvent[]; error?: string };

const STATS_POLL_MS = 60 * 1000;
const EVENTS_POLL_MS = 30 * 1000;
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'ET', 'BT', 'P'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function isHalfTimeStatus(status?: string | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(status));
}

function isFinishedStatus(status?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

function isLiveStatus(status?: string | null) {
  return LIVE_STATUSES.includes(normalizeStatus(status));
}

function isScheduledStatus(status?: string | null) {
  return SCHEDULED_STATUSES.includes(normalizeStatus(status));
}

function eventConfirmsHalfTime(event?: MatchEvent | null) {
  if (!event) return false;
  const value = `${event.type || ''} ${event.detail || ''}`.toLowerCase();
  const hasEnglishHalfTime = /\b(ht|half[-_\s]?time)\b/i.test(value);
  const hasArabicHalfTime = [
    'استراحة',
    'بين الشوطين',
    'نهاية الشوط الأول',
    'نهاية الشوط الاول',
    'انتهاء الشوط الأول',
    'انتهاء الشوط الاول',
    'الشوط الأول انتهى',
    'الشوط الاول انتهى',
  ].some((phrase) => value.includes(phrase));
  return hasEnglishHalfTime || hasArabicHalfTime;
}

function isConfirmedHalfTime(match?: LiveStatsResponse['match'], lastEvent?: MatchEvent | null) {
  return isHalfTimeStatus(match?.status) || eventConfirmsHalfTime(lastEvent);
}

function displayMatchStatus(status?: string | null) {
  const value = normalizeStatus(status);
  if (isHalfTimeStatus(value)) return 'استراحة';
  if (isFinishedStatus(value)) return 'انتهت';
  if (value === '1H') return 'الشوط الأول';
  if (value === '2H') return 'الشوط الثاني';
  if (isLiveStatus(value)) return 'مباشرة الآن';
  if (isScheduledStatus(value)) return 'قادمة';
  return value || '—';
}

function statValue(snapshot: Snapshot, key: string) {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
}

function displayNumber(value: number | null | undefined, fallback = '٠') {
  return value === null || value === undefined ? fallback : value.toLocaleString('ar-EG');
}

function formatMatchDateTime(value?: string | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return date.toLocaleString('ar-EG', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function snapshotRank(snapshot: Snapshot) {
  if (!snapshot) return -1;
  let score = 0;
  const provider = String(snapshot.provider || '').toUpperCase();
  if (provider === 'ISPORTS_FLASH') score += 1000;
  if (statValue(snapshot, 'minute') !== null) score += 160;
  if (statValue(snapshot, 'homeAttacks') !== null || statValue(snapshot, 'awayAttacks') !== null) score += 120;
  if (statValue(snapshot, 'homeDangerousAttacks') !== null || statValue(snapshot, 'awayDangerousAttacks') !== null) score += 120;
  if (statValue(snapshot, 'homeCorners') !== null || statValue(snapshot, 'awayCorners') !== null) score += 60;
  const captured = new Date(snapshot.capturedAt || 0).getTime();
  return score + (Number.isFinite(captured) ? Math.min(29, Math.floor(captured / 60000) % 30) : 0);
}

function bestSnapshot(data: LiveStatsResponse | null): Snapshot {
  const candidates = [data?.latest, ...(data?.history || [])].filter(Boolean) as Snapshot[];
  return candidates.sort((a, b) => snapshotRank(b) - snapshotRank(a))[0] || data?.latest || null;
}

function eventIcon(type: string) {
  const value = type.toLowerCase();
  if (value.includes('goal')) return '⚽';
  if (value.includes('corner')) return '🚩';
  if (value.includes('yellow')) return '🟨';
  if (value.includes('red')) return '🟥';
  if (value.includes('danger')) return '🔥';
  if (value.includes('shot')) return '🎯';
  if (value.includes('penalty')) return '🥅';
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
  if (value.includes('shot')) return 'تسديدة مؤثرة';
  if (value.includes('penalty')) return 'ركلة جزاء';
  if (value.includes('substitution')) return 'تبديل';
  if (value.includes('status')) return 'تحديث الحالة';
  return 'حدث مهم';
}

function cleanEventDetail(detail?: string | null) {
  return String(detail || '')
    .replace(/football-data\.org/gi, '')
    .replace(/FOOTBALL_DATA_FALLBACK/g, '')
    .replace(/FOOTBALL_DATA/g, '')
    .replace(/ISPORTS_TIMELINE/g, '')
    .replace(/ISPORTS_PAGE/g, '')
    .replace(/ISPORTS/g, '')
    .replace(/iSports Timeline/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+$/g, '')
    .trim();
}

function inferBallPosition(event?: MatchEvent | null) {
  if (!event) return { left: 50, top: 50, label: 'منتصف الملعب' };
  const type = event.type.toLowerCase();
  const detail = event.detail.toLowerCase();
  const isAway = detail.includes('away') || detail.includes('الفريق الثاني') || detail.includes('الضيف');
  const attackingLeft = isAway ? 24 : 76;
  if (type.includes('goal')) return { left: attackingLeft, top: 50, label: 'هدف' };
  if (type.includes('corner')) return { left: isAway ? 7 : 93, top: 12, label: 'ركنية' };
  if (type.includes('danger')) return { left: attackingLeft, top: 38, label: 'هجمة خطيرة' };
  if (type.includes('shot')) return { left: attackingLeft, top: 58, label: 'تسديدة' };
  if (type.includes('card') || type.includes('status')) return { left: 50, top: 50, label: 'توقف اللعب' };
  return { left: 50, top: 50, label: 'منتصف الملعب' };
}

function confirmedMinute(match?: LiveStatsResponse['match'], latest?: Snapshot, lastEvent?: MatchEvent | null) {
  const status = normalizeStatus(match?.status);
  if (isHalfTimeStatus(status) || eventConfirmsHalfTime(lastEvent)) return 45;
  const snapshotMinute = statValue(latest || null, 'minute');
  if (snapshotMinute !== null && snapshotMinute > 0) return Math.max(1, Math.min(135, snapshotMinute));
  if (lastEvent?.minute && lastEvent.minute > 0) return Math.max(1, Math.min(135, lastEvent.minute));
  if (isFinishedStatus(status)) return 90;
  return null;
}

function confirmedClockLabel(match?: LiveStatsResponse['match'], latest?: Snapshot, lastEvent?: MatchEvent | null) {
  const status = normalizeStatus(match?.status);
  const minute = confirmedMinute(match, latest, lastEvent);
  if (isConfirmedHalfTime(match, lastEvent)) return 'استراحة';
  if (minute !== null && isLiveStatus(status)) return `الدقيقة ${displayNumber(minute)}`;
  if (minute !== null && isFinishedStatus(status)) return `انتهت - ${displayNumber(minute)}′`;
  if (status === '1H') return 'الشوط الأول مؤكد';
  if (status === '2H') return 'الشوط الثاني مؤكد';
  if (isLiveStatus(status)) return 'مباشرة الآن - بانتظار دقيقة مؤكدة';
  if (isScheduledStatus(status)) return 'بانتظار تأكيد البداية';
  return 'بانتظار حالة موثقة';
}

function teamFlagUrl(team: Team) {
  return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);
}

function TeamName({ team, fallback, align }: { team: Team; fallback: string; align: 'right' | 'left' }) {
  const name = team?.name || fallback;
  const flag = teamFlagUrl(team);
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-[10px] font-black text-[#FFD700]">
        {flag ? <img src={flag} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : team?.code || '---'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black text-white md:text-xl">{name}</span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase text-gray-500">{team?.code || (align === 'right' ? 'Home' : 'Away')}</span>
      </span>
    </div>
  );
}

function MiniStat({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 text-xs font-black"><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(home)}</span><span className="text-center text-gray-500">{label}</span><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(away)}</span></div></div>;
}

function StatRow({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homePct = total > 0 ? Math.max(6, Math.round((h / total) * 100)) : 50;
  const awayPct = total > 0 ? Math.max(6, Math.round((a / total) * 100)) : 50;
  const isEmpty = home === null && away === null;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[44px_1fr_44px] items-center gap-3 text-xs font-black"><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(home)}</span><span className="text-center text-gray-400">{label}</span><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(away)}</span></div>
      <div className="grid grid-cols-2 gap-2"><div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${isEmpty ? 'opacity-25' : ''}`} style={{ width: `${homePct}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${isEmpty ? 'opacity-25' : ''}`} style={{ width: `${awayPct}%` }} /></div></div>
    </div>
  );
}

export default function InternalAnimationPlayer({ matchId = '', dbMatchId = '' }: { matchId?: string; dbMatchId?: string }) {
  const [stats, setStats] = useState<LiveStatsResponse | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => { const params = new URLSearchParams(); if (matchId) params.set('matchId', matchId); if (dbMatchId) params.set('dbMatchId', dbMatchId); return params.toString(); }, [matchId, dbMatchId]);

  async function fetchStats() {
    if (!query) return;
    try {
      const response = await fetch(`/api/matches/live-stats?${query}`, { cache: 'no-store' });
      const json: LiveStatsResponse = await response.json();
      setStats(json);
      setError(json?.ok ? null : json?.error || 'تعذر تحميل بيانات المباراة');
    } catch (err: any) { setError(err?.message || 'تعذر تحميل بيانات المباراة'); }
    finally { setLoading(false); }
  }

  async function fetchEvents() {
    if (!query) return;
    try {
      const response = await fetch(`/api/matches/live-events?${query}`, { cache: 'no-store' });
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

  const latest = bestSnapshot(stats);
  const match = stats?.match;
  const lastEvent = events[0] || null;
  const ball = useMemo(() => inferBallPosition(lastEvent), [lastEvent]);
  const homeScore = statValue(latest, 'homeScore') ?? match?.homeScore ?? 0;
  const awayScore = statValue(latest, 'awayScore') ?? match?.awayScore ?? 0;
  const minute = confirmedMinute(match, latest, lastEvent);
  const isHalfTime = isConfirmedHalfTime(match, lastEvent);
  const statusLabel = isHalfTime ? 'استراحة' : displayMatchStatus(match?.status);
  const clockLabel = confirmedClockLabel(match, latest, lastEvent);

  if (loading) return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">جاري تحميل المشغل...</div>;
  if (error) return <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200"><AlertTriangle className="mb-2" /> {error}</div>;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><TeamName team={match?.homeTeam || null} fallback="الفريق الأول" align="right" /><div className="rounded-3xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-3xl font-black text-[#FFD700] tabular-nums sm:px-6 sm:text-4xl">{displayNumber(homeScore)} - {displayNumber(awayScore)}</div><TeamName team={match?.awayTeam || null} fallback="الفريق الثاني" align="left" /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"><div className="text-[10px] font-black text-gray-500">موعد المباراة</div><div className="mt-1 text-sm font-black text-white">{formatMatchDateTime(match?.matchDate)}</div></div>
              <div className="rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-3 py-2"><div className="text-[10px] font-black text-[#00FF88]/80">زمن المباراة المؤكد</div><div className="mt-1 text-sm font-black text-[#00FF88]">{clockLabel}</div></div>
            </div>
          </div>

          <div className="relative h-[420px] overflow-hidden rounded-3xl border border-emerald-300/25 bg-[linear-gradient(90deg,rgba(15,121,67,0.95),rgba(14,145,79,0.95))] shadow-inner">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.045)_0,rgba(255,255,255,0.045)_1px,transparent_1px,transparent_14.285%)]" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" /><div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" /><div className="absolute left-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2 border-white/45" /><div className="absolute right-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2 border-white/45" /><div className="absolute left-3 top-1/2 h-24 w-10 -translate-y-1/2 rounded-r-xl border-y-2 border-r-2 border-white/40" /><div className="absolute right-3 top-1/2 h-24 w-10 -translate-y-1/2 rounded-l-xl border-y-2 border-l-2 border-white/40" />
            <div className="absolute left-[15%] top-[20%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[25%] top-[40%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[18%] top-[65%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[38%] top-[52%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute right-[15%] top-[20%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[25%] top-[40%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[18%] top-[65%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[38%] top-[52%] h-3 w-3 rounded-full bg-[#FFD700]/80" />
            <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${ball.left}%`, top: `${ball.top}%` }}><div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black text-xl shadow-[0_0_35px_rgba(255,255,255,0.55)]">⚽</div><div className="absolute left-1/2 top-14 w-36 -translate-x-1/2 rounded-full border border-black/20 bg-black/70 px-3 py-1 text-center text-[10px] font-black text-white">{isHalfTime ? 'استراحة بين الشوطين' : ball.label}</div></div>
            <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">الدقيقة: <span className="text-[#FFD700]">{displayNumber(minute, '—')}</span></div>
            <div className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">الحالة: <span className="text-[#FFD700]">{statusLabel}</span></div>
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/60 p-3"><div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><Radio size={14} /> آخر حدث</div><p className="mt-1 text-sm leading-6 text-white">{lastEvent ? `${eventIcon(lastEvent.type)} ${lastEvent.minute ? `د${lastEvent.minute} - ` : ''}${eventLabel(lastEvent.type)}: ${cleanEventDetail(lastEvent.detail)}` : 'لا توجد أحداث مهمة محفوظة بعد.'}</p></div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white"><BarChart3 size={18} className="text-[#0FF0FC]" /> إحصائيات المباراة</div>
            <div className="grid gap-3 sm:grid-cols-3"><MiniStat label="ركنيات" home={statValue(latest, 'homeCorners')} away={statValue(latest, 'awayCorners')} accent /><MiniStat label="صفراء" home={statValue(latest, 'homeYellowCards')} away={statValue(latest, 'awayYellowCards')} /><MiniStat label="حمراء" home={statValue(latest, 'homeRedCards')} away={statValue(latest, 'awayRedCards')} /></div>
            <div className="mt-3 grid gap-3 md:grid-cols-2"><StatRow label="الاستحواذ" home={statValue(latest, 'homePossession')} away={statValue(latest, 'awayPossession')} /><StatRow label="الهجمات" home={statValue(latest, 'homeAttacks')} away={statValue(latest, 'awayAttacks')} /><StatRow label="الهجمات الخطيرة" home={statValue(latest, 'homeDangerousAttacks')} away={statValue(latest, 'awayDangerousAttacks')} accent /><StatRow label="التسديدات" home={statValue(latest, 'homeShots')} away={statValue(latest, 'awayShots')} /><StatRow label="على المرمى" home={statValue(latest, 'homeShotsOnTarget')} away={statValue(latest, 'awayShotsOnTarget')} accent /><StatRow label="خارج المرمى" home={statValue(latest, 'homeShotsOffTarget')} away={statValue(latest, 'awayShotsOffTarget')} /></div>
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-black text-white">الأحداث والحالة</h3><Goal className="text-[#FFD700]" size={22} /></div><div className="max-h-[860px] space-y-2 overflow-y-auto pr-1">{events.length ? events.map((event) => (<div key={event.id} className="rounded-xl border border-white/8 bg-white/[0.035] p-3"><div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><span>{eventIcon(event.type)}</span>{event.minute ? `د${event.minute}` : 'حدث'}</div><p className="mt-1 text-sm leading-6 text-gray-200">{cleanEventDetail(event.detail)}</p></div>)) : (<div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لا توجد أحداث مهمة محفوظة بعد.</div>)}</div><div className="mt-3 flex items-center gap-2 rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-3 py-2 text-[11px] font-bold text-[#00FF88]"><CheckCircle2 size={14} /> البيانات تبقى محفوظة بعد نهاية المباراة وتظهر من قاعدة البيانات.</div></aside>
      </div>
    </section>
  );
}
