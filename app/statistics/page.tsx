'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ApiState = {
  providerSummary: any;
  databaseSummary: any;
  playerLeaders: any;
  penaltiesSummary: any;
  loading: boolean;
  error: string | null;
};

const unavailable = 'غير متوفر';

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null && number > 0) return number;
  }
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function formatNumber(value?: number | null, fallback = unavailable) {
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

function percent(numerator?: number | null, denominator?: number | null) {
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function sourceName(summary: any, databaseSummary: any) {
  if (summary?.provider === 'THE_STATS_API' || summary?.source === 'thestatsapi_server_side_summary') return 'TheStatsAPI';
  if (summary?.provider === 'DATABASE_SUMMARY' || databaseSummary?.ok) return 'DB/Snapshots';
  return '—';
}

function teamLabel(team: any) {
  return team?.name || team?.code || unavailable;
}

function dateLabel(value?: string | null) {
  if (!value) return unavailable;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return unavailable;
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function StatCard({ title, value, subtitle, source, tone = 'cyan' }: { title: string; value: string; subtitle?: string; source?: string; tone?: 'gold' | 'cyan' | 'green' | 'red' | 'neutral' }) {
  const toneClass = {
    gold: 'text-[#FFD700] border-[#FFD700]/18 bg-[#FFD700]/8',
    cyan: 'text-[#0FF0FC] border-[#0FF0FC]/16 bg-[#0FF0FC]/8',
    green: 'text-[#00FF88] border-[#00FF88]/16 bg-[#00FF88]/8',
    red: 'text-red-100 border-red-300/16 bg-red-400/8',
    neutral: 'text-white border-white/10 bg-white/[0.04]',
  }[tone];

  return (
    <article className={`rounded-2xl border p-4 shadow-[0_12px_32px_rgba(0,0,0,0.2)] ${toneClass}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-xs font-black text-gray-300">{title}</h3>
        {source && source !== '—' ? <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black text-gray-300">{source}</span> : null}
      </div>
      <div className="text-3xl font-black leading-none">{value}</div>
      {subtitle ? <p className="mt-2 text-xs font-bold leading-5 text-gray-400">{subtitle}</p> : null}
    </article>
  );
}

function DetailRow({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/8 px-3 py-2 last:border-0">
      <span className="text-sm font-bold text-gray-300">{label}</span>
      <span className="text-left text-sm font-black text-white">{value}</span>
      {source ? <span className="col-span-2 text-[10px] font-bold text-gray-500">المصدر: {source}</span> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.18)]">
      <h2 className="mb-4 text-lg font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

function playerName(leader: any) {
  return leader?.name || unavailable;
}

function playerSubtitle(leader: any, label: string) {
  if (!leader?.value) return 'بانتظار بيانات موثقة';
  const team = leader?.team?.name || leader?.team?.code || '';
  return `${formatNumber(Number(leader.value))} ${label}${team ? ` • ${team}` : ''}`;
}

export default function StatisticsPage() {
  const [state, setState] = useState<ApiState>({
    providerSummary: null,
    databaseSummary: null,
    playerLeaders: null,
    penaltiesSummary: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [providerResponse, databaseResponse, leadersResponse, penaltiesResponse] = await Promise.all([
          fetch('/api/matches/cached-the-stats-summary', { cache: 'no-store' }),
          fetch('/api/matches/summary-stats', { cache: 'no-store' }),
          fetch('/api/players/leaders', { cache: 'no-store' }),
          fetch('/api/matches/penalties-summary', { cache: 'no-store' }),
        ]);

        const [providerSummary, databaseSummary, playerLeaders, penaltiesSummary] = await Promise.all([
          providerResponse.ok ? providerResponse.json() : null,
          databaseResponse.ok ? databaseResponse.json() : null,
          leadersResponse.ok ? leadersResponse.json() : null,
          penaltiesResponse.ok ? penaltiesResponse.json() : null,
        ]);

        if (!cancelled) {
          setState({
            providerSummary: providerSummary?.ok ? providerSummary : null,
            databaseSummary: databaseSummary?.ok ? databaseSummary : null,
            playerLeaders: playerLeaders?.ok ? playerLeaders : null,
            penaltiesSummary: penaltiesSummary?.ok ? penaltiesSummary : null,
            loading: false,
            error: null,
          });
        }
      } catch (error: any) {
        if (!cancelled) setState((current) => ({ ...current, loading: false, error: error?.message || 'تعذر تحميل الإحصائيات' }));
      }
    }
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const data = useMemo(() => {
    const summary = state.providerSummary || state.databaseSummary || {};
    const database = state.databaseSummary || {};
    const finalStats = summary.finalStats || database.finalStats || {};
    const teamLeaders = summary.teamLeaders || database.teamLeaders || {};
    const penalties = state.penaltiesSummary?.penalties?.available ? state.penaltiesSummary.penalties : database.penalties || summary.penalties || null;
    const source = sourceName(summary, database);
    const totalMatches = pickNumber(summary.totalMatches, database.totalMatches);
    const finishedMatches = pickNumber(summary.finishedMatches, database.finishedMatches);
    const liveMatches = pickNumber(summary.liveMatches, database.liveMatches);
    const scheduledMatches = pickNumber(summary.scheduledMatches, database.scheduledMatches);
    const totalGoals = pickNumber(summary.totalGoals, database.totalGoals);
    const averageGoals = pickNumber(summary.averageGoalsPerFinishedMatch, database.averageGoalsPerFinishedMatch);
    const totalShots = pickNumber(finalStats.totalShots, finalStats.shots);
    const totalShotsOnTarget = pickNumber(finalStats.totalShotsOnTarget, finalStats.shotsOnTarget);
    const shotAccuracy = percent(totalShotsOnTarget, totalShots);
    const cleanSheets = pickNumber(summary.cleanSheets, database.cleanSheets);
    const cleanSheetRate = finishedMatches ? percent(cleanSheets, finishedMatches * 2) : null;

    return {
      summary,
      database,
      finalStats,
      teamLeaders,
      penalties,
      source,
      totalMatches,
      finishedMatches,
      liveMatches,
      scheduledMatches,
      totalGoals,
      averageGoals,
      totalShots,
      totalShotsOnTarget,
      shotAccuracy,
      cleanSheets,
      cleanSheetRate,
    };
  }, [state]);

  const topScorer = state.playerLeaders?.leaders?.topScorer || null;
  const topAssister = state.playerLeaders?.leaders?.topAssister || null;
  const cardsSource = data.summary?.yellowCards !== undefined || data.database?.yellowCards !== undefined ? data.source : '—';
  const yellowCards = pickNumber(data.summary?.yellowCards, data.database?.yellowCards);
  const redCards = pickNumber(data.summary?.redCards, data.database?.redCards);
  const xg = pickNumber(data.finalStats?.totalXg, data.finalStats?.xg, data.summary?.powerStats?.totalXg, data.summary?.powerStats?.xg);
  const bigChances = pickNumber(data.finalStats?.bigChances, data.summary?.powerStats?.bigChances);
  const passAccuracy = pickNumber(data.finalStats?.passAccuracyPercent, data.summary?.powerStats?.passAccuracyPercent);
  const averageShots = pickNumber(data.finalStats?.averageShotsPerFinishedMatch, data.summary?.powerStats?.averageShotsPerFinishedMatch);
  const averagePossession = pickNumber(data.finalStats?.averagePossessionSample, data.summary?.powerStats?.averagePossessionSample);
  const corners = pickNumber(data.finalStats?.totalCorners, data.finalStats?.corners, data.summary?.powerStats?.totalCorners, data.summary?.powerStats?.corners);
  const attacks = pickNumber(data.finalStats?.totalAttacks, data.summary?.powerStats?.totalAttacks, data.summary?.powerStats?.attacks);
  const dangerousAttacks = pickNumber(data.finalStats?.totalDangerousAttacks, data.summary?.powerStats?.totalDangerousAttacks, data.summary?.powerStats?.dangerousAttacks);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-5 px-3 py-6 text-white sm:px-4 lg:px-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_28%),linear-gradient(135deg,rgba(7,24,18,0.95),rgba(3,12,11,0.99))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">DATA CENTER</p>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">كل إحصائيات البطولة</h1>
            <p className="mt-2 text-sm font-bold text-gray-400">تجميع تفصيلي من TheStatsAPI وDB/Snapshots وFootball-Data عند توفرها.</p>
          </div>
          <Link href="/" className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-gray-200 transition hover:border-[#FFD700]/25 hover:text-[#FFD700]">العودة للرئيسية</Link>
        </div>
        {state.loading ? <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm font-bold text-gray-400">جاري تحميل الإحصائيات...</div> : null}
        {state.error ? <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">{state.error}</div> : null}
      </div>

      {!state.loading ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="المباريات" value={data.totalMatches !== null && data.finishedMatches !== null ? `${formatNumber(data.finishedMatches)} / ${formatNumber(data.totalMatches)}` : formatNumber(data.totalMatches)} subtitle={`${formatNumber(data.liveMatches)} مباشرة • ${formatNumber(data.scheduledMatches)} قادمة`} source={data.source} tone="neutral" />
            <StatCard title="أهداف البطولة" value={formatNumber(data.totalGoals)} subtitle={`${formatNumber(data.finishedMatches)} مباراة منتهية`} source={data.source} tone="gold" />
            <StatCard title="متوسط الأهداف" value={formatDecimal(data.averageGoals)} subtitle="هدف لكل مباراة منتهية" source={data.source} tone="cyan" />
            <StatCard title="التسديدات" value={`${formatNumber(data.totalShots)} / ${formatNumber(data.totalShotsOnTarget)}`} subtitle={`دقة التسديد: ${formatPercent(data.shotAccuracy)}`} source={data.source} tone="cyan" />
          </section>

          <Section title="اللاعبون">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard title="الهداف" value={playerName(topScorer)} subtitle={playerSubtitle(topScorer, 'هدف')} source={topScorer?.sourceName || state.playerLeaders?.sources?.topScorer?.provider || '—'} tone="gold" />
              <StatCard title="صانع الأهداف" value={playerName(topAssister)} subtitle={playerSubtitle(topAssister, 'أسيست')} source={topAssister?.sourceName || 'PlayerPerformance'} tone="cyan" />
              <StatCard title="عدد اللاعبين" value={formatNumber(data.database?.playerCount)} subtitle={`${formatNumber(data.database?.teamCount)} منتخب • ${formatNumber(data.database?.hiddenDuplicatePlayerRows)} صفوف مكررة مخفية`} source="DB/Snapshots" tone="green" />
            </div>
          </Section>

          <Section title="المنتخبات">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="أفضل هجوم" value={teamLabel(data.teamLeaders?.topScoringTeam)} subtitle={`${formatNumber(data.teamLeaders?.topScoringTeam?.goalsFor)} هدف`} source={data.source} tone="green" />
              <StatCard title="الأكثر استقبالًا" value={teamLabel(data.teamLeaders?.mostConcedingTeam)} subtitle={`${formatNumber(data.teamLeaders?.mostConcedingTeam?.goalsAgainst)} هدف مستقبَل`} source={data.source} tone="red" />
              <StatCard title="أفضل شباك نظيفة" value={teamLabel(data.teamLeaders?.bestCleanSheetTeam)} subtitle={`${formatNumber(data.teamLeaders?.bestCleanSheetTeam?.cleanSheets)} شباك نظيفة`} source={data.source} tone="green" />
              <StatCard title="نسبة الشباك النظيفة" value={formatPercent(data.cleanSheetRate)} subtitle={`${formatNumber(data.cleanSheets)} شباك نظيفة`} source={data.source} tone="green" />
            </div>
          </Section>

          <Section title="اللعب والهجوم">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="xG" value={formatDecimal(xg)} subtitle="الأهداف المتوقعة" source={data.source} tone="cyan" />
              <StatCard title="فرص كبيرة" value={formatNumber(bigChances)} subtitle="إجمالي الفرص الكبيرة" source={data.source} tone="cyan" />
              <StatCard title="متوسط التسديدات" value={formatDecimal(averageShots)} subtitle="لكل مباراة منتهية" source={data.source} tone="cyan" />
              <StatCard title="متوسط الاستحواذ" value={formatPercent(averagePossession)} subtitle="متوسط عينات الاستحواذ" source={data.source} tone="cyan" />
              <StatCard title="دقة التمرير" value={formatPercent(passAccuracy)} subtitle="نسبة النجاح" source={data.source} tone="cyan" />
              <StatCard title="ركنيات" value={formatNumber(corners)} subtitle="إجمالي الركنيات" source={data.source} tone="cyan" />
              <StatCard title="هجمات" value={formatNumber(attacks)} subtitle="إجمالي الهجمات" source={data.source} tone="cyan" />
              <StatCard title="هجمات خطيرة" value={formatNumber(dangerousAttacks)} subtitle="إجمالي الخطورة" source={data.source} tone="cyan" />
            </div>
          </Section>

          <Section title="الانضباط وركلات الجزاء">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="البطاقات الصفراء" value={formatNumber(yellowCards)} source={cardsSource} tone="gold" />
              <StatCard title="البطاقات الحمراء" value={formatNumber(redCards)} source={cardsSource} tone="red" />
              <StatCard title="ركلات الجزاء" value={formatNumber(data.penalties?.total)} subtitle={`${formatNumber(data.penalties?.scored)} مسجلة • ${formatNumber(data.penalties?.missed)} ضائعة • ${formatNumber(data.penalties?.unknown)} غير محددة`} source={state.penaltiesSummary?.provider || data.penalties?.source || '—'} tone="gold" />
              <StatCard title="نسبة تسجيل الجزاءات" value={formatPercent(percent(data.penalties?.scored, data.penalties?.total))} subtitle="المسجلة من الإجمالي" source={state.penaltiesSummary?.provider || data.penalties?.source || '—'} tone="green" />
            </div>
          </Section>

          <Section title="جودة وتغطية البيانات">
            <div className="rounded-2xl border border-white/10 bg-black/20">
              <DetailRow label="المصدر الأساسي المعروض" value={data.source} />
              <DetailRow label="مباريات لها لقطات إحصائية نهائية" value={formatNumber(data.finalStats?.matchesWithFinalSnapshots)} />
              <DetailRow label="عدد اللقطات المحفوظة" value={formatNumber(data.database?.snapshotsCount)} />
              <DetailRow label="مباريات لها بيانات كروت" value={formatNumber(data.database?.matchesWithCardSnapshots)} />
              <DetailRow label="مباريات لها بيانات جزاءات" value={formatNumber(data.database?.penaltySource?.matchesWithPenaltySnapshots)} />
              <DetailRow label="آخر تحديث للكروت" value={dateLabel(data.database?.latestCardsUpdatedAt)} />
              <DetailRow label="آخر تحديث للجزاءات" value={dateLabel(data.database?.latestPenaltyUpdatedAt)} />
              <DetailRow label="آخر تحديث للإحصائيات التفصيلية" value={dateLabel(data.database?.latestFinalStatsUpdatedAt)} />
              <DetailRow label="آخر تحديث عام" value={dateLabel(data.summary?.latestUpdatedAt || data.database?.latestUpdatedAt)} />
            </div>
          </Section>
        </>
      ) : null}
    </main>
  );
}
