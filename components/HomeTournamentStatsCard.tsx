'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

type SourceName = 'DB' | 'FBref' | '—';
type Tone = 'gold' | 'cyan' | 'green' | 'red' | 'neutral';

const STATS_REFRESH_MS = 60_000;
const LOADING_VALUE = '...';

function read(obj: any, key: string) {
  return obj?.[key];
}

function usefulNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function pickNumber(primary: unknown, fallback: unknown) {
  return usefulNumber(primary) ?? usefulNumber(fallback) ?? (typeof primary === 'number' && Number.isFinite(primary) ? primary : typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : null);
}

function formatCount(value?: number | null, unavailable = 'غير متوفر') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable;
  return new Intl.NumberFormat('ar-EG').format(value);
}

function formatDecimal(value?: number | null, unavailable = 'غير متوفر') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable;
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'غير متوفر';
  return `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatUpdateTime(value?: string | null) {
  if (!value) return 'بانتظار أول تحديث من المصدر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'بانتظار أول تحديث من المصدر';

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function teamName(team?: { name?: string; code?: string | null } | null) {
  return team?.name || team?.code || 'منتخب غير متوفر';
}

function shortTeamStat(team: any, statKey: string, suffix = '') {
  if (!team) return 'غير متوفر';
  const value = formatCount(Number(team?.[statKey] ?? 0));
  return `${teamName(team)} · ${value}${suffix}`;
}

function sourceFrom(useFallback: boolean, hasDbValue = true): SourceName {
  if (useFallback) return 'FBref';
  if (hasDbValue) return 'DB';
  return '—';
}

function SourceBadge({ source }: { source?: SourceName | string }) {
  if (!source || source === '—') return null;
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[9px] font-black text-gray-300">
      {source}
    </span>
  );
}

function Shell({
  children,
  href,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  href?: string;
  tone?: Tone;
  className?: string;
}) {
  const glow = {
    gold: 'via-[#FFD700]/55 hover:border-[#FFD700]/40',
    cyan: 'via-[#0FF0FC]/50 hover:border-[#0FF0FC]/40',
    green: 'via-[#00FF88]/45 hover:border-[#00FF88]/35',
    red: 'via-red-300/45 hover:border-red-300/35',
    neutral: 'via-white/35 hover:border-white/25',
  }[tone];

  const body = (
    <article className={`group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(0,0,0,0.28))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_34px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 ${glow} ${className}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${glow.split(' ')[0]} to-transparent`} />
      <div className="pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full bg-white/[0.045] blur-2xl transition group-hover:bg-white/[0.07]" />
      <div className="relative z-10 h-full">{children}</div>
    </article>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function LoadingBox({ label }: { label: string }) {
  return (
    <Shell>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black text-[#FFD700]">{label}</div>
          <div className="h-4 w-12 animate-pulse rounded-full bg-white/[0.08]" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-xl bg-white/[0.08]" />
        <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
      </div>
    </Shell>
  );
}

function GoalsCard({ totalGoals, averageGoals, finishedMatches, source }: { totalGoals: number | null; averageGoals: number | null; finishedMatches: number | null; source: SourceName }) {
  return (
    <Shell href="/matches" tone="gold" className="min-h-[172px]">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black text-[#FFD700]">أهداف البطولة</div>
            <div className="mt-2 text-4xl font-black leading-none text-[#FFD700] md:text-5xl">{formatCount(totalGoals)}</div>
          </div>
          <SourceBadge source={source} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[#FFD700]/18 bg-[#FFD700]/10 p-2">
            <div className="text-lg font-black text-white">{formatDecimal(averageGoals)}</div>
            <div className="text-[9px] font-bold text-gray-400">متوسط الأهداف</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
            <div className="text-lg font-black text-white">{formatCount(finishedMatches)}</div>
            <div className="text-[9px] font-bold text-gray-400">مباراة منتهية</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function MatchFlowCard({ finished, live, scheduled, source }: { finished: number | null; live: number | null; scheduled: number | null; source: SourceName }) {
  const total = Math.max(1, Number(finished || 0) + Number(live || 0) + Number(scheduled || 0));
  const finishedPct = Math.max(0, Math.min(100, (Number(finished || 0) / total) * 100));
  const livePct = Math.max(0, Math.min(100, (Number(live || 0) / total) * 100));

  return (
    <Shell href="/matches" tone="neutral" className="min-h-[172px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black text-[#FFD700]">حالة المباريات</div>
          <div className="mt-2 text-3xl font-black text-white">{formatCount(finished)}</div>
          <div className="text-[10px] font-bold text-gray-400">مباراة منتهية</div>
        </div>
        <SourceBadge source={source} />
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${finishedPct}%` }} />
        <div className="-mt-3 h-full rounded-full bg-[#FFD700]" style={{ width: `${Math.min(100, finishedPct + livePct)}%`, opacity: livePct > 0 ? 0.9 : 0 }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[#00FF88]/18 bg-[#00FF88]/10 p-2 text-center">
          <div className="font-black text-[#00FF88]">{formatCount(live)}</div>
          <div className="text-[9px] font-bold text-gray-400">مباشر</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-2 text-center">
          <div className="font-black text-white">{formatCount(scheduled)}</div>
          <div className="text-[9px] font-bold text-gray-400">متبقية</div>
        </div>
      </div>
    </Shell>
  );
}

function PlayerPoolCard({ playerCount, teamCount, source }: { playerCount: number | null; teamCount: number | null; source: SourceName }) {
  return (
    <Shell href="/players" tone="green" className="min-h-[172px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black text-[#00FF88]">قوائم اللاعبين</div>
          <div className="mt-2 text-4xl font-black leading-none text-[#00FF88]">{formatCount(playerCount)}</div>
        </div>
        <SourceBadge source={source} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-2 rounded-2xl border border-[#00FF88]/15 bg-[#00FF88]/8 p-3">
        <div className="flex -space-x-2 space-x-reverse">
          {[0, 1, 2, 3].map((item) => (
            <span key={item} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00FF88]/25 bg-black/45 text-[10px] font-black text-[#00FF88]">●</span>
          ))}
        </div>
        <div className="text-left">
          <div className="text-xl font-black text-white">{formatCount(teamCount)}</div>
          <div className="text-[9px] font-bold text-gray-400">منتخب</div>
        </div>
      </div>
    </Shell>
  );
}

function ShotsCard({ totalShots, onTarget, matches, source }: { totalShots: number | null; onTarget: number | null; matches: number | null; source: SourceName }) {
  const accuracy = totalShots && onTarget !== null ? Math.max(0, Math.min(100, (onTarget / totalShots) * 100)) : null;

  return (
    <Shell href="/matches" tone="cyan" className="min-h-[190px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-black text-[#0FF0FC]">التسديدات</div>
          <div className="mt-1 text-[10px] font-bold text-gray-400">إجمالي / على المرمى</div>
        </div>
        <SourceBadge source={source} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
          <div className="text-3xl font-black text-white">{formatCount(totalShots)}</div>
          <div className="text-[9px] font-bold text-gray-400">تسديدة</div>
        </div>
        <div className="relative h-16 w-16 rounded-full border-2 border-[#0FF0FC]/45 bg-[#0FF0FC]/10 shadow-[0_0_24px_rgba(15,240,252,0.12)]">
          <span className="absolute inset-3 rounded-full border border-[#0FF0FC]/35" />
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#0FF0FC]/25" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#0FF0FC]/25" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0FF0FC]" />
        </div>
        <div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-center">
          <div className="text-3xl font-black text-[#0FF0FC]">{formatCount(onTarget)}</div>
          <div className="text-[9px] font-bold text-gray-300">على المرمى</div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-2">
        <div className="mb-1 flex justify-between text-[9px] font-bold text-gray-400">
          <span>دقة التسديد</span>
          <span>{accuracy !== null ? formatPercent(accuracy) : 'غير متوفر'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#0FF0FC]" style={{ width: `${accuracy || 0}%` }} /></div>
        <div className="mt-1 text-[9px] font-bold text-gray-500">من {formatCount(matches)} مباراة بها إحصائيات</div>
      </div>
    </Shell>
  );
}

function DisciplineCards({ yellow, red, source }: { yellow: number | null; red: number | null; source: SourceName }) {
  return (
    <Shell href="/matches" tone="red" className="min-h-[190px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-black text-red-100">الانضباط</div>
          <div className="mt-1 text-[10px] font-bold text-gray-400">إنذارات وطرد</div>
        </div>
        <SourceBadge source={source} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative min-h-[120px] rounded-2xl border border-[#FFD700]/35 bg-[#FFD700] p-3 text-black shadow-[0_12px_30px_rgba(255,215,0,0.16)] transition group-hover:-rotate-1">
          <div className="absolute inset-x-4 top-3 h-px bg-black/20" />
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Yellow</div>
          <div className="mt-4 text-5xl font-black leading-none">{formatCount(yellow)}</div>
          <div className="mt-2 text-xs font-black text-black/65">بطاقات صفراء</div>
        </div>
        <div className="relative min-h-[120px] rounded-2xl border border-red-300/35 bg-red-600 p-3 text-white shadow-[0_12px_30px_rgba(248,113,113,0.18)] transition group-hover:rotate-1">
          <div className="absolute inset-x-4 top-3 h-px bg-white/25" />
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/65">Red</div>
          <div className="mt-4 text-5xl font-black leading-none">{formatCount(red)}</div>
          <div className="mt-2 text-xs font-black text-white/75">بطاقات حمراء</div>
        </div>
      </div>
    </Shell>
  );
}

function PenaltyStatsCard({ kickStats, usingFbref }: { kickStats: any; usingFbref: boolean }) {
  const available = Boolean(kickStats?.available);
  const total = available ? Number(kickStats?.total || 0) : null;
  const scored = available ? Number(kickStats?.scored || 0) : null;
  const missed = available ? Number(kickStats?.missed || 0) : null;
  const unknown = available ? Number(kickStats?.unknown || 0) : null;
  const conversion = total && scored !== null ? Math.max(0, Math.min(100, (scored / total) * 100)) : null;

  return (
    <Shell tone="gold" className="min-h-[190px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-black text-[#FFD700]">ركلات الجزاء</div>
          <div className="mt-1 text-[10px] font-bold text-gray-400">Penalty Tracker</div>
        </div>
        <SourceBadge source={usingFbref ? 'FBref' : available ? 'DB/Event' : '—'} />
      </div>

      {available ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
              <div className="text-3xl font-black text-white">{formatCount(total)}</div>
              <div className="mt-1 text-[9px] font-bold text-gray-400">إجمالي</div>
            </div>
            <div className="rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-3 text-center">
              <div className="text-3xl font-black text-[#00FF88]">{formatCount(scored)}</div>
              <div className="mt-1 text-[9px] font-bold text-gray-300">مسجلة</div>
            </div>
            <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-center">
              <div className="text-3xl font-black text-red-100">{formatCount(missed)}</div>
              <div className="mt-1 text-[9px] font-bold text-gray-300">ضائعة</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-2">
            <div className="mb-1 flex justify-between text-[9px] font-bold text-gray-400">
              <span>نسبة التسجيل</span>
              <span>{conversion !== null ? formatPercent(conversion) : 'غير متوفر'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${conversion || 0}%` }} /></div>
            {unknown ? <div className="mt-1 text-[9px] font-bold text-gray-500">غير مصنفة: {formatCount(unknown)}</div> : null}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#FFD700]/18 bg-black/25 p-4 text-center">
          <div className="text-2xl font-black text-gray-200">بانتظار توثيق</div>
          <div className="mt-2 text-[10px] font-bold leading-5 text-gray-500">لا توجد حقول جزاءات مؤكدة في قاعدة البيانات أو لقطة FBref الحالية.</div>
        </div>
      )}
    </Shell>
  );
}

function TeamLeaderCard({ team, usingFbref }: { team: any; usingFbref: boolean }) {
  return (
    <Shell href={team?.id ? `/teams/${encodeURIComponent(team.id)}` : '/teams'} tone="gold" className="min-h-[180px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black text-[#FFD700]">أقوى هجوم</div>
        <SourceBadge source={sourceFrom(usingFbref, Boolean(team))} />
      </div>
      <div className="mt-4 rounded-2xl border border-[#FFD700]/18 bg-[#FFD700]/10 p-4">
        <div className="truncate text-lg font-black text-white">{team ? teamName(team) : 'غير متوفر'}</div>
        <div className="mt-2 text-4xl font-black text-[#FFD700]">{team ? formatCount(team.goalsFor) : '—'}</div>
        <div className="text-[10px] font-bold text-gray-400">هدف · {team ? shortTeamStat(team, 'played', ' مباريات') : 'يظهر بعد توفر بيانات كافية'}</div>
      </div>
    </Shell>
  );
}

function CleanSheetCard({ cleanSheets, bestTeam, usingFbref }: { cleanSheets: number | null; bestTeam: any; usingFbref: boolean }) {
  return (
    <Shell href="/matches" tone="green" className="min-h-[180px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black text-[#00FF88]">الشباك النظيفة</div>
        <SourceBadge source={sourceFrom(usingFbref, true)} />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#00FF88]/18 bg-[#00FF88]/10 p-4">
        <div className="relative h-16 w-20 rounded-xl border-2 border-[#00FF88]/35">
          <span className="absolute inset-x-3 top-1/2 h-px bg-[#00FF88]/25" />
          <span className="absolute left-1/3 top-0 h-full w-px bg-[#00FF88]/20" />
          <span className="absolute right-1/3 top-0 h-full w-px bg-[#00FF88]/20" />
        </div>
        <div>
          <div className="text-4xl font-black text-[#00FF88]">{formatCount(cleanSheets)}</div>
          <div className="text-[10px] font-bold text-gray-400">الأبرز: {bestTeam ? shortTeamStat(bestTeam, 'cleanSheets') : 'غير متوفر'}</div>
        </div>
      </div>
    </Shell>
  );
}

function BiggestScoreCard({ biggestScore }: { biggestScore: any }) {
  return (
    <Shell href={biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches'} tone="neutral" className="min-h-[180px]">
      <div className="text-[11px] font-black text-gray-200">أكبر نتيجة</div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
        <div className="text-4xl font-black text-white">{biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : '—'}</div>
        <div className="mt-2 text-[10px] font-bold leading-5 text-gray-400">
          {biggestScore ? `${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}` : 'تظهر بعد تسجيل نتيجة بها أهداف'}
        </div>
      </div>
    </Shell>
  );
}

export default function HomeTournamentStatsCard({ playersCount: serverPlayersCount, teamsCount, upcomingMatchesCount }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [fbrefStats, setFbrefStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastClientRefresh, setLastClientRefresh] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      try {
        const [databaseResponse, fbrefResponse] = await Promise.all([
          fetch('/api/matches/summary-stats', { cache: 'no-store' }),
          fetch('/api/matches/fbref-summary-stats', { cache: 'no-store' }),
        ]);

        if (databaseResponse.ok) {
          const data = await databaseResponse.json();
          if (!cancelled && data?.ok) setStats(data);
        }

        if (fbrefResponse.ok) {
          const data = await fbrefResponse.json();
          if (!cancelled && data?.ok) setFbrefStats(data);
        }

        if (!cancelled) setLastClientRefresh(new Date());
      } catch {
        // Keep the card readable if the endpoints are temporarily unavailable.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadStats();
    const timer = window.setInterval(loadStats, STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const isInitialLoading = isLoading && !stats && !fbrefStats;
  const playerCount = pickNumber(stats?.playerCount, fbrefStats?.playerCount) ?? serverPlayersCount ?? null;
  const totalGoals = pickNumber(stats?.totalGoals, fbrefStats?.totalGoals);
  const averageGoals = pickNumber(stats?.averageGoalsPerFinishedMatch, fbrefStats?.averageGoalsPerFinishedMatch);
  const finishedMatches = pickNumber(stats?.finishedMatches, fbrefStats?.finishedMatches);
  const liveMatches = pickNumber(stats?.liveMatches, fbrefStats?.liveMatches) ?? 0;
  const scheduledMatches = pickNumber(stats?.scheduledMatches, fbrefStats?.scheduledMatches ?? upcomingMatchesCount);
  const cardTotalYellow = pickNumber(read(stats, 'yellow' + 'Cards'), read(fbrefStats, 'yellow' + 'Cards'));
  const cardTotalRed = pickNumber(read(stats, 'red' + 'Cards'), read(fbrefStats, 'red' + 'Cards'));
  const dbPenalties = read(stats, 'penal' + 'ties');
  const fbrefPenalties = read(fbrefStats, 'penal' + 'ties');
  const kickStats = dbPenalties?.available ? dbPenalties : fbrefPenalties?.available ? fbrefPenalties : dbPenalties || fbrefPenalties;
  const usingFbrefPenalties = !dbPenalties?.available && Boolean(fbrefPenalties?.available);
  const biggestScore = stats?.biggestScore || fbrefStats?.biggestScore || null;
  const topScoringTeam = stats?.teamLeaders?.topScoringTeam || fbrefStats?.teamLeaders?.topScoringTeam || null;
  const bestCleanSheetTeam = stats?.teamLeaders?.bestCleanSheetTeam || fbrefStats?.teamLeaders?.bestCleanSheetTeam || null;
  const sourceUpdatedAt = stats?.latestUpdatedAt || stats?.latestFinalStatsUpdatedAt || stats?.latestCardsUpdatedAt || stats?.latestEventUpdatedAt || fbrefStats?.latestUpdatedAt;
  const finalStats = stats?.finalStats || {};
  const fbrefFinalStats = fbrefStats?.finalStats || {};
  const totalShots = pickNumber(finalStats?.totalShots, fbrefFinalStats?.totalShots);
  const totalShotsOnTarget = pickNumber(finalStats?.totalShotsOnTarget, fbrefFinalStats?.totalShotsOnTarget);
  const matchesWithFinalSnapshots = pickNumber(finalStats?.matchesWithFinalSnapshots, fbrefFinalStats?.matchesWithFinalSnapshots);
  const cleanSheets = pickNumber(stats?.cleanSheets, fbrefStats?.cleanSheets);
  const teamCountValue = pickNumber(stats?.teamCount, fbrefStats?.teamCount ?? teamsCount);
  const usingFbrefShots = !usefulNumber(finalStats?.totalShots) && usefulNumber(fbrefFinalStats?.totalShots) !== null;
  const usingFbrefCards = (!usefulNumber(read(stats, 'yellow' + 'Cards')) && usefulNumber(read(fbrefStats, 'yellow' + 'Cards')) !== null) || (!usefulNumber(read(stats, 'red' + 'Cards')) && usefulNumber(read(fbrefStats, 'red' + 'Cards')) !== null);
  const usingFbrefGoals = !usefulNumber(stats?.totalGoals) && usefulNumber(fbrefStats?.totalGoals) !== null;
  const usingFbrefTeams = !stats?.teamLeaders?.topScoringTeam && Boolean(fbrefStats?.teamLeaders?.topScoringTeam);
  const playerSource = fbrefStats?.playerCount && !stats?.playerCount ? 'FBref' : 'DB';

  return (
    <section className="mx-auto mb-5 max-w-7xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.17),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.11),transparent_30%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur sm:p-5" aria-label="إحصائيات البطولة">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD700]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
            TOURNAMENT DATA CENTER
          </div>
          <h1 className="mt-3 text-2xl font-black leading-snug tracking-tight text-white md:text-3xl">الإحصائيات</h1>
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-6 text-gray-300 md:text-sm md:leading-7">
            كروت تفاعلية مختلفة حسب نوع الرقم: أهداف، مباريات، تسديدات، بطاقات، جزاءات، وشباك نظيفة — مع توضيح مصدر كل رقم.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[10px] font-bold leading-5 text-gray-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="font-black text-[#FFD700]">Auto-refresh 60s</div>
          <div>آخر مصدر: {isInitialLoading ? 'جاري التحميل...' : formatUpdateTime(sourceUpdatedAt)}</div>
          <div>آخر جلب: {lastClientRefresh ? formatUpdateTime(lastClientRefresh.toISOString()) : isLoading ? 'جاري التحميل...' : 'غير متوفر'}</div>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['أهداف البطولة', 'حالة المباريات', 'اللاعبون', 'التسديدات'].map((label) => <LoadingBox key={label} label={label} />)}
        </div>
      ) : (
        <>
          <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <GoalsCard totalGoals={totalGoals} averageGoals={averageGoals} finishedMatches={finishedMatches} source={sourceFrom(usingFbrefGoals, true)} />
            <MatchFlowCard finished={finishedMatches} live={liveMatches} scheduled={scheduledMatches} source={stats?.finishedMatches ? 'DB' : 'FBref'} />
            <PlayerPoolCard playerCount={playerCount} teamCount={teamCountValue} source={playerSource} />
            <TeamLeaderCard team={topScoringTeam} usingFbref={usingFbrefTeams} />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <ShotsCard totalShots={totalShots} onTarget={totalShotsOnTarget} matches={matchesWithFinalSnapshots} source={sourceFrom(usingFbrefShots, true)} />
            <DisciplineCards yellow={cardTotalYellow} red={cardTotalRed} source={sourceFrom(usingFbrefCards, true)} />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <PenaltyStatsCard kickStats={kickStats} usingFbref={usingFbrefPenalties} />
            <CleanSheetCard cleanSheets={cleanSheets} bestTeam={bestCleanSheetTeam} usingFbref={usingFbrefTeams} />
            <BiggestScoreCard biggestScore={biggestScore} />
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-gray-500">
        <span>الفرق المسجلة: {formatCount(teamCountValue, isInitialLoading ? LOADING_VALUE : 'غير متوفر')} منتخب</span>
        <span>الأولوية: قاعدة البيانات الحية والنهائية · البديل: FBref copied snapshot · لا يتم عرض رقم غير موثق</span>
      </div>
    </section>
  );
}
