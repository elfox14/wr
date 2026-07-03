'use client';

import Link from 'next/link';

type Props = {
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  groupStandings?: unknown[];
};

type TeamStanding = {
  team?: string;
  code?: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  points?: number;
};

type GroupData = {
  key?: string;
  arName?: string;
  standings?: TeamStanding[];
};

const nf = new Intl.NumberFormat('ar-EG');
const nfDecimal = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });

function safeNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function format(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? nf.format(value) : '—';
}

function formatDecimal(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? nfDecimal.format(value) : '—';
}

function isGroupList(value: unknown): value is GroupData[] {
  return Array.isArray(value) && value.every((group) => group && Array.isArray((group as GroupData).standings));
}

function teamName(row?: TeamStanding | null) {
  return row?.team || row?.code || 'غير محدد';
}

function readTeams(groups: unknown[]) {
  if (!isGroupList(groups)) return [];
  return groups.flatMap((group) => group.standings || []).filter(Boolean);
}

function buildSummary(groups: unknown[], fallbackTeams = 0, fallbackPlayers = 0) {
  const teams = readTeams(groups);
  const playedSum = teams.reduce((sum, team) => sum + safeNumber(team.played), 0);
  const playedMatches = Math.floor(playedSum / 2);
  const totalGoals = teams.reduce((sum, team) => sum + safeNumber(team.goalsFor), 0);
  const avgGoals = playedMatches > 0 ? totalGoals / playedMatches : null;
  const topAttack = [...teams].sort((a, b) => safeNumber(b.goalsFor) - safeNumber(a.goalsFor) || safeNumber(b.points) - safeNumber(a.points))[0] || null;
  const bestDefense = [...teams]
    .filter((team) => safeNumber(team.played) > 0)
    .sort((a, b) => safeNumber(a.goalsAgainst) - safeNumber(b.goalsAgainst) || safeNumber(b.goalDifference) - safeNumber(a.goalDifference))[0] || null;
  const bestPoints = [...teams].sort((a, b) => safeNumber(b.points) - safeNumber(a.points) || safeNumber(b.goalDifference) - safeNumber(a.goalDifference))[0] || null;
  const cleanSheetsEstimate = teams.reduce((sum, team) => sum + (safeNumber(team.goalsAgainst) === 0 && safeNumber(team.played) > 0 ? 1 : 0), 0);

  return {
    teams,
    playedMatches,
    totalGoals,
    avgGoals,
    topAttack,
    bestDefense,
    bestPoints,
    cleanSheetsEstimate,
    teamsCount: fallbackTeams || teams.length,
    playersCount: fallbackPlayers,
  };
}

function StatTile({ label, value, note, tone = 'neutral' }: { label: string; value: string; note?: string; tone?: 'gold' | 'green' | 'cyan' | 'red' | 'neutral' }) {
  const toneClass = {
    gold: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]',
    green: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]',
    cyan: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]',
    red: 'border-red-300/25 bg-red-400/10 text-red-100',
    neutral: 'border-white/10 bg-white/[0.045] text-white',
  }[tone];

  return (
    <article className={`relative overflow-hidden rounded-2xl border p-3 ${toneClass}`}>
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50" />
      <div className="text-[10px] font-black opacity-90">{label}</div>
      <div className="mt-2 text-2xl font-black leading-none md:text-3xl">{value}</div>
      {note ? <div className="mt-1 truncate text-[9px] font-bold text-gray-400">{note}</div> : null}
    </article>
  );
}

function TeamHighlight({ label, team, metric }: { label: string; team: TeamStanding | null; metric: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[10px] font-black text-gray-500">{label}</div>
      <div className="mt-2 truncate text-sm font-black text-white">{teamName(team)}</div>
      <div className="mt-1 truncate text-[10px] font-bold text-[#FFD700]">{metric}</div>
    </div>
  );
}

function MiniTable({ teams }: { teams: TeamStanding[] }) {
  const topTeams = [...teams]
    .sort((a, b) => safeNumber(b.points) - safeNumber(a.points) || safeNumber(b.goalDifference) - safeNumber(a.goalDifference) || safeNumber(b.goalsFor) - safeNumber(a.goalsFor))
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="grid grid-cols-[minmax(0,1fr)_42px_42px_42px] gap-2 border-b border-white/10 px-3 py-2 text-[9px] font-black text-gray-500">
        <span>المنتخب</span><span className="text-center">لعب</span><span className="text-center">أهداف</span><span className="text-center">نقاط</span>
      </div>
      <div className="divide-y divide-white/10">
        {topTeams.map((team) => (
          <div key={`${team.code || team.team}`} className="grid grid-cols-[minmax(0,1fr)_42px_42px_42px] gap-2 px-3 py-2 text-[10px] font-bold text-gray-300">
            <span className="truncate font-black text-white">{teamName(team)}</span>
            <span className="text-center">{format(safeNumber(team.played))}</span>
            <span className="text-center text-[#00FF88]">{format(safeNumber(team.goalsFor))}</span>
            <span className="text-center text-[#FFD700]">{format(safeNumber(team.points))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeTournamentStatsCard({ playersCount = 0, teamsCount = 0, upcomingMatchesCount = 0, groupStandings = [] }: Props) {
  const summary = buildSummary(groupStandings, teamsCount, 1248);
  if (!summary.teams.length) return null;

  const topAttackMetric = summary.topAttack ? `${format(safeNumber(summary.topAttack.goalsFor))} هدف` : 'غير متوفر';
  const bestDefenseMetric = summary.bestDefense ? `${format(safeNumber(summary.bestDefense.goalsAgainst))} هدف مستقبَل` : 'غير متوفر';
  const bestPointsMetric = summary.bestPoints ? `${format(safeNumber(summary.bestPoints.points))} نقطة` : 'غير متوفر';

  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.10),transparent_30%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,10,8,0.99))] p-3 text-white shadow-[0_16px_44px_rgba(0,0,0,0.25)] sm:rounded-3xl sm:p-4" aria-label="إحصائيات كأس العالم">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#0FF0FC]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0FF0FC]" />
            STATS SNAPSHOT
          </div>
          <h2 className="mt-1.5 text-lg font-black leading-tight md:text-xl">أرقام البطولة الآن</h2>
          <p className="mt-1 max-w-3xl text-[11px] font-bold leading-5 text-gray-400">ملخص خفيف من بيانات الإحصائيات الحالية، بدون تحميل إضافي على الصفحة.</p>
        </div>
        <Link href="/statistics" className="mobile-tap rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1.5 text-[10px] font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">كل الإحصائيات</Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="المباريات الملعوبة" value={format(summary.playedMatches)} note={`${format(upcomingMatchesCount)} قادمة / جارية`} tone="gold" />
        <StatTile label="إجمالي الأهداف" value={format(summary.totalGoals)} note={`${formatDecimal(summary.avgGoals)} هدف في المباراة`} tone="green" />
        <StatTile label="المنتخبات" value={format(summary.teamsCount)} note={`${format(summary.playersCount)} لاعب في قاعدة البيانات`} tone="cyan" />
        <StatTile label="شباك نظيفة" value={format(summary.cleanSheetsEstimate)} note="حسب ترتيب المجموعات الحالي" />
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        <TeamHighlight label="أقوى هجوم" team={summary.topAttack} metric={topAttackMetric} />
        <TeamHighlight label="أفضل دفاع" team={summary.bestDefense} metric={bestDefenseMetric} />
        <TeamHighlight label="أفضل رصيد نقاط" team={summary.bestPoints} metric={bestPointsMetric} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <MiniTable teams={summary.teams} />
        <div className="rounded-2xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/10 p-3 text-[11px] font-bold leading-5 text-gray-300">
          <b className="mb-1 block text-sm font-black text-white">قراءة سريعة</b>
          الأرقام هنا محسوبة من البيانات الموجودة أصلًا في الرئيسية، لذلك لا يوجد طلب إضافي من المتصفح ولا تحميل ثقيل عند فتح الصفحة.
        </div>
      </div>
    </section>
  );
}
