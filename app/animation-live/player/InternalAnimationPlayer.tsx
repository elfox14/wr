'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Goal, Radio } from 'lucide-react';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type Snapshot = Record<string, any> | null;
type MatchEvent = { id: string; minute?: number | null; type: string; detail: string; playerName?: string | null; sourceName?: string | null; createdAt?: string | null };

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
  sync?: { status?: string; error?: string; note?: string; providerStatus?: number; blockedUntil?: string; reason?: string };
  error?: string;
};

type LiveEventsResponse = {
  ok: boolean;
  updatedAt?: string;
  pollingSeconds?: number;
  events?: MatchEvent[];
  error?: string;
};

const STATS_POLL_MS = 5 * 60 * 1000;
const EVENTS_POLL_MS = 30 * 1000;

const STAT_KEYS = [
  'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
];

const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function isHalfTimeStatus(status?: string | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(status));
}

function isFinishedStatus(status?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

function displayMatchStatus(status?: string | null) {
  const value = normalizeStatus(status);
  if (isHalfTimeStatus(value)) return 'استراحة';
  if (isFinishedStatus(value)) return 'انتهت';
  if (value === 'IN_PLAY' || value === 'LIVE') return 'مباشرة الآن';
  if (value === 'SCHEDULED' || value === 'TIMED' || value === 'NOT_STARTED' || value === 'NS') return 'قادمة';
  return value || '—';
}

function statValue(snapshot: Snapshot, key: string) {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
}

function hasAnyDetailedStat(snapshot: Snapshot) {
  if (!snapshot) return false;
  return STAT_KEYS.some((key) => snapshot[key] !== null && snapshot[key] !== undefined);
}

function displayNumber(value: number | null, fallback = '—') {
  return value === null ? fallback : value.toLocaleString('ar-EG');
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
    .trim();
}

function inferBallPosition(event?: MatchEvent | null) {
  if (!event) return { left: 50, top: 50, label: 'منتصف الملعب' };
  const type = event.type.toLowerCase();
  const detail = event.detail.toLowerCase();
  const isAway = detail.includes('away') || detail.includes('الفريق الثاني') || detail.includes('الضيف');
  const attackingLeft = isAway ? 24 : 76;
  if (type.includes('goal')) return { left: attackingLeft, top: 50, label: 'داخل منطقة الجزاء' };
  if (type.includes('corner')) return { left: isAway ? 7 : 93, top: 12, label: 'منطقة الركنية' };
  if (type.includes('danger')) return { left: attackingLeft, top: 38, label: 'هجمة خطيرة' };
  if (type.includes('shot')) return { left: attackingLeft, top: 58, label: 'تسديدة' };
  if (type.includes('card') || type.includes('status')) return { left: 50, top: 50, label: 'توقف اللعب' };
  return { left: 50, top: 50, label: 'منتصف الملعب' };
}

function inferLiveMinute(match?: LiveStatsResponse['match'], latest?: Snapshot) {
  if (!match) return null;
  const status = normalizeStatus(match.status);
  if (isFinishedStatus(status)) return 90;
  if (isHalfTimeStatus(status)) return 45;

  const snapshotMinute = statValue(latest || null, 'minute');
  if (snapshotMinute !== null && snapshotMinute > 0) return Math.max(1, Math.min(135, snapshotMinute));

  if (!match.matchDate) return null;
  const start = new Date(match.matchDate).getTime();
  if (!Number.isFinite(start)) return null;
  const minute = Math.floor((Date.now() - start) / 60_000) + 1;
  if (minute < 1) return null;
  return Math.max(1, Math.min(135, minute));
}

function statsNotice(stats: LiveStatsResponse | null, latest: Snapshot) {
  if (hasAnyDetailedStat(latest) || stats?.hasStats) return null;
  return 'الإحصائيات التفصيلية غير متاحة الآن.';
}

function MiniStat({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 text-xs font-black">
        <span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(home)}</span>
        <span className="text-center text-gray-500">{label}</span>
        <span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(away)}</span>
      </div>
    </div>
  );
}

export default function InternalAnimationPlayer({ matchId = '', dbMatchId = '' }: { matchId?: string; dbMatchId?: string }) {
  const [stats, setStats] = useState<LiveStatsResponse | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (matchId) params.set('matchId', matchId);
    if (dbMatchId) params.set('dbMatchId', dbMatchId);
    return params.toString();
  }, [matchId, dbMatchId]);

  async function fetchStats() {
    if (!query) return;
    try {
      const response = await fetch(`/api/matches/live-stats?${query}`, { cache: 'no-store' });
      const json: LiveStatsResponse = await response.json();
      setStats(json);
      setError(json?.ok ? null : json?.error || 'تعذر تحميل بيانات المباراة');
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل بيانات المباراة');
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvents() {
    if (!query) return;
    try {
      const response = await fetch(`/api/matches/live-events?${query}`, { cache: 'no-store' });
      const json: LiveEventsResponse = await response.json();
      if (json?.ok) setEvents(json.events || []);
    } catch {
      // Keep the last known events on screen.
    }
  }

  useEffect(() => {
    if (!query) {
      setLoading(false);
      setError('لا يوجد معرف مباراة متاح للعرض.');
      return;
    }
    fetchStats();
    fetchEvents();
    const statsTimer = window.setInterval(fetchStats, STATS_POLL_MS);
    const eventsTimer = window.setInterval(fetchEvents, EVENTS_POLL_MS);
    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(eventsTimer);
    };
  }, [query]);

  const latest = stats?.latest || null;
  const match = stats?.match;
  const lastEvent = events[0] || null;
  const ball = useMemo(() => inferBallPosition(lastEvent), [lastEvent]);
  const homeName = match?.homeTeam?.name || 'الفريق الأول';
  const awayName = match?.awayTeam?.name || 'الفريق الثاني';
  const homeScore = statValue(latest, 'homeScore') ?? match?.homeScore ?? 0;
  const awayScore = statValue(latest, 'awayScore') ?? match?.awayScore ?? 0;
  const minute = inferLiveMinute(match, latest);
  const unavailableStatsNotice = statsNotice(stats, latest);
  const statusLabel = displayMatchStatus(match?.status);
  const isHalfTime = isHalfTimeStatus(match?.status);

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">جاري تحميل المشغل...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200"><AlertTriangle className="mb-2" /> {error}</div>;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
            <div className="min-w-0 text-right">
              <div className="truncate text-base font-black text-white md:text-xl">{homeName}</div>
              <div className="mt-1 text-[10px] font-bold uppercase text-gray-500">Home</div>
            </div>
            <div className="rounded-3xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-6 py-3 text-4xl font-black text-[#FFD700] tabular-nums">{homeScore} - {awayScore}</div>
            <div className="min-w-0 text-left">
              <div className="truncate text-base font-black text-white md:text-xl">{awayName}</div>
              <div className="mt-1 text-[10px] font-bold uppercase text-gray-500">Away</div>
            </div>
          </div>

          <div className="relative h-[420px] overflow-hidden rounded-3xl border border-emerald-300/25 bg-[linear-gradient(90deg,rgba(15,121,67,0.95),rgba(14,145,79,0.95))] shadow-inner">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.045)_0,rgba(255,255,255,0.045)_1px,transparent_1px,transparent_14.285%)]" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" />
            <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" />
            <div className="absolute left-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2 border-white/45" />
            <div className="absolute right-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2 border-white/45" />
            <div className="absolute left-3 top-1/2 h-24 w-10 -translate-y-1/2 rounded-r-xl border-y-2 border-r-2 border-white/40" />
            <div className="absolute right-3 top-1/2 h-24 w-10 -translate-y-1/2 rounded-l-xl border-y-2 border-l-2 border-white/40" />

            <div className="absolute left-[15%] top-[20%] h-3 w-3 rounded-full bg-white/70" />
            <div className="absolute left-[25%] top-[40%] h-3 w-3 rounded-full bg-white/70" />
            <div className="absolute left-[18%] top-[65%] h-3 w-3 rounded-full bg-white/70" />
            <div className="absolute left-[38%] top-[52%] h-3 w-3 rounded-full bg-white/70" />
            <div className="absolute right-[15%] top-[20%] h-3 w-3 rounded-full bg-[#FFD700]/80" />
            <div className="absolute right-[25%] top-[40%] h-3 w-3 rounded-full bg-[#FFD700]/80" />
            <div className="absolute right-[18%] top-[65%] h-3 w-3 rounded-full bg-[#FFD700]/80" />
            <div className="absolute right-[38%] top-[52%] h-3 w-3 rounded-full bg-[#FFD700]/80" />

            <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${ball.left}%`, top: `${ball.top}%` }}>
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black text-xl shadow-[0_0_35px_rgba(255,255,255,0.55)]">⚽</div>
              <div className="absolute left-1/2 top-14 w-36 -translate-x-1/2 rounded-full border border-black/20 bg-black/70 px-3 py-1 text-center text-[10px] font-black text-white">{isHalfTime ? 'استراحة بين الشوطين' : ball.label}</div>
            </div>

            <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">
              الدقيقة: <span className="text-[#FFD700]">{displayNumber(minute)}</span>
            </div>
            <div className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">
              الحالة: <span className="text-[#FFD700]">{statusLabel}</span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/60 p-3">
              <div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><Radio size={14} /> آخر حدث</div>
              <p className="mt-1 text-sm leading-6 text-white">{lastEvent ? `${eventIcon(lastEvent.type)} ${lastEvent.minute ? `د${lastEvent.minute} - ` : ''}${eventLabel(lastEvent.type)}: ${cleanEventDetail(lastEvent.detail)}` : 'لا توجد أحداث مهمة محفوظة بعد.'}</p>
            </div>
          </div>

          {unavailableStatsNotice ? (
            <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-4 text-xs font-bold leading-6 text-[#FFD700]">
              <AlertTriangle size={15} className="inline" /> {unavailableStatsNotice}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <MiniStat label="استحواذ" home={statValue(latest, 'homePossession')} away={statValue(latest, 'awayPossession')} />
              <MiniStat label="هجمات خطيرة" home={statValue(latest, 'homeDangerousAttacks')} away={statValue(latest, 'awayDangerousAttacks')} accent />
              <MiniStat label="على المرمى" home={statValue(latest, 'homeShotsOnTarget')} away={statValue(latest, 'awayShotsOnTarget')} accent />
              <MiniStat label="تسديدات" home={statValue(latest, 'homeShots')} away={statValue(latest, 'awayShots')} />
              <MiniStat label="ركنيات" home={statValue(latest, 'homeCorners')} away={statValue(latest, 'awayCorners')} />
              <MiniStat label="كروت" home={(statValue(latest, 'homeYellowCards') ?? 0) + (statValue(latest, 'homeRedCards') ?? 0)} away={(statValue(latest, 'awayYellowCards') ?? 0) + (statValue(latest, 'awayRedCards') ?? 0)} />
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-black text-white">Timeline الأحداث المهمة</h3>
            <Goal className="text-[#FFD700]" size={22} />
          </div>
          <div className="max-h-[670px] space-y-2 overflow-y-auto pr-1">
            {events.length ? events.map((event) => (
              <div key={event.id} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                <div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><span>{eventIcon(event.type)}</span>{event.minute ? `د${event.minute}` : 'حدث'}</div>
                <p className="mt-1 text-sm leading-6 text-gray-200">{cleanEventDetail(event.detail)}</p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لا توجد أحداث مهمة محفوظة بعد.</div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
