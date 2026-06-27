'use client';

import { useEffect, useMemo, useState } from 'react';
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
  match?: {
    id: string; status: string;
    homeScore: number; awayScore: number;
    homeTeam: Team; awayTeam: Team;
  };
  latest?: Snapshot;
  error?: string;
};
type EventsResponse = { ok: boolean; events?: EventItem[]; error?: string };
type Props = { matchId?: string | number | null; dbMatchId?: string | number | null };

const STATS_POLL_MS = 30_000;
const EVENTS_POLL_MS = 15_000;

function n(v: number | null | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function fmt(v: number | null | undefined) {
  return n(v) !== null ? (v as number).toString() : '—';
}
function scoreLabel(v: number | null | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toString() : '0';
}
function stat(s: Snapshot, k: string) {
  const r = s?.[k];
  if (r === null || r === undefined || r === '') return null;
  const v = Number(r);
  return Number.isFinite(v) ? v : null;
}
function flag(team: Team, w = 80) {
  return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, w);
}
function query(matchId?: string | number | null, dbMatchId?: string | number | null) {
  const p = new URLSearchParams();
  if (matchId) p.set('matchId', String(matchId));
  if (dbMatchId) p.set('dbMatchId', String(dbMatchId));
  return p.toString();
}
function eventIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('goal')) return '⚽';
  if (t.includes('yellow')) return '🟨';
  if (t.includes('red')) return '🟥';
  if (t.includes('substitution')) return '🔄';
  if (t.includes('corner')) return '🚩';
  if (t.includes('var')) return '📺';
  if (t.includes('penalty')) return '🥅';
  return '•';
}

/* ── StatBar ── */
function StatBar({ label, home, away, icon }: { label: string; home: number | null; away: number | null; icon: string }) {
  const total = (home ?? 0) + (away ?? 0);
  const hp = total > 0 ? Math.max(4, Math.round(((home ?? 0) / total) * 100)) : 50;
  const ap = 100 - hp;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5">
      <div className="flex items-center gap-2 justify-end">
        <span className="text-blue-300 font-bold text-sm">{fmt(home)}</span>
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${hp}%` }} />
        </div>
      </div>
      <div className="text-center text-xs text-slate-400 w-28 flex flex-col items-center">
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
          <div className="h-full bg-red-500 rounded-full ml-auto" style={{ width: `${ap}%` }} />
        </div>
        <span className="text-red-300 font-bold text-sm">{fmt(away)}</span>
      </div>
    </div>
  );
}

/* ── TeamCard ── */
function TeamCard({ team, score, side }: { team: Team; score: number | undefined; side: 'home' | 'away' }) {
  const src = flag(team, 120);
  return (
    <div className={`flex flex-col items-center gap-2 ${side === 'away' ? 'items-end' : 'items-start'}`}>
      {src ? (
        <img src={src} alt={team?.name ?? ''} width={56} height={56} className="rounded-full ring-2 ring-white/20 shadow-lg" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
          {side === 'home' ? '🟦' : '🟥'}
        </div>
      )}
      <span className="text-white font-bold text-sm text-center">{team?.name ?? (side === 'home' ? 'الفريق الأول' : 'الفريق الثاني')}</span>
      <span className="text-4xl font-black text-white tabular-nums">{scoreLabel(score)}</span>
    </div>
  );
}

/* ── EventRow ── */
function EventRow({ ev, homeId }: { ev: EventItem; homeId?: string }) {
  const isGoal = ev.type.toLowerCase().includes('goal');
  const isHome = ev.teamId && ev.teamId === homeId;
  const icon = eventIcon(ev.type);
  const min = ev.minuteLabel || (ev.minute ? `${ev.minute}'` : '');
  const imgSrc = ev.playerImage || ev.playerAsset?.image;
  return (
    <div className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-sm ${
      isGoal ? 'bg-yellow-500/10 border border-yellow-500/30' : 'hover:bg-white/5'
    } ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
      <span className="text-lg">{icon}</span>
      <span className="text-slate-400 text-xs w-8 shrink-0 text-center">{min}</span>
      {imgSrc && <img src={imgSrc} alt="" width={20} height={20} className="rounded-full" />}
      <span className="text-slate-200 flex-1 truncate">{ev.playerName || ev.detail}</span>
    </div>
  );
}

export default function MatchDataPanel({ matchId, dbMatchId }: Props) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qs = useMemo(() => query(matchId, dbMatchId), [matchId, dbMatchId]);

  async function loadStats() {
    if (!qs) return;
    try {
      const res = await fetch(`/api/matches/live-stats?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json);
      setError(json?.ok ? null : json?.error || 'تعذر تحميل البيانات');
    } catch (e: any) { setError(e?.message || 'خطأ'); } finally { setLoading(false); }
  }

  async function loadEvents() {
    if (!qs) return;
    try {
      const res = await fetch(`/api/matches/live-events?${qs}`, { cache: 'no-store' });
      const json: EventsResponse = await res.json();
      if (json?.ok) setEvents(json.events || []);
    } catch {}
  }

  useEffect(() => {
    if (!qs) return;
    loadStats(); loadEvents();
    const t1 = window.setInterval(loadStats, STATS_POLL_MS);
    const t2 = window.setInterval(loadEvents, EVENTS_POLL_MS);
    return () => { window.clearInterval(t1); window.clearInterval(t2); };
  }, [qs]);

  if (!qs) return null;
  const m = data?.match;
  const s = data?.latest || null;
  const homeId = m?.homeTeam?.id;

  const stats = [
    { label:'الاستحواذ', icon:'⏱️', home:stat(s,'homePossession'), away:stat(s,'awayPossession') },
    { label:'التسديدات', icon:'👟', home:stat(s,'homeShots'), away:stat(s,'awayShots') },
    { label:'على المرمى', icon:'🥅', home:stat(s,'homeShotsOnTarget'), away:stat(s,'awayShotsOnTarget') },
    { label:'هجمات خطيرة', icon:'🎯', home:stat(s,'homeDangerousAttacks'), away:stat(s,'awayDangerousAttacks') },
    { label:'الهجمات', icon:'🚀', home:stat(s,'homeAttacks'), away:stat(s,'awayAttacks') },
    { label:'الركنيات', icon:'🚩', home:stat(s,'homeCorners'), away:stat(s,'awayCorners') },
    { label:'صفراء', icon:'🟨', home:stat(s,'homeYellowCards'), away:stat(s,'awayYellowCards') },
    { label:'حمراء', icon:'🟥', home:stat(s,'homeRedCards'), away:stat(s,'awayRedCards') },
  ];

  const statusLabel = m?.status==='FT'?'نهاية':m?.status==='HT'?'استراحة':m?.status==='NS'?'لم تبدأ':m?.status??'مجدولة';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4" dir="rtl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-white">إحصائيات المباراة</h1>
        <p className="text-slate-400 text-xs mt-1">تحديث تلقائي كل 30 ثانية</p>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">جاري التحميل…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-900/30 border border-red-500/30 text-red-300 rounded-2xl text-center">{error}</div>
      ) : (
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10 shadow-xl overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 39px,#fff 39px,#fff 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#fff 39px,#fff 40px)'}} />
            <div className="relative flex items-center justify-between gap-2">
              <TeamCard team={m?.homeTeam??null} score={m?.homeScore} side="home" />
              <div className="flex flex-col items-center gap-2">
                <span className="text-5xl font-black text-white tabular-nums">{scoreLabel(m?.homeScore)} - {scoreLabel(m?.awayScore)}</span>
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                  m?.status==='FT'?'bg-green-500/20 text-green-300 border border-green-500/30':
                  m?.status==='HT'?'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30':
                  'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>{statusLabel}</span>
              </div>
              <TeamCard team={m?.awayTeam??null} score={m?.awayScore} side="away" />
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-2xl border border-white/10 p-5">
            <div className="flex justify-between text-xs font-bold mb-3">
              <span className="text-blue-400">{m?.homeTeam?.name??'الفريق الأول'}</span>
              <span className="text-red-400">{m?.awayTeam?.name??'الفريق الثاني'}</span>
            </div>
            {stats.map(st => <StatBar key={st.label} {...st} />)}
          </div>
          {events.length > 0 && (
            <div className="bg-slate-800/80 rounded-2xl border border-white/10 p-5">
              <h2 className="text-white font-bold mb-3">★ أحداث المباراة</h2>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {events.map(ev => <EventRow key={ev.id} ev={ev} homeId={homeId} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
