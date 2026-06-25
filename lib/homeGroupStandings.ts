import prisma from '@/lib/prisma';
import { WORLD_CUP_2026_GROUPS, type WorldCup2026GroupKey } from '@/lib/worldCup2026GroupConfig';

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET', 'BT', 'P'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

type TableRow = {
  team: string;
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type MatchForTable = {
  id: string;
  externalId: string | null;
  animationMatchId: number | null;
  matchDate: Date;
  status: string;
  groupPhase: string | null;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string; code: string };
  awayTeam: { name: string; code: string };
};

function normalizeGroupKey(value?: string | null): WorldCup2026GroupKey | null {
  const group = String(value || '').replace('Group', '').replace('GROUP_', '').replace('المجموعة', '').trim().toUpperCase();
  return group in WORLD_CUP_2026_GROUPS ? group as WorldCup2026GroupKey : null;
}

function normalizeCode(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toUpperCase();
}

function isFinished(status?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function statusRank(status?: string | null) {
  const value = normalizeStatus(status);
  if (FINISHED_STATUSES.includes(value)) return 4;
  if (LIVE_STATUSES.includes(value)) return 3;
  if (SCHEDULED_STATUSES.includes(value)) return 2;
  return 1;
}

function matchDedupeKey(match: MatchForTable) {
  const codes = [normalizeCode(match.homeTeam?.code), normalizeCode(match.awayTeam?.code)].sort();
  return codes.join('|');
}

function chooseBetterMatch(current: MatchForTable | undefined, candidate: MatchForTable) {
  if (!current) return candidate;
  const currentRank = statusRank(current.status);
  const candidateRank = statusRank(candidate.status);
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;

  const currentHasProviderId = Boolean(current.animationMatchId || current.externalId);
  const candidateHasProviderId = Boolean(candidate.animationMatchId || candidate.externalId);
  if (candidateHasProviderId !== currentHasProviderId) return candidateHasProviderId ? candidate : current;

  const currentScoreTotal = safeNumber(current.homeScore) + safeNumber(current.awayScore);
  const candidateScoreTotal = safeNumber(candidate.homeScore) + safeNumber(candidate.awayScore);
  if (candidateScoreTotal !== currentScoreTotal) return candidateScoreTotal > currentScoreTotal ? candidate : current;

  return new Date(candidate.matchDate).getTime() < new Date(current.matchDate).getTime() ? candidate : current;
}

function groupForTeamCode(code?: string | null) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  for (const [group, data] of Object.entries(WORLD_CUP_2026_GROUPS) as [WorldCup2026GroupKey, typeof WORLD_CUP_2026_GROUPS[WorldCup2026GroupKey]][]) {
    if (data.teams.some((team) => team.codes.map(normalizeCode).includes(normalized))) return group;
  }

  return null;
}

export async function getHomeGroupStandings() {
  const matches = await prisma.match.findMany({
    select: {
      id: true,
      externalId: true,
      animationMatchId: true,
      matchDate: true,
      status: true,
      groupPhase: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
    },
  }) as MatchForTable[];

  return (Object.entries(WORLD_CUP_2026_GROUPS) as [WorldCup2026GroupKey, typeof WORLD_CUP_2026_GROUPS[WorldCup2026GroupKey]][]).map(([group, data]) => {
    const rows = data.teams.map<TableRow>((team) => ({
      team: team.name,
      code: team.codes[0],
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }));

    const byCode = new Map<string, TableRow>();
    data.teams.forEach((team, index) => {
      team.codes.forEach((code) => byCode.set(normalizeCode(code), rows[index]));
    });

    let finishedMatches = 0;
    let liveMatches = 0;
    let scheduledMatches = 0;
    let duplicateMatchesIgnored = 0;
    const uniqueMatches = new Map<string, MatchForTable>();

    for (const match of matches) {
      const matchGroup = normalizeGroupKey(match.groupPhase) || groupForTeamCode(match.homeTeam?.code) || groupForTeamCode(match.awayTeam?.code);
      if (matchGroup !== group) continue;

      const home = byCode.get(normalizeCode(match.homeTeam?.code));
      const away = byCode.get(normalizeCode(match.awayTeam?.code));
      if (!home || !away) continue;

      const key = matchDedupeKey(match);
      const previous = uniqueMatches.get(key);
      const chosen = chooseBetterMatch(previous, match);
      if (previous) duplicateMatchesIgnored += 1;
      uniqueMatches.set(key, chosen);
    }

    for (const match of uniqueMatches.values()) {
      const status = normalizeStatus(match.status);
      if (LIVE_STATUSES.includes(status)) liveMatches += 1;
      if (SCHEDULED_STATUSES.includes(status)) scheduledMatches += 1;
      if (!isFinished(status)) continue;

      const home = byCode.get(normalizeCode(match.homeTeam?.code));
      const away = byCode.get(normalizeCode(match.awayTeam?.code));
      if (!home || !away) continue;

      finishedMatches += 1;
      const homeScore = safeNumber(match.homeScore);
      const awayScore = safeNumber(match.awayScore);

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (homeScore < awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    rows.forEach((row) => {
      row.goalDifference = row.goalsFor - row.goalsAgainst;
    });

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team, 'ar');
    });

    return {
      key: group,
      arName: data.arName,
      finishedMatches,
      liveMatches,
      scheduledMatches,
      duplicateMatchesIgnored,
      standings: rows,
    };
  });
}
