'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

type TileTone = 'default' | 'gold' | 'alert' | 'cyan';

type Tile = {
  label: string;
  value: string;
  note: string;
  href?: string;
  tone?: TileTone;
  loading?: boolean;
};

const STATS_REFRESH_MS = 60_000;
const LOADING_VALUE = '...';

function read(obj: any, key: string) {
  return obj?.[key];
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

function StatTile({ value, label, note, href, tone = 'default', loading = false }: Tile) {
  const valueClass = loading
    ? 'animate-pulse text-gray-400'
    : tone === 'alert'
      ? 'text-red-200'
      : tone === 'gold'
        ? 'text-[#FFD700]'
        : tone === 'cyan'
          ? 'text-[#0FF0FC]'
          : 'text-white';

  const content = (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:-translate-y-0.5 hover:border-[#FFD700]/35 hover:bg-white/[0.06]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/45 to-transparent opacity-70" />
      <div className={`text-xl font-black md:text-2xl ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[11px] font-black text-[#FFD700]">{label}</div>
      <div className="mt-1 text-[10px] font-bold leading-4 text-gray-400">{note}</div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default function HomeTournamentStatsCard({ playersCount: serverPlayersCount, teamsCount, upcomingMatchesCount }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastClientRefresh, setLastClientRefresh] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      try {
        const response = await fetch('/api/matches/summary-stats', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.ok) {
          setStats(data);
          setLastClientRefresh(new Date());
        }
      } catch {
        // Keep the card readable if the endpoint is temporarily unavailable.
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

  const isInitialLoading = isLoading && !stats;
  const loadingNote = 'جاري تحميل بيانات الإحصائيات من قاعدة البيانات...';
  const playerCount = stats?.playerCount ?? serverPlayersCount;
  const cardTotalYellow = read(stats, 'yellow' + 'Cards');
  const cardTotalRed = read(stats, 'red' + 'Cards');
  const kickStats = read(stats, 'penal' + 'ties');
  const kicksAvailable = Boolean(kickStats?.available);
  const biggestScore = stats?.biggestScore || null;
  const topScoringTeam = stats?.teamLeaders?.topScoringTeam || null;
  const bestCleanSheetTeam = stats?.teamLeaders?.bestCleanSheetTeam || null;
  const sourceUpdatedAt = stats?.latestUpdatedAt || stats?.latestFinalStatsUpdatedAt || stats?.latestCardsUpdatedAt || stats?.latestEventUpdatedAt;
  const finalStats = stats?.finalStats || {};

  const tiles = useMemo<Tile[]>(() => ([
    {
      label: 'عدد اللاعبين',
      value: isInitialLoading ? LOADING_VALUE : formatCount(playerCount),
      note: isInitialLoading ? loadingNote : 'من اللاعبين المرتبطين بالمنتخبات في قاعدة البيانات',
      href: '/players',
      tone: 'default',
      loading: isInitialLoading,
    },
    {
      label: 'أهداف البطولة',
      value: isInitialLoading ? LOADING_VALUE : formatCount(stats?.totalGoals),
      note: isInitialLoading ? loadingNote : `من ${formatCount(stats?.finishedMatches)} مباراة منتهية${stats?.liveGoals ? ` · أهداف مباشرة غير نهائية: ${formatCount(stats.liveGoals)}` : ''}`,
      href: '/matches',
      tone: 'gold',
      loading: isInitialLoading,
    },
    {
      label: 'متوسط الأهداف',
      value: isInitialLoading ? LOADING_VALUE : formatDecimal(stats?.averageGoalsPerFinishedMatch),
      note: isInitialLoading ? loadingNote : 'هدف لكل مباراة منتهية فقط',
      href: '/matches',
      tone: 'cyan',
      loading: isInitialLoading,
    },
    {
      label: 'أكثر منتخب تسجيلًا',
      value: isInitialLoading ? LOADING_VALUE : topScoringTeam ? formatCount(topScoringTeam.goalsFor) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : topScoringTeam ? shortTeamStat(topScoringTeam, 'played', ' مباريات') : 'يظهر بعد انتهاء مباريات كافية',
      href: topScoringTeam?.id ? `/teams/${encodeURIComponent(topScoringTeam.id)}` : '/teams',
      tone: 'gold',
      loading: isInitialLoading,
    },
    {
      label: 'شباك نظيفة',
      value: isInitialLoading ? LOADING_VALUE : formatCount(stats?.cleanSheets),
      note: isInitialLoading ? loadingNote : bestCleanSheetTeam ? `الأبرز: ${shortTeamStat(bestCleanSheetTeam, 'cleanSheets')}` : 'إجمالي الشباك النظيفة بعد المباريات',
      href: '/matches',
      tone: 'default',
      loading: isInitialLoading,
    },
    {
      label: 'تسديدات / على المرمى',
      value: isInitialLoading ? LOADING_VALUE : finalStats?.totalShots ? `${formatCount(finalStats.totalShots)} / ${formatCount(finalStats.totalShotsOnTarget)}` : 'غير متوفر',
      note: isInitialLoading ? loadingNote : finalStats?.matchesWithFinalSnapshots ? `من ${formatCount(finalStats.matchesWithFinalSnapshots)} مباراة بها إحصائيات نهائية` : 'تظهر بعد مزامنة إحصائيات المباراة',
      href: '/matches',
      tone: 'cyan',
      loading: isInitialLoading,
    },
    {
      label: 'كروت صفراء / حمراء',
      value: isInitialLoading ? LOADING_VALUE : `${formatCount(cardTotalYellow)} / ${formatCount(cardTotalRed)}`,
      note: isInitialLoading ? loadingNote : 'من snapshots أو أحداث المباراة المتاحة',
      href: '/matches',
      tone: 'alert',
      loading: isInitialLoading,
    },
    {
      label: 'ركلات الجزاء',
      value: isInitialLoading ? LOADING_VALUE : kicksAvailable ? formatCount(kickStats?.total) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : kicksAvailable ? `مسجلة: ${formatCount(kickStats?.scored)} · ضائعة: ${formatCount(kickStats?.missed)}` : 'غير متوفر في المصادر الحالية',
      href: '/matches',
      tone: 'default',
      loading: isInitialLoading,
    },
    {
      label: 'أكبر نتيجة',
      value: isInitialLoading ? LOADING_VALUE : biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : 'غير متوفر',
      note: isInitialLoading ? loadingNote : biggestScore ? `${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}` : 'تظهر بعد تسجيل نتيجة بها أهداف',
      href: biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches',
      tone: 'default',
      loading: isInitialLoading,
    },
    {
      label: 'مباريات منتهية',
      value: isInitialLoading ? LOADING_VALUE : formatCount(stats?.finishedMatches),
      note: isInitialLoading ? loadingNote : `مباشر الآن: ${formatCount(stats?.liveMatches)} / متبقية: ${formatCount(stats?.scheduledMatches ?? upcomingMatchesCount)}`,
      href: '/matches',
      tone: 'default',
      loading: isInitialLoading,
    },
  ]), [stats, upcomingMatchesCount, kicksAvailable, biggestScore, isInitialLoading, cardTotalYellow, cardTotalRed, kickStats, playerCount, topScoringTeam, bestCleanSheetTeam, finalStats]);

  return (
    <section className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_28%),linear-gradient(135deg,rgba(7,24,18,0.94),rgba(4,17,13,0.98))] p-3 text-white shadow-[0_18px_46px_rgba(0,0,0,0.32)] backdrop-blur sm:p-4" aria-label="إحصائيات البطولة">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD700]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
            TOURNAMENT STATS
          </div>
          <h1 className="mt-3 text-xl font-black leading-snug tracking-tight text-white md:text-2xl lg:text-3xl">الإحصائيات</h1>
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-6 text-gray-300 md:text-sm md:leading-7">
            ملخص البطولة بعد المباريات من قاعدة البيانات: الأهداف، المتوسطات، المنتخبات الأبرز، التسديدات، البطاقات، ركلات الجزاء، وحالة المباريات.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-left text-[10px] font-bold leading-5 text-gray-400">
          <div className="font-black text-[#FFD700]">تحديث تلقائي كل 60 ثانية</div>
          <div>آخر مصدر: {isInitialLoading ? 'جاري التحميل...' : formatUpdateTime(sourceUpdatedAt)}</div>
          <div>آخر جلب: {lastClientRefresh ? formatUpdateTime(lastClientRefresh.toISOString()) : isLoading ? 'جاري التحميل...' : 'غير متوفر'}</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-gray-500">
        <span>الفرق المسجلة: {formatCount(stats?.teamCount ?? teamsCount, isInitialLoading ? LOADING_VALUE : 'غير متوفر')} منتخب</span>
        <span>مصدر اللاعبين: قاعدة البيانات · إحصائيات المباريات تظهر بعد توفر snapshots أو أحداث نهائية</span>
      </div>
    </section>
  );
}
