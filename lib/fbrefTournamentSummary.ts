import { worldCupMasterMeta } from '@/lib/worldCupMasterFbrefStats';
import { groupAFbrefStats } from '@/lib/groupAFbrefStats';
import { groupBFbrefStats } from '@/lib/groupBFbrefStats';
import { groupCFbrefStats } from '@/lib/groupCFbrefStats';
import { groupDFbrefStats } from '@/lib/groupDFbrefStats';
import { groupEFbrefStats } from '@/lib/groupEFbrefStats';
import { groupFFbrefStats } from '@/lib/groupFFbrefStats';
import { groupGHIFbrefStats } from '@/lib/groupGHIFbrefStats';
import { groupJFbrefStats } from '@/lib/groupJFbrefStats';
import { groupKFbrefStats } from '@/lib/groupKFbrefStats';
import { groupLFbrefStats } from '@/lib/groupLFbrefStats';

type TeamAggregate = {
  id: string;
  name: string;
  code: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
};

type PenaltyAggregate = {
  available: boolean;
  total: number;
  scored: number;
  missed: number;
  unknown: number;
  teamsWithPenaltyFields: number;
  source: string;
};

function n(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function allFbrefTeams(): any[] {
  return [
    ...groupAFbrefStats,
    ...groupBFbrefStats,
    ...groupCFbrefStats,
    ...groupDFbrefStats,
    ...groupEFbrefStats,
    ...groupFFbrefStats,
    ...groupGHIFbrefStats,
    ...groupJFbrefStats,
    ...groupKFbrefStats,
    ...groupLFbrefStats,
  ];
}

function cleanSheetsFromTeam(team: any) {
  const gkCleanSheets = optionalNumber(team?.goalkeeping?.cleanSheets);
  if (gkCleanSheets !== null) return gkCleanSheets;
  const mp = n(team?.standing?.mp);
  const ga = optionalNumber(team?.standing?.ga);
  return mp > 0 && ga === 0 ? 1 : 0;
}

function teamAggregate(team: any): TeamAggregate {
  return {
    id: String(team?.teamCode || team?.code || team?.team || 'unknown'),
    name: String(team?.team || team?.name || team?.teamCode || 'غير متوفر'),
    code: String(team?.teamCode || team?.code || ''),
    played: n(team?.standing?.mp),
    wins: n(team?.standing?.wins),
    draws: n(team?.standing?.draws),
    losses: n(team?.standing?.losses),
    goalsFor: n(team?.standing?.gf),
    goalsAgainst: n(team?.standing?.ga),
    cleanSheets: cleanSheetsFromTeam(team),
  };
}

function pickTopTeam(teams: TeamAggregate[], primary: keyof TeamAggregate, secondary: keyof TeamAggregate = 'played') {
  return [...teams]
    .filter((team) => team.played > 0)
    .sort((a, b) => Number(b[primary]) - Number(a[primary]) || Number(b[secondary]) - Number(a[secondary]) || a.name.localeCompare(b.name))[0] || null;
}

function penaltyField(team: any, keys: string[]) {
  const containers = [team?.standard, team?.shooting, team?.misc, team?.goalkeeping, team?.matchContext, team];
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    for (const key of keys) {
      const value = optionalNumber(container[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function penaltiesFromFbrefTeam(team: any) {
  const scored = penaltyField(team, [
    'pk', 'PK', 'pkGoals', 'penaltyGoals', 'penaltiesScored', 'penaltyScored', 'pensScored', 'penaltiesMade', 'penaltyMade',
  ]);
  const attempts = penaltyField(team, [
    'pkatt', 'PKatt', 'pkAtt', 'penaltyAttempts', 'penaltiesAttempted', 'penaltiesTaken', 'penaltyTaken', 'pensAttempted', 'pensTaken',
  ]);
  const missedRaw = penaltyField(team, [
    'pkMissed', 'penaltyMissed', 'penaltiesMissed', 'pensMissed', 'penaltySaved', 'penaltiesSaved',
  ]);

  if (scored === null && attempts === null && missedRaw === null) {
    return { hasData: false, total: 0, scored: 0, missed: 0, unknown: 0 };
  }

  const safeScored = Math.max(0, n(scored));
  const missed = missedRaw !== null ? Math.max(0, n(missedRaw)) : attempts !== null ? Math.max(0, n(attempts) - safeScored) : 0;
  const total = attempts !== null ? Math.max(n(attempts), safeScored + missed) : safeScored + missed;
  const unknown = Math.max(0, total - safeScored - missed);
  return { hasData: true, total, scored: safeScored, missed, unknown };
}

function aggregateFbrefPenalties(teams: any[]): PenaltyAggregate {
  let total = 0;
  let scored = 0;
  let missed = 0;
  let unknown = 0;
  let teamsWithPenaltyFields = 0;

  for (const team of teams) {
    const penalties = penaltiesFromFbrefTeam(team);
    if (!penalties.hasData) continue;
    teamsWithPenaltyFields += 1;
    total += penalties.total;
    scored += penalties.scored;
    missed += penalties.missed;
    unknown += penalties.unknown;
  }

  return {
    available: teamsWithPenaltyFields > 0,
    total,
    scored,
    missed,
    unknown,
    teamsWithPenaltyFields,
    source: teamsWithPenaltyFields > 0 ? 'FBref penalty fields fallback' : 'not_available_in_current_fbref_snapshot',
  };
}

export function getFbrefTournamentSummary() {
  const teams = allFbrefTeams();
  const teamRows = teams.map(teamAggregate);
  const playedTeams = teamRows.filter((team) => team.played > 0);

  const totalTeamMatches = playedTeams.reduce((sum, team) => sum + team.played, 0);
  const finishedMatches = Math.floor(totalTeamMatches / 2);
  const totalGoals = playedTeams.reduce((sum, team) => sum + team.goalsFor, 0);
  const liveMatches = 0;
  const scheduledMatches = Math.max(0, 104 - finishedMatches);

  let totalShots = 0;
  let totalShotsOnTarget = 0;
  let totalCorners = 0;
  let totalAttacks = 0;
  let totalDangerousAttacks = 0;
  let yellowCards = 0;
  let redCards = 0;
  let possessionSampleTotal = 0;
  let possessionSampleCount = 0;
  let teamsWithShooting = 0;
  let teamsWithCards = 0;
  let teamsWithPossession = 0;

  for (const team of teams) {
    const shots = optionalNumber(team?.shooting?.shots);
    const shotsOnTarget = optionalNumber(team?.shooting?.shotsOnTarget);
    if (shots !== null || shotsOnTarget !== null) {
      totalShots += n(shots);
      totalShotsOnTarget += n(shotsOnTarget);
      teamsWithShooting += 1;
    }

    const corners = optionalNumber(team?.misc?.corners ?? team?.misc?.cornerKicks);
    totalCorners += n(corners);
    totalAttacks += n(team?.misc?.fouls) + n(team?.misc?.fouled);
    totalDangerousAttacks += n(team?.misc?.tacklesWon) + n(team?.misc?.interceptions);

    const yellows = optionalNumber(team?.misc?.yellowCards);
    const reds = optionalNumber(team?.misc?.redCards);
    const secondYellows = optionalNumber(team?.misc?.secondYellows);
    if (yellows !== null || reds !== null || secondYellows !== null) {
      yellowCards += n(yellows) + n(secondYellows);
      redCards += n(reds) + n(secondYellows);
      teamsWithCards += 1;
    }

    const possession = optionalNumber(team?.matchContext?.averagePossession);
    if (possession !== null) {
      possessionSampleTotal += possession;
      possessionSampleCount += 1;
      teamsWithPossession += 1;
    }
  }

  const topScoringTeam = pickTopTeam(teamRows, 'goalsFor', 'played');
  const mostConcedingTeam = pickTopTeam(teamRows, 'goalsAgainst', 'played');
  const bestCleanSheetTeam = pickTopTeam(teamRows, 'cleanSheets', 'played');
  const cleanSheets = teamRows.reduce((sum, team) => sum + team.cleanSheets, 0);
  const penalties = aggregateFbrefPenalties(teams);

  return {
    ok: true,
    source: 'fbref_copied_snapshot_fallback',
    sourceName: worldCupMasterMeta.sourceName,
    sourceUrl: worldCupMasterMeta.sourceUrl,
    sourceNote: worldCupMasterMeta.sourceNote,
    siteLastUpdated: worldCupMasterMeta.siteLastUpdated,
    totalMatches: 104,
    finishedMatches,
    liveMatches,
    scheduledMatches,
    teamCount: teams.length,
    playerCount: teams.reduce((sum, team) => sum + n(team?.rosterSummary?.count), 0),
    playerCountSource: 'fbref_roster_snapshot_fallback',
    totalGoals,
    liveGoals: 0,
    averageGoalsPerFinishedMatch: finishedMatches > 0 ? Number((totalGoals / finishedMatches).toFixed(2)) : null,
    yellowCards,
    redCards,
    penalties,
    biggestScore: null,
    teamLeaders: {
      topScoringTeam,
      mostConcedingTeam,
      bestCleanSheetTeam,
    },
    cleanSheets,
    finalStats: {
      matchesWithFinalSnapshots: finishedMatches,
      totalShots,
      totalShotsOnTarget,
      totalCorners,
      totalAttacks,
      totalDangerousAttacks,
      averageShotsPerFinishedMatch: finishedMatches > 0 && totalShots > 0 ? Number((totalShots / finishedMatches).toFixed(1)) : null,
      averagePossessionSample: possessionSampleCount > 0 ? Number((possessionSampleTotal / possessionSampleCount).toFixed(1)) : null,
      teamsWithShooting,
      teamsWithCards,
      teamsWithPossession,
    },
    latestUpdatedAt: null,
  };
}
