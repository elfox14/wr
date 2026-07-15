import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';
import LiveOnlyRefresh from '@/components/LiveOnlyRefresh';
import {
  dedupeStatisticsPlayers,
  ensureStatisticsEventPlayer,
  normalizeStatisticsPlayerText,
  type StatisticsPlayerRow as PlayerStats,
} from '@/lib/statisticsPlayerDedupe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'إحصائيات كأس العالم 2026 | الأهداف، المنتخبات واللاعبون',
  description: 'لوحة إحصائيات كأس العالم 2026: أرقام البطولة، ترتيب المنتخبات، الهدافون، صناعة اللعب، التسديدات، الحراس والانضباط.',
};

const LIVE_STATS_CACHE_SECONDS = 30;
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'ET', 'BT', 'P', 'PEN_LIVE'];
const SCHEDULED = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

const nf = new Intl.NumberFormat('ar-EG');
const nfDecimal = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
const nfPercent = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });

type TeamLite = { id: string; name: string; code: string | null; image: string | null };
type Penalties = { home: number; away: number };
type MatchRow = {
  id: string;
  date: Date;
  stage: string | null;
  status: string | null;
  homeScore: number;
  awayScore: number;
  totalGoals: number;
  penalties: Penalties | null;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
};
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
type CanonicalSource = {
  id: string;
  externalId?: string | null;
  syncSource?: string | null;
  stage?: string | null;
  groupPhase?: string | null;
  lastSyncedAt?: Date | string | null;
  matchDate: Date;
  homeTeam: { id: string };
  awayTeam: { id: string };
};
type SnapshotLite = {
  matchId: string;
  provider: string;
  capturedAt: Date;
  homePossession: number | null;
  awayPossession: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  homeYellowCards: number | null;
  awayYellowCards: number | null;
  homeRedCards: number | null;
  awayRedCards: number | null;
};

function upper(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}
function statusKind(status?: string | null) {
  const raw = upper(status);
  if (FINISHED.includes(raw)) return 'finished' as const;
  if (LIVE.includes(raw)) return 'live' as const;
  if (SCHEDULED.includes(raw)) return 'scheduled' as const;
  return 'scheduled' as const;
}
function isLive(status?: string | null) { return statusKind(status) === 'live'; }
function num(value: number | null | undefined) { return typeof value === 'number' && Number.isFinite(value) ? nf.format(value) : '—'; }
function decimal(value: number | null | undefined) { return typeof value === 'number' && Number.isFinite(value) ? nfDecimal.format(value) : '—'; }
function percent(value: number | null | undefined) { return typeof value === 'number' && Number.isFinite(value) ? `${nfPercent.format(value)}%` : '—'; }
function safe(value: unknown) { const number = Number(value ?? 0); return Number.isFinite(number) ? number : 0; }
function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(parsed) ? parsed : null;
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function safeDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}
function formatDate(value: Date | string | null | undefined) {
  const date = safeDate(value) || new Date();
  return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}
function penaltiesFromExternalIds(value: unknown): Penalties | null {
  const external = asRecord(value);
  const penalties = asRecord(external?.penalties) || asRecord(external?.penaltyScore) || asRecord(external?.pens);
  const home = numberOrNull(penalties?.home ?? penalties?.Home ?? penalties?.homeTeam ?? penalties?.HomeTeam);
  const away = numberOrNull(penalties?.away ?? penalties?.Away ?? penalties?.awayTeam ?? penalties?.AwayTeam);
  return home !== null && away !== null ? { home, away } : null;
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
function teamSlug(team: TeamLite) { return `/teams/${encodeURIComponent(team.id)}`; }
function stageLabel(stage?: string | null) {
  const raw = String(stage || '').toLowerCase();
  if (raw.includes('third')) return 'المركز الثالث';
  if (raw.includes('semi')) return 'نصف النهائي';
  if (raw.includes('quarter')) return 'ربع النهائي';
  if (raw.includes('16') || raw.includes('last_16') || raw.includes('r16')) return 'دور الـ١٦';
  if (raw.includes('32') || raw.includes('last_32') || raw.includes('r32')) return 'دور الـ٣٢';
  if (raw.includes('final')) return 'النهائي';
  return 'دور المجموعات';
}
function statusLabel(status?: string | null) {
  if (statusKind(status) === 'finished') return 'انتهت';
  if (isLive(status)) return upper(status) === 'HT' ? 'استراحة' : 'مباشر';
  return 'لم تبدأ';
}
function scoreLabel(match: MatchRow) {
  const base = `${num(match.homeScore)} - ${num(match.awayScore)}`;
  return match.penalties ? `${base} | ترجيح ${num(match.penalties.home)}-${num(match.penalties.away)}` : base;
}
function canonicalStage(match: CanonicalSource) {
  const raw = `${match.stage || ''} ${match.groupPhase || ''}`.toLowerCase();
  if (raw.includes('third')) return 'third_place';
  if (raw.includes('semi')) return 'semi_finals';
  if (raw.includes('quarter')) return 'quarter_finals';
  if (raw.includes('round_of_16') || raw.includes('last_16') || raw.includes('r16') || raw.includes('round of 16') || raw.includes('16')) return 'round_of_16';
  if (raw.includes('round_of_32') || raw.includes('last_32') || raw.includes('r32') || raw.includes('round of 32') || raw.includes('32')) return 'round_of_32';
  if (raw.includes('final')) return 'final';
  const group = raw.match(/group[_\s-]*([a-l])/i)?.[1] || raw.match(/المجموعة\s*([a-l])/i)?.[1] || raw || 'group';
  return `group_${String(group).toUpperCase()}`;
}
function canonicalKey(match: CanonicalSource) { return `${canonicalStage(match)}:${[match.homeTeam.id, match.awayTeam.id].sort().join('|')}`; }
function canonicalPriority(match: CanonicalSource) {
  const fifa = String(match.syncSource || '').toUpperCase().includes('FIFA') || String(match.externalId || '').toLowerCase().startsWith('fifa-');
  const syncedAt = match.lastSyncedAt ? new Date(match.lastSyncedAt).getTime() : 0;
  return (fifa ? 1_000_000_000_000_000 : 0) + (Number.isFinite(syncedAt) ? syncedAt : 0);
}
function canonicalizeMatches<T extends CanonicalSource>(matches: T[]) {
  const map = new Map<string, T>();
  for (const match of matches) {
    const key = canonicalKey(match);
    const current = map.get(key);
    if (!current || canonicalPriority(match) > canonicalPriority(current)) map.set(key, match);
  }
  return [...map.values()];
}
function makeTeamRow(team: TeamLite): TeamStats {
  return { ...team, played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, cleanSheets: 0, shots: 0, shotsOnTarget: 0, corners: 0, yellowCards: 0, redCards: 0, possessionTotal: 0, possessionCount: 0 };
}
function applyResult(row: TeamStats, goalsFor: number, goalsAgainst: number, result: 'win' | 'draw' | 'loss') {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsAgainst === 0) row.cleanSheets += 1;
  if (result === 'win') { row.won += 1; row.points += 3; }
  else if (result === 'draw') { row.drawn += 1; row.points += 1; }
  else row.lost += 1;
}
function addLiveGoals(row: TeamStats, goalsFor: number, goalsAgainst: number) {
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
}
function addSnapshotStats(row: TeamStats, stats: { shots: number; shotsOnTarget: number; corners: number; yellow: number; red: number; possession?: number | null }) {
  row.shots += stats.shots;
  row.shotsOnTarget += stats.shotsOnTarget;
  row.corners += stats.corners;
  row.yellowCards += stats.yellow;
  row.redCards += stats.red;
  if (stats.possession !== null && stats.possession !== undefined) {
    row.possessionTotal += stats.possession;
    row.possessionCount += 1;
  }
}
function winnerSide(match: MatchRow): 'home' | 'away' | 'draw' {
  if (match.homeScore > match.awayScore) return 'home';
  if (match.awayScore > match.homeScore) return 'away';
  if (match.penalties) {
    if (match.penalties.home > match.penalties.away) return 'home';
    if (match.penalties.away > match.penalties.home) return 'away';
  }
  return 'draw';
}
function teamComparator(a: TeamStats, b: TeamStats) {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst;
}
function topBy<T>(rows: T[], picker: (item: T) => number | null | undefined, limit = 8, positiveOnly = true) {
  return [...rows]
    .filter((item) => !positiveOnly || safe(picker(item)) > 0)
    .sort((a, b) => safe(picker(b)) - safe(picker(a)))
    .slice(0, limit);
}
function playerRating(player: PlayerStats) { return player.ratingCount > 0 ? player.ratingTotal / player.ratingCount : null; }
function snapshotScore(snapshot: SnapshotLite) {
  const direct = [snapshot.homeShots, snapshot.awayShots, snapshot.homeShotsOnTarget, snapshot.awayShotsOnTarget, snapshot.homePossession, snapshot.awayPossession, snapshot.homeCorners, snapshot.awayCorners].filter((value) => value !== null && value !== undefined).length;
  const providerBoost = String(snapshot.provider || '').startsWith('THE_STATS_API') ? 20 : 0;
  return direct * 2 + providerBoost;
}
function bestSnapshotsByMatch(snapshots: SnapshotLite[]) {
  const map = new Map<string, SnapshotLite>();
  for (const snapshot of snapshots) {
    const current = map.get(snapshot.matchId);
    if (!current) { map.set(snapshot.matchId, snapshot); continue; }
    const score = snapshotScore(snapshot);
    const currentScore = snapshotScore(current);
    if (score > currentScore || (score === currentScore && snapshot.capturedAt.getTime() > current.capturedAt.getTime())) map.set(snapshot.matchId, snapshot);
  }
  return map;
}
async function loadStatisticsUncached() {
  const [rawMatches, snapshots, performances, events, teamsCount, playersCount, totalSnapshots] = await Promise.all([
    prisma.match.findMany({
      select: {
        id: true,
        externalId: true,
        syncSource: true,
        status: true,
        stage: true,
        groupPhase: true,
        matchDate: true,
        homeScore: true,
        awayScore: true,
        externalIds: true,
        lastSyncedAt: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true } },
      },
      orderBy: { matchDate: 'asc' },
    }),
    prisma.matchStatsSnapshot.findMany({
      where: { provider: { startsWith: 'THE_STATS_API' } },
      select: {
        matchId: true,
        provider: true,
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
      where: {
        OR: [
          { goals: { gt: 0 } },
          { assists: { gt: 0 } },
          { shotsTotal: { gt: 0 } },
          { shotsOnTarget: { gt: 0 } },
          { keyPasses: { gt: 0 } },
          { tackles: { gt: 0 } },
          { interceptions: { gt: 0 } },
          { saves: { gt: 0 } },
          { yellowCards: { gt: 0 } },
          { redCards: { gt: 0 } },
          { apiRating: { not: null } },
        ],
      },
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
        asset: { select: { id: true, name: true, code: true, image: true, team: { select: { id: true, name: true, code: true, image: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.matchEvent.findMany({
      where: { type: { in: ['goal', 'yellow_card', 'red_card'] } },
      select: { matchId: true, type: true, playerName: true, teamId: true, sourceName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.matchStatsSnapshot.count({ where: { provider: { startsWith: 'THE_STATS_API' } } }),
  ]);

  const matches = canonicalizeMatches(rawMatches).sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());
  const canonicalMatchIds = new Set(matches.map((match) => match.id));
  const bestSnapshots = bestSnapshotsByMatch(snapshots as SnapshotLite[]);
  const matchRows: MatchRow[] = matches.map((match) => ({
    id: match.id,
    date: match.matchDate,
    stage: match.stage || match.groupPhase,
    status: match.status,
    homeScore: safe(match.homeScore),
    awayScore: safe(match.awayScore),
    totalGoals: safe(match.homeScore) + safe(match.awayScore),
    penalties: penaltiesFromExternalIds(match.externalIds),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
  }));

  const finishedRows = matchRows.filter((match) => statusKind(match.status) === 'finished');
  const liveRows = matchRows.filter((match) => statusKind(match.status) === 'live');
  const scheduledRows = matchRows.filter((match) => statusKind(match.status) === 'scheduled');
  const scoredRows = [...finishedRows, ...liveRows];
  const teamMap = new Map<string, TeamStats>();
  const teamNameById = new Map<string, string>();
  function teamRow(team: TeamLite) {
    teamNameById.set(team.id, teamDisplayName(team));
    if (!teamMap.has(team.id)) teamMap.set(team.id, makeTeamRow(team));
    return teamMap.get(team.id)!;
  }

  for (const match of finishedRows) {
    const home = teamRow(match.homeTeam);
    const away = teamRow(match.awayTeam);
    const winner = winnerSide(match);
    applyResult(home, match.homeScore, match.awayScore, winner === 'home' ? 'win' : winner === 'away' ? 'loss' : 'draw');
    applyResult(away, match.awayScore, match.homeScore, winner === 'away' ? 'win' : winner === 'home' ? 'loss' : 'draw');
  }
  for (const match of liveRows) {
    addLiveGoals(teamRow(match.homeTeam), match.homeScore, match.awayScore);
    addLiveGoals(teamRow(match.awayTeam), match.awayScore, match.homeScore);
  }
  for (const match of scoredRows) {
    const snapshot = bestSnapshots.get(match.id);
    if (!snapshot) continue;
    addSnapshotStats(teamRow(match.homeTeam), {
      shots: safe(snapshot.homeShots),
      shotsOnTarget: safe(snapshot.homeShotsOnTarget),
      corners: safe(snapshot.homeCorners),
      yellow: safe(snapshot.homeYellowCards),
      red: safe(snapshot.homeRedCards),
      possession: numberOrNull(snapshot.homePossession),
    });
    addSnapshotStats(teamRow(match.awayTeam), {
      shots: safe(snapshot.awayShots),
      shotsOnTarget: safe(snapshot.awayShotsOnTarget),
      corners: safe(snapshot.awayCorners),
      yellow: safe(snapshot.awayYellowCards),
      red: safe(snapshot.awayRedCards),
      possession: numberOrNull(snapshot.awayPossession),
    });
  }

  const playerMap = new Map<string, PlayerStats>();
  for (const performance of performances) {
    const asset = performance.asset;
    if (!playerMap.has(asset.id)) {
      playerMap.set(asset.id, { id: asset.id, name: asset.name, code: asset.code, image: asset.image, teamId: asset.team?.id || null, teamName: asset.team ? teamDisplayName(asset.team) : '—', minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, interceptions: 0, saves: 0, goalsConceded: 0, yellowCards: 0, redCards: 0, ratingTotal: 0, ratingCount: 0 });
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
    if (Number.isFinite(rating) && rating > 0) { row.ratingTotal += rating; row.ratingCount += 1; }
  }

  const shotmapGoalMatches = new Set(events.filter((event) => event.type === 'goal' && event.sourceName === 'THE_STATS_API_FINAL_SHOTMAP').map((event) => event.matchId));
  const eventPlayerStats = new Map<string, { name: string; teamId: string | null; teamName: string; goals: number; yellowCards: number; redCards: number }>();
  for (const event of events) {
    if (!event.playerName || !canonicalMatchIds.has(event.matchId)) continue;
    if (event.type === 'goal' && shotmapGoalMatches.has(event.matchId) && event.sourceName !== 'THE_STATS_API_FINAL_SHOTMAP') continue;
    const key = `event:${event.teamId || 'team'}:${normalizeStatisticsPlayerText(event.playerName)}`;
    const current = eventPlayerStats.get(key) || { name: event.playerName, teamId: event.teamId, teamName: teamNameById.get(event.teamId || '') || '—', goals: 0, yellowCards: 0, redCards: 0 };
    if (event.type === 'goal') current.goals += 1;
    if (event.type === 'yellow_card') current.yellowCards += 1;
    if (event.type === 'red_card') current.redCards += 1;
    eventPlayerStats.set(key, current);
  }
  for (const eventStat of eventPlayerStats.values()) {
    const row = ensureStatisticsEventPlayer(playerMap, eventStat);
    row.goals = Math.max(row.goals, eventStat.goals);
    row.yellowCards = Math.max(row.yellowCards, eventStat.yellowCards);
    row.redCards = Math.max(row.redCards, eventStat.redCards);
  }

  const teams = [...teamMap.values()].sort(teamComparator);
  const players = dedupeStatisticsPlayers([...playerMap.values()]);
  const totalGoals = scoredRows.reduce((sum, match) => sum + match.totalGoals, 0);
  const finishedGoals = finishedRows.reduce((sum, match) => sum + match.totalGoals, 0);
  const liveGoals = liveRows.reduce((sum, match) => sum + match.totalGoals, 0);
  const totalShots = teams.reduce((sum, team) => sum + team.shots, 0);
  const totalShotsOnTarget = teams.reduce((sum, team) => sum + team.shotsOnTarget, 0);
  const yellowCards = teams.reduce((sum, team) => sum + team.yellowCards, 0);
  const redCards = teams.reduce((sum, team) => sum + team.redCards, 0);
  const cleanSheets = teams.reduce((sum, team) => sum + team.cleanSheets, 0);
  const possessionTeams = teams.filter((team) => team.possessionCount > 0);
  const averagePossession = possessionTeams.length ? possessionTeams.reduce((sum, team) => sum + team.possessionTotal / team.possessionCount, 0) / possessionTeams.length : null;
  const latestSnapshotDate = snapshots[0]?.capturedAt || null;
  const latestPerformanceDate = performances.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null);
  const latestMatchSync = matches.map((match) => safeDate(match.lastSyncedAt)).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null;
  const updatedAt = [latestSnapshotDate, latestPerformanceDate, latestMatchSync]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] || new Date();

  return {
    totalMatches: matches.length,
    finishedMatchesCount: finishedRows.length,
    liveMatchesCount: liveRows.length,
    scheduledMatchesCount: scheduledRows.length,
    teamsCount,
    playersCount,
    playerPerformanceRows: performances.length,
    usefulSnapshotCount: bestSnapshots.size,
    totalSnapshots,
    totalGoals,
    finishedGoals,
    liveGoals,
    averageGoals: scoredRows.length ? totalGoals / scoredRows.length : null,
    totalShots,
    totalShotsOnTarget,
    shotAccuracy: totalShots ? (totalShotsOnTarget / totalShots) * 100 : null,
    yellowCards,
    redCards,
    cleanSheets,
    averagePossession,
    updatedAt,
    teams,
    topAttack: topBy(teams, (team) => team.goalsFor, 1, false)[0] || null,
    bestDefense: [...teams].filter((team) => team.played > 0).sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.cleanSheets - a.cleanSheets)[0] || null,
    bestPossessionTeam: [...teams].filter((team) => team.possessionCount > 0).sort((a, b) => (b.possessionTotal / b.possessionCount) - (a.possessionTotal / a.possessionCount))[0] || null,
    topScorers: topBy(players, (player) => player.goals, 8),
    topAssists: topBy(players, (player) => player.assists, 8),
    topCreators: topBy(players, (player) => player.keyPasses, 8),
    topShooters: topBy(players, (player) => player.shots, 8),
    topSaves: topBy(players, (player) => player.saves, 8),
    topCards: topBy(players, (player) => player.yellowCards + player.redCards * 2, 8),
    topRated: [...players].filter((player) => player.ratingCount > 0).sort((a, b) => safe(playerRating(b)) - safe(playerRating(a))).slice(0, 8),
    topDefenders: topBy(players, (player) => player.tackles + player.interceptions, 8),
    topMatches: [...finishedRows].sort((a, b) => b.totalGoals - a.totalGoals || b.date.getTime() - a.date.getTime()).slice(0, 8),
    recentMatches: [...finishedRows].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8),
    liveMatchRows: [...liveRows].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 8),
  };
}

const loadLiveStatistics = unstable_cache(loadStatisticsUncached, ['statistics-page-v7-live'], {
  revalidate: LIVE_STATS_CACHE_SECONDS,
  tags: ['statistics-page', 'home-dashboard'],
});
const loadIdleStatistics = unstable_cache(loadStatisticsUncached, ['statistics-page-v7-idle'], {
  revalidate: false,
  tags: ['statistics-page', 'home-dashboard'],
});

function StatCard({ label, value, note, tone = 'neutral' }: { label: string; value: string; note?: string; tone?: 'neutral' | 'gold' | 'green' | 'cyan' | 'red' }) {
  const toneClass = { neutral: 'border-white/10 bg-white/[0.045] text-white', gold: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]', green: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]', cyan: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]', red: 'border-red-300/25 bg-red-400/10 text-red-100' }[tone];
  return <article className={`relative overflow-hidden rounded-3xl border p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22)] ${toneClass}`}><div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-60" /><p className="text-[11px] font-black text-current/85">{label}</p><b className="mt-3 block text-3xl font-black leading-none md:text-4xl">{value}</b>{note ? <p className="mt-2 text-[11px] font-bold text-gray-400">{note}</p> : null}</article>;
}
function TeamIdentity({ team, compact = false }: { team: { id?: string; name: string; code: string | null; image: string | null }; compact?: boolean }) {
  const name = teamDisplayName(team);
  const flag = flagFor(team, 80);
  return <div className="flex min-w-0 items-center gap-2">{flag ? <img src={flag} alt={`علم ${name}`} className={`${compact ? 'h-7 w-9' : 'h-9 w-12'} shrink-0 rounded-lg border border-white/10 object-cover`} loading="lazy" /> : <span className={`${compact ? 'h-7 w-9' : 'h-9 w-12'} shrink-0 rounded-lg border border-white/10 bg-white/10`} />}<span className="team-name-full min-w-0 truncate font-black text-white">{name}</span></div>;
}
function PlayerIdentity({ player }: { player: PlayerStats }) {
  return <div className="flex min-w-0 items-center gap-2">{player.image ? <img src={player.image} alt={playerDisplayName(player)} className="h-9 w-9 shrink-0 rounded-xl border border-white/10 object-cover" loading="lazy" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-[10px] font-black text-[#FFD700]">{playerDisplayName(player).slice(0, 2)}</span>}<span className="min-w-0"><b className="block truncate text-sm font-black text-white">{playerDisplayName(player)}</b><span className="block truncate text-[10px] font-bold text-gray-500">{player.teamName}</span></span></div>;
}
function FeatureTeamCard({ title, team, metric }: { title: string; team: TeamStats | null; metric: string }) {
  return <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4"><p className="text-[11px] font-black text-gray-400">{title}</p>{team ? <div className="mt-3"><TeamIdentity team={team} /><p className="mt-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700]">{metric}</p></div> : <p className="mt-4 text-sm font-bold text-gray-500">غير متوفر حاليًا</p>}</article>;
}
function SectionTitle({ id, kicker, title, description }: { id: string; kicker: string; title: string; description: string }) {
  return <header id={id} className="scroll-mt-24"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">{kicker}</p><h2 className="mt-2 text-xl font-black text-white md:text-2xl">{title}</h2><p className="mt-1 max-w-3xl text-sm font-bold leading-6 text-gray-400">{description}</p></header>;
}
function TeamTable({ teams }: { teams: TeamStats[] }) {
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-right text-xs"><thead className="bg-white/[0.05] text-[10px] font-black text-gray-400"><tr><th className="px-4 py-3">المنتخب</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th><th>تسديدات</th><th>على المرمى</th><th>استحواذ</th></tr></thead><tbody className="divide-y divide-white/10">{teams.map((team, index) => { const possession = team.possessionCount ? team.possessionTotal / team.possessionCount : null; return <tr key={team.id} className="transition hover:bg-white/[0.04]"><td className="px-4 py-3"><Link href={teamSlug(team)} className="flex items-center gap-3"><span className="w-5 text-center text-[10px] font-black text-gray-500">{nf.format(index + 1)}</span><TeamIdentity team={team} compact /></Link></td><td>{num(team.played)}</td><td>{num(team.won)}</td><td>{num(team.drawn)}</td><td>{num(team.lost)}</td><td>{num(team.goalsFor)}</td><td>{num(team.goalsAgainst)}</td><td>{num(team.goalDifference)}</td><td className="font-black text-[#FFD700]">{num(team.points)}</td><td>{num(team.shots)}</td><td>{num(team.shotsOnTarget)}</td><td>{percent(possession)}</td></tr>; })}</tbody></table></div></div>;
}
function PlayerRanking({ title, players, metricLabel, value, empty = 'لم تتوفر بيانات كافية بعد' }: { title: string; players: PlayerStats[]; metricLabel: string; value: (player: PlayerStats) => number | null | undefined; empty?: string }) {
  return <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-3"><h3 className="text-sm font-black text-white">{title}</h3>{players.length ? <div className="mt-3 space-y-2">{players.slice(0, 6).map((player, index) => <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-2"><div className="flex min-w-0 items-center gap-2"><span className="w-5 text-center text-[10px] font-black text-gray-500">{nf.format(index + 1)}</span><PlayerIdentity player={player} /></div><div className="shrink-0 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-center text-[10px] font-black text-[#FFD700]"><b className="block text-base leading-none">{num(value(player))}</b><span>{metricLabel}</span></div></div>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">{empty}</p>}</article>;
}
function MatchTable({ matches, empty = 'لا توجد مباريات متاحة الآن' }: { matches: MatchRow[]; empty?: string }) {
  if (!matches.length) return <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm font-bold text-gray-500">{empty}</div>;
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-right text-xs"><thead className="bg-white/[0.05] text-[10px] font-black text-gray-400"><tr><th className="px-4 py-3">المباراة</th><th>الدور</th><th>الحالة</th><th>النتيجة</th><th>الأهداف</th><th>التاريخ</th></tr></thead><tbody className="divide-y divide-white/10">{matches.map((match) => <tr key={match.id} className="transition hover:bg-white/[0.04]"><td className="px-4 py-3"><Link href={`/matches/${match.id}`} className="flex items-center gap-3"><TeamIdentity team={match.homeTeam} compact /><span className="text-[10px] font-black text-gray-500">ضد</span><TeamIdentity team={match.awayTeam} compact /></Link></td><td>{stageLabel(match.stage)}</td><td className={isLive(match.status) ? 'font-black text-[#00FF88]' : 'text-gray-300'}>{statusLabel(match.status)}</td><td className="font-black text-white">{scoreLabel(match)}</td><td className="text-[#FFD700] font-black">{num(match.totalGoals)}</td><td>{formatDate(match.date)}</td></tr>)}</tbody></table></div></div>;
}

export default async function StatisticsPage() {
  const hasLiveMatches = Boolean(await prisma.match.findFirst({ where: { status: { in: LIVE } }, select: { id: true } }));
  const data = await (hasLiveMatches ? loadLiveStatistics() : loadIdleStatistics());
  const completion = data.totalMatches ? (data.finishedMatchesCount / data.totalMatches) * 100 : null;
  const topAttackMetric = data.topAttack ? `${num(data.topAttack.goalsFor)} هدف · ${num(data.topAttack.shots)} تسديدة` : '—';
  const bestDefenseMetric = data.bestDefense ? `${num(data.bestDefense.goalsAgainst)} هدف مستقبَل · ${num(data.bestDefense.cleanSheets)} شباك نظيفة` : '—';
  const possessionMetric = data.bestPossessionTeam && data.bestPossessionTeam.possessionCount ? `${percent(data.bestPossessionTeam.possessionTotal / data.bestPossessionTeam.possessionCount)} استحواذ` : '—';

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-7 px-3 py-5 text-white sm:px-4 lg:px-6">
      <LiveOnlyRefresh active={hasLiveMatches} intervalMs={30_000} />
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_32%),linear-gradient(135deg,#061313,#050505)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
        <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-[#FFD700]/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div><p className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#FFD700]">CACHED DATA CENTER</p><h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">إحصائيات كأس العالم 2026</h1><p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-gray-400">الصفحة لا تجلب من TheStats API أثناء زيارة المستخدم. يتم تجميع جميع السجلات الموثقة المحفوظة في قاعدة البيانات، ويعمل التحديث التلقائي أثناء المباريات المباشرة فقط.</p></div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-gray-300"><div className="text-[10px] font-black text-gray-500">آخر تحديث بيانات</div><div className="mt-1 text-lg font-black text-white">{formatDate(data.updatedAt)}</div><div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#00FF88]" style={{ width: `${Math.min(100, completion || 0)}%` }} /></div><div className="mt-1 text-[10px] text-gray-500">{hasLiveMatches ? `تحديث مباشر كل ${nf.format(LIVE_STATS_CACHE_SECONDS)} ثانية` : 'التحديث متوقف لعدم وجود مباراة مباشرة'}</div></div>
        </div>
      </section>

      <nav className="sticky top-2 z-20 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-black/65 p-2 backdrop-blur-xl">{[['#overview', 'نظرة عامة'], ['#live', 'مباشر الآن'], ['#teams', 'المنتخبات'], ['#players', 'اللاعبون'], ['#matches', 'المباريات'], ['#discipline', 'الانضباط']].map(([href, label]) => <a key={href} href={href} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-gray-300 transition hover:border-[#FFD700]/30 hover:text-[#FFD700]">{label}</a>)}</nav>

      <section id="overview" className="scroll-mt-24 space-y-4"><SectionTitle id="overview-title" kicker="OVERVIEW" title="نظرة عامة محدثة" description="الأرقام تجمع المباريات المنتهية والمباشرة من قاعدة البيانات، مع استخدام Snapshot من TheStats عند توفره." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="المباريات المنتهية" value={`${num(data.finishedMatchesCount)} / ${num(data.totalMatches)}`} note={`${num(data.liveMatchesCount)} مباشر · ${num(data.scheduledMatchesCount)} قادمة`} tone="gold" /><StatCard label="إجمالي الأهداف" value={num(data.totalGoals)} note={`${num(data.finishedGoals)} مكتملة · ${num(data.liveGoals)} مباشرة`} tone="green" /><StatCard label="إجمالي التسديدات" value={num(data.totalShots)} note={`${percent(data.shotAccuracy)} دقة على المرمى`} tone="cyan" /><StatCard label="مصادر TheStats" value={num(data.usefulSnapshotCount)} note={`${num(data.totalSnapshots)} Snapshot محفوظ`} /></div><div className="grid gap-3 md:grid-cols-3"><FeatureTeamCard title="أقوى هجوم" team={data.topAttack} metric={topAttackMetric} /><FeatureTeamCard title="أفضل دفاع" team={data.bestDefense} metric={bestDefenseMetric} /><FeatureTeamCard title="الأكثر استحواذًا" team={data.bestPossessionTeam} metric={possessionMetric} /></div></section>

      <section id="live" className="scroll-mt-24 space-y-4"><SectionTitle id="live-title" kicker="LIVE" title="المباريات المباشرة الآن" description="أي نتيجة مباشرة محفوظة في قاعدة البيانات تظهر هنا بدون جلب خارجي من الصفحة." /><MatchTable matches={data.liveMatchRows} empty="لا توجد مباريات مباشرة الآن" /></section>

      <section className="space-y-4"><SectionTitle id="teams" kicker="TEAMS" title="ترتيب المنتخبات بالأرقام" description="جدول يجمع نتائج المنتخبات في المباريات المكتملة، مع إحصائيات TheStats المحفوظة في snapshots." /><TeamTable teams={data.teams} /></section>

      <section className="space-y-4"><SectionTitle id="players" kicker="PLAYERS" title="أبرز اللاعبين" description="قوائم الهدافين وصناع اللعب والتسديدات والتصديات من PlayerPerformance، مع fallback للأهداف من أحداث المباراة عند الحاجة." /><div className="grid gap-3 lg:grid-cols-2"><PlayerRanking title="الهدافون" players={data.topScorers} metricLabel="هدف" value={(player) => player.goals} /><PlayerRanking title="صناعة الأهداف" players={data.topAssists} metricLabel="أسيست" value={(player) => player.assists} /><PlayerRanking title="الأكثر تسديدًا" players={data.topShooters} metricLabel="تسديدة" value={(player) => player.shots} /><PlayerRanking title="صناعة الفرص" players={data.topCreators} metricLabel="تمريرة مفتاحية" value={(player) => player.keyPasses} /><PlayerRanking title="الحراس" players={data.topSaves} metricLabel="تصدي" value={(player) => player.saves} /><PlayerRanking title="الأعلى تقييمًا" players={data.topRated} metricLabel="تقييم" value={(player) => playerRating(player)} /></div></section>

      <section className="space-y-4"><SectionTitle id="matches" kicker="MATCHES" title="إحصائيات المباريات" description="أكثر المباريات غزارة تهديفية وآخر النتائج المكتملة، مع إظهار ركلات الترجيح إذا كانت متاحة." /><div className="grid gap-4 xl:grid-cols-2"><div className="space-y-3"><h3 className="text-sm font-black text-white">أكثر المباريات أهدافًا</h3><MatchTable matches={data.topMatches} /></div><div className="space-y-3"><h3 className="text-sm font-black text-white">آخر النتائج</h3><MatchTable matches={data.recentMatches} /></div></div></section>

      <section className="space-y-4"><SectionTitle id="discipline" kicker="DISCIPLINE" title="الانضباط والبطاقات" description="مؤشرات البطاقات والالتحامات الدفاعية تساعد على قراءة الجانب البدني والانضباطي في البطولة." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="البطاقات الصفراء" value={num(data.yellowCards)} tone="gold" /><StatCard label="البطاقات الحمراء" value={num(data.redCards)} tone="red" /><StatCard label="دقة التسديد" value={percent(data.shotAccuracy)} note={`${num(data.totalShotsOnTarget)} على المرمى`} tone="cyan" /><StatCard label="متوسط الاستحواذ" value={percent(data.averagePossession)} note="متوسط المنتخبات المتاحة" /></div><div className="grid gap-3 lg:grid-cols-2"><PlayerRanking title="الأكثر حصولًا على بطاقات" players={data.topCards} metricLabel="نقطة انضباط" value={(player) => player.yellowCards + player.redCards * 2} /><PlayerRanking title="أكثر تدخلات دفاعية" players={data.topDefenders} metricLabel="تدخل/اعتراض" value={(player) => player.tackles + player.interceptions} /></div></section>
    </main>
  );
}
