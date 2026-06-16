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

function toneStyles(tone: Tone) {
  return {
    gold: { line: 'via-[#FFD700]/65', border: 'hover:border-[#FFD700]/35', value: 'text-[#FFD700]' },
    cyan: { line: 'via-[#0FF0FC]/55', border: 'hover:border-[#0FF0FC]/35', value: 'text-[#0FF0FC]' },
    green: { line: 'via-[#00FF88]/50', border: 'hover:border-[#00FF88]/30', value: 'text-[#00FF88]' },
    red: { line: 'via-red-300/55', border: 'hover:border-red-300/30', value: 'text-red-100' },
    neutral: { line: 'via-white/35', border: 'hover:border-white/25', value: 'text-white' },
  }[tone];
}

function SourceBadge({ source }: { source?: SourceName | string }) {
  if (!source || source === '—') return null;
  return <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-black text-gray-300">{source}</span>;
}

function Card({ children, href, tone = 'neutral', className = '' }: { children: ReactNode; href?: string; tone?: Tone; className?: string }) {
  const style = toneStyles(tone);
  const body = (
    <article className={`group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(0,0,0,0.24))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_10px_26px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 ${style.border} ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${style.line} to-transparent`} />
      {children}
    </article>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SectionTitle({ title, subtitle, source, tone = 'neutral' }: { title: string; subtitle?: string; source?: SourceName | string; tone?: Tone }) {
  const style = toneStyles(tone);
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <div className={`text-[10px] font-black ${style.value}`}>{title}</div>
        {subtitle ? <div className="mt-0.5 text-[9px] font-bold text-gray-500">{subtitle}</div> : null}
      </div>
      <SourceBadge source={source} />
    </div>
  );
}

function LoadingBox({ label }: { label: string }) {
  return (
    <Card>
      <SectionTitle title={label} />
      <div className="h-7 w-20 animate-pulse rounded-lg bg-white/[0.08]" />
      <div className="mt-2 h-3 w-full animate-pulse rounded bg-white/[0.06]" />
    </Card>
  );
}

function GoalsCard({ totalGoals, averageGoals, finishedMatches, source }: { totalGoals: number | null; averageGoals: number | null; finishedMatches: number | null; source: SourceName }) {
  return (
    <Card href="/matches" tone="gold">
      <SectionTitle title="أهداف البطولة" subtitle="إجمالي ومتوسط" source={source} tone="gold" />
      <div className="text-3xl font-black leading-none text-[#FFD700]">{formatCount(totalGoals)}</div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl border border-[#FFD700]/15 bg-[#FFD700]/10 px-2 py-1.5">
          <div className="text-sm font-black text-white">{formatDecimal(averageGoals)}</div>
          <div className="text-[8px] font-bold text-gray-400">متوسط</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
          <div className="text-sm font-black text-white">{formatCount(finishedMatches)}</div>
          <div className="text-[8px] font-bold text-gray-400">منتهية</div>
        </div>
      </div>
    </Card>
  );
}

function MatchFlowCard({ finished, live, scheduled, source }: { finished: number | null; live: number | null; scheduled: number | null; source: SourceName }) {
  const total = Math.max(1, Number(finished || 0) + Number(live || 0) + Number(scheduled || 0));
  const finishedPct = Math.max(0, Math.min(100, (Number(finished || 0) / total) * 100));
  const livePct = Math.max(0, Math.min(100, (Number(live || 0) / total) * 100));
  return (
    <Card href="/matches">
      <SectionTitle title="حالة المباريات" subtitle="منتهية / مباشرة / متبقية" source={source} />
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-black text-white">{formatCount(finished)}</div>
          <div className="text-[8px] font-bold text-gray-500">منتهية</div>
        </div>
        <div className="text-left text-[9px] font-bold text-gray-400">
          <div>مباشر: <span className="text-[#00FF88]">{formatCount(live)}</span></div>
          <div>متبقية: <span className="text-white">{formatCount(scheduled)}</span></div>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${finishedPct}%` }} />
        <div className="-mt-2 h-full rounded-full bg-[#FFD700]" style={{ width: `${Math.min(100, finishedPct + livePct)}%`, opacity: livePct > 0 ? 0.9 : 0 }} />
      </div>
    </Card>
  );
}

function PlayerPoolCard({ playerCount, teamCount, source }: { playerCount: number | null; teamCount: number | null; source: SourceName }) {
  return (
    <Card href="/players" tone="green">
      <SectionTitle title="قوائم اللاعبين" subtitle="لاعبون ومنتخبات" source={source} tone="green" />
      <div className="flex items-end justify-between gap-2">
        <div className="text-3xl font-black leading-none text-[#00FF88]">{formatCount(playerCount)}</div>
        <div className="rounded-xl border border-[#00FF88]/15 bg-[#00FF88]/10 px-2.5 py-1.5 text-left">
          <div className="text-sm font-black text-white">{formatCount(teamCount)}</div>
          <div className="text-[8px] font-bold text-gray-400">منتخب</div>
        </div>
      </div>
      <div className="mt-2 flex -space-x-1.5 space-x-reverse">
        {[0, 1, 2, 3].map((item) => <span key={item} className="h-6 w-6 rounded-full border border-[#00FF88]/25 bg-black/40" />)}
      </div>
    </Card>
  );
}

function ShotsCard({ totalShots, onTarget, matches, source }: { totalShots: number | null; onTarget: number | null; matches: number | null; source: SourceName }) {
  const accuracy = totalShots && onTarget !== null ? Math.max(0, Math.min(100, (onTarget / totalShots) * 100)) : null;
  return (
    <Card href="/matches" tone="cyan">
      <SectionTitle title="التسديدات" subtitle="إجمالي / على المرمى" source={source} tone="cyan" />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
          <div className="text-2xl font-black text-white">{formatCount(totalShots)}</div>
          <div className="text-[8px] font-bold text-gray-400">تسديدة</div>
        </div>
        <div className="relative h-11 w-11 rounded-full border border-[#0FF0FC]/45 bg-[#0FF0FC]/10">
          <span className="absolute inset-2.5 rounded-full border border-[#0FF0FC]/30" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0FF0FC]" />
        </div>
        <div className="rounded-xl border border-[#0FF0FC]/18 bg-[#0FF0FC]/10 p-2 text-center">
          <div className="text-2xl font-black text-[#0FF0FC]">{formatCount(onTarget)}</div>
          <div className="text-[8px] font-bold text-gray-300">على المرمى</div>
        </div>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
        <div className="mb-1 flex justify-between text-[8px] font-bold text-gray-400"><span>الدقة</span><span>{accuracy !== null ? formatPercent(accuracy) : 'غير متوفر'}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#0FF0FC]" style={{ width: `${accuracy || 0}%` }} /></div>
        <div className="mt-1 text-[8px] font-bold text-gray-500">من {formatCount(matches)} مباراة</div>
      </div>
    </Card>
  );
}

function DisciplineCards({ yellow, red, source }: { yellow: number | null; red: number | null; source: SourceName }) {
  return (
    <Card href="/matches" tone="red">
      <SectionTitle title="الانضباط" subtitle="إنذارات وطرد" source={source} tone="red" />
      <div className="grid grid-cols-2 gap-2">
        <div className="relative min-h-[86px] rounded-xl border border-[#FFD700]/35 bg-[#FFD700] p-2.5 text-black shadow-[0_8px_18px_rgba(255,215,0,0.12)] transition group-hover:-rotate-1">
          <div className="text-[8px] font-black uppercase tracking-[0.13em] text-black/55">Yellow</div>
          <div className="mt-2 text-4xl font-black leading-none">{formatCount(yellow)}</div>
          <div className="mt-1 text-[9px] font-black text-black/65">بطاقات صفراء</div>
        </div>
        <div className="relative min-h-[86px] rounded-xl border border-red-300/35 bg-red-600 p-2.5 text-white shadow-[0_8px_18px_rgba(248,113,113,0.13)] transition group-hover:rotate-1">
          <div className="text-[8px] font-black uppercase tracking-[0.13em] text-white/65">Red</div>
          <div className="mt-2 text-4xl font-black leading-none">{formatCount(red)}</div>
          <div className="mt-1 text-[9px] font-black text-white/75">بطاقات حمراء</div>
        </div>
      </div>
    </Card>
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
    <Card tone="gold">
      <SectionTitle title="ركلات الجزاء" subtitle="مسجلة / ضائعة" source={usingFbref ? 'FBref' : available ? 'DB/Event' : '—'} tone="gold" />
      {available ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center"><div className="text-xl font-black text-white">{formatCount(total)}</div><div className="text-[8px] font-bold text-gray-400">إجمالي</div></div>
            <div className="rounded-xl border border-[#00FF88]/18 bg-[#00FF88]/10 p-2 text-center"><div className="text-xl font-black text-[#00FF88]">{formatCount(scored)}</div><div className="text-[8px] font-bold text-gray-300">مسجلة</div></div>
            <div className="rounded-xl border border-red-300/18 bg-red-400/10 p-2 text-center"><div className="text-xl font-black text-red-100">{formatCount(missed)}</div><div className="text-[8px] font-bold text-gray-300">ضائعة</div></div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${conversion || 0}%` }} /></div>
          {unknown ? <div className="mt-1 text-[8px] font-bold text-gray-500">غير مصنفة: {formatCount(unknown)}</div> : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-[#FFD700]/18 bg-black/20 p-3 text-center">
          <div className="text-sm font-black text-gray-200">بانتظار توثيق</div>
          <div className="mt-1 text-[9px] font-bold leading-4 text-gray-500">لا يوجد رقم جزاءات مؤكد بعد.</div>
        </div>
      )}
    </Card>
  );
}

function TeamLeaderCard({ team, usingFbref }: { team: any; usingFbref: boolean }) {
  return (
    <Card href={team?.id ? `/teams/${encodeURIComponent(team.id)}` : '/teams'} tone="gold">
      <SectionTitle title="أقوى هجوم" subtitle="الأكثر تسجيلًا" source={sourceFrom(usingFbref, Boolean(team))} tone="gold" />
      <div className="rounded-xl border border-[#FFD700]/18 bg-[#FFD700]/10 p-2.5">
        <div className="truncate text-sm font-black text-white">{team ? teamName(team) : 'غير متوفر'}</div>
        <div className="mt-1 text-3xl font-black text-[#FFD700]">{team ? formatCount(team.goalsFor) : '—'}</div>
        <div className="text-[8px] font-bold text-gray-400">هدف · {team ? shortTeamStat(team, 'played', ' مباريات') : 'يظهر بعد توفر بيانات'}</div>
      </div>
    </Card>
  );
}

function CleanSheetCard({ cleanSheets, bestTeam, usingFbref }: { cleanSheets: number | null; bestTeam: any; usingFbref: boolean }) {
  return (
    <Card href="/matches" tone="green">
      <SectionTitle title="الشباك النظيفة" subtitle="Clean Sheets" source={sourceFrom(usingFbref, true)} tone="green" />
      <div className="flex items-center gap-2 rounded-xl border border-[#00FF88]/18 bg-[#00FF88]/10 p-2.5">
        <div className="relative h-11 w-14 rounded-lg border border-[#00FF88]/35"><span className="absolute inset-x-2 top-1/2 h-px bg-[#00FF88]/25" /><span className="absolute left-1/3 top-0 h-full w-px bg-[#00FF88]/20" /><span className="absolute right-1/3 top-0 h-full w-px bg-[#00FF88]/20" /></div>
        <div>
          <div className="text-3xl font-black leading-none text-[#00FF88]">{formatCount(cleanSheets)}</div>
          <div className="mt-1 text-[8px] font-bold text-gray-400">الأبرز: {bestTeam ? shortTeamStat(bestTeam, 'cleanSheets') : 'غير متوفر'}</div>
        </div>
      </div>
    </Card>
  );
}

function BiggestScoreCard({ biggestScore }: { biggestScore: any }) {
  return (
    <Card href={biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches'}>
      <SectionTitle title="أكبر نتيجة" subtitle="Scoreline" />
      <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-center">
        <div className="text-3xl font-black text-white">{biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : '—'}</div>
        <div className="mt-1 text-[9px] font-bold leading-4 text-gray-400">{biggestScore ? `${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}` : 'تظهر بعد تسجيل نتيجة'}</div>
      </div>
    </Card>
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
    <section className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.08),transparent_28%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur sm:p-4" aria-label="إحصائيات البطولة">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-[#FFD700]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
            TOURNAMENT DATA CENTER
          </div>
          <h1 className="mt-2 text-xl font-black leading-snug tracking-tight text-white md:text-2xl">الإحصائيات</h1>
          <p className="mt-1.5 max-w-4xl text-[11px] font-semibold leading-5 text-gray-300 md:text-xs md:leading-6">
            كروت تفاعلية مدمجة حسب نوع الرقم، مع توضيح مصدر كل مؤشر.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-1.5 text-left text-[9px] font-bold leading-4 text-gray-400">
          <div className="font-black text-[#FFD700]">Auto-refresh 60s</div>
          <div>آخر مصدر: {isInitialLoading ? 'جاري التحميل...' : formatUpdateTime(sourceUpdatedAt)}</div>
          <div>آخر جلب: {lastClientRefresh ? formatUpdateTime(lastClientRefresh.toISOString()) : isLoading ? 'جاري التحميل...' : 'غير متوفر'}</div>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {['أهداف البطولة', 'حالة المباريات', 'اللاعبون', 'التسديدات'].map((label) => <LoadingBox key={label} label={label} />)}
        </div>
      ) : (
        <>
          <div className="mb-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <GoalsCard totalGoals={totalGoals} averageGoals={averageGoals} finishedMatches={finishedMatches} source={sourceFrom(usingFbrefGoals, true)} />
            <MatchFlowCard finished={finishedMatches} live={liveMatches} scheduled={scheduledMatches} source={stats?.finishedMatches ? 'DB' : 'FBref'} />
            <PlayerPoolCard playerCount={playerCount} teamCount={teamCountValue} source={playerSource} />
            <TeamLeaderCard team={topScoringTeam} usingFbref={usingFbrefTeams} />
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            <ShotsCard totalShots={totalShots} onTarget={totalShotsOnTarget} matches={matchesWithFinalSnapshots} source={sourceFrom(usingFbrefShots, true)} />
            <DisciplineCards yellow={cardTotalYellow} red={cardTotalRed} source={sourceFrom(usingFbrefCards, true)} />
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            <PenaltyStatsCard kickStats={kickStats} usingFbref={usingFbrefPenalties} />
            <CleanSheetCard cleanSheets={cleanSheets} bestTeam={bestCleanSheetTeam} usingFbref={usingFbrefTeams} />
            <BiggestScoreCard biggestScore={biggestScore} />
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-1.5 text-[9px] font-bold text-gray-500">
        <span>الفرق المسجلة: {formatCount(teamCountValue, isInitialLoading ? LOADING_VALUE : 'غير متوفر')} منتخب</span>
        <span>الأولوية: قاعدة البيانات · البديل: FBref · لا يتم عرض رقم غير موثق</span>
      </div>
    </section>
  );
}
