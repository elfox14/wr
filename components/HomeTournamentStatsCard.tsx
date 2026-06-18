'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

type Tone = 'gold' | 'cyan' | 'green' | 'red' | 'neutral';

const STATS_REFRESH_MS = 60_000;
const LOADING_VALUE = '...';
const unavailableSource = '—';
const CARD_SPAN = 'col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2';

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

function formatCount(value?: number | null, unavailable = 'غير متوفر') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable;
  return new Intl.NumberFormat('ar-EG').format(value);
}

function formatDecimal(value?: number | null, unavailable = 'غير متوفر') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable;
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value?: number | null, unavailable = 'غير متوفر') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable;
  return `${formatDecimal(value)}%`;
}

function teamName(team?: { name?: string; code?: string | null } | null) {
  return team?.name || team?.code || 'غير متوفر';
}

function shortText(value: string, max = 24) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sourceNameForSummary(summary: any, databaseSummary: any) {
  if (summary?.provider === 'THE_STATS_API' || summary?.source === 'thestatsapi_server_side_summary') return 'TheStatsAPI';
  if (summary?.provider === 'DATABASE_SUMMARY') return 'DB/Snapshots';
  if (databaseSummary?.ok) return 'DB/Snapshots';
  return unavailableSource;
}

function hasProviderStat(summary: any, key: string) {
  const availability = finiteNumber(summary?.statAvailability?.[key]);
  return availability !== null && availability > 0;
}

function hasSnapshotValue(summary: any, ...values: unknown[]) {
  const matches = pickNumber(summary?.finalStats?.matchesWithFinalSnapshots);
  return matches !== null && pickNumber(...values) !== null;
}

function toneStyles(tone: Tone) {
  return {
    gold: { line: 'via-[#FFD700]/70', border: 'hover:border-[#FFD700]/35', value: 'text-[#FFD700]' },
    cyan: { line: 'via-[#0FF0FC]/55', border: 'hover:border-[#0FF0FC]/35', value: 'text-[#0FF0FC]' },
    green: { line: 'via-[#00FF88]/50', border: 'hover:border-[#00FF88]/30', value: 'text-[#00FF88]' },
    red: { line: 'via-red-300/55', border: 'hover:border-red-300/30', value: 'text-red-100' },
    neutral: { line: 'via-white/35', border: 'hover:border-white/25', value: 'text-white' },
  }[tone];
}

function SourceBadge({ source }: { source?: string }) {
  if (!source || source === unavailableSource) return null;
  return <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-black text-gray-300">{source}</span>;
}

function StatShell({
  title,
  source,
  tone = 'neutral',
  href,
  itemClassName = CARD_SPAN,
  children,
}: {
  title: string;
  source?: string;
  tone?: Tone;
  href?: string;
  itemClassName?: string;
  children: ReactNode;
}) {
  const style = toneStyles(tone);
  const body = (
    <article className={`group relative h-full min-h-[124px] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(0,0,0,0.25))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_22px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 ${style.border}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${style.line} to-transparent`} />
      <div className="relative z-10 flex h-full min-h-0 flex-col gap-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className={`truncate text-[10px] font-black ${style.value}`}>{title}</div>
          <SourceBadge source={source} />
        </div>
        {children}
      </div>
    </article>
  );

  return href ? <Link className={`block ${itemClassName}`} href={href}>{body}</Link> : <div className={itemClassName}>{body}</div>;
}

function GoalFrame({ children, tone = 'gold' }: { children: ReactNode; tone?: Tone }) {
  const style = toneStyles(tone);
  return (
    <div className="relative flex min-h-[78px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center">
      <div className={`pointer-events-none absolute inset-x-3 top-2 h-[58px] rounded-t-2xl border-2 border-b-0 ${tone === 'green' ? 'border-[#00FF88]/35' : tone === 'cyan' ? 'border-[#0FF0FC]/35' : 'border-[#FFD700]/35'}`} />
      <div className="pointer-events-none absolute inset-x-5 top-[50%] h-px bg-white/10" />
      <div className="relative z-10 w-full">{children}</div>
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent ${style.line} to-transparent`} />
    </div>
  );
}

function GoalStatCard({ title, value, subtitle, source, tone = 'gold', href }: { title: string; value: string; subtitle?: string; source?: string; tone?: Tone; href?: string }) {
  const style = toneStyles(tone);
  return (
    <StatShell title={title} source={source} tone={tone} href={href} itemClassName={CARD_SPAN}>
      <GoalFrame tone={tone}>
        <div className={`truncate text-3xl font-black leading-none ${style.value}`}>{value}</div>
        {subtitle ? <div className="mt-1 truncate text-[9px] font-bold text-gray-400">{subtitle}</div> : null}
      </GoalFrame>
    </StatShell>
  );
}

function LoadingBox({ label }: { label: string }) {
  return <GoalStatCard title={label} value={LOADING_VALUE} subtitle="جاري التحميل" />;
}

function PlayerImage({ leader }: { leader: any }) {
  const initials = String(leader?.code || leader?.name || '—').slice(0, 2);
  const image = typeof leader?.image === 'string' && leader.image.trim() ? leader.image : '';

  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-black/55 shadow-[0_0_24px_rgba(255,215,0,0.12)] transition group-hover:scale-105">
      {image ? (
        <img src={image} alt={leader?.name || 'الهداف'} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-sm font-black text-[#FFD700]/75">{initials}</span>
      )}
    </span>
  );
}

function TopScorerCard({ leader }: { leader: any }) {
  const rawId = String(leader?.id || '');
  const href = rawId && !rawId.startsWith('provider-scorer:') ? `/players/${encodeURIComponent(rawId)}` : '/players';
  const playerName = leader?.name ? shortText(String(leader.name), 22) : 'غير متوفر';
  const team = leader?.team?.name || leader?.team?.code || '';
  const subtitle = leader?.value
    ? `${formatCount(Number(leader.value))} هدف${team ? ` • ${shortText(String(team), 14)}` : ''}`
    : 'بانتظار بيانات موثقة';
  const source = leader?.sourceName || leader?.source || (leader ? 'DB' : unavailableSource);

  return (
    <StatShell title="الهداف" source={source} tone="gold" href={href} itemClassName={CARD_SPAN}>
      <div className="flex min-h-0 flex-1 items-center gap-3 overflow-hidden rounded-xl border border-[#FFD700]/15 bg-[#FFD700]/10 px-2.5 py-2 text-right">
        <PlayerImage leader={leader} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black leading-tight text-white">{playerName}</div>
          <div className="mt-1 truncate text-[10px] font-bold leading-tight text-[#FFD700]/80">{subtitle}</div>
        </div>
      </div>
    </StatShell>
  );
}

function PlayersGroupCard({ playerCount, teamCount, source }: { playerCount: number | null; teamCount: number | null; source: string }) {
  return (
    <StatShell title="اللاعبون" source={source} tone="green" href="/players" itemClassName={CARD_SPAN}>
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[#00FF88]/15 bg-[#00FF88]/10 px-2 py-2">
        <div className="relative h-10 w-24">
          {[0, 1, 2, 3, 4].map((item) => (
            <span key={item} className="absolute top-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#00FF88]/25 bg-black/55 text-[10px] font-black text-[#00FF88] shadow-[0_4px_12px_rgba(0,255,136,0.08)]" style={{ right: `${item * 16}px`, zIndex: 10 - item }}>
              <span className="h-2.5 w-2.5 rounded-full bg-[#00FF88]/70" />
            </span>
          ))}
        </div>
        <div className="text-3xl font-black leading-none text-[#00FF88]">{formatCount(playerCount)}</div>
        <div className="mt-1 text-[9px] font-bold text-gray-400">{formatCount(teamCount)} منتخب</div>
      </div>
    </StatShell>
  );
}

function CardsMiniCard({ yellow, red, source }: { yellow: number | null; red: number | null; source: string }) {
  return (
    <StatShell title="الكروت" source={source} tone="red" href="/matches" itemClassName={CARD_SPAN}>
      <div className="grid flex-1 grid-cols-2 items-center gap-2">
        <div className="flex h-[78px] flex-col justify-between rounded-xl border border-[#FFD700]/35 bg-[#FFD700] p-2 text-black shadow-[0_5px_14px_rgba(255,215,0,0.12)] transition group-hover:-rotate-1">
          <div className="text-[8px] font-black uppercase tracking-[0.12em] text-black/55">Yellow</div>
          <div className="text-4xl font-black leading-none">{formatCount(yellow)}</div>
          <div className="text-[9px] font-black text-black/65">صفراء</div>
        </div>
        <div className="flex h-[78px] flex-col justify-between rounded-xl border border-red-300/35 bg-red-600 p-2 text-white shadow-[0_5px_14px_rgba(248,113,113,0.13)] transition group-hover:rotate-1">
          <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/65">Red</div>
          <div className="text-4xl font-black leading-none">{formatCount(red)}</div>
          <div className="text-[9px] font-black text-white/75">حمراء</div>
        </div>
      </div>
    </StatShell>
  );
}

function PenaltyMiniCard({ kickStats, source }: { kickStats: any; source: string }) {
  const available = Boolean(kickStats?.available);
  const total = available ? Number(kickStats?.total || 0) : null;
  const scored = available ? Number(kickStats?.scored || 0) : null;
  const missed = available ? Number(kickStats?.missed || 0) : null;
  const conversion = total && scored !== null ? Math.max(0, Math.min(100, (scored / total) * 100)) : null;

  return (
    <StatShell title="ركلات الجزاء" source={available ? source : unavailableSource} tone="gold" itemClassName={CARD_SPAN}>
      {available ? (
        <div className="flex flex-1 flex-col justify-center">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center text-white"><div className="text-base font-black leading-none">{formatCount(total)}</div><div className="mt-1 text-[8px] font-bold opacity-75">إجمالي</div></div>
            <div className="rounded-xl border border-[#00FF88]/18 bg-[#00FF88]/10 px-2 py-2 text-center text-[#00FF88]"><div className="text-base font-black leading-none">{formatCount(scored)}</div><div className="mt-1 text-[8px] font-bold opacity-75">مسجلة</div></div>
            <div className="rounded-xl border border-red-300/18 bg-red-400/10 px-2 py-2 text-center text-red-100"><div className="text-base font-black leading-none">{formatCount(missed)}</div><div className="mt-1 text-[8px] font-bold opacity-75">ضائعة</div></div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${conversion || 0}%` }} /></div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#FFD700]/18 bg-black/20 p-3 text-center">
          <div className="text-xs font-black text-gray-200">غير متوفر من مصدر ركلات الجزاء</div>
        </div>
      )}
    </StatShell>
  );
}

function PowerStatsCard({ powerStats, source }: { powerStats: any; source: string }) {
  const xg = pickNumber(powerStats?.totalXg, powerStats?.xg);
  const bigChances = pickNumber(powerStats?.bigChances);
  const passAccuracy = pickNumber(powerStats?.passAccuracyPercent);
  const saves = pickNumber(powerStats?.saves);
  const tackles = pickNumber(powerStats?.tackles);
  const corners = pickNumber(powerStats?.corners, powerStats?.totalCorners);

  const cards = [
    { title: 'xG', value: formatDecimal(xg), subtitle: 'الأهداف المتوقعة' },
    { title: 'فرص كبيرة', value: formatCount(bigChances), subtitle: 'إجمالي الفرص' },
    { title: 'دقة التمرير', value: formatPercent(passAccuracy), subtitle: 'نسبة النجاح' },
    { title: saves !== null ? 'تصديات' : 'تدخلات', value: saves !== null ? formatCount(saves) : formatCount(tackles), subtitle: saves !== null ? 'إجمالي التصديات' : 'إجمالي التدخلات' },
    ...(corners !== null ? [{ title: 'ركنيات', value: formatCount(corners), subtitle: 'إجمالي الركنيات' }] : []),
  ];

  return (
    <>
      {cards.map((card) => (
        <GoalStatCard key={`${card.title}-${card.subtitle}`} title={card.title} value={card.value} subtitle={card.subtitle} source={source} tone="cyan" href="/matches" />
      ))}
    </>
  );
}

export default function HomeTournamentStatsCard({ playersCount: serverPlayersCount, teamsCount }: Props) {
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
        const [providerResponse, databaseResponse, playerLeadersResponse, penaltiesResponse] = await Promise.all([
          fetch('/api/matches/cached-the-stats-summary', { cache: 'no-store' }),
          fetch('/api/matches/summary-stats', { cache: 'no-store' }),
          fetch('/api/players/leaders', { cache: 'no-store' }),
          fetch('/api/matches/penalties-summary', { cache: 'no-store' }),
        ]);
        if (providerResponse.ok) {
          const data = await providerResponse.json();
          if (!cancelled && data?.ok) setProviderSummary(data);
        }
        if (databaseResponse.ok) {
          const data = await databaseResponse.json();
          if (!cancelled && data?.ok) setDatabaseSummary(data);
        }
        if (playerLeadersResponse.ok) {
          const data = await playerLeadersResponse.json();
          if (!cancelled && data?.ok) setPlayerLeaders(data);
        }
        if (penaltiesResponse.ok) {
          const data = await penaltiesResponse.json();
          if (!cancelled && data?.ok) setPenaltiesSummary(data);
        }
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

  const isInitialLoading = isLoading && !providerSummary && !databaseSummary && !playerLeaders && !penaltiesSummary;
  const summary = providerSummary || databaseSummary;
  const summarySource = sourceNameForSummary(summary, databaseSummary);
  const finalStats = summary?.finalStats || {};
  const powerStats = summary?.powerStats || finalStats || {};
  const totalGoals = pickNumber(summary?.totalGoals, databaseSummary?.totalGoals);
  const averageGoals = pickNumber(summary?.averageGoalsPerFinishedMatch, databaseSummary?.averageGoalsPerFinishedMatch);
  const finishedMatches = pickNumber(summary?.finishedMatches, databaseSummary?.finishedMatches);
  const totalShots = hasProviderStat(summary, 'shots') || hasSnapshotValue(summary, finalStats?.totalShots) ? pickNumber(finalStats?.totalShots, finalStats?.shots) : null;
  const totalShotsOnTarget = hasProviderStat(summary, 'shotsOnTarget') || hasSnapshotValue(summary, finalStats?.totalShotsOnTarget) ? pickNumber(finalStats?.totalShotsOnTarget) : null;
  const cardTotalYellow = pickNumber(read(summary, 'yellow' + 'Cards'), read(databaseSummary, 'yellow' + 'Cards'));
  const cardTotalRed = pickNumber(read(summary, 'red' + 'Cards'), read(databaseSummary, 'red' + 'Cards'));
  const biggestScore = summary?.biggestScore || databaseSummary?.biggestScore || null;
  const bestCleanSheetTeam = summary?.teamLeaders?.bestCleanSheetTeam || databaseSummary?.teamLeaders?.bestCleanSheetTeam || null;
  const cleanSheets = pickNumber(summary?.cleanSheets, databaseSummary?.cleanSheets);
  const teamCountValue = pickNumber(summary?.teamCount, databaseSummary?.teamCount, teamsCount);
  const playerCountValue = pickNumber(databaseSummary?.playerCount, serverPlayersCount);
  const topScorer = playerLeaders?.leaders?.topScorer || null;
  const penalties = penaltiesSummary?.penalties?.available ? penaltiesSummary.penalties : read(databaseSummary, 'penal' + 'ties')?.available ? read(databaseSummary, 'penal' + 'ties') : read(summary, 'penal' + 'ties');
  const penaltySource = penaltiesSummary?.penalties?.available ? (penaltiesSummary?.provider || penaltiesSummary?.source || 'FOOTBALL_DATA_FULL') : penalties?.available ? summarySource : unavailableSource;
  const powerSource = hasProviderStat(summary, 'xg') || pickNumber(powerStats?.totalXg, powerStats?.xg) !== null ? summarySource : unavailableSource;
  const cardsSource = cardTotalYellow !== null || cardTotalRed !== null ? summarySource : unavailableSource;

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
      </div>

      {isInitialLoading ? (
        <div className="grid auto-rows-[124px] grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12">
          {['الهداف', 'الأهداف', 'المتوسط', 'التسديدات', 'أكبر نتيجة', 'الشباك', 'اللاعبون', 'الكروت', 'الجزاءات', 'xG', 'فرص كبيرة', 'دقة التمرير', 'تصديات'].map((label) => <LoadingBox key={label} label={label} />)}
        </div>
      ) : (
        <div className="grid auto-rows-[124px] grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12">
          <TopScorerCard leader={topScorer} />
          <GoalStatCard title="أهداف البطولة" value={formatCount(totalGoals)} subtitle={`${formatCount(finishedMatches)} مباراة منتهية`} source={totalGoals !== null ? summarySource : unavailableSource} tone="gold" href="/matches" />
          <GoalStatCard title="متوسط الأهداف" value={formatDecimal(averageGoals)} subtitle="هدف لكل مباراة" source={averageGoals !== null ? summarySource : unavailableSource} tone="cyan" href="/matches" />
          <GoalStatCard title="التسديدات" value={`${formatCount(totalShots)} / ${formatCount(totalShotsOnTarget)}`} subtitle="إجمالي / على المرمى" source={totalShots !== null || totalShotsOnTarget !== null ? summarySource : unavailableSource} tone="cyan" href="/matches" />
          <GoalStatCard title="أكبر نتيجة" value={biggestScore ? `${formatCount(biggestScore.homeScore)}-${formatCount(biggestScore.awayScore)}` : '—'} subtitle={biggestScore ? shortText(`${teamName(biggestScore.homeTeam)} ضد ${teamName(biggestScore.awayTeam)}`, 22) : 'تظهر بعد التسجيل'} source={biggestScore ? summarySource : unavailableSource} href={biggestScore?.matchId ? `/matches/${encodeURIComponent(biggestScore.matchId)}` : '/matches'} />
          <GoalStatCard title="الشباك النظيفة" value={formatCount(cleanSheets)} subtitle={bestCleanSheetTeam ? shortText(teamName(bestCleanSheetTeam), 18) : 'غير متوفر'} source={cleanSheets !== null ? summarySource : unavailableSource} tone="green" href="/matches" />
          <PlayersGroupCard playerCount={playerCountValue} teamCount={teamCountValue} source={playerCountValue !== null || teamCountValue !== null ? 'DB/Snapshots' : unavailableSource} />
          <CardsMiniCard yellow={cardTotalYellow} red={cardTotalRed} source={cardsSource} />
          <PenaltyMiniCard kickStats={penalties} source={penaltySource} />
          <PowerStatsCard powerStats={powerStats} source={powerSource} />
        </div>
      )}
    </section>
  );
}
