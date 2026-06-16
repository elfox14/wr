'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

type TileTone = 'default' | 'gold' | 'alert' | 'cyan' | 'green';

type Tile = {
  label: string;
  value: string;
  note: string;
  href?: string;
  tone?: TileTone;
  loading?: boolean;
  source?: string;
};

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

function formatUpdateTime(value?: string | null) {
  if (!value) return 'بانتظار أول تحديث من المصدر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'بانتظار أول تحديث من المصدر';

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

function fallbackNote(base: string, isFbrefFallback: boolean) {
  return isFbrefFallback ? `${base} · FBref` : base;
}

function toneClasses(tone: TileTone) {
  if (tone === 'alert') return { value: 'text-red-200', glow: 'from-red-400/40', border: 'hover:border-red-300/35' };
  if (tone === 'gold') return { value: 'text-[#FFD700]', glow: 'from-[#FFD700]/45', border: 'hover:border-[#FFD700]/35' };
  if (tone === 'cyan') return { value: 'text-[#0FF0FC]', glow: 'from-[#0FF0FC]/45', border: 'hover:border-[#0FF0FC]/35' };
  if (tone === 'green') return { value: 'text-[#00FF88]', glow: 'from-[#00FF88]/40', border: 'hover:border-[#00FF88]/35' };
  return { value: 'text-white', glow: 'from-white/25', border: 'hover:border-white/25' };
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-0.5 text-[9px] font-black text-gray-300">{source}</span>;
}

function StatTile({ value, label, note, href, tone = 'default', loading = false, source }: Tile) {
  const toneClass = toneClasses(tone);
  const valueClass = loading ? 'animate-pulse text-gray-400' : toneClass.value;

  const content = (
    <div className={`group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(0,0,0,0.24))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-0.5 ${toneClass.border}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${toneClass.glow} via-white/50 to-transparent opacity-80`} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black text-[#FFD700]">{label}</div>
        <SourceBadge source={source} />
      </div>
      <div className={`text-2xl font-black leading-none md:text-3xl ${valueClass}`}>{value}</div>
      <div className="mt-2 text-[10px] font-bold leading-5 text-gray-400">{note}</div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function PenaltyStatsCard({ kickStats, loading, usingFbref }: { kickStats: any; loading: boolean; usingFbref: boolean }) {
  const available = Boolean(kickStats?.available);
  const total = available ? Number(kickStats?.total || 0) : null;
  const scored = available ? Number(kickStats?.scored || 0) : null;
  const missed = available ? Number(kickStats?.missed || 0) : null;
  const unknown = available ? Number(kickStats?.unknown || 0) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#FFD700]/20 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.26))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black text-[#FFD700]">ركلات الجزاء</div>
          <div className="mt-1 text-[9px] font-bold text-gray-500">Penalty Tracker</div>
        </div>
        <SourceBadge source={usingFbref ? 'FBref' : available ? 'DB/Event' : 'No verified source'} />
      </div>

      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-white/[0.06]" />
      ) : available ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/25 p-2 text-center">
            <div className="text-xl font-black text-white">{formatCount(total)}</div>
            <div className="mt-1 text-[9px] font-bold text-gray-400">إجمالي</div>
          </div>
          <div className="rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-2 text-center">
            <div className="text-xl font-black text-[#00FF88]">{formatCount(scored)}</div>
            <div className="mt-1 text-[9px] font-bold text-gray-300">مسجلة</div>
          </div>
          <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-2 text-center">
            <div className="text-xl font-black text-red-100">{formatCount(missed)}</div>
            <div className="mt-1 text-[9px] font-bold text-gray-300">ضائعة</div>
          </div>
          {unknown ? <div className="col-span-3 text-center text-[10px] font-bold text-gray-400">غير مصنفة: {formatCount(unknown)}</div> : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/12 bg-black/20 p-3 text-center">
          <div className="text-lg font-black text-gray-200">بانتظار توثيق</div>
          <div className="mt-1 text-[10px] font-bold leading-5 text-gray-500">بحثنا في قاعدة البيانات ولقطة FBref المحفوظة؛ لا توجد حقول جزاءات مؤكدة حتى الآن.</div>
        </div>
      )}
    </div>
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
  const loadingNote = 'جاري تحميل بيانات الإحصائيات من قاعدة البيانات ولقطة FBref...';
  const playerCount = pickNumber(stats?.playerCount, fbrefStats?.playerCount) ?? serverPlayersCount;
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
  const usingFbrefShots = !usefulNumber(finalStats?.totalShots) && usefulNumber(fbrefFinalStats?.totalShots) !== null;
  const usingFbrefCards = (!usefulNumber(read(stats, 'yellow' + 'Cards')) && usefulNumber(read(fbrefStats, 'yellow' + 'Cards')) !== null) || (!usefulNumber(read(stats, 'red' + 'Cards')) && usefulNumber(read(fbrefStats, 'red' + 'Cards')) !== null);
  const usingFbrefGoals = !usefulNumber(stats?.totalGoals) && usefulNumber(fbrefStats?.totalGoals) !== null;
  const usingFbrefTeams = !stats?.teamLeaders?.topScoringTeam && Boolean(fbrefStats?.teamLeaders?.topScoringTeam);

  const highlightTiles = useMemo<Tile[]>(() => ([
    {
      label: 'أهداف البطولة',
      value: isInitialLoading ? LOADING_VALUE : formatCount(totalGoals),
      note: isInitialLoading ? loadingNote : fallbackNote(`من ${formatCount(finishedMatches)} مباراة منتهية`, usingFbrefGoals),
      href: '/matches',
      tone: 'gold',
      source: usingFbrefGoals ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
    {
      label: 'متوسط الأهداف',
      value: isInitialLoading ? LOADING_VALUE : formatDecimal(averageGoals),
      note: isInitialLoading ? loadingNote : fallbackNote('هدف لكل مباراة منتهية فقط', usingFbrefGoals),
      href: '/matches',
      tone: 'cyan',
      source: usingFbrefGoals ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
    {
      label: 'مباريات منتهية',
      value: isInitialLoading ? LOADING_VALUE : formatCount(finishedMatches),
      note: isInitialLoading ? loadingNote : `مباشر الآن: ${formatCount(liveMatches)} / متبقية: ${formatCount(scheduledMatches)}`,
      href: '/matches',
      tone: 'default',
      source: stats?.finishedMatches ? 'DB' : 'FBref',
      loading: isInitialLoading,
    },
    {
      label: 'عدد اللاعبين',
      value: isInitialLoading ? LOADING_VALUE : formatCount(playerCount),
      note: isInitialLoading ? loadingNote : fbrefStats?.playerCount && !stats?.playerCount ? 'من قوائم FBref المحفوظة' : 'من اللاعبين المرتبطين بالمنتخبات',
      href: '/players',
      tone: 'green',
      source: fbrefStats?.playerCount && !stats?.playerCount ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
  ]), [stats, fbrefStats, isInitialLoading, totalGoals, averageGoals, finishedMatches, liveMatches, scheduledMatches, playerCount, usingFbrefGoals]);

  const detailTiles = useMemo<Tile[]>(() => ([
    {
      label: 'أكثر منتخب تسجيلًا',
      value: isInitialLoading ? LOADING_VALUE : topScoringTeam ? formatCount(topScoringTeam.goalsFor) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : topScoringTeam ? fallbackNote(shortTeamStat(topScoringTeam, 'played', ' مباريات'), usingFbrefTeams) : 'يظهر بعد انتهاء مباريات كافية',
      href: topScoringTeam?.id ? `/teams/${encodeURIComponent(topScoringTeam.id)}` : '/teams',
      tone: 'gold',
      source: usingFbrefTeams ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
    {
      label: 'شباك نظيفة',
      value: isInitialLoading ? LOADING_VALUE : formatCount(cleanSheets),
      note: isInitialLoading ? loadingNote : bestCleanSheetTeam ? fallbackNote(`الأبرز: ${shortTeamStat(bestCleanSheetTeam, 'cleanSheets')}`, usingFbrefTeams) : 'إجمالي الشباك النظيفة',
      href: '/matches',
      tone: 'default',
      source: usingFbrefTeams ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
    {
      label: 'تسديدات / على المرمى',
      value: isInitialLoading ? LOADING_VALUE : totalShots ? `${formatCount(totalShots)} / ${formatCount(totalShotsOnTarget)}` : 'غير متوفر',
      note: isInitialLoading ? loadingNote : matchesWithFinalSnapshots ? fallbackNote(`من ${formatCount(matchesWithFinalSnapshots)} مباراة بها إحصائيات`, usingFbrefShots) : 'تظهر بعد مزامنة إحصائيات المباراة',
      href: '/matches',
      tone: 'cyan',
      source: usingFbrefShots ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
    {
      label: 'كروت صفراء / حمراء',
      value: isInitialLoading ? LOADING_VALUE : `${formatCount(cardTotalYellow)} / ${formatCount(cardTotalRed)}`,
      note: isInitialLoading ? loadingNote : fallbackNote('من أحداث المباراة أو FBref عند غياب snapshots', usingFbrefCards),
      href: '/matches',
      tone: 'alert',
      source: usingFbrefCards ? 'FBref' : 'DB',
      loading: isInitialLoading,
    },
    {
      label: 'أكبر نتيجة',
      value: isInitialLoading ? LOADING_VALUE : biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : 'غير متوفر',
      note: isInitialLoading ? loadingNote : biggestScore ? `${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}` : 'تظهر بعد تسجيل نتيجة بها أهداف',
      href: biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches',
      tone: 'default',
      source: biggestScore ? 'DB' : undefined,
      loading: isInitialLoading,
    },
  ]), [isInitialLoading, topScoringTeam, bestCleanSheetTeam, totalShots, totalShotsOnTarget, matchesWithFinalSnapshots, cardTotalYellow, cardTotalRed, biggestScore, cleanSheets, usingFbrefTeams, usingFbrefShots, usingFbrefCards]);

  return (
    <section className="mx-auto mb-5 max-w-7xl overflow-hidden rounded-[1.65rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.09),transparent_30%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-4 text-white shadow-[0_22px_60px_rgba(0,0,0,0.38)] backdrop-blur sm:p-5" aria-label="إحصائيات البطولة">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD700]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
            TOURNAMENT DATA CENTER
          </div>
          <h1 className="mt-3 text-2xl font-black leading-snug tracking-tight text-white md:text-3xl">الإحصائيات</h1>
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-6 text-gray-300 md:text-sm md:leading-7">
            ملخص احترافي للبطولة من قاعدة البيانات، مع استخدام لقطة FBref المحفوظة كبديل فقط عند غياب snapshots أو أحداث المباراة.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[10px] font-bold leading-5 text-gray-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="font-black text-[#FFD700]">Auto-refresh 60s</div>
          <div>آخر مصدر: {isInitialLoading ? 'جاري التحميل...' : formatUpdateTime(sourceUpdatedAt)}</div>
          <div>آخر جلب: {lastClientRefresh ? formatUpdateTime(lastClientRefresh.toISOString()) : isLoading ? 'جاري التحميل...' : 'غير متوفر'}</div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {highlightTiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
        <PenaltyStatsCard kickStats={kickStats} loading={isInitialLoading} usingFbref={usingFbrefPenalties} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {detailTiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-gray-500">
        <span>الفرق المسجلة: {formatCount(stats?.teamCount ?? fbrefStats?.teamCount ?? teamsCount, isInitialLoading ? LOADING_VALUE : 'غير متوفر')} منتخب</span>
        <span>الأولوية: قاعدة البيانات الحية والنهائية · البديل: FBref copied snapshot · الجزاءات لا تظهر إلا إذا كانت موثقة</span>
      </div>
    </section>
  );
}
