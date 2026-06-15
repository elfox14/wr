'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type BiggestScore = {
  matchId: string;
  homeTeam: { name: string; code?: string | null };
  awayTeam: { name: string; code?: string | null };
  homeScore: number;
  awayScore: number;
  totalGoals: number;
  goalDifference: number;
  matchDate: string;
};

type SummaryStats = {
  ok?: boolean;
  totalMatches?: number;
  finishedMatches?: number;
  liveMatches?: number;
  scheduledMatches?: number;
  teamCount?: number;
  playerCount?: number;
  rawPlayerRows?: number;
  hiddenDuplicatePlayerRows?: number;
  estimatedFinalSquadCapacity?: number;
  overEstimatedCapacityBy?: number;
  totalGoals?: number;
  yellowCards?: number;
  redCards?: number;
  penalties?: {
    available?: boolean;
    total?: number;
    scored?: number;
    missed?: number;
    unknown?: number;
    source?: string;
  };
  biggestScore?: BiggestScore | null;
  snapshotsCount?: number;
  matchesWithCardSnapshots?: number;
  latestCardsUpdatedAt?: string | null;
  latestEventUpdatedAt?: string | null;
  latestUpdatedAt?: string | null;
};

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

const STATS_REFRESH_MS = 60_000;
const LOADING_VALUE = '...';

function formatCount(value?: number | null, unavailable = 'غير متوفر') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable;
  return new Intl.NumberFormat('ar-EG').format(value);
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

function StatTile({ value, label, note, href, tone = 'default', loading = false }: { value: string; label: string; note: string; href?: string; tone?: 'default' | 'gold' | 'danger'; loading?: boolean }) {
  const content = (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:-translate-y-0.5 hover:border-[#FFD700]/35 hover:bg-white/[0.06]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/45 to-transparent opacity-70" />
      <div className={`text-xl font-black md:text-2xl ${loading ? 'animate-pulse text-gray-400' : tone === 'danger' ? 'text-red-200' : tone === 'gold' ? 'text-[#FFD700]' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-[11px] font-black text-[#FFD700]">{label}</div>
      <div className="mt-1 text-[10px] font-bold leading-4 text-gray-400">{note}</div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default function HomeTournamentStatsCard({ playersCount, teamsCount, upcomingMatchesCount }: Props) {
  const [stats, setStats] = useState<SummaryStats | null>(null);
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
        // Keep fallback values if the endpoint is temporarily unavailable.
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
  const loadingNote = 'جاري تحميل بيانات الإحصائيات...';
  const cardsAvailable = Boolean((stats?.matchesWithCardSnapshots || 0) > 0 || (stats?.yellowCards || 0) > 0 || (stats?.redCards || 0) > 0);
  const penaltiesAvailable = Boolean(stats?.penalties?.available);
  const biggestScore = stats?.biggestScore || null;
  const playerNote = stats?.rawPlayerRows && stats.rawPlayerRows > (stats.playerCount || 0)
    ? `بعد الدمج · الخام: ${formatCount(stats.rawPlayerRows)}`
    : 'لاعب ظاهر بعد الدمج';

  const tiles = useMemo(() => ([
    {
      label: 'عدد اللاعبين',
      value: formatCount(stats?.playerCount ?? playersCount, isInitialLoading ? LOADING_VALUE : 'غير متوفر'),
      note: isInitialLoading && !playersCount ? loadingNote : playerNote,
      href: '/players',
      tone: 'default' as const,
      loading: isInitialLoading && !playersCount,
    },
    {
      label: 'أهداف البطولة',
      value: isInitialLoading ? LOADING_VALUE : formatCount(stats?.totalGoals),
      note: isInitialLoading ? loadingNote : 'من بداية البطولة حسب نتائج المباريات',
      href: '/matches',
      tone: 'gold' as const,
      loading: isInitialLoading,
    },
    {
      label: 'كروت صفراء',
      value: isInitialLoading ? LOADING_VALUE : cardsAvailable ? formatCount(stats?.yellowCards) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : cardsAvailable ? 'من snapshots أو أحداث المباراة المتاحة' : 'غير متوفر في المصادر الحالية',
      href: '/matches',
      tone: 'gold' as const,
      loading: isInitialLoading,
    },
    {
      label: 'كروت حمراء',
      value: isInitialLoading ? LOADING_VALUE : cardsAvailable ? formatCount(stats?.redCards) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : cardsAvailable ? 'من snapshots أو أحداث المباراة المتاحة' : 'غير متوفر في المصادر الحالية',
      href: '/matches',
      tone: 'danger' as const,
      loading: isInitialLoading,
    },
    {
      label: 'ركلات الجزاء',
      value: isInitialLoading ? LOADING_VALUE : penaltiesAvailable ? formatCount(stats?.penalties?.total) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : penaltiesAvailable ? 'مرصودة من أحداث المباراة' : 'غير متوفر في المصادر الحالية',
      href: '/matches',
      tone: 'default' as const,
      loading: isInitialLoading,
    },
    {
      label: 'جزاء مسجل',
      value: isInitialLoading ? LOADING_VALUE : penaltiesAvailable ? formatCount(stats?.penalties?.scored) : 'غير متوفر',
      note: isInitialLoading ? loadingNote : penaltiesAvailable ? `مهدرة: ${formatCount(stats?.penalties?.missed)} / غير مصنفة: ${formatCount(stats?.penalties?.unknown)}` : 'يظهر عند توفر أحداث الجزاءات',
      href: '/matches',
      tone: 'gold' as const,
      loading: isInitialLoading,
    },
    {
      label: 'أكبر نتيجة',
      value: isInitialLoading ? LOADING_VALUE : biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : 'غير متوفر',
      note: isInitialLoading ? loadingNote : biggestScore ? `${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}` : 'تظهر بعد تسجيل نتيجة بها أهداف',
      href: biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches',
      tone: 'default' as const,
      loading: isInitialLoading,
    },
    {
      label: 'مباريات منتهية',
      value: isInitialLoading ? LOADING_VALUE : formatCount(stats?.finishedMatches),
      note: isInitialLoading ? loadingNote : `مباشر الآن: ${formatCount(stats?.liveMatches)} / متبقية: ${formatCount(stats?.scheduledMatches ?? upcomingMatchesCount)}`,
      href: '/matches',
      tone: 'default' as const,
      loading: isInitialLoading,
    },
  ]), [stats, playersCount, upcomingMatchesCount, cardsAvailable, penaltiesAvailable, biggestScore, playerNote, isInitialLoading]);

  return (
    <section className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_28%),linear-gradient(135deg,rgba(7,24,18,0.94),rgba(4,17,13,0.98))] p-3 text-white shadow-[0_18px_46px_rgba(0,0,0,0.32)] backdrop-blur sm:p-4" aria-label="إحصائيات البطولة الحية">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD700]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
            LIVE TOURNAMENT STATS
          </div>
          <h1 className="mt-3 text-xl font-black leading-snug tracking-tight text-white md:text-2xl lg:text-3xl">الإحصائيات</h1>
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-6 text-gray-300 md:text-sm md:leading-7">
            ملخص محدث للبطولة من قاعدة البيانات: اللاعبين، الأهداف، البطاقات، ركلات الجزاء، أكبر نتيجة، وحالة المباريات.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-left text-[10px] font-bold leading-5 text-gray-400">
          <div className="font-black text-[#FFD700]">تحديث تلقائي كل 60 ثانية</div>
          <div>آخر مصدر: {isInitialLoading ? 'جاري التحميل...' : formatUpdateTime(stats?.latestUpdatedAt || stats?.latestCardsUpdatedAt)}</div>
          <div>آخر جلب: {lastClientRefresh ? formatUpdateTime(lastClientRefresh.toISOString()) : isLoading ? 'جاري التحميل...' : 'غير متوفر'}</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-gray-500">
        <span>الفرق المسجلة: {formatCount(stats?.teamCount ?? teamsCount, isInitialLoading ? LOADING_VALUE : 'غير متوفر')} منتخب</span>
        <span>سعة القوائم التقديرية: {formatCount(stats?.estimatedFinalSquadCapacity, isInitialLoading ? LOADING_VALUE : 'غير متوفر')} لاعب · المصدر: قاعدة البيانات بعد الدمج</span>
      </div>
    </section>
  );
}
