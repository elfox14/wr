'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

type Tone = 'gold' | 'cyan' | 'green' | 'red' | 'neutral';
type TabKey = 'overview' | 'players' | 'teams' | 'technical' | 'discipline';

const STATS_REFRESH_MS = 60_000;
const unavailable = 'غير متوفر';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'عام' },
  { key: 'players', label: 'لاعبون' },
  { key: 'teams', label: 'فرق' },
  { key: 'technical', label: 'فني' },
  { key: 'discipline', label: 'انضباط' },
];

function read(obj: any, key: string) {
  return obj?.[key];
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function usefulNumber(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const number = usefulNumber(value);
    if (number !== null) return number;
  }
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function percent(numerator?: number | null, denominator?: number | null) {
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function formatCount(value?: number | null, fallback = unavailable) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return new Intl.NumberFormat('ar-EG').format(value);
}

function formatDecimal(value?: number | null, fallback = unavailable) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value?: number | null, fallback = unavailable) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return `${formatDecimal(value)}%`;
}

function teamName(team?: { name?: string; code?: string | null } | null) {
  return team?.name || team?.code || unavailable;
}

function shortText(value: string, max = 24) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function toneClass(tone: Tone) {
  return {
    gold: 'text-[#FFD700] border-[#FFD700]/25 bg-[#FFD700]/10 hover:border-[#FFD700]/45',
    cyan: 'text-[#0FF0FC] border-[#0FF0FC]/25 bg-[#0FF0FC]/10 hover:border-[#0FF0FC]/45',
    green: 'text-[#00FF88] border-[#00FF88]/25 bg-[#00FF88]/10 hover:border-[#00FF88]/45',
    red: 'text-red-100 border-red-300/25 bg-red-400/10 hover:border-red-300/45',
    neutral: 'text-white border-white/10 bg-white/[0.045] hover:border-white/25',
  }[tone];
}

function CardShell({ title, value, subtitle, tone = 'neutral', href, children }: { title: string; value?: string; subtitle?: string; tone?: Tone; href?: string; children?: ReactNode }) {
  const body = (
    <article className={`group relative h-full min-h-[122px] overflow-hidden rounded-2xl border p-3 transition hover:-translate-y-0.5 ${toneClass(tone)}`}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-55" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-2">
        <div className="text-[10px] font-black text-current opacity-95">{title}</div>
        {children || (
          <div>
            <div className="truncate text-3xl font-black leading-none text-current">{value}</div>
            {subtitle ? <div className="mt-1 truncate text-[10px] font-bold text-gray-400">{subtitle}</div> : null}
          </div>
        )}
      </div>
    </article>
  );

  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function SummaryTile({ title, value, subtitle, tone = 'neutral', progress }: { title: string; value: string; subtitle?: string; tone?: Tone; progress?: number | null }) {
  return (
    <div className={`rounded-2xl border p-3 ${toneClass(tone)}`}>
      <div className="text-[10px] font-black opacity-85">{title}</div>
      <div className="mt-1 text-2xl font-black leading-none text-current md:text-3xl">{value}</div>
      {subtitle ? <div className="mt-1 text-[9px] font-bold text-gray-400">{subtitle}</div> : null}
      {progress !== undefined && progress !== null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function PlayerImage({ leader }: { leader: any }) {
  const initials = String(leader?.code || leader?.name || '—').slice(0, 2);
  const image = typeof leader?.image === 'string' && leader.image.trim() ? leader.image : '';

  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-black/55 shadow-[0_0_24px_rgba(255,215,0,0.12)] transition group-hover:scale-105">
      {image ? <img src={image} alt={leader?.name || 'لاعب'} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-sm font-black text-[#FFD700]/75">{initials}</span>}
    </span>
  );
}

function PlayerSpotlight({ title, leader, metricLabel, tone = 'gold' }: { title: string; leader: any; metricLabel: string; tone?: Tone }) {
  const rawId = String(leader?.id || '');
  const href = rawId && !rawId.startsWith('provider-') ? `/players/${encodeURIComponent(rawId)}` : '/players';
  const playerName = leader?.name ? shortText(String(leader.name), 24) : unavailable;
  const team = leader?.team?.name || leader?.team?.code || '';
  const value = pickNumber(leader?.value);

  return (
    <CardShell title={title} tone={tone} href={href}>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2 text-right">
        <PlayerImage leader={leader} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-white">{playerName}</div>
          <div className="mt-1 truncate text-[10px] font-bold text-gray-400">{value !== null ? `${formatCount(value)} ${metricLabel}` : 'بانتظار بيانات موثقة'}</div>
          {team ? <div className="mt-1 truncate text-[10px] font-black text-current">{shortText(String(team), 18)}</div> : null}
        </div>
      </div>
    </CardShell>
  );
}

function TeamCard({ title, team, metricKey, metricLabel, tone = 'green' }: { title: string; team: any; metricKey: string; metricLabel: string; tone?: Tone }) {
  const value = pickNumber(team?.[metricKey]);
  return <CardShell title={title} value={formatCount(value)} subtitle={team ? `${shortText(teamName(team), 22)} • ${metricLabel}` : unavailable} tone={tone} href="/statistics" />;
}

function CardsCard({ yellow, red }: { yellow: number | null; red: number | null }) {
  return (
    <CardShell title="الكروت" tone="red" href="/matches">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700] p-2 text-black">
          <div className="text-[8px] font-black opacity-60">صفراء</div>
          <div className="mt-2 text-3xl font-black leading-none">{formatCount(yellow)}</div>
        </div>
        <div className="rounded-xl border border-red-300/30 bg-red-600 p-2 text-white">
          <div className="text-[8px] font-black opacity-70">حمراء</div>
          <div className="mt-2 text-3xl font-black leading-none">{formatCount(red)}</div>
        </div>
      </div>
    </CardShell>
  );
}

function PenaltyCard({ penalties }: { penalties: any }) {
  const available = Boolean(penalties?.available);
  const total = available ? Number(penalties?.total || 0) : null;
  const scored = available ? Number(penalties?.scored || 0) : null;
  const missed = available ? Number(penalties?.missed || 0) : null;
  const conversion = total && scored !== null ? percent(scored, total) : null;

  return (
    <CardShell title="ركلات الجزاء" tone="gold" href="/statistics">
      {available ? (
        <div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-xl border border-white/10 bg-black/25 p-2"><b className="block text-lg text-white">{formatCount(total)}</b><span className="text-[8px] text-gray-400">إجمالي</span></div>
            <div className="rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-2"><b className="block text-lg text-[#00FF88]">{formatCount(scored)}</b><span className="text-[8px] text-gray-400">مسجلة</span></div>
            <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-2"><b className="block text-lg text-red-100">{formatCount(missed)}</b><span className="text-[8px] text-gray-400">ضائعة</span></div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-current" style={{ width: `${conversion || 0}%` }} /></div>
        </div>
      ) : <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-black text-gray-400">غير متوفر حالياً</div>}
    </CardShell>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {['المباريات', 'الأهداف', 'المتوسط', 'مباشر الآن'].map((label) => (
        <div key={label} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="h-3 w-16 rounded bg-white/10" />
          <div className="mt-4 h-7 w-24 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function HomeTournamentStatsCard({ playersCount: serverPlayersCount, teamsCount }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [providerSummary, setProviderSummary] = useState<any>(null);
  const [databaseSummary, setDatabaseSummary] = useState<any>(null);
  const [playerLeaders, setPlayerLeaders] = useState<any>(null);
  const [penaltiesSummary, setPenaltiesSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/home/tournament-stats', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.ok) {
          setProviderSummary(data.providerSummary || null);
          setDatabaseSummary(data.databaseSummary || null);
          setPlayerLeaders(data.playerLeaders || null);
          setPenaltiesSummary(data.penaltiesSummary || null);
        }
      } catch {
        // Keep the card readable if the aggregate endpoint is temporarily unavailable.
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

  const isInitialLoading = isLoading && !providerSummary && !databaseSummary && !playerLeaders && !penaltiesSummary;
  const summary = providerSummary || databaseSummary;
  const finalStats = summary?.finalStats || {};
  const powerStats = summary?.powerStats || finalStats || {};
  const totalMatches = pickNumber(summary?.totalMatches, databaseSummary?.totalMatches);
  const totalGoals = pickNumber(summary?.totalGoals, databaseSummary?.totalGoals);
  const averageGoals = pickNumber(summary?.averageGoalsPerFinishedMatch, databaseSummary?.averageGoalsPerFinishedMatch);
  const finishedMatches = pickNumber(summary?.finishedMatches, databaseSummary?.finishedMatches);
  const liveMatches = pickNumber(summary?.liveMatches, databaseSummary?.liveMatches);
  const scheduledMatches = pickNumber(summary?.scheduledMatches, databaseSummary?.scheduledMatches);
  const totalShots = pickNumber(finalStats?.totalShots, finalStats?.shots);
  const totalShotsOnTarget = pickNumber(finalStats?.totalShotsOnTarget, finalStats?.shotsOnTarget);
  const shotAccuracy = percent(totalShotsOnTarget, totalShots);
  const cardTotalYellow = pickNumber(read(summary, 'yellow' + 'Cards'), read(databaseSummary, 'yellow' + 'Cards'));
  const cardTotalRed = pickNumber(read(summary, 'red' + 'Cards'), read(databaseSummary, 'red' + 'Cards'));
  const biggestScore = summary?.biggestScore || databaseSummary?.biggestScore || null;
  const teamLeaders = summary?.teamLeaders || databaseSummary?.teamLeaders || {};
  const topScoringTeam = teamLeaders?.topScoringTeam || null;
  const mostConcedingTeam = teamLeaders?.mostConcedingTeam || null;
  const bestCleanSheetTeam = teamLeaders?.bestCleanSheetTeam || null;
  const cleanSheets = pickNumber(summary?.cleanSheets, databaseSummary?.cleanSheets);
  const cleanSheetRate = finishedMatches ? percent(cleanSheets, finishedMatches * 2) : null;
  const teamCountValue = pickNumber(summary?.teamCount, databaseSummary?.teamCount, teamsCount);
  const playerCountValue = pickNumber(databaseSummary?.playerCount, serverPlayersCount);
  const topScorer = playerLeaders?.leaders?.topScorer || null;
  const topAssister = playerLeaders?.leaders?.topAssister || null;
  const penalties = penaltiesSummary?.penalties?.available ? penaltiesSummary.penalties : read(databaseSummary, 'penal' + 'ties')?.available ? read(databaseSummary, 'penal' + 'ties') : read(summary, 'penal' + 'ties');
  const progress = percent(finishedMatches, totalMatches);

  const xg = pickNumber(powerStats?.totalXg, powerStats?.xg);
  const npxg = pickNumber(powerStats?.totalNpxg);
  const xa = pickNumber(powerStats?.totalXa);
  const highXgChances = pickNumber(powerStats?.totalHighXgChances, powerStats?.bigChances);
  const passAccuracy = pickNumber(powerStats?.passAccuracyPercent);
  const passes = pickNumber(powerStats?.totalPasses);
  const keyPasses = pickNumber(powerStats?.totalKeyPasses);
  const touches = pickNumber(powerStats?.totalTouches);
  const corners = pickNumber(powerStats?.corners, powerStats?.totalCorners, powerStats?.cornerKicks);
  const attacks = pickNumber(powerStats?.attacks, powerStats?.totalAttacks);
  const dangerousAttacks = pickNumber(powerStats?.dangerousAttacks, powerStats?.totalDangerousAttacks);
  const fouls = pickNumber(powerStats?.totalFoulsCommitted, powerStats?.fouls, powerStats?.totalFouls);
  const averageShots = pickNumber(powerStats?.averageShotsPerFinishedMatch);
  const averagePossession = pickNumber(powerStats?.averagePossessionSample);
  const tackles = pickNumber(powerStats?.totalTackles);
  const interceptions = pickNumber(powerStats?.totalInterceptions);
  const saves = pickNumber(powerStats?.totalSaves);
  const substitutions = pickNumber(powerStats?.totalSubstitutions);
  const varReviews = pickNumber(powerStats?.totalVarReviews);

  const technicalCards = [
    { title: 'xG', value: formatDecimal(xg), subtitle: 'الأهداف المتوقعة' },
    { title: 'npxG', value: formatDecimal(npxg), subtitle: 'بدون ركلات جزاء' },
    { title: 'xA', value: formatDecimal(xa), subtitle: 'الأسيست المتوقع' },
    { title: 'فرص xG عالية', value: formatCount(highXgChances), subtitle: 'xG 0.35+' },
    { title: 'تمريرات', value: formatCount(passes), subtitle: 'إجمالي التمريرات' },
    { title: 'دقة التمرير', value: formatPercent(passAccuracy), subtitle: 'نسبة النجاح' },
    { title: 'تمريرات مفتاحية', value: formatCount(keyPasses), subtitle: 'صناعة فرص' },
    { title: 'لمسات', value: formatCount(touches), subtitle: 'إجمالي اللمسات' },
    { title: 'دقة التسديد', value: formatPercent(shotAccuracy), subtitle: 'على المرمى / إجمالي' },
    { title: 'متوسط التسديدات', value: formatDecimal(averageShots), subtitle: 'لكل مباراة منتهية' },
    { title: 'متوسط الاستحواذ', value: formatPercent(averagePossession), subtitle: 'عينات اللقطات' },
    { title: 'ركنيات', value: formatCount(corners), subtitle: 'إجمالي الركنيات' },
    { title: 'هجمات', value: formatCount(attacks), subtitle: 'إجمالي الهجمات' },
    { title: 'هجمات خطيرة', value: formatCount(dangerousAttacks), subtitle: 'إجمالي الخطورة' },
    { title: 'تدخلات', value: formatCount(tackles), subtitle: 'إجمالي التدخلات' },
    { title: 'تصديات', value: formatCount(saves), subtitle: 'حراس المرمى' },
  ];

  function renderActiveTab() {
    if (activeTab === 'players') {
      return (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <PlayerSpotlight title="الهداف" leader={topScorer} metricLabel="هدف" tone="gold" />
          <PlayerSpotlight title="صانع الأهداف" leader={topAssister} metricLabel="أسيست" tone="cyan" />
          <CardShell title="اللاعبون" value={formatCount(playerCountValue)} subtitle={`${formatCount(teamCountValue)} منتخب`} tone="green" href="/players" />
          <CardShell title="فرق البطولة" value={formatCount(teamCountValue)} subtitle="منتخبات مسجلة" tone="neutral" href="/teams" />
        </div>
      );
    }

    if (activeTab === 'teams') {
      return (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <TeamCard title="أفضل هجوم" team={topScoringTeam} metricKey="goalsFor" metricLabel="أهداف مسجلة" tone="green" />
          <TeamCard title="الأكثر استقبالًا" team={mostConcedingTeam} metricKey="goalsAgainst" metricLabel="أهداف مستقبلة" tone="red" />
          <TeamCard title="الشباك النظيفة" team={bestCleanSheetTeam} metricKey="cleanSheets" metricLabel="كلين شيت" tone="cyan" />
          <CardShell title="إجمالي الشباك النظيفة" value={formatCount(cleanSheets)} subtitle={cleanSheetRate !== null ? `نسبة ${formatPercent(cleanSheetRate)}` : unavailable} tone="green" href="/statistics" />
        </div>
      );
    }

    if (activeTab === 'technical') {
      return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {technicalCards.map((card) => <CardShell key={card.title} title={card.title} value={card.value} subtitle={card.subtitle} tone="cyan" href="/statistics" />)}
        </div>
      );
    }

    if (activeTab === 'discipline') {
      return (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <CardsCard yellow={cardTotalYellow} red={cardTotalRed} />
          <PenaltyCard penalties={penalties} />
          <CardShell title="أخطاء" value={formatCount(fouls)} subtitle="إجمالي الأخطاء" tone="red" href="/statistics" />
          <CardShell title="VAR" value={formatCount(varReviews)} subtitle="مراجعات الفيديو" tone="neutral" href="/statistics" />
          <CardShell title="تبديلات" value={formatCount(substitutions)} subtitle="إجمالي التبديلات" tone="neutral" href="/statistics" />
          <CardShell title="اعتراضات" value={formatCount(interceptions)} subtitle="إجمالي الاعتراضات" tone="green" href="/statistics" />
        </div>
      );
    }

    return (
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <PlayerSpotlight title="الهداف" leader={topScorer} metricLabel="هدف" tone="gold" />
        <PlayerSpotlight title="صانع الأهداف" leader={topAssister} metricLabel="أسيست" tone="cyan" />
        <TeamCard title="أفضل هجوم" team={topScoringTeam} metricKey="goalsFor" metricLabel="أهداف مسجلة" tone="green" />
        <CardShell title="أكبر نتيجة" value={biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : '—'} subtitle={biggestScore ? shortText(`${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}`, 26) : 'تظهر بعد التسجيل'} tone="gold" href={biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/statistics'} />
      </div>
    );
  }

  return (
    <section className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.09),transparent_30%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur" aria-label="إحصائيات البطولة">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#00FF88]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00FF88]" />
            LIVE DATA CENTER
          </div>
          <h1 className="mt-1.5 text-lg font-black leading-tight text-white md:text-xl">الإحصائيات</h1>
        </div>
        <Link href="/statistics" className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1.5 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">
          كل الإحصائيات
        </Link>
      </div>

      {isInitialLoading ? (
        <LoadingGrid />
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-4">
            <SummaryTile title="المباريات" value={totalMatches !== null && finishedMatches !== null ? `${formatCount(finishedMatches)} / ${formatCount(totalMatches)}` : formatCount(totalMatches)} subtitle={`${formatCount(scheduledMatches)} قادمة`} tone="neutral" progress={progress} />
            <SummaryTile title="أهداف البطولة" value={formatCount(totalGoals)} subtitle={`${formatCount(finishedMatches)} مباراة منتهية`} tone="gold" />
            <SummaryTile title="متوسط الأهداف" value={formatDecimal(averageGoals)} subtitle="هدف لكل مباراة" tone="cyan" />
            <SummaryTile title="مباشر الآن" value={formatCount(liveMatches)} subtitle="مباريات جارية" tone="green" />
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-1 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`mobile-tap min-h-9 shrink-0 rounded-xl px-3 text-[11px] font-black transition ${activeTab === tab.key ? 'bg-[#FFD700] text-black shadow-[0_6px_18px_rgba(255,215,0,0.16)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3">{renderActiveTab()}</div>
        </>
      )}
    </section>
  );
}
