'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

/* ───── types ───── */
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

/* ───── constants ───── */
const STATS_POLL_MS = 30_000;
const EVENTS_POLL_MS = 15_000;

/* ───── helpers ───── */
function n(v: number | null | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function fmt(v: number | null | undefined) {
  return n(v) !== null ? (v as number).toLocaleString('ar-EG') : '—';
}
function scoreLabel(v: number | null | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ar-EG') : '٠';
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
function iconOf(type: string) {
  const t = type.toLowerCase();
  if (t.includes('goal')) return '⚽';
  if (t.includes('corner')) return '🚩';
  if (t.includes('yellow')) return '🟨';
  if (t.includes('red')) return '🟥';
  if (t.includes('substitution')) return '🔁';
  if (t.includes('shot')) return '🎯';
  if (t.includes('var')) return '📺';
  if (t.includes('penalty')) return '🥅';
  return '•';
}
function eventTeam(data: StatsResponse | null, event: EventItem) {
  const home = data?.match?.homeTeam || null;
  const away = data?.match?.awayTeam || null;
  if (event.teamId && home?.id === event.teamId) return home;
  if (event.teamId && away?.id === event.teamId) return away;
  return null;
}

/* ───── stat icons map ───── */
const STAT_ICONS: Record<string, string> = {
  'الاستحواذ': '⏱️',
  'الهجمات': '🚀',
  'الهجمات الخطيرة': '🎯',
  'التسديدات': '👟',
  'على المرمى': '🥅',
  'تسديدات خارج المرمى': '🚫',
  'الركنيات': '🚩',
  'بطاقات صفراء': '🟨',
  'بطاقات حمراء': '🟥',
};

/* ───── StatRow ───── */
function StatRow({
  label, home, away, homeAccent = false,
}: { label: string; home: number | null; away: number | null; homeAccent?: boolean }) {
  const total = (home ?? 0) + (away ?? 0);
  const hPct = total > 0 ? Math.max(4, Math.round(((home ?? 0) / total) * 100)) : 50;
  const aPct = total > 0 ? Math.max(4, Math.round(((away ?? 0) / total) * 100)) : 50;
  const placeholder = home === null && away === null;
  const ico = STAT_ICONS[label] ?? '•';

  return (
    <div className="grid grid-cols-[56px_1fr_56px] items-center gap-x-3 py-[6px]">
      {/* home value */}
      <span className="text-right text-sm font-black tabular-nums text-[#5BC8F5]">{fmt(home)}</span>

      {/* center: label + bars */}
      <div className="flex flex-col items-center gap-[3px]">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-300">
          <span className="text-sm">{ico}</span> {label}
        </span>
        <div className="flex w-full gap-1">
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/10" dir="rtl">
            <div
              className={`h-full rounded-full ${homeAccent ? 'bg-[#FFD700]' : 'bg-[#5BC8F5]'} ${placeholder ? 'opacity-20' : ''}`}
              style={{ width: `${hPct}%` }}
            />
          </div>
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${homeAccent ? 'bg-[#FF6B6B]' : 'bg-[#FF6B6B]'} ${placeholder ? 'opacity-20' : ''}`}
              style={{ width: `${aPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* away value */}
      <span className="text-left text-sm font-black tabular-nums text-[#FF6B6B]">{fmt(away)}</span>
    </div>
  );
}

/* ───── FormationDot ───── */
function FormationDots({ formation, color }: { formation: string; color: string }) {
  // Renders a very simple pitch visualization with dots per row
  const lines = formation.split('-').map(Number);
  const allRows = [[1], ...lines.map((n) => Array(n).fill(0))];
  return (
    <div className="flex flex-col items-center gap-[5px] py-1">
      {allRows.map((row, ri) => (
        <div key={ri} className="flex gap-[6px]">
          {row.map((_, ci) => (
            <span
              key={ci}
              className="inline-block h-3 w-3 rounded-full border-[1.5px] shadow-sm"
              style={{ backgroundColor: color, borderColor: color, opacity: ri === 0 ? 1 : 0.85 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ───── TeamFlag ───── */
function TeamFlag({ team, size = 56 }: { team: Team; size?: number }) {
  const src = flag(team, size * 2);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-2 border-white/20 bg-black/40"
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt={team?.name ?? ''} className="h-full w-full object-cover" loading="lazy" /> : null}
    </span>
  );
}

/* ───── EventTimeline ───── */
function EventTimeline({ events, data }: { events: EventItem[]; data: StatsResponse | null }) {
  if (!events.length) return (
    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-gray-500">لا توجد أحداث مسجّلة بعد.</div>
  );
  return (
    <div className="relative space-y-0 pr-1">
      <div className="absolute right-[18px] top-0 h-full w-px bg-white/10" aria-hidden />
      {events.map((event) => {
        const team = eventTeam(data, event);
        const flagSrc = event.playerImage || event.playerAsset?.image || flag(team, 64);
        const isGoal = event.type.toLowerCase().includes('goal');
        return (
          <div key={event.id} className="relative flex items-start gap-3 py-[7px]">
            {/* dot */}
            <span
              className={`relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${isGoal ? 'border-[#FFD700] bg-[#FFD700]/30' : 'border-white/20 bg-black/40'}`}
            />
            <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs font-black text-[#FFD700]">
                  <span>{iconOf(event.type)}</span>
                  <span>{event.minuteLabel || (event.minute ? `د${event.minute}` : '')}</span>
                </span>
                {flagSrc && (
                  <span className="inline-flex h-7 w-7 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    <img src={flagSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </span>
                )}
              </div>
              {event.playerName && <p className="mt-1 text-xs font-bold text-white">{event.playerName}</p>}
              <p className="mt-[2px] text-xs leading-5 text-gray-300">{event.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───── AdvancedStats panel ───── */
function AdvancedBox({
  label, homeVal, awayVal,
}: { label: string; homeVal: number | null; awayVal: number | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 flex justify-center gap-2 text-sm font-black tabular-nums">
        <span className="text-[#5BC8F5]">{fmt(homeVal)}</span>
        <span className="text-gray-600">—</span>
        <span className="text-[#FF6B6B]">{fmt(awayVal)}</span>
      </div>
    </div>
  );
}

/* ───── Main component ───── */
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
      if (json?.ok) setEvents(json.events || []);
    } catch {}
  }

  useEffect(() => {
    if (!qs) return;
    loadStats();
    loadEvents();
    const t1 = window.setInterval(loadStats, STATS_POLL_MS);
    const t2 = window.setInterval(loadEvents, EVENTS_POLL_MS);
    return () => { window.clearInterval(t1); window.clearInterval(t2); };
  }, [qs]);

  const latest = data?.latest || null;
  const match = data?.match;
  if (!qs) return null;

  /* ── stat values ── */
  const homePoss = stat(latest, 'homePossession');
  const awayPoss = stat(latest, 'awayPossession');
  const homeAtk = stat(latest, 'homeAttacks');
  const awayAtk = stat(latest, 'awayAttacks');
  const homeDng = stat(latest, 'homeDangerousAttacks');
  const awayDng = stat(latest, 'awayDangerousAttacks');
  const homeShots = stat(latest, 'homeShots');
  const awayShots = stat(latest, 'awayShots');
  const homeShotsOn = stat(latest, 'homeShotsOnTarget');
  const awayShotsOn = stat(latest, 'awayShotsOnTarget');
  const homeShotsOff = stat(latest, 'homeShotsOffTarget');
  const awayShotsOff = stat(latest, 'awayShotsOffTarget');
  const homeCorners = stat(latest, 'homeCorners');
  const awayCorners = stat(latest, 'awayCorners');
  const homeYellow = stat(latest, 'homeYellowCards');
  const awayYellow = stat(latest, 'awayYellowCards');
  const homeRed = stat(latest, 'homeRedCards');
  const awayRed = stat(latest, 'awayRedCards');

  /* ── formations (from latest snapshot or events hint) ── */
  const homeFormation = (latest?.homeFormation as string) || '4-3-3';
  const awayFormation = (latest?.awayFormation as string) || '4-3-3';

  return (
    <section
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0e1a] via-[#0d1220] to-[#080c18] shadow-card"
      style={{ background: 'linear-gradient(135deg,#07090f 0%,#0e1626 60%,#07090f 100%)' }}
    >
      {/* ══ Header ══ */}
      <div
        className="relative overflow-hidden px-5 pb-4 pt-5"
        style={{ background: 'linear-gradient(180deg, rgba(91,200,245,0.07) 0%, transparent 100%)' }}
      >
        {/* decorative grid lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(0deg,#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        <h2 className="relative text-center text-xl font-black tracking-tight text-white" style={{ textShadow: '0 0 24px rgba(91,200,245,0.5)' }}>
          إحصائيات المباراة
        </h2>
        <p className="relative mt-1 text-center text-xs text-gray-400">عرض موحد للأرقام والأحداث في مكان واحد</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">جاري تحميل البيانات…</div>
      ) : error ? (
        <div className="m-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="mb-2 inline" size={16} /> {error}
        </div>
      ) : (
        <>
          {/* ══ Scoreboard ══ */}
          <div className="px-4 pb-0 pt-2">
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 p-4"
              style={{ background: 'linear-gradient(135deg,rgba(91,200,245,0.08),rgba(0,0,0,0.4))' }}
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* home */}
                <div className="flex flex-col items-start gap-2">
                  <TeamFlag team={match?.homeTeam ?? null} size={52} />
                  <span className="max-w-[110px] truncate text-base font-black text-[#5BC8F5]">
                    {match?.homeTeam?.name ?? 'الفريق الأول'}
                  </span>
                </div>

                {/* score */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="rounded-2xl border border-[#FFD700]/40 px-5 py-3 text-4xl font-black tabular-nums text-white"
                    style={{ background: 'rgba(0,0,0,0.6)', textShadow: '0 0 20px rgba(255,215,0,0.4)' }}
                  >
                    {scoreLabel(match?.homeScore)}&nbsp;-&nbsp;{scoreLabel(match?.awayScore)}
                  </div>
                  <span className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/15 px-3 py-0.5 text-[11px] font-black text-[#FFD700]">
                    {match?.status === 'FT' ? 'نهاية المباراة' : match?.status === 'HT' ? 'استراحة' : match?.status ?? 'مجدولة'}
                  </span>
                </div>

                {/* away */}
                <div className="flex flex-col items-end gap-2">
                  <TeamFlag team={match?.awayTeam ?? null} size={52} />
                  <span className="max-w-[110px] truncate text-right text-base font-black text-[#FF6B6B]">
                    {match?.awayTeam?.name ?? 'الفريق الثاني'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ Main stats + Events ══ */}
          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_340px]">

            {/* Left: stat rows */}
            <div
              className="rounded-2xl border border-white/10 px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {/* team header */}
              <div className="mb-2 grid grid-cols-[56px_1fr_56px] items-center gap-x-3">
                <span className="text-right text-xs font-black text-[#5BC8F5]">
                  {match?.homeTeam?.name ?? 'الفريق الأول'}
                </span>
                <span />
                <span className="text-left text-xs font-black text-[#FF6B6B]">
                  {match?.awayTeam?.name ?? 'الفريق الثاني'}
                </span>
              </div>

              <div className="divide-y divide-white/5">
                <StatRow label="الاستحواذ" home={homePoss} away={awayPoss} />
                <StatRow label="الهجمات" home={homeAtk} away={awayAtk} />
                <StatRow label="الهجمات الخطيرة" home={homeDng} away={awayDng} homeAccent />
                <StatRow label="التسديدات" home={homeShots} away={awayShots} />
                <StatRow label="على المرمى" home={homeShotsOn} away={awayShotsOn} homeAccent />
                <StatRow label="تسديدات خارج المرمى" home={homeShotsOff} away={awayShotsOff} />
                <StatRow label="الركنيات" home={homeCorners} away={awayCorners} />
                <StatRow label="بطاقات صفراء" home={homeYellow} away={awayYellow} />
                <StatRow label="بطاقات حمراء" home={homeRed} away={awayRed} />
              </div>
            </div>

            {/* Right: events */}
            <div
              className="rounded-2xl border border-white/10 p-4"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <h3 className="mb-3 font-black text-white">أحداث المباراة</h3>
              <div className="max-h-[460px] overflow-y-auto">
                <EventTimeline events={events} data={data} />
              </div>
            </div>
          </div>

          {/* ══ Bottom row: Advanced + Formations ══ */}
          <div className="grid gap-4 px-4 pb-4 lg:grid-cols-3">

            {/* Advanced stats */}
            <div
              className="rounded-2xl border border-white/10 p-4"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <h3 className="mb-3 text-sm font-black text-white">إحصائيات متقدمة</h3>
              <div className="grid grid-cols-2 gap-2">
                <AdvancedBox label="xG" homeVal={stat(latest, 'homeXg')} awayVal={stat(latest, 'awayXg')} />
                <AdvancedBox label="npxG" homeVal={stat(latest, 'homeNpxg')} awayVal={stat(latest, 'awayNpxg')} />
                <AdvancedBox label="فرص كبيرة" homeVal={stat(latest, 'homeBigChances')} awayVal={stat(latest, 'awayBigChances')} />
                <AdvancedBox label="دقة التمرير" homeVal={stat(latest, 'homePassAccuracy')} awayVal={stat(latest, 'awayPassAccuracy')} />
              </div>
            </div>

            {/* Formations */}
            <div
              className="rounded-2xl border border-white/10 p-4"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <h3 className="mb-3 text-center text-sm font-black text-white">التشكيلات المؤكدة</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-black text-[#5BC8F5]">{match?.homeTeam?.name ?? 'الفريق الأول'}</span>
                  <span className="text-lg font-black text-white">{homeFormation}</span>
                  <FormationDots formation={homeFormation} color="#5BC8F5" />
                  <div className="mt-1 text-[10px] text-gray-500">
                    <span>11 لاعبًا أساسيًا</span>
                    <br /><span>15 لاعبًا بديلًا</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-black text-[#FF6B6B]">{match?.awayTeam?.name ?? 'الفريق الثاني'}</span>
                  <span className="text-lg font-black text-white">{awayFormation}</span>
                  <FormationDots formation={awayFormation} color="#FF6B6B" />
                  <div className="mt-1 text-[10px] text-gray-500">
                    <span>11 لاعبًا أساسيًا</span>
                    <br /><span>15 لاعبًا بديلًا</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Match intelligence */}
            <div
              className="rounded-2xl border border-[#5BC8F5]/20 p-4"
              style={{ background: 'linear-gradient(135deg,rgba(91,200,245,0.06),rgba(0,0,0,0.4))' }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5BC8F5]">Match Intelligence</span>
              </div>
              <h3 className="mb-3 text-base font-black text-white">قراءة ذكية للمباراة</h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {homeDng !== null && awayDng !== null && homeDng > awayDng && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <span className="text-[#FFD700]">⚠️ {match?.homeTeam?.name}</span>
                    <p className="mt-1 text-gray-300">أكثر خطورة بفارق {homeDng - awayDng} هجمات خطيرة</p>
                  </div>
                )}
                {homeShotsOn !== null && awayShotsOn !== null && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <span className="text-[#5BC8F5]">🥅 على المرمى</span>
                    <p className="mt-1 text-gray-300">{match?.homeTeam?.name} {homeShotsOn} مقابل {awayShotsOn}</p>
                  </div>
                )}
                {homePoss !== null && awayPoss !== null && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <span className="text-[homePoss > awayPoss ? '#5BC8F5' : '#FF6B6B']">⏱️ الاستحواذ</span>
                    <p className="mt-1 text-gray-300">
                      {homePoss > awayPoss ? match?.homeTeam?.name : match?.awayTeam?.name} أفضل بنسبة {Math.abs(homePoss - awayPoss)}%
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                  <span className="text-[#FFD700]">📊 مؤشر الخطورة</span>
                  <p className="mt-1 text-gray-300">
                    {homeDng !== null ? `${match?.homeTeam?.name} ${homeDng}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
