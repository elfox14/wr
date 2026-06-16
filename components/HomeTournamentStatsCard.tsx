'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  if (!value) return 'بانتظار أول تحديث';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'بانتظار أول تحديث';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function teamName(team?: { name?: string; code?: string | null } | null) {
  return team?.name || team?.code || 'غير متوفر';
}

function shortText(value: string, max = 24) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sourceFrom(useFallback: boolean, hasDbValue = true): SourceName {
  if (useFallback) return 'FBref';
  if (hasDbValue) return 'DB';
  return '—';
}

function toneStyles(tone: Tone) {
  return {
    gold: { line: 'via-[#FFD700]/70', border: 'hover:border-[#FFD700]/35', value: 'text-[#FFD700]', soft: 'bg-[#FFD700]/10 border-[#FFD700]/15' },
    cyan: { line: 'via-[#0FF0FC]/55', border: 'hover:border-[#0FF0FC]/35', value: 'text-[#0FF0FC]', soft: 'bg-[#0FF0FC]/10 border-[#0FF0FC]/15' },
    green: { line: 'via-[#00FF88]/50', border: 'hover:border-[#00FF88]/30', value: 'text-[#00FF88]', soft: 'bg-[#00FF88]/10 border-[#00FF88]/15' },
    red: { line: 'via-red-300/55', border: 'hover:border-red-300/30', value: 'text-red-100', soft: 'bg-red-400/10 border-red-300/15' },
    neutral: { line: 'via-white/35', border: 'hover:border-white/25', value: 'text-white', soft: 'bg-white/[0.06] border-white/10' },
  }[tone];
}

function SourceBadge({ source }: { source?: SourceName | string }) {
  if (!source || source === '—') return null;
  return <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-black text-gray-300">{source}</span>;
}

function MiniCard({
  title,
  value,
  subtitle,
  source,
  tone = 'neutral',
  href,
  children,
}: {
  title: string;
  value?: string;
  subtitle?: string;
  source?: SourceName | string;
  tone?: Tone;
  href?: string;
  children?: ReactNode;
}) {
  const style = toneStyles(tone);
  const body = (
    <article className={`group relative h-[118px] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(0,0,0,0.25))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_22px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 ${style.border}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${style.line} to-transparent`} />
      <div className="relative z-10 flex h-full flex-col justify-between gap-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className={`truncate text-[9px] font-black ${style.value}`}>{title}</div>
          <SourceBadge source={source} />
        </div>
        {children || (
          <>
            <div className={`truncate text-2xl font-black leading-none ${style.value}`}>{value}</div>
            {subtitle ? <div className="truncate text-[8px] font-bold leading-3 text-gray-500">{subtitle}</div> : null}
          </>
        )}
      </div>
    </article>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function MiniChip({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${className}`}>
      <div className="truncate text-sm font-black leading-none">{value}</div>
      <div className="mt-0.5 truncate text-[7px] font-bold opacity-75">{label}</div>
    </div>
  );
}

function LoadingBox({ label }: { label: string }) {
  return <MiniCard title={label} value={LOADING_VALUE} subtitle="جاري التحميل" />;
}

function DisciplineMiniCard({ yellow, red, source }: { yellow: number | null; red: number | null; source: SourceName }) {
  return (
    <MiniCard title="الانضباط" source={source} tone="red" href="/matches">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-[76px] rounded-xl border border-[#FFD700]/35 bg-[#FFD700] p-2 text-black shadow-[0_5px_14px_rgba(255,215,0,0.12)] transition group-hover:-rotate-1">
          <div className="text-[7px] font-black uppercase tracking-[0.12em] text-black/55">Yellow</div>
          <div className="mt-1.5 text-3xl font-black leading-none">{formatCount(yellow)}</div>
          <div className="mt-1 text-[8px] font-black text-black/65">صفراء</div>
        </div>
        <div className="h-[76px] rounded-xl border border-red-300/35 bg-red-600 p-2 text-white shadow-[0_5px_14px_rgba(248,113,113,0.13)] transition group-hover:rotate-1">
          <div className="text-[7px] font-black uppercase tracking-[0.12em] text-white/65">Red</div>
          <div className="mt-1.5 text-3xl font-black leading-none">{formatCount(red)}</div>
          <div className="mt-1 text-[8px] font-black text-white/75">حمراء</div>
        </div>
      </div>
    </MiniCard>
  );
}

function ShotsMiniCard({ totalShots, onTarget, matches, source }: { totalShots: number | null; onTarget: number | null; matches: number | null; source: SourceName }) {
  const accuracy = totalShots && onTarget !== null ? Math.max(0, Math.min(100, (onTarget / totalShots) * 100)) : null;
  return (
    <MiniCard title="التسديدات" source={source} tone="cyan" href="/matches">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <MiniChip label="تسديدة" value={formatCount(totalShots)} className="border-white/10 bg-black/20 text-white" />
        <div className="relative h-9 w-9 rounded-full border border-[#0FF0FC]/45 bg-[#0FF0FC]/10">
          <span className="absolute inset-2 rounded-full border border-[#0FF0FC]/30" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0FF0FC]" />
        </div>
        <MiniChip label="على المرمى" value={formatCount(onTarget)} className="border-[#0FF0FC]/18 bg-[#0FF0FC]/10 text-[#0FF0FC]" />
      </div>
      <div className="mt-2">
        <div className="mb-0.5 flex justify-between text-[7px] font-bold text-gray-500"><span>الدقة</span><span>{accuracy !== null ? formatPercent(accuracy) : 'غير متوفر'}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#0FF0FC]" style={{ width: `${accuracy || 0}%` }} /></div>
        <div className="mt-0.5 text-[7px] font-bold text-gray-500">{formatCount(matches)} مباراة</div>
      </div>
    </MiniCard>
  );
}

function PenaltyMiniCard({ kickStats, usingFbref }: { kickStats: any; usingFbref: boolean }) {
  const available = Boolean(kickStats?.available);
  const total = available ? Number(kickStats?.total || 0) : null;
  const scored = available ? Number(kickStats?.scored || 0) : null;
  const missed = available ? Number(kickStats?.missed || 0) : null;
  const conversion = total && scored !== null ? Math.max(0, Math.min(100, (scored / total) * 100)) : null;
  return (
    <MiniCard title="ركلات الجزاء" source={usingFbref ? 'FBref' : available ? 'DB/Event' : '—'} tone="gold">
      {available ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <MiniChip label="إجمالي" value={formatCount(total)} className="border-white/10 bg-black/20 text-white" />
            <MiniChip label="مسجلة" value={formatCount(scored)} className="border-[#00FF88]/18 bg-[#00FF88]/10 text-[#00FF88]" />
            <MiniChip label="ضائعة" value={formatCount(missed)} className="border-red-300/18 bg-red-400/10 text-red-100" />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${conversion || 0}%` }} /></div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#FFD700]/18 bg-black/20 p-2.5 text-center">
          <div className="text-xs font-black text-gray-200">بانتظار توثيق</div>
          <div className="mt-0.5 text-[7px] font-bold text-gray-500">لا يوجد رقم مؤكد</div>
        </div>
      )}
    </MiniCard>
  );
}

function MatchFlowMiniCard({ finished, live, scheduled, source }: { finished: number | null; live: number | null; scheduled: number | null; source: SourceName }) {
  const total = Math.max(1, Number(finished || 0) + Number(live || 0) + Number(scheduled || 0));
  const finishedPct = Math.max(0, Math.min(100, (Number(finished || 0) / total) * 100));
  const livePct = Math.max(0, Math.min(100, (Number(live || 0) / total) * 100));
  return (
    <MiniCard title="حالة المباريات" source={source} href="/matches">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-black leading-none text-white">{formatCount(finished)}</div>
          <div className="text-[7px] font-bold text-gray-500">منتهية</div>
        </div>
        <div className="text-left text-[8px] font-bold text-gray-400">
          <div>مباشر <span className="text-[#00FF88]">{formatCount(live)}</span></div>
          <div>متبقية <span className="text-white">{formatCount(scheduled)}</span></div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${finishedPct}%` }} />
        <div className="-mt-1.5 h-full rounded-full bg-[#FFD700]" style={{ width: `${Math.min(100, finishedPct + livePct)}%`, opacity: livePct > 0 ? 0.9 : 0 }} />
      </div>
    </MiniCard>
  );
}

function GoalLeaderMiniCard({ team, usingFbref }: { team: any; usingFbref: boolean }) {
  return (
    <MiniCard title="أقوى هجوم" source={sourceFrom(usingFbref, Boolean(team))} tone="gold" href={team?.id ? `/teams/${encodeURIComponent(team.id)}` : '/teams'}>
      <div className="truncate text-sm font-black text-white">{team ? shortText(teamName(team), 18) : 'غير متوفر'}</div>
      <div className="text-3xl font-black leading-none text-[#FFD700]">{team ? formatCount(team.goalsFor) : '—'}</div>
      <div className="truncate text-[8px] font-bold text-gray-500">هدف · {team ? formatCount(Number(team.played || 0)) : '—'} مباريات</div>
    </MiniCard>
  );
}

function CleanSheetMiniCard({ cleanSheets, bestTeam, usingFbref }: { cleanSheets: number | null; bestTeam: any; usingFbref: boolean }) {
  return (
    <MiniCard title="الشباك النظيفة" source={sourceFrom(usingFbref, true)} tone="green" href="/matches">
      <div className="flex items-center gap-2">
        <div className="relative h-10 w-14 shrink-0 rounded-lg border border-[#00FF88]/35"><span className="absolute inset-x-2 top-1/2 h-px bg-[#00FF88]/25" /><span className="absolute left-1/3 top-0 h-full w-px bg-[#00FF88]/20" /><span className="absolute right-1/3 top-0 h-full w-px bg-[#00FF88]/20" /></div>
        <div className="min-w-0">
          <div className="text-3xl font-black leading-none text-[#00FF88]">{formatCount(cleanSheets)}</div>
          <div className="truncate text-[8px] font-bold text-gray-500">{bestTeam ? shortText(teamName(bestTeam), 18) : 'غير متوفر'}</div>
        </div>
      </div>
    </MiniCard>
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
  const playerSource: SourceName = fbrefStats?.playerCount && !stats?.playerCount ? 'FBref' : 'DB';

  return (
    <section className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.11),transparent_23%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.07),transparent_28%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 text-white shadow-[0_16px_44px_rgba(0,0,0,0.32)] backdrop-blur" aria-label="إحصائيات البطولة">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#FFD700]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
            DATA CENTER
          </div>
          <h1 className="mt-1.5 text-lg font-black leading-tight text-white md:text-xl">الإحصائيات</h1>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-1 text-left text-[8px] font-bold leading-3 text-gray-400">
          <div className="font-black text-[#FFD700]">60s refresh</div>
          <div>{isInitialLoading ? 'جاري التحميل...' : formatUpdateTime(sourceUpdatedAt)}</div>
          <div>{lastClientRefresh ? formatUpdateTime(lastClientRefresh.toISOString()) : isLoading ? 'جاري التحميل...' : 'غير متوفر'}</div>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid auto-rows-[118px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
          {['الأهداف', 'الحالة', 'اللاعبون', 'الهجوم', 'التسديدات', 'الانضباط', 'الجزاءات', 'الشباك', 'أكبر نتيجة', 'المتوسط'].map((label) => <LoadingBox key={label} label={label} />)}
        </div>
      ) : (
        <div className="grid auto-rows-[118px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
          <MiniCard title="أهداف البطولة" value={formatCount(totalGoals)} subtitle={`${formatCount(finishedMatches)} مباراة منتهية`} source={sourceFrom(usingFbrefGoals, true)} tone="gold" href="/matches" />
          <MiniCard title="متوسط الأهداف" value={formatDecimal(averageGoals)} subtitle="هدف لكل مباراة" source={sourceFrom(usingFbrefGoals, true)} tone="cyan" href="/matches" />
          <MatchFlowMiniCard finished={finishedMatches} live={liveMatches} scheduled={scheduledMatches} source={stats?.finishedMatches ? 'DB' : 'FBref'} />
          <MiniCard title="اللاعبون" value={formatCount(playerCount)} subtitle={`${formatCount(teamCountValue)} منتخب`} source={playerSource} tone="green" href="/players" />
          <GoalLeaderMiniCard team={topScoringTeam} usingFbref={usingFbrefTeams} />
          <ShotsMiniCard totalShots={totalShots} onTarget={totalShotsOnTarget} matches={matchesWithFinalSnapshots} source={sourceFrom(usingFbrefShots, true)} />
          <DisciplineMiniCard yellow={cardTotalYellow} red={cardTotalRed} source={sourceFrom(usingFbrefCards, true)} />
          <PenaltyMiniCard kickStats={kickStats} usingFbref={usingFbrefPenalties} />
          <CleanSheetMiniCard cleanSheets={cleanSheets} bestTeam={bestCleanSheetTeam} usingFbref={usingFbrefTeams} />
          <MiniCard title="أكبر نتيجة" value={biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : '—'} subtitle={biggestScore ? shortText(`${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}`, 22) : 'تظهر بعد التسجيل'} href={biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches'} />
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-1 text-[8px] font-bold text-gray-500">
        <span>الفرق: {formatCount(teamCountValue, isInitialLoading ? LOADING_VALUE : 'غير متوفر')}</span>
        <span>الأولوية DB · البديل FBref · بدون أرقام غير موثقة</span>
      </div>
    </section>
  );
}
