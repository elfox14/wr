'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, CornerDownRight, ShieldAlert, Target, Zap } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type Snapshot = Record<string, any> | null;
type EventItem = {
  id: string;
  minute?: number | null;
  minuteLabel?: string | null;
  type: string;
  detail: string;
  teamId?: string | null;
  playerName?: string | null;
  playerImage?: string | null;
  playerAsset?: { image?: string | null; name?: string | null } | null;
  sourceName?: string | null;
};

type StatsResponse = {
  ok: boolean;
  updatedAt?: string;
  hasStats?: boolean;
  sourceStatus?: { mode?: string; statsProvider?: string; isportsBlocked?: boolean; reason?: string };
  scorePolicy?: { timeInferenceDisabled?: boolean; statusSource?: string };
  match?: {
    id: string;
    status: string;
    homeScore: number;
    awayScore: number;
    homeTeam: Team;
    awayTeam: Team;
  };
  latest?: Snapshot;
  error?: string;
};

type EventsResponse = { ok: boolean; updatedAt?: string; events?: EventItem[]; error?: string };
type Props = { matchId?: string | number | null; dbMatchId?: string | number | null };

const STATS_POLL_MS = 30_000;
const EVENTS_POLL_MS = 15_000;

function valueLabel(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG') : '—';
}

function scoreLabel(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG') : '٠';
}

function stat(snapshot: Snapshot, key: string) {
  const raw = snapshot?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function flag(team: Team, width = 80) {
  return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, width);
}

function query(matchId?: string | number | null, dbMatchId?: string | number | null) {
  const params = new URLSearchParams();
  if (matchId) params.set('matchId', String(matchId));
  if (dbMatchId) params.set('dbMatchId', String(dbMatchId));
  return params.toString();
}

function icon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('goal')) return '⚽';
  if (t.includes('corner')) return '🚩';
  if (t.includes('yellow')) return '🟨';
  if (t.includes('red')) return '🟥';
  if (t.includes('substitution')) return '🔁';
  if (t.includes('danger')) return '🔥';
  if (t.includes('shot')) return '🎯';
  if (t.includes('var')) return '📺';
  if (t.includes('penalty')) return '🥅';
  return '•';
}

function sourceLabel(source?: string | null) {
  const value = String(source || '').trim();
  if (!value || value === 'FOOTBALL_DATA' || value === 'FOOTBALL_DATA_FALLBACK') return '';
  if (value === 'ISPORTS_TIMELINE') return 'iSports Timeline';
  if (value === 'ISPORTS_REMOTE_LIVE') return 'iSports Live';
  if (value === 'ISPORTS_PAGE') return 'iSports';
  if (value === 'THE_STATS_API') return 'TheStats';
  return value.replace(/_/g, ' ');
}

function TeamName({ team, fallback, align }: { team: Team; fallback: string; align?: 'right' | 'left' }) {
  const src = flag(team, 48);
  const name = team?.name || fallback;
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 ${align === 'left' ? 'flex-row-reverse' : ''}`}>
      <span className="inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-white/10 bg-black/30">
        {src ? <img src={src} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : null}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function MiniStat({ label, home, away, children }: { label: string; home: number | null; away: number | null; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
      <div className="mb-2 flex justify-center text-[#FFD700]">{children}</div>
      <div className="text-[11px] font-bold text-gray-500">{label}</div>
      <div className="mt-1 text-base font-black text-white tabular-nums">{valueLabel(home)} - {valueLabel(away)}</div>
    </div>
  );
}

function percent(home: number | null, away: number | null) {
  if (home === null && away === null) return { h: 50, a: 50, placeholder: true };
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  if (total <= 0) return { h: 50, a: 50, placeholder: false };
  return { h: Math.max(5, Math.round((h / total) * 100)), a: Math.max(5, Math.round((a / total) * 100)), placeholder: false };
}

function StatRow({ label, home, away, accent = false }: { label: string; home: number | null; away: number | null; accent?: boolean }) {
  const pct = percent(home, away);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[42px_1fr_42px] items-center gap-3 text-xs font-black">
        <span className={accent ? 'text-[#FFD700]' : 'text-white'}>{valueLabel(home)}</span>
        <span className="text-center text-gray-400">{label}</span>
        <span className={accent ? 'text-[#FFD700]' : 'text-white'}>{valueLabel(away)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl">
          <div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${pct.placeholder ? 'opacity-25' : ''}`} style={{ width: `${pct.h}%` }} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${pct.placeholder ? 'opacity-25' : ''}`} style={{ width: `${pct.a}%` }} />
        </div>
      </div>
    </div>
  );
}

function eventTeam(data: StatsResponse | null, event: EventItem) {
  const home = data?.match?.homeTeam || null;
  const away = data?.match?.awayTeam || null;
  if (event.teamId && home?.id === event.teamId) return home;
  if (event.teamId && away?.id === event.teamId) return away;
  const text = event.detail.toLowerCase();
  if (home?.name && text.includes(home.name.toLowerCase())) return home;
  if (away?.name && text.includes(away.name.toLowerCase())) return away;
  return null;
}

function EventAvatar({ event, data }: { event: EventItem; data: StatsResponse | null }) {
  const team = eventTeam(data, event);
  const src = event.playerImage || event.playerAsset?.image || flag(team, 80);
  const alt = event.playerName || event.playerAsset?.name || team?.name || event.type;
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" /> : <span>{icon(event.type)}</span>}
    </span>
  );
}

function StatusBadge({ data }: { data: StatsResponse | null }) {
  const mode = data?.sourceStatus?.mode || 'database_first';
  const disabled = data?.scorePolicy?.timeInferenceDisabled;
  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-black">
      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300">المصدر: {(data?.sourceStatus?.statsProvider || 'DATABASE').replace(/_/g, ' ')}</span>
      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">الحالة من المصدر فقط</span>
      {disabled ? <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-[#FFD700]">بدون استنتاج زمني</span> : null}
      {data?.sourceStatus?.isportsBlocked ? <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-red-200">iSports محجوب مؤقتًا</span> : null}
      <span className="sr-only">{mode}</span>
    </div>
  );
}

export default function MatchDataPanel({ matchId, dbMatchId }: Props) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventsUpdatedAt, setEventsUpdatedAt] = useState<string | null>(null);
  const qs = useMemo(() => query(matchId, dbMatchId), [matchId, dbMatchId]);

  async function loadStats() {
    if (!qs) return;
    try {
      const res = await fetch(`/api/matches/live-stats?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json);
      setError(json?.ok ? null : json?.error || 'تعذر تحميل بيانات المباراة');
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل بيانات المباراة');
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    if (!qs) return;
    try {
      const res = await fetch(`/api/matches/live-events?${qs}`, { cache: 'no-store' });
      const json: EventsResponse = await res.json();
      if (json?.ok) {
        setEvents(json.events || []);
        setEventsUpdatedAt(json.updatedAt || new Date().toISOString());
      }
    } catch {}
  }

  useEffect(() => {
    if (!qs) return;
    loadStats();
    loadEvents();
    const statsTimer = window.setInterval(loadStats, STATS_POLL_MS);
    const eventsTimer = window.setInterval(loadEvents, EVENTS_POLL_MS);
    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(eventsTimer);
    };
  }, [qs]);

  const latest = data?.latest || null;
  const match = data?.match;
  const minute = stat(latest, 'minute');

  if (!qs) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-card">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Activity size={13} /> Live Match Center</p>
          <h2 className="mt-2 text-xl font-black text-white">بيانات المباراة الحية</h2>
          <p className="mt-1 text-xs leading-5 text-gray-400">الخانات غير المتاحة تظهر بعلامة — ولا يتم تحويل حالة المباراة بناءً على الوقت فقط.</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300"><Clock size={13} className="inline" /> بيانات: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('ar-EG') : '—'}</span>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300"><Target size={13} className="inline" /> أحداث: {eventsUpdatedAt ? new Date(eventsUpdatedAt).toLocaleTimeString('ar-EG') : '—'}</span>
          </div>
          <StatusBadge data={data} />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-400">جاري تحميل بيانات المباراة...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mb-2" /> {error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="min-w-0 text-right"><div className="truncate text-lg font-black text-white"><TeamName team={match?.homeTeam || null} fallback="الفريق الأول" align="right" /></div></div>
                <div className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-5 py-3 text-3xl font-black text-[#FFD700] tabular-nums">{scoreLabel(match?.homeScore)} - {scoreLabel(match?.awayScore)}</div>
                <div className="min-w-0 text-left"><div className="truncate text-lg font-black text-white"><TeamName team={match?.awayTeam || null} fallback="الفريق الثاني" align="left" /></div></div>
              </div>
              <div className="mt-3 text-xs font-bold text-gray-500">الدقيقة: {minute ? valueLabel(minute) : 'غير موثقة من المصدر'}</div>
              <div className="mt-1 text-[11px] font-bold text-gray-600">الحالة الحالية: {match?.status || '—'}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="ركنيات" home={stat(latest, 'homeCorners')} away={stat(latest, 'awayCorners')}><CornerDownRight size={16} /></MiniStat>
              <MiniStat label="صفراء" home={stat(latest, 'homeYellowCards')} away={stat(latest, 'awayYellowCards')}><ShieldAlert size={16} /></MiniStat>
              <MiniStat label="حمراء" home={stat(latest, 'homeRedCards')} away={stat(latest, 'awayRedCards')}><Zap size={16} /></MiniStat>
            </div>

            <StatRow label="الاستحواذ" home={stat(latest, 'homePossession')} away={stat(latest, 'awayPossession')} />
            <StatRow label="الهجمات" home={stat(latest, 'homeAttacks')} away={stat(latest, 'awayAttacks')} />
            <StatRow label="الهجمات الخطيرة" home={stat(latest, 'homeDangerousAttacks')} away={stat(latest, 'awayDangerousAttacks')} accent />
            <StatRow label="التسديدات" home={stat(latest, 'homeShots')} away={stat(latest, 'awayShots')} />
            <StatRow label="على المرمى" home={stat(latest, 'homeShotsOnTarget')} away={stat(latest, 'awayShotsOnTarget')} accent />
            <StatRow label="خارج المرمى" home={stat(latest, 'homeShotsOffTarget')} away={stat(latest, 'awayShotsOffTarget')} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-white">الأحداث والحالة</h3>
                <p className="text-xs text-gray-500">الأهداف والركنيات والكروت والتبديلات من Timeline أو مصدر مؤكد.</p>
              </div>
              <Target className="text-[#FFD700]" size={22} />
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {events.length ? events.map((event) => {
                const src = sourceLabel(event.sourceName);
                return (
                  <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-start gap-3">
                      <EventAvatar event={event} data={data} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-[#FFD700]"><span>{icon(event.type)}</span>{event.minuteLabel || (event.minute ? `د${event.minute}` : 'حدث')}{src ? <><span className="text-gray-600">•</span><span>{src}</span></> : null}</div>
                        {event.playerName ? <p className="mt-1 text-xs font-black text-white">{event.playerName}</p> : null}
                        <p className="mt-1 text-sm leading-6 text-gray-200">{event.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لا توجد أحداث محفوظة بعد.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
