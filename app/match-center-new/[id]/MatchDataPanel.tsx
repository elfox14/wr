'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  MapPin,
  Shield,
  Trophy,
  CalendarDays,
  Timer,
  BarChart3,
  Sparkles,
  Goal,
  Users,
  Flag,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string;
  name?: string;
  code?: string;
  image?: string;
  shortName?: string;
} | null;

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
  x?: number | null;
  y?: number | null;
};

type StatsResponse = {
  ok: boolean;
  updatedAt?: string;
  hasStats?: boolean;
  sourceStatus?: {
    mode?: string;
    statsProvider?: string;
    isportsBlocked?: boolean;
    reason?: string;
  };
  scorePolicy?: {
    timeInferenceDisabled?: boolean;
    statusSource?: string;
  };
  match?: {
    id: string;
    status: string;
    homeScore: number;
    awayScore: number;
    homeTeam: Team;
    awayTeam: Team;
    venue?: string | null;
    referee?: string | null;
    city?: string | null;
    competition?: string | null;
    stage?: string | null;
    kickoff?: string | null;
    attendance?: number | null;
    weather?: string | null;
  };
  latest?: Snapshot;
  error?: string;
};

type EventsResponse = {
  ok: boolean;
  updatedAt?: string;
  events?: EventItem[];
  error?: string;
};

type Props = {
  matchId?: string | number | null;
  dbMatchId?: string | number | null;
};

const STATS_POLL_MS = 30_000;
const EVENTS_POLL_MS = 15_000;

function valueLabel(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('ar-EG')
    : '—';
}

function scoreLabel(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('ar-EG')
    : '٠';
}

function stat(snapshot: Snapshot, key: string) {
  const raw = snapshot?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function flag(team: Team, width = 80) {
  return getTeamFlagUrl(
    { code: team?.code, name: team?.name, image: team?.image },
    width
  );
}

function query(matchId?: string | number | null, dbMatchId?: string | number | null) {
  const params = new URLSearchParams();
  if (matchId) params.set('matchId', String(matchId));
  if (dbMatchId) params.set('dbMatchId', String(dbMatchId));
  return params.toString();
}

function eventIcon(type: string) {
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

function TeamBadge({
  team,
  colorClass,
  align = 'right',
}: {
  team: Team;
  colorClass: string;
  align?: 'right' | 'left';
}) {
  const src = flag(team, 80);

  return (
    <div className={`flex flex-col gap-2 ${align === 'left' ? 'items-start' : 'items-end'}`}>
      <div
        className={`flex items-center gap-3 ${
          align === 'left' ? 'flex-row' : 'flex-row-reverse'
        }`}
      >
        <div className="relative">
          <div
            className={`absolute inset-0 rounded-2xl blur-xl opacity-35 ${colorClass}`}
          />
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5">
            {src ? (
              <img
                src={src}
                alt={team?.name || 'team'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-xl font-black text-white">?</span>
            )}
          </div>
        </div>
        <div className={`${align === 'left' ? 'text-right' : 'text-left'}`}>
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
            Team
          </div>
          <div className="text-xl font-black text-white">
            {team?.name || 'الفريق'}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMeta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-bold text-gray-500">
        <span className="text-[#FFD700]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-sm font-black text-white">{value || '—'}</div>
    </div>
  );
}

function StatBarRow({
  label,
  home,
  away,
  icon,
}: {
  label: string;
  home: number | null;
  away: number | null;
  icon: React.ReactNode;
}) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const hp = total > 0 ? Math.max(6, Math.round((h / total) * 100)) : 50;
  const ap = total > 0 ? Math.max(6, Math.round((a / total) * 100)) : 50;

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
      <div className="mb-2 grid grid-cols-[56px_1fr_56px] items-center gap-3">
        <div className="text-right text-sm font-black text-cyan-300 tabular-nums">
          {valueLabel(home)}
        </div>
        <div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-gray-300">
          <span className="text-[#FFD700]">{icon}</span>
          <span>{label}</span>
        </div>
        <div className="text-left text-sm font-black text-rose-300 tabular-nums">
          {valueLabel(away)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-300"
            style={{ width: `${hp}%` }}
          />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400"
            style={{ width: `${ap}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#FFD700]">
          {icon}
        </div>
        <h3 className="text-base font-black text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function LastMatchesStrip({ teamName }: { teamName: string }) {
  const fake = ['ف', 'ف', 'ت', 'خ', 'ف'];
  return (
    <div>
      <div className="mb-2 text-xs font-bold text-gray-500">آخر 5 مباريات</div>
      <div className="flex gap-2">
        {fake.map((item, i) => (
          <div
            key={`${teamName}-${i}`}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${
              item === 'ف'
                ? 'bg-emerald-500/20 text-emerald-300'
                : item === 'ت'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamMiniProfile({
  team,
  side,
}: {
  team: Team;
  side: 'home' | 'away';
}) {
  const src = flag(team, 96);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {src ? (
            <img src={src} alt={team?.name || ''} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <div
            className={`text-[11px] font-bold uppercase tracking-[0.25em] ${
              side === 'home' ? 'text-cyan-300' : 'text-rose-300'
            }`}
          >
            {side === 'home' ? 'Home' : 'Away'}
          </div>
          <div className="text-lg font-black text-white">{team?.name || 'الفريق'}</div>
        </div>
      </div>

      <div className="grid gap-3">
        <LastMatchesStrip teamName={team?.name || 'team'} />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-gray-500">متوسط الأهداف</div>
            <div className="mt-1 text-sm font-black text-white">1.8</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-gray-500">شباك نظيفة</div>
            <div className="mt-1 text-sm font-black text-white">2 / 5</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeadToHeadBlock({
  homeName,
  awayName,
}: {
  homeName: string;
  awayName: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-cyan-500/10 p-4 text-center">
        <div className="text-xs text-cyan-200">{homeName}</div>
        <div className="mt-2 text-3xl font-black text-white">3</div>
        <div className="text-xs text-gray-400">انتصارات</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
        <div className="text-xs text-gray-300">تعادل</div>
        <div className="mt-2 text-3xl font-black text-white">1</div>
        <div className="text-xs text-gray-500">آخر المواجهات</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-rose-500/10 p-4 text-center">
        <div className="text-xs text-rose-200">{awayName}</div>
        <div className="mt-2 text-3xl font-black text-white">2</div>
        <div className="text-xs text-gray-400">انتصارات</div>
      </div>
    </div>
  );
}

function GroupTable({
  homeName,
  awayName,
}: {
  homeName: string;
  awayName: string;
}) {
  const rows = [
    { team: homeName, pts: 6, gd: '+4' },
    { team: awayName, pts: 4, gd: '+1' },
    { team: 'فريق ثالث', pts: 3, gd: '-2' },
    { team: 'فريق رابع', pts: 1, gd: '-3' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-[40px_1fr_60px_60px] bg-white/[0.05] px-3 py-2 text-xs font-bold text-gray-400">
        <div>#</div>
        <div>الفريق</div>
        <div className="text-center">النقاط</div>
        <div className="text-center">فارق</div>
      </div>
      {rows.map((row, idx) => (
        <div
          key={row.team}
          className="grid grid-cols-[40px_1fr_60px_60px] items-center border-t border-white/5 px-3 py-3 text-sm"
        >
          <div className="font-black text-white">{idx + 1}</div>
          <div className="font-bold text-white">{row.team}</div>
          <div className="text-center font-black text-[#FFD700]">{row.pts}</div>
          <div className="text-center font-bold text-gray-300">{row.gd}</div>
        </div>
      ))}
    </div>
  );
}

function EventTimeline({
  events,
}: {
  events: EventItem[];
}) {
  return (
    <div className="relative">
      <div className="absolute right-[14px] top-0 h-full w-px bg-white/10" />
      <div className="space-y-3">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="relative flex items-start gap-3">
              <div className="relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#FFD700]/40 bg-[#FFD700]/10 text-xs">
                {eventIcon(event.type)}
              </div>
              <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-xs font-black text-[#FFD700]">
                    {event.minuteLabel || (event.minute ? `د${event.minute}` : 'حدث')}
                  </div>
                  <div className="text-[11px] font-bold text-gray-500">
                    {event.type}
                  </div>
                </div>
                {event.playerName ? (
                  <div className="text-sm font-black text-white">{event.playerName}</div>
                ) : null}
                <div className="mt-1 text-sm leading-6 text-gray-300">{event.detail}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
            لا توجد أحداث محفوظة بعد.
          </div>
        )}
      </div>
    </div>
  );
}

function PitchEventMap({ events }: { events: EventItem[] }) {
  const plotted = events.filter(
    (event) =>
      typeof event.x === 'number' &&
      typeof event.y === 'number' &&
      Number.isFinite(event.x) &&
      Number.isFinite(event.y)
  );

  return (
    <div className="rounded-3xl border border-emerald-400/15 bg-[#071a10] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-black text-white">الملعب التفاعلي</div>
          <div className="text-xs text-emerald-200/70">
            عرض مواقع الأحداث النهائية على أرضية الملعب
          </div>
        </div>
        <div className="text-[11px] font-bold text-emerald-200">
          {plotted.length} حدث بإحداثيات
        </div>
      </div>

      <div className="relative aspect-[1.9/1] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-emerald-700/30 to-emerald-900/40">
        <div className="absolute inset-4 rounded-[28px] border border-white/30" />
        <div className="absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-white/25" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
        <div className="absolute bottom-1/2 left-4 h-28 w-16 translate-y-1/2 border border-white/25 border-r-0" />
        <div className="absolute bottom-1/2 right-4 h-28 w-16 translate-y-1/2 border border-white/25 border-l-0" />
        <div className="absolute bottom-1/2 left-4 h-14 w-6 translate-y-1/2 border border-white/25 border-r-0" />
        <div className="absolute bottom-1/2 right-4 h-14 w-6 translate-y-1/2 border border-white/25 border-l-0" />

        {plotted.map((event) => {
          const left = `${Math.max(3, Math.min(97, Number(event.x)))}%`;
          const top = `${Math.max(3, Math.min(97, Number(event.y)))}%`;
          const isGoal = event.type.toLowerCase().includes('goal');

          return (
            <div
              key={`pitch-${event.id}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left, top }}
            >
              <div
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] shadow-lg ${
                  isGoal
                    ? 'border-[#FFD700] bg-[#FFD700] text-black'
                    : 'border-white/40 bg-black/60 text-white'
                }`}
              >
                {eventIcon(event.type)}
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-44 -translate-x-1/2 rounded-xl border border-white/10 bg-[#08111f] p-2 text-[11px] text-white shadow-2xl group-hover:block">
                <div className="font-black text-[#FFD700]">
                  {event.minuteLabel || (event.minute ? `د${event.minute}` : 'حدث')}
                </div>
                <div className="mt-1 leading-5 text-gray-300">{event.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmartInsight({
  title,
  body,
  tone = 'default',
}: {
  title: string;
  body: string;
  tone?: 'default' | 'home' | 'away' | 'accent';
}) {
  const toneClass =
    tone === 'home'
      ? 'bg-cyan-500/10 border-cyan-400/20'
      : tone === 'away'
      ? 'bg-rose-500/10 border-rose-400/20'
      : tone === 'accent'
      ? 'bg-[#FFD700]/10 border-[#FFD700]/20'
      : 'bg-white/[0.04] border-white/10';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="mb-2 text-sm font-black text-white">{title}</div>
      <div className="text-sm leading-6 text-gray-300">{body}</div>
    </div>
  );
}

function inferInsights(data: StatsResponse | null, latest: Snapshot) {
  const home = data?.match?.homeTeam?.name || 'الفريق الأول';
  const away = data?.match?.awayTeam?.name || 'الفريق الثاني';
  const possHome = stat(latest, 'homePossession') ?? 0;
  const possAway = stat(latest, 'awayPossession') ?? 0;
  const dHome = stat(latest, 'homeDangerousAttacks') ?? 0;
  const dAway = stat(latest, 'awayDangerousAttacks') ?? 0;
  const sHome = stat(latest, 'homeShotsOnTarget') ?? 0;
  const sAway = stat(latest, 'awayShotsOnTarget') ?? 0;

  return [
    {
      title: 'قراءة السيطرة',
      body:
        possHome === possAway
          ? 'المباراة متوازنة في الاستحواذ، والحسم ينتقل إلى جودة الفرص والتنفيذ داخل الثلث الأخير.'
          : `${possHome > possAway ? home : away} يملك أفضلية في الاستحواذ بفارق ${Math.abs(
              possHome - possAway
            )}%، ما يشير إلى تحكم أكبر في نسق اللعب.`,
      tone: 'accent' as const,
    },
    {
      title: 'الخطر الهجومي',
      body:
        dHome === dAway
          ? 'مستوى التهديد متقارب، وهذا يرفع قيمة التفاصيل الصغيرة مثل التحول السريع أو الكرات الثابتة.'
          : `${dHome > dAway ? home : away} الأكثر خطورة بفارق ${Math.abs(
              dHome - dAway
            )} هجمة خطيرة.`,
      tone: dHome > dAway ? ('home' as const) : ('away' as const),
    },
    {
      title: 'جودة الإنهاء',
      body:
        sHome === sAway
          ? 'عدد التسديدات على المرمى متساوٍ تقريبًا، لذلك الجودة النهائية هي العامل الفارق.'
          : `${sHome > sAway ? home : away} سدد على المرمى أكثر (${Math.max(
              sHome,
              sAway
            )})، ما يعكس فاعلية هجومية أعلى.`,
      tone: sHome > sAway ? ('home' as const) : ('away' as const),
    },
  ];
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
  const insights = inferInsights(data, latest);

  const homeName = match?.homeTeam?.name || 'الفريق الأول';
  const awayName = match?.awayTeam?.name || 'الفريق الثاني';

  if (!qs) return null;

  return (
    <section
      dir="rtl"
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#050816] text-white shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-20 top-12 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#FFD700]/5 blur-3xl" />
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-gray-400">جاري تحميل النسخة الاحترافية للمباراة...</div>
      ) : error ? (
        <div className="m-5 rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200">
          <AlertTriangle className="mb-2" /> {error}
        </div>
      ) : (
        <div className="relative z-10 p-4 lg:p-6">
          {/* HERO */}
          <div className="mb-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.03] to-rose-500/10 p-5 lg:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-[11px] font-black text-[#FFD700]">
                  <Sparkles size={13} />
                  Match Center New
                </div>
                <h2 className="text-2xl font-black lg:text-3xl">تجربة احترافية حصرية للمباراة</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-300">
                  صفحة شاملة تجمع النتيجة الحية، التحليل، الأحداث، الملعب التفاعلي، وسرد بصري متكامل للمواجهة.
                </p>
              </div>

              <div className="grid gap-2 text-xs font-bold text-gray-300">
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-2">
                  تحديث الإحصائيات: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('ar-EG') : '—'}
                </div>
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-2">
                  تحديث الأحداث: {eventsUpdatedAt ? new Date(eventsUpdatedAt).toLocaleTimeString('ar-EG') : '—'}
                </div>
              </div>
            </div>

            <div className="grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]">
              <TeamBadge team={match?.homeTeam || null} colorClass="bg-cyan-400/30" align="right" />

              <div className="text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-gray-300">
                  <Trophy size={13} className="text-[#FFD700]" />
                  {match?.competition || 'بطولة دولية'} {match?.stage ? `• ${match.stage}` : ''}
                </div>
                <div className="rounded-[28px] border border-[#FFD700]/25 bg-black/30 px-8 py-5 shadow-[0_0_40px_rgba(255,215,0,0.12)]">
                  <div className="text-5xl font-black tracking-tight text-white lg:text-6xl">
                    {scoreLabel(match?.homeScore)} - {scoreLabel(match?.awayScore)}
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]">
                    {match?.status || 'LIVE'}
                  </div>
                </div>
              </div>

              <TeamBadge team={match?.awayTeam || null} colorClass="bg-rose-400/30" align="left" />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <HeroMeta icon={<MapPin size={15} />} label="الملعب" value={match?.venue || 'غير متاح'} />
              <HeroMeta icon={<Shield size={15} />} label="الحكم" value={match?.referee || 'غير متاح'} />
              <HeroMeta icon={<Flag size={15} />} label="المدينة" value={match?.city || 'غير متاح'} />
              <HeroMeta
                icon={<CalendarDays size={15} />}
                label="الموعد"
                value={match?.kickoff ? new Date(match.kickoff).toLocaleString('ar-EG') : 'غير متاح'}
              />
              <HeroMeta
                icon={<Users size={15} />}
                label="الحضور / الطقس"
                value={
                  match?.attendance
                    ? `${valueLabel(match.attendance)} متفرج`
                    : match?.weather || 'غير متاح'
                }
              />
            </div>
          </div>

          {/* INSIGHTS */}
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            {insights.map((item) => (
              <SmartInsight
                key={item.title}
                title={item.title}
                body={item.body}
                tone={item.tone}
              />
            ))}
          </div>

          {/* CORE GRID */}
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <InfoCard title="كل الإحصائيات" icon={<BarChart3 size={18} />}>
                <div className="space-y-3">
                  <StatBarRow
                    label="الاستحواذ"
                    home={stat(latest, 'homePossession')}
                    away={stat(latest, 'awayPossession')}
                    icon={<Timer size={14} />}
                  />
                  <StatBarRow
                    label="الهجمات"
                    home={stat(latest, 'homeAttacks')}
                    away={stat(latest, 'awayAttacks')}
                    icon={<ChevronRight size={14} />}
                  />
                  <StatBarRow
                    label="الهجمات الخطيرة"
                    home={stat(latest, 'homeDangerousAttacks')}
                    away={stat(latest, 'awayDangerousAttacks')}
                    icon={<Activity size={14} />}
                  />
                  <StatBarRow
                    label="التسديدات"
                    home={stat(latest, 'homeShots')}
                    away={stat(latest, 'awayShots')}
                    icon={<Goal size={14} />}
                  />
                  <StatBarRow
                    label="على المرمى"
                    home={stat(latest, 'homeShotsOnTarget')}
                    away={stat(latest, 'awayShotsOnTarget')}
                    icon={<Sparkles size={14} />}
                  />
                  <StatBarRow
                    label="خارج المرمى"
                    home={stat(latest, 'homeShotsOffTarget')}
                    away={stat(latest, 'awayShotsOffTarget')}
                    icon={<ChevronLeft size={14} />}
                  />
                  <StatBarRow
                    label="الركنيات"
                    home={stat(latest, 'homeCorners')}
                    away={stat(latest, 'awayCorners')}
                    icon={<Flag size={14} />}
                  />
                  <StatBarRow
                    label="البطاقات الصفراء"
                    home={stat(latest, 'homeYellowCards')}
                    away={stat(latest, 'awayYellowCards')}
                    icon={<div className="h-3 w-3 rounded-sm bg-yellow-400" />}
                  />
                  <StatBarRow
                    label="البطاقات الحمراء"
                    home={stat(latest, 'homeRedCards')}
                    away={stat(latest, 'awayRedCards')}
                    icon={<div className="h-3 w-3 rounded-sm bg-red-500" />}
                  />
                </div>
              </InfoCard>

              <InfoCard title="الملعب التفاعلي للأحداث" icon={<MapPin size={18} />}>
                <PitchEventMap events={events} />
              </InfoCard>

              <InfoCard title="المواجهات المباشرة" icon={<Trophy size={18} />}>
                <HeadToHeadBlock homeName={homeName} awayName={awayName} />
              </InfoCard>

              <InfoCard title="موقف المجموعة" icon={<BarChart3 size={18} />}>
                <GroupTable homeName={homeName} awayName={awayName} />
              </InfoCard>
            </div>

            <div className="space-y-6">
              <InfoCard title="أحداث المباراة النهائية" icon={<CalendarDays size={18} />}>
                <div className="max-h-[560px] overflow-y-auto pr-1">
                  <EventTimeline events={events} />
                </div>
              </InfoCard>

              <InfoCard title="معلومات الفريقين" icon={<Users size={18} />}>
                <div className="grid gap-4">
                  <TeamMiniProfile team={match?.homeTeam || null} side="home" />
                  <TeamMiniProfile team={match?.awayTeam || null} side="away" />
                </div>
              </InfoCard>

              <InfoCard title="مقترحات حصرية" icon={<Sparkles size={18} />}>
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-1 text-sm font-black text-white">Story of the Match</div>
                    <div className="text-sm leading-6 text-gray-300">
                      نضيف شريطًا سرديًا يشرح كيف تغيّر مسار المباراة دقيقة بدقيقة، ومن أين جاء التحول الحقيقي.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-1 text-sm font-black text-white">Shareable Infographic</div>
                    <div className="text-sm leading-6 text-gray-300">
                      بطاقة مشاركة جاهزة للسوشيال تعرض النتيجة، الإحصائيات الحاسمة، ورسمًا بصريًا للأحداث.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-1 text-sm font-black text-white">Broadcast Mode</div>
                    <div className="text-sm leading-6 text-gray-300">
                      نسخة تلفزيونية أكبر للعروض أو شاشات الاستوديو مع تباين عالٍ وحركة انتقال ناعمة.
                    </div>
                  </div>
                </div>
              </InfoCard>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
