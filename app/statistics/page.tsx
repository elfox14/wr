import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

export const revalidate = 300;

export const metadata = {
  title: 'إحصائيات كأس العالم 2026 | الأهداف، المنتخبات واللاعبون',
  description: 'لوحة إحصائيات كأس العالم 2026: أرقام البطولة، ترتيب المنتخبات، الهدافون، صناعة اللعب، التسديدات، الحراس والانضباط.',
};

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'PEN_LIVE'];
const nf = new Intl.NumberFormat('ar-EG');
const nfDecimal = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
const nfPercent = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });

type TeamLite = { id: string; name: string; code: string | null; image: string | null };
type TeamStats = TeamLite & {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  yellowCards: number;
  redCards: number;
  possessionTotal: number;
  possessionCount: number;
};

type PlayerStats = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  teamName: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  ratingTotal: number;
  ratingCount: number;
};

type MatchRow = {
  id: string;
  date: Date;
  stage: string | null;
  status: string | null;
  homeScore: number;
  awayScore: number;
  totalGoals: number;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
};

function statusKind(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (FINISHED.includes(raw)) return 'finished';
  if (LIVE.includes(raw)) return 'live';
  return 'scheduled';
}

function num(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? nf.format(value) : '—';
}

function decimal(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? nfDecimal.format(value) : '—';
}

function percent(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${nfPercent.format(value)}%` : '—';
}

function safe(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function teamDisplayName(team?: { name?: string | null; code?: string | null } | null) {
  return team ? getArabicTeamName(team.code || null, team.name || '') : '—';
}

function playerDisplayName(player?: { name?: string | null; code?: string | null } | null) {
  return player?.name || player?.code || '—';
}

function flagFor(team?: { name?: string | null; code?: string | null; image?: string | null } | null, width = 96) {
  if (!team) return null;
  const name = teamDisplayName(team);
  return getTeamFlagUrl({ code: team.code || null, name, image: null }, width) || team.image || null;
}

function short(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function stageLabel(stage?: string | null) {
  const raw = String(stage || '').toLowerCase();
  if (raw.includes('round') || raw.includes('32')) return 'دور الـ٣٢';
  if (raw.includes('16')) return 'دور الـ١٦';
  if (raw.includes('quarter')) return 'ربع النهائي';
  if (raw.includes('semi')) return 'نصف النهائي';
  if (raw.includes('final')) return 'النهائي';
  return 'دور المجموعات';
}

function teamSlug(team: TeamLite) {
  return team.code ? `/teams/team-${team.code.toLowerCase()}` : '/teams';
}

function makeTeamRow(team: TeamLite): TeamStats {
  return {
    ...team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    cleanSheets: 0,
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    yellowCards: 0,
    redCards: 0,
    possessionTotal: 0,
    possessionCount: 0,
  };
}

function addResult(row: TeamStats, goalsFor: number, goalsAgainst: number) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsAgainst === 0) row.cleanSheets += 1;
  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

function teamComparator(a: TeamStats, b: TeamStats) {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst;
}

function metricPer90(value: number, minutes: number) {
  return minutes > 0 ? (value / minutes) * 90 : null;
}

function playerRating(player: PlayerStats) {
  return player.ratingCount > 0 ? player.ratingTotal / player.ratingCount : null;
}

function topBy<T>(rows: T[], picker: (item: T) => number, limit = 8) {
  return [...rows].sort((a, b) => picker(b) - picker(a)).slice(0, limit);
}

async function loadStatistics() {
  const [matches, latestSnapshotsRaw, performances, teamsCount, playersCount] = await Promise.all([
    prisma.match.findMany({
      select: {
        id: true,
        status: true,
        stage: true,
        groupPhase: true,
        matchDate: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true } },
      },
      orderBy: { matchDate: 'asc' },
    }),
    prisma.matchStatsSnapshot.findMany({
      select: {
        matchId: true,
        capturedAt: true,
        homePossession: true,
        awayPossession: true,
        homeShots: true,
        awayShots: true,
        homeShotsOnTarget: true,
        awayShotsOnTarget: true,
        homeCorners: true,
        awayCorners: true,
        homeYellowCards: true,
        awayYellowCards: true,
        homeRedCards: true,
        awayRedCards: true,
      },
      orderBy: { capturedAt: 'desc' },
    }),
    prisma.playerPerformance.findMany({
      select: {
        minutes: true,
        goals: true,
        assists: true,
        shotsTotal: true,
        shotsOnTarget: true,
        keyPasses: true,
        tackles: true,
        interceptions: true,
        saves: true,
        goalsConceded: true,
        yellowCards: true,
        redCards: true,
        apiRating: true,
        internalRating: true,
        updatedAt: true,
        asset: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
            team: { select: { name: true, code: true, image: true } },
          },
        },
      },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
  ]);

  const latestSnapshots = new Map<string, (typeof latestSnapshotsRaw)[number]>();
  for (const snapshot of latestSnapshotsRaw) {
    if (!latestSnapshots.has(snapshot.matchId)) latestSnapshots.set(snapshot.matchId, snapshot);
  }

  const teamMap = new Map<string, TeamStats>();
  function teamRow(team: TeamLite) {
    if (!teamMap.has(team.id)) teamMap.set(team.id, makeTeamRow(team));
    return teamMap.get(team.id)!;
  }

  const matchRows: MatchRow[] = matches.map((match) => ({
    id: match.id,
    date: match.matchDate,
    stage: match.stage || match.groupPhase,
    status: match.status,
    homeScore: safe(match.homeScore),
    awayScore: safe(match.awayScore),
    totalGoals: safe(match.homeScore) + safe(match.awayScore),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
  }));

  const finishedMatches = matchRows.filter((match) => statusKind(match.status) === 'finished');
  const liveMatches = matchRows.filter((match) => statusKind(match.status) === 'live');
  const scheduledMatches = matchRows.filter((match) => statusKind(match.status) === 'scheduled');

  for (const match of finishedMatches) {
    const home = teamRow(match.homeTeam);
    const away = teamRow(match.awayTeam);
    addResult(home, match.homeScore, match.awayScore);
    addResult(away, match.awayScore, match.homeScore);

    const snapshot = latestSnapshots.get(match.id);
    if (snapshot) {
      home.shots += safe(snapshot.homeShots);
      away.shots += safe(snapshot.awayShots);
      home.shotsOnTarget += safe(snapshot.homeShotsOnTarget);
      away.shotsOnTarget += safe(snapshot.awayShotsOnTarget);
      home.corners += safe(snapshot.homeCorners);
      away.corners += safe(snapshot.awayCorners);
      home.yellowCards += safe(snapshot.homeYellowCards);
      away.yellowCards += safe(snapshot.awayYellowCards);
      home.redCards += safe(snapshot.homeRedCards);
      away.redCards += safe(snapshot.awayRedCards);
      if (snapshot.homePossession !== null && snapshot.homePossession !== undefined) {
        home.possessionTotal += safe(snapshot.homePossession);
        home.possessionCount += 1;
      }
      if (snapshot.awayPossession !== null && snapshot.awayPossession !== undefined) {
        away.possessionTotal += safe(snapshot.awayPossession);
        away.possessionCount += 1;
      }
    }
  }

  const playerMap = new Map<string, PlayerStats>();
  for (const performance of performances) {
    const asset = performance.asset;
    if (!playerMap.has(asset.id)) {
      playerMap.set(asset.id, {
        id: asset.id,
        name: asset.name,
        code: asset.code,
        image: asset.image,
        teamName: asset.team ? teamDisplayName(asset.team) : performance.asset.team?.name || '—',
        minutes: 0,
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        tackles: 0,
        interceptions: 0,
        saves: 0,
        goalsConceded: 0,
        yellowCards: 0,
        redCards: 0,
        ratingTotal: 0,
        ratingCount: 0,
      });
    }
    const row = playerMap.get(asset.id)!;
    row.minutes += safe(performance.minutes);
    row.goals += safe(performance.goals);
    row.assists += safe(performance.assists);
    row.shots += safe(performance.shotsTotal);
    row.shotsOnTarget += safe(performance.shotsOnTarget);
    row.keyPasses += safe(performance.keyPasses);
    row.tackles += safe(performance.tackles);
    row.interceptions += safe(performance.interceptions);
    row.saves += safe(performance.saves);
    row.goalsConceded += safe(performance.goalsConceded);
    row.yellowCards += safe(performance.yellowCards);
    row.redCards += safe(performance.redCards);
    const rating = Number(performance.apiRating ?? performance.internalRating ?? 0);
    if (Number.isFinite(rating) && rating > 0) {
      row.ratingTotal += rating;
      row.ratingCount += 1;
    }
  }

  const teams = [...teamMap.values()].sort(teamComparator);
  const players = [...playerMap.values()];
  const totalGoals = finishedMatches.reduce((sum, match) => sum + match.totalGoals, 0);
  const totalShots = teams.reduce((sum, team) => sum + team.shots, 0);
  const totalShotsOnTarget = teams.reduce((sum, team) => sum + team.shotsOnTarget, 0);
  const totalCorners = teams.reduce((sum, team) => sum + team.corners, 0);
  const yellowCards = teams.reduce((sum, team) => sum + team.yellowCards, 0);
  const redCards = teams.reduce((sum, team) => sum + team.redCards, 0);
  const cleanSheets = teams.reduce((sum, team) => sum + team.cleanSheets, 0);
  const possessionTeams = teams.filter((team) => team.possessionCount > 0);
  const averagePossession = possessionTeams.length ? possessionTeams.reduce((sum, team) => sum + team.possessionTotal / team.possessionCount, 0) / possessionTeams.length : null;
  const updatedAt = latestSnapshotsRaw[0]?.capturedAt || performances[0]?.updatedAt || new Date();

  return {
    totalMatches: matches.length,
    finishedMatches: finishedMatches.length,
    liveMatches: liveMatches.length,
    scheduledMatches: scheduledMatches.length,
    teamsCount,
    playersCount,
    totalGoals,
    averageGoals: finishedMatches.length ? totalGoals / finishedMatches.length : null,
    totalShots,
    totalShotsOnTarget,
    shotAccuracy: totalShots ? (totalShotsOnTarget / totalShots) * 100 : null,
    totalCorners,
    yellowCards,
    redCards,
    cleanSheets,
    averagePossession,
    updatedAt,
    teams,
    players,
    topAttack: topBy(teams, (team) => team.goalsFor, 1)[0] || null,
    bestDefense: [...teams].filter((team) => team.played > 0).sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.cleanSheets - a.cleanSheets)[0] || null,
    mostShotsTeam: topBy(teams, (team) => team.shots, 1)[0] || null,
    bestPossessionTeam: [...teams].filter((team) => team.possessionCount > 0).sort((a, b) => (b.possessionTotal / b.possessionCount) - (a.possessionTotal / a.possessionCount))[0] || null,
    topScorers: topBy(players, (player) => player.goals, 8),
    topAssists: topBy(players, (player) => player.assists, 8),
    topCreators: topBy(players, (player) => player.keyPasses, 8),
    topShooters: topBy(players, (player) => player.shots, 8),
    topSaves: topBy(players, (player) => player.saves, 8),
    topCards: topBy(players, (player) => player.yellowCards + player.redCards * 2, 8),
    topMatches: [...finishedMatches].sort((a, b) => b.totalGoals - a.totalGoals || b.date.getTime() - a.date.getTime()).slice(0, 8),
    recentMatches: [...finishedMatches].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8),
  };
}

function StatCard({ label, value, note, tone = 'neutral' }: { label: string; value: string; note?: string; tone?: 'neutral' | 'gold' | 'green' | 'cyan' | 'red' }) {
  const toneClass = {
    neutral: 'border-white/10 bg-white/[0.045] text-white',
    gold: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]',
    green: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]',
    cyan: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]',
    red: 'border-red-300/25 bg-red-400/10 text-red-100',
  }[tone];
  return (
    <article className={`relative overflow-hidden rounded-3xl border p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22)] ${toneClass}`}>
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-60" />
      <p className="text-[11px] font-black text-current/85">{label}</p>
      <b className="mt-3 block text-3xl font-black leading-none md:text-4xl">{value}</b>
      {note ? <p className="mt-2 text-[11px] font-bold text-gray-400">{note}</p> : null}
    </article>
  );
}

function TeamIdentity({ team, compact = false }: { team: { name: string; code: string | null; image: string | null }; compact?: boolean }) {
  const name = teamDisplayName(team);
  const flag = flagFor(team, 80);
  return (
    <div className="flex min-w-0 items-center gap-2">
      {flag ? <img src={flag} alt={`علم ${name}`} className={`${compact ? 'h-7 w-9' : 'h-9 w-12'} shrink-0 rounded-lg border border-white/10 object-cover`} loading="lazy" /> : <span className={`${compact ? 'h-7 w-9' : 'h-9 w-12'} shrink-0 rounded-lg border border-white/10 bg-white/10`} />}
      <span className="team-name-full min-w-0 truncate font-black text-white">{name}</span>
    </div>
  );
}

function PlayerIdentity({ player }: { player: PlayerStats }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {player.image ? <img src={player.image} alt={playerDisplayName(player)} className="h-9 w-9 shrink-0 rounded-xl border border-white/10 object-cover" loading="lazy" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-[10px] font-black text-[#FFD700]">{playerDisplayName(player).slice(0, 2)}</span>}
      <span className="min-w-0">
        <b className="block truncate text-sm font-black text-white">{playerDisplayName(player)}</b>
        <span className="block truncate text-[10px] font-bold text-gray-500">{player.teamName}</span>
      </span>
    </div>
  );
}

function FeatureTeamCard({ title, team, metric }: { title: string; team: TeamStats | null; metric: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[11px] font-black text-gray-400">{title}</p>
      {team ? <div className="mt-3"><TeamIdentity team={team} /><p className="mt-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700]">{metric}</p></div> : <p className="mt-4 text-sm font-bold text-gray-500">غير متوفر حاليًا</p>}
    </article>
  );
}

function SectionTitle({ id, kicker, title, description }: { id: string; kicker: string; title: string; description: string }) {
  return (
    <header id={id} className="scroll-mt-24">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">{kicker}</p>
      <h2 className="mt-2 text-xl font-black text-white md:text-2xl">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm font-bold leading-6 text-gray-400">{description}</p>
    </header>
  );
}

function TeamTable({ teams }: { teams: TeamStats[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-right text-xs">
          <thead className="bg-white/[0.05] text-[10px] font-black text-gray-400">
            <tr><th className="px-4 py-3">المنتخب</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th><th>تسديدات</th><th>على المرمى</th><th>استحواذ</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {teams.slice(0, 16).map((team, index) => {
              const possession = team.possessionCount ? team.possessionTotal / team.possessionCount : null;
              return (
                <tr key={team.id} className="transition hover:bg-white/[0.04]">
                  <td className="px-4 py-3"><Link href={teamSlug(team)} className="flex items-center gap-3"><span className="w-5 text-center text-[10px] font-black text-gray-500">{nf.format(index + 1)}</span><TeamIdentity team={team} compact /></Link></td>
                  <td>{num(team.played)}</td><td>{num(team.won)}</td><td>{num(team.drawn)}</td><td>{num(team.lost)}</td><td>{num(team.goalsFor)}</td><td>{num(team.goalsAgainst)}</td><td>{num(team.goalDifference)}</td><td className="font-black text-[#FFD700]">{num(team.points)}</td><td>{num(team.shots)}</td><td>{num(team.shotsOnTarget)}</td><td>{percent(possession)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRanking({ title, players, metricLabel, value }: { title: string; players: PlayerStats[]; metricLabel: string; value: (player: PlayerStats) => number | null }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="text-sm font-black text-white">{title}</h3>
      <div className="mt-3 space-y-2">
        {players.slice(0, 6).map((player, index) => (
          <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
            <div className="flex min-w-0 items-center gap-2"><span className="w-5 text-center text-[10px] font-black text-gray-500">{nf.format(index + 1)}</span><PlayerIdentity player={player} /></div>
            <div className="shrink-0 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-center text-[10px] font-black text-[#FFD700]"><b className="block text-base leading-none">{num(value(player))}</b><span>{metricLabel}</span></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function MatchTable({ matches }: { matches: MatchRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-right text-xs">
          <thead className="bg-white/[0.05] text-[10px] font-black text-gray-400"><tr><th className="px-4 py-3">المباراة</th><th>الدور</th><th>النتيجة</th><th>الأهداف</th><th>التاريخ</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {matches.map((match) => (
              <tr key={match.id} className="transition hover:bg-white/[0.04]">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><TeamIdentity team={match.homeTeam} compact /><span className="text-[10px] font-black text-gray-500">ضد</span><TeamIdentity team={match.awayTeam} compact /></div></td>
                <td>{stageLabel(match.stage)}</td><td className="font-black text-white">{num(match.homeScore)} - {num(match.awayScore)}</td><td className="text-[#FFD700] font-black">{num(match.totalGoals)}</td><td>{new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short' }).format(match.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function StatisticsPage() {
  const data = await loadStatistics();
  const completion = data.totalMatches ? (data.finishedMatches / data.totalMatches) * 100 : null;
  const topAttackMetric = data.topAttack ? `${num(data.topAttack.goalsFor)} هدف · ${num(data.topAttack.shots)} تسديدة` : '—';
  const bestDefenseMetric = data.bestDefense ? `${num(data.bestDefense.goalsAgainst)} هدف مستقبَل · ${num(data.bestDefense.cleanSheets)} شباك نظيفة` : '—';
  const possessionMetric = data.bestPossessionTeam && data.bestPossessionTeam.possessionCount ? `${percent(data.bestPossessionTeam.possessionTotal / data.bestPossessionTeam.possessionCount)} استحواذ` : '—';
  const updatedLabel = new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(data.updatedAt);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-7 px-3 py-5 text-white sm:px-4 lg:px-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_32%),linear-gradient(135deg,#061313,#050505)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
        <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-[#FFD700]/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#FFD700]">WORLD CUP DATA CENTER</p>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">إحصائيات كأس العالم 2026</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-gray-400">لوحة تحليلية تجمع أرقام البطولة، أداء المنتخبات، ترتيب اللاعبين، إحصائيات المباريات والانضباط في مكان واحد.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-gray-300">
            <div className="text-[10px] font-black text-gray-500">آخر تحديث</div>
            <div className="mt-1 text-lg font-black text-white">{updatedLabel}</div>
            <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${Math.min(100, completion || 0)}%` }} /></div>
            <div className="mt-1 text-[10px] text-gray-500">اكتمال المباريات: {percent(completion)}</div>
          </div>
        </div>
      </section>

      <nav className="sticky top-2 z-20 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-black/65 p-2 backdrop-blur-xl">
        {[['#overview', 'نظرة عامة'], ['#teams', 'المنتخبات'], ['#players', 'اللاعبون'], ['#matches', 'المباريات'], ['#discipline', 'الانضباط']].map(([href, label]) => <a key={href} href={href} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-gray-300 transition hover:border-[#FFD700]/30 hover:text-[#FFD700]">{label}</a>)}
      </nav>

      <section id="overview" className="scroll-mt-24 space-y-4">
        <SectionTitle id="overview-title" kicker="OVERVIEW" title="نظرة عامة على البطولة" description="ملخص سريع لأهم أرقام البطولة حتى الآن، مع مؤشرات هجومية وفنية تساعد القارئ على فهم شكل المنافسة." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="المباريات المنتهية" value={`${num(data.finishedMatches)} / ${num(data.totalMatches)}`} note={`${num(data.liveMatches)} مباشر · ${num(data.scheduledMatches)} قادمة`} tone="gold" />
          <StatCard label="إجمالي الأهداف" value={num(data.totalGoals)} note={`${decimal(data.averageGoals)} هدف في المباراة`} tone="green" />
          <StatCard label="إجمالي التسديدات" value={num(data.totalShots)} note={`${percent(data.shotAccuracy)} دقة على المرمى`} tone="cyan" />
          <StatCard label="الركنيات" value={num(data.totalCorners)} note={`${num(data.cleanSheets)} شباك نظيفة`} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FeatureTeamCard title="أقوى هجوم" team={data.topAttack} metric={topAttackMetric} />
          <FeatureTeamCard title="أفضل دفاع" team={data.bestDefense} metric={bestDefenseMetric} />
          <FeatureTeamCard title="الأكثر استحواذًا" team={data.bestPossessionTeam} metric={possessionMetric} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle id="teams" kicker="TEAMS" title="ترتيب المنتخبات بالأرقام" description="جدول يجمع النتائج والأهداف والنقاط مع المؤشرات الفنية الأساسية لكل منتخب." />
        <TeamTable teams={data.teams} />
      </section>

      <section className="space-y-4">
        <SectionTitle id="players" kicker="PLAYERS" title="أبرز اللاعبين" description="قوائم مختصرة لأهم اللاعبين حسب التسجيل، الصناعة، التسديد، صناعة الفرص، التصديات والانضباط." />
        <div className="grid gap-3 lg:grid-cols-2">
          <PlayerRanking title="الهدافون" players={data.topScorers} metricLabel="هدف" value={(player) => player.goals} />
          <PlayerRanking title="صناعة الأهداف" players={data.topAssists} metricLabel="أسيست" value={(player) => player.assists} />
          <PlayerRanking title="الأكثر تسديدًا" players={data.topShooters} metricLabel="تسديدة" value={(player) => player.shots} />
          <PlayerRanking title="صناعة الفرص" players={data.topCreators} metricLabel="تمريرة مفتاحية" value={(player) => player.keyPasses} />
          <PlayerRanking title="الحراس" players={data.topSaves} metricLabel="تصدي" value={(player) => player.saves} />
          <PlayerRanking title="الأعلى تقييمًا" players={[...data.players].sort((a, b) => (playerRating(b) || 0) - (playerRating(a) || 0)).slice(0, 8)} metricLabel="تقييم" value={(player) => playerRating(player)} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle id="matches" kicker="MATCHES" title="إحصائيات المباريات" description="أكثر المباريات غزارة تهديفية وآخر النتائج المكتملة في البطولة." />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3"><h3 className="text-sm font-black text-white">أكثر المباريات أهدافًا</h3><MatchTable matches={data.topMatches} /></div>
          <div className="space-y-3"><h3 className="text-sm font-black text-white">آخر النتائج</h3><MatchTable matches={data.recentMatches} /></div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle id="discipline" kicker="DISCIPLINE" title="الانضباط والبطاقات" description="مؤشرات البطاقات والالتحامات الدفاعية تساعد على قراءة الجانب البدني والانضباطي في البطولة." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="البطاقات الصفراء" value={num(data.yellowCards)} tone="gold" />
          <StatCard label="البطاقات الحمراء" value={num(data.redCards)} tone="red" />
          <StatCard label="دقة التسديد" value={percent(data.shotAccuracy)} note={`${num(data.totalShotsOnTarget)} على المرمى`} tone="cyan" />
          <StatCard label="متوسط الاستحواذ" value={percent(data.averagePossession)} note="متوسط المنتخبات المتاحة" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <PlayerRanking title="الأكثر حصولًا على بطاقات" players={data.topCards} metricLabel="نقطة انضباط" value={(player) => player.yellowCards + player.redCards * 2} />
          <PlayerRanking title="أكثر تدخلات دفاعية" players={topBy(data.players, (player) => player.tackles + player.interceptions, 8)} metricLabel="تدخل/اعتراض" value={(player) => player.tackles + player.interceptions} />
        </div>
      </section>
    </main>
  );
}
