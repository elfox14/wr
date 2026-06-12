'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, Clock, CornerDownRight, Database, ShieldAlert, Target, Zap } from 'lucide-react';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type Snapshot = Record<string, any> | null;
type MatchEvent = { id: string; minute?: number | null; type: string; detail: string; playerName?: string | null; sourceName?: string | null; createdAt?: string | null };

type LiveStatsResponse = {
  ok: boolean;
  updatedAt?: string;
  pollingSeconds?: number;
  providerSyncEnabled?: boolean;
  hasStats?: boolean;
  match?: {
    id: string;
    animationMatchId?: number;
    status: string;
    homeScore: number;
    awayScore: number;
    homeTeam: Team;
    awayTeam: Team;
  };
  latest?: Snapshot;
  history?: Snapshot[];
  sync?: { status?: string; savedEventsCount?: number; error?: string; note?: string; providerStatus?: number };
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

function statValue(snapshot: Snapshot, key: string) {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
}

function displayNumber(value: number | null, fallback = '—') {
  return value === null ? fallback : value.toLocaleString('ar-EG');
}

function percentPair(home: number | null, away: number | null) {
  if (home === null && away === null) return { homePct: 50, awayPct: 50 };
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  if (total <= 0) return { homePct: 50, awayPct: 50 };
  return { homePct: Math.max(5, Math.round((h / total) * 100)), awayPct: Math.max(5, Math.round((a / total) * 100)) };
}

function StatRow({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  const { homePct, awayPct } = percentPair(home, away);
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[42px_1fr_42px] items-center gap-3 text-xs font-black">
        <span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(home)}</span>
        <span className="text-center text-gray-400">{label}</span>
        <span className={accent ? 'text-[#FFD700]' : 'text-white'}>{displayNumber(away)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'}`} style={{ width: `${homePct}%` }} /></div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'}`} style={{ width: `${awayPct}%` }} /></div>
      </div>
    </div>
  );
}

function eventIcon(type: string) {
  const value = type.toLowerCase();
  if (value.includes('goal')) return '⚽';
  if (value.includes('corner')) return '🚩';
  if (value.includes('yellow')) return '🟨';
  if (value.includes('red')) return '🟥';
  if (value.includes('danger')) return '🔥';
  if (value.includes('shot')) return '🎯';
  return '•';
}

function hasAnyStat(snapshot: Snapshot) {
  if (!snapshot) return false;
  return [
    'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
    'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
    'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
    'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  ].some((key) => snapshot[key] !== null && snapshot[key] !== undefined);
}

export default function LiveMatchStatsPanel({ matchId }: { matchId: string }) {
  const [data, setData] = useState<LiveStatsResponse | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventsUpdatedAt, setEventsUpdatedAt] = useState<string | null>(null);

  async function fetchStats() {
    if (!matchId) return;
    try {
      const response = await fetch(`/api/matches/live-stats?matchId=${encodeURIComponent(matchId)}`, { cache: 'no-store' });
      const json = await response.json();
      setData(json);
      setError(json?.ok ? null : json?.error || 'تعذر تحميل الإحصائيات');
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  }

  async function fetchImportantEvents() {
    if (!matchId) return;
    try {
      const response = await fetch(`/api/matches/live-events?matchId=${encodeURIComponent(matchId)}`, { cache: 'no-store' });
      const json: LiveEventsResponse = await response.json();
      if (json?.ok) {
        setEvents(json.events || []);
        setEventsUpdatedAt(json.updatedAt || new Date().toISOString());
      }
    } catch {
      // keep the latest saved events visible; this endpoint is intentionally lightweight and database-only
    }
  }

  useEffect(() => {
    fetchStats();
    fetchImportantEvents();
    const statsTimer = window.setInterval(fetchStats, STATS_POLL_MS);
    const eventsTimer = window.setInterval(fetchImportantEvents, EVENTS_POLL_MS);
    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(eventsTimer);
    };
  }, [matchId]);

  const latest = data?.latest || null;
  const match = data?.match;
  const hasStats = Boolean(data?.hasStats || hasAnyStat(latest));
  const statusLabel = data?.sync?.status === 'database_only' ? 'قراءة من قاعدة البيانات' : data?.sync?.status === 'cached_recent_snapshot' ? 'آخر لقطة محفوظة' : data?.sync?.status === 'saved' ? 'تم تسجيل لقطة جديدة' : data?.sync?.status || 'متابعة مباشرة';
  const providerWarning = data?.sync?.status === 'failed'
    ? `مزود الإحصائيات لم يرجع بيانات الآن${data.sync?.providerStatus ? ` (status ${data.sync.providerStatus})` : ''}.`
    : !hasStats
      ? 'لا توجد أرقام إحصائية محفوظة لهذه المباراة بعد. قد يكون المزود متوقفًا، الحد اليومي انتهى، أو المباراة في استراحة ولا يرسل التحليل الآن.'
      : null;

  const derived = useMemo(() => {
    const homeScore = statValue(latest, 'homeScore') ?? match?.homeScore ?? 0;
    const awayScore = statValue(latest, 'awayScore') ?? match?.awayScore ?? 0;
    return { homeScore, awayScore };
  }, [latest, match]);

  if (!matchId) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-card">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Activity size={13} /> Live Stats Recorder</p>
          <h2 className="mt-2 text-xl font-black text-white">إحصائيات المباراة الحية</h2>
          <p className="mt-1 text-xs leading-5 text-gray-400">الإحصائيات والنتيجة تُقرأ كل 5 دقائق فقط. الأحداث المهمة لها تحديث منفصل أخف من قاعدة البيانات.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300"><Clock size={13} className="inline" /> إحصائيات: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('ar-EG') : '—'}</span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300"><Target size={13} className="inline" /> أحداث: {eventsUpdatedAt ? new Date(eventsUpdatedAt).toLocaleTimeString('ar-EG') : '—'}</span>
          <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-[#FFD700]"><Database size={13} className="inline" /> {statusLabel}</span>
        </div>
      </div>

      {providerWarning && (
        <div className="mb-4 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-3 text-xs font-bold leading-6 text-[#FFD700]">
          <AlertTriangle size={15} className="inline" /> {providerWarning}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-400">جاري تحميل الإحصائيات...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mb-2" /> {error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="min-w-0 text-right">
                  <div className="truncate text-lg font-black text-white">{match?.homeTeam?.name || 'الفريق الأول'}</div>
                </div>
                <div className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-5 py-3 text-3xl font-black text-[#FFD700] tabular-nums">{derived.homeScore} - {derived.awayScore}</div>
                <div className="min-w-0 text-left">
                  <div className="truncate text-lg font-black text-white">{match?.awayTeam?.name || 'الفريق الثاني'}</div>
                </div>
              </div>
              <div className="mt-3 text-xs font-bold text-gray-500">الدقيقة: {displayNumber(statValue(latest, 'minute'))}</div>
            </div>

            <StatRow label="الاستحواذ" home={statValue(latest, 'homePossession')} away={statValue(latest, 'awayPossession')} />
            <StatRow label="الهجمات" home={statValue(latest, 'homeAttacks')} away={statValue(latest, 'awayAttacks')} />
            <StatRow label="الهجمات الخطيرة" home={statValue(latest, 'homeDangerousAttacks')} away={statValue(latest, 'awayDangerousAttacks')} accent />
            <StatRow label="التسديدات" home={statValue(latest, 'homeShots')} away={statValue(latest, 'awayShots')} />
            <StatRow label="على المرمى" home={statValue(latest, 'homeShotsOnTarget')} away={statValue(latest, 'awayShotsOnTarget')} accent />
            <StatRow label="خارج المرمى" home={statValue(latest, 'homeShotsOffTarget')} away={statValue(latest, 'awayShotsOffTarget')} />

            <div className="grid grid-cols-3 gap-3">
              <StatMini icon={<CornerDownRight size={16} />} label="ركنيات" home={statValue(latest, 'homeCorners')} away={statValue(latest, 'awayCorners')} />
              <StatMini icon={<ShieldAlert size={16} />} label="صفراء" home={statValue(latest, 'homeYellowCards')} away={statValue(latest, 'awayYellowCards')} />
              <StatMini icon={<Zap size={16} />} label="حمراء" home={statValue(latest, 'homeRedCards')} away={statValue(latest, 'awayRedCards')} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-white">الأحداث المهمة</h3>
                <p className="text-xs text-gray-500">استثناء سريع وخفيف: أهداف، هجمات خطيرة، كروت، ركنيات، وتسديدات مؤثرة.</p>
              </div>
              <Target className="text-[#FFD700]" size={22} />
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {events.length ? events.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                  <div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><span>{eventIcon(event.type)}</span>{event.minute ? `د${event.minute}` : 'حدث'}<span className="text-gray-600">•</span><span>{event.sourceName || 'Live'}</span></div>
                  <p className="mt-1 text-sm leading-6 text-gray-200">{event.detail}</p>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لا توجد أحداث مهمة محفوظة بعد.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatMini({ icon, label, home, away }: { icon: ReactNode; label: string; home: number | null; away: number | null }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-3 text-center">
      <div className="mb-2 flex justify-center text-[#FFD700]">{icon}</div>
      <div className="text-[11px] font-bold text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-black text-white tabular-nums">{displayNumber(home)} - {displayNumber(away)}</div>
    </div>
  );
}
