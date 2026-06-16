'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Goal, Radio, RefreshCw } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type Snapshot = Record<string, any> | null;
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

const STATS_POLL_MS = 60_000;
const EVENTS_POLL_MS = 30_000;
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];

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
function cleanEventDetail(detail?: string | null) {
  return String(detail || '').replace(/FOOTBALL_DATA_FALLBACK|FOOTBALL_DATA|ISPORTS_TIMELINE|ISPORTS_PAGE|ISPORTS/gi, '').replace(/football-data\.org/gi, '').replace(/\s+/g, ' ').trim();
}
function eventSide(event?: MatchEvent | null, home?: Team, away?: Team) {
  const text = `${event?.detail || ''} ${event?.sourceName || ''}`.toLowerCase();
  const awayName = String(away?.name || '').toLowerCase();
  const awayCode = String(away?.code || '').toLowerCase();
  const homeName = String(home?.name || '').toLowerCase();
  const homeCode = String(home?.code || '').toLowerCase();
  if ((awayName && text.includes(awayName)) || (awayCode && text.includes(awayCode)) || text.includes('away') || text.includes('الضيف')) return 'away';
  if ((homeName && text.includes(homeName)) || (homeCode && text.includes(homeCode)) || text.includes('home') || text.includes('صاحب الأرض') || text.includes('صاحب الارض')) return 'home';
  return 'neutral';
}
function ballPosition(event?: MatchEvent | null, home?: Team, away?: Team) {
  if (!event) return { left: 50, top: 50, label: 'منتصف الملعب', side: 'neutral' };
  const type = event.type.toLowerCase();
  const side = eventSide(event, home, away);
  const isAway = side === 'away';
  const attack = isAway ? 24 : side === 'home' ? 76 : 50;
  if (type.includes('goal')) return { left: attack, top: 50, label: 'مكان الهدف', side };
  if (type.includes('corner')) return { left: isAway ? 7 : side === 'home' ? 93 : 50, top: isAway ? 14 : 86, label: 'منطقة الركنية', side };
  if (type.includes('danger')) return { left: attack, top: 38, label: 'هجمة خطيرة', side };
  if (type.includes('shot')) return { left: attack, top: 58, label: 'تسديدة', side };
  if (type.includes('yellow') || type.includes('red') || type.includes('card')) return { left: side === 'neutral' ? 50 : attack, top: 50, label: 'مكان البطاقة', side };
  if (type.includes('substitution')) return { left: 50, top: side === 'away' ? 20 : 80, label: 'منطقة التبديل', side };
  return { left: 50, top: 50, label: 'مكان الحدث', side };
}
function flagUrl(team: Team) { return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80); }
function TeamName({ team, fallback, align }: { team: Team; fallback: string; align: 'right' | 'left' }) {
  const name = team?.name || fallback;
  const flag = flagUrl(team);
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-[10px] font-black text-[#FFD700]">
        {flag ? <img src={flag} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : team?.code || '---'}
      </span>
      <span className="min-w-0"><span className="block truncate text-base font-black text-white md:text-xl">{name}</span><span className="mt-0.5 block text-[10px] font-bold uppercase text-gray-500">{team?.code || '---'}</span></span>
    </div>
  );
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
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[44px_1fr_44px] items-center gap-3 text-xs font-black"><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{ar(home)}</span><span className="text-center text-gray-400">{label}</span><span className={accent ? 'text-[#FFD700]' : 'text-white'}>{ar(away)}</span></div>
      <div className="grid grid-cols-2 gap-2"><div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${empty ? 'opacity-25' : ''}`} style={{ width: `${homePct}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${empty ? 'opacity-25' : ''}`} style={{ width: `${awayPct}%` }} /></div></div>
    </div>
  );
}

export default function InternalAnimationPlayer({ matchId = '', dbMatchId = '' }: { matchId?: string; dbMatchId?: string }) {
  const [stats, setStats] = useState<LiveStatsResponse | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
  useEffect(() => {
    if (!selectedEventId && events[0]?.id) setSelectedEventId(events[0].id);
  }, [events, selectedEventId]);

  const latest = resolvedSnapshot(stats);
  const match = stats?.match;
  const selectedEvent = events.find((event) => event.id === selectedEventId) || events[0] || null;
  const ball = ballPosition(selectedEvent, match?.homeTeam || null, match?.awayTeam || null);
  const homeScore = n(latest, 'homeScore') ?? match?.homeScore ?? 0;
  const awayScore = n(latest, 'awayScore') ?? match?.awayScore ?? 0;
  const minute = n(latest, 'minute') ?? (isFinishedStatus(match?.status) ? 90 : null);
  const provider = sourceLabel(latest?.provider || stats?.sourceStatus?.statsProvider);

  if (loading) return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">جاري تحميل المشغل...</div>;
  if (error) return <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200"><AlertTriangle className="mb-2" /> {error}</div>;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><TeamName team={match?.homeTeam || null} fallback="الفريق الأول" align="right" /><div className="rounded-3xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-3xl font-black text-[#FFD700] tabular-nums sm:px-6 sm:text-4xl">{ar(homeScore)} - {ar(awayScore)}</div><TeamName team={match?.awayTeam || null} fallback="الفريق الثاني" align="left" /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"><div className="text-[10px] font-black text-gray-500">موعد المباراة</div><div className="mt-1 text-sm font-black text-white">{formatDate(match?.matchDate)}</div></div><div className="rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-3 py-2"><div className="text-[10px] font-black text-[#00FF88]/80">الحالة</div><div className="mt-1 text-sm font-black text-[#00FF88]">{displayMatchStatus(match?.status)} {minute ? `- ${ar(minute)}′` : ''}</div></div><div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2"><div className="text-[10px] font-black text-[#FFD700]/80">مصدر البيانات</div><div className="mt-1 text-sm font-black text-[#FFD700]">{provider}</div></div></div>
          </div>

          <div className="relative h-[420px] overflow-hidden rounded-3xl border border-emerald-300/25 bg-[linear-gradient(90deg,rgba(15,121,67,0.95),rgba(14,145,79,0.95))] shadow-inner">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.045)_0,rgba(255,255,255,0.045)_1px,transparent_1px,transparent_14.285%)]" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" /><div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" /><div className="absolute left-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2 border-white/45" /><div className="absolute right-0 top-1/2 h-44 w-24 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2 border-white/45" />
            <div className="absolute left-[15%] top-[20%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[25%] top-[40%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[18%] top-[65%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute left-[38%] top-[52%] h-3 w-3 rounded-full bg-white/70" /><div className="absolute right-[15%] top-[20%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[25%] top-[40%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[18%] top-[65%] h-3 w-3 rounded-full bg-[#FFD700]/80" /><div className="absolute right-[38%] top-[52%] h-3 w-3 rounded-full bg-[#FFD700]/80" />
            <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out" style={{ left: `${ball.left}%`, top: `${ball.top}%` }}>
              <div className="absolute inset-0 h-14 w-14 -translate-x-1 -translate-y-1 animate-ping rounded-full bg-[#FFD700]/25" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black text-xl shadow-[0_0_35px_rgba(255,255,255,0.55)]">{selectedEvent ? eventIcon(selectedEvent.type) : '⚽'}</div>
              <div className="absolute left-1/2 top-14 w-40 -translate-x-1/2 rounded-full border border-black/20 bg-black/75 px-3 py-1 text-center text-[10px] font-black text-white">{ball.label}</div>
            </div>
            <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">الدقيقة: <span className="text-[#FFD700]">{ar(selectedEvent?.minute ?? minute, '—')}</span></div>
            <div className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white">الحالة: <span className="text-[#FFD700]">{displayMatchStatus(match?.status)}</span></div>
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/60 p-3"><div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><Radio size={14} /> الحدث المحدد على الملعب</div><p className="mt-1 text-sm leading-6 text-white">{selectedEvent ? `${eventIcon(selectedEvent.type)} ${selectedEvent.minute ? `د${selectedEvent.minute} - ` : ''}${eventLabel(selectedEvent.type)}: ${cleanEventDetail(selectedEvent.detail)}` : 'اضغط على أي حدث من القائمة لإظهار مكانه على الملعب.'}</p></div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-white"><span className="inline-flex items-center gap-2"><BarChart3 size={18} className="text-[#0FF0FC]" /> إحصائيات المباراة</span><span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-gray-400"><RefreshCw size={12} /> تحديث كل دقيقة</span></div>
            <div className="grid gap-3 sm:grid-cols-3"><MiniStat label="ركنيات" home={n(latest, 'homeCorners')} away={n(latest, 'awayCorners')} accent /><MiniStat label="صفراء" home={n(latest, 'homeYellowCards')} away={n(latest, 'awayYellowCards')} /><MiniStat label="حمراء" home={n(latest, 'homeRedCards')} away={n(latest, 'awayRedCards')} /></div>
            <div className="mt-3 grid gap-3 md:grid-cols-2"><StatRow label="الاستحواذ" home={n(latest, 'homePossession')} away={n(latest, 'awayPossession')} /><StatRow label="الهجمات" home={n(latest, 'homeAttacks')} away={n(latest, 'awayAttacks')} /><StatRow label="الهجمات الخطيرة" home={n(latest, 'homeDangerousAttacks')} away={n(latest, 'awayDangerousAttacks')} accent /><StatRow label="التسديدات" home={n(latest, 'homeShots')} away={n(latest, 'awayShots')} /><StatRow label="على المرمى" home={n(latest, 'homeShotsOnTarget')} away={n(latest, 'awayShotsOnTarget')} accent /><StatRow label="خارج المرمى" home={n(latest, 'homeShotsOffTarget')} away={n(latest, 'awayShotsOffTarget')} /></div>
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-black text-white">الأحداث والحالة</h3><Goal className="text-[#FFD700]" size={22} /></div>
          <div className="max-h-[860px] space-y-2 overflow-y-auto pr-1">{events.length ? events.map((event) => { const active = event.id === selectedEvent?.id; return (<button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className={`block w-full rounded-xl border p-3 text-right transition ${active ? 'border-[#FFD700]/60 bg-[#FFD700]/12 shadow-[0_0_24px_rgba(255,215,0,0.10)]' : 'border-white/8 bg-white/[0.035] hover:border-[#0FF0FC]/35 hover:bg-white/[0.06]'}`}><div className="flex items-center gap-2 text-xs font-black text-[#FFD700]"><span>{eventIcon(event.type)}</span>{event.minute ? `د${event.minute}` : 'حدث'}<span className="mr-auto rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] text-gray-400">اضغط للعرض</span></div><p className="mt-1 text-sm leading-6 text-gray-200">{cleanEventDetail(event.detail)}</p></button>); }) : (<div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لا توجد أحداث مهمة محفوظة بعد.</div>)}</div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-3 py-2 text-[11px] font-bold text-[#00FF88]"><CheckCircle2 size={14} /> اضغط على أي حدث لتحريك العلامة إلى مكانه التقريبي على الملعب.</div>
        </aside>
      </div>
    </section>
  );
}
