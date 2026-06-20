import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { dedupePlayers } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function isLiveStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return value === 'IN_PLAY' || value === 'LIVE' || value === 'HT' || value === '1H' || value === '2H';
}

function isFinishedStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return value === 'FINISHED' || value === 'FT' || value === 'AET' || value === 'PEN';
}

function isScheduledStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return value === 'SCHEDULED' || value === 'TIMED' || value === 'NOT_STARTED' || value === 'NS';
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function textIncludesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function isPenaltyEvent(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  return textIncludesAny(text, ['penalty', 'spot kick', 'ركلة جزاء', 'ضربة جزاء', 'جزاء']);
}

function isPenaltyMissed(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  return textIncludesAny(text, ['miss', 'missed', 'saved', 'failed', 'off target', 'ضائعة', 'اهدر', 'أهدر', 'تصدى', 'تصدي']);
}

function isPenaltyScored(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  if (isPenaltyMissed(type, detail)) return false;
  return textIncludesAny(text, ['penalty_scored', 'penalty goal', 'scored penalty', 'goal penalty', 'penalty converted', 'سجل', 'مسجلة', 'هدف من ركلة جزاء', 'هدف من ضربة جزاء']);
}

function maxIsoDate(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().pop() || null;
}

function rawTeamStats(rawData: any, side: 'home' | 'away') {
  return rawData?.teams?.[side]?.stats || rawData?.[`${side}Team`]?.statistics || {};
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = nullableNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function sumNumbers(rows: any[], key: string) {
  return rows.reduce((sum, row) => sum + safeNumber(row?.[key]), 0);
}

function countRows(rows: any[], predicate: (row: any) => boolean) {
  return rows.reduce((sum, row) => sum + (predicate(row) ? 1 : 0), 0);
}

function eventText(event: any) {
  return `${event?.normalizedType || ''} ${event?.type || ''} ${event?.detail || ''}`.toLowerCase();
}

function cardTypeFromBooking(booking: any) {
  const card = String(booking?.card || booking?.type || booking?.detail || '').toLowerCase();
  if (card.includes('red') && card.includes('yellow')) return 'second_yellow';
  if (card.includes('red')) return 'red';
  if (card.includes('yellow')) return 'yellow';
  return 'unknown';
}

function cardTotalsFromBookings(bookings: any[]) {
  let yellow = 0;
  let red = 0;
  for (const booking of bookings) {
    const type = cardTypeFromBooking(booking);
    if (type === 'yellow') yellow += 1;
    if (type === 'red') red += 1;
    if (type === 'second_yellow') {
      yellow += 1;
      red += 1;
    }
  }
  return { yellow, red };
}

function snapshotCardTotals(snapshot: any) {
  const rawData = snapshot?.rawData || {};
  const homeStats = rawTeamStats(rawData, 'home');
  const awayStats = rawTeamStats(rawData, 'away');
  const homeYellow = firstNumber(snapshot?.homeYellowCards, homeStats?.yellowCards, homeStats?.yellow_cards);
  const awayYellow = firstNumber(snapshot?.awayYellowCards, awayStats?.yellowCards, awayStats?.yellow_cards);
  const homeRed = firstNumber(snapshot?.homeRedCards, homeStats?.redCards, homeStats?.red_cards);
  const awayRed = firstNumber(snapshot?.awayRedCards, awayStats?.redCards, awayStats?.red_cards);
  const homeSecondYellow = firstNumber(homeStats?.yellowRedCards, homeStats?.yellow_red_cards) || 0;
  const awaySecondYellow = firstNumber(awayStats?.yellowRedCards, awayStats?.yellow_red_cards) || 0;

  const hasStatCards = [homeYellow, awayYellow, homeRed, awayRed].some((value) => value !== null);
  if (hasStatCards) {
    return {
      yellow: safeNumber(homeYellow) + safeNumber(awayYellow) + homeSecondYellow + awaySecondYellow,
      red: safeNumber(homeRed) + safeNumber(awayRed) + homeSecondYellow + awaySecondYellow,
      source: 'snapshot_stats',
      hasData: true,
    };
  }

  const bookings = safeArray(rawData?.bookings);
  const bookingTotals = cardTotalsFromBookings(bookings);
  return {
    ...bookingTotals,
    source: bookings.length ? 'raw_bookings' : 'no_card_data',
    hasData: bookings.length > 0,
  };
}

function bestCardTotalsFromSnapshots(snapshots: any[]) {
  for (const snapshot of snapshots) {
    const totals = snapshotCardTotals(snapshot);
    if (totals.hasData) return { ...totals, capturedAt: snapshot.capturedAt };
  }
  return { yellow: 0, red: 0, source: 'no_card_data', hasData: false, capturedAt: snapshots[0]?.capturedAt || null };
}

function penaltyTotalsFromRawData(rawData: any) {
  let scored = 0;
  let missed = 0;
  let unknown = 0;

  for (const goal of safeArray(rawData?.goals)) {
    const type = String(goal?.type || goal?.detail || '').toUpperCase();
    if (type.includes('PENALTY')) scored += 1;
  }

  for (const penalty of safeArray(rawData?.penalties)) {
    if (penalty?.scored === true) scored += 1;
    else if (penalty?.scored === false) missed += 1;
    else unknown += 1;
  }

  return { total: scored + missed + unknown, scored, missed, unknown };
}

function bestPenaltyTotalsFromSnapshots(snapshots: any[]) {
  for (const snapshot of snapshots) {
    const totals = penaltyTotalsFromRawData(snapshot?.rawData || {});
    if (totals.total > 0) return { ...totals, source: 'MatchStatsSnapshot.rawData', capturedAt: snapshot.capturedAt };
  }
  return { total: 0, scored: 0, missed: 0, unknown: 0, source: 'no_penalty_data', capturedAt: snapshots[0]?.capturedAt || null };
}

function latestFinalStatsFromSnapshots(snapshots: any[]) {
  for (const snapshot of snapshots) {
    const normalized = snapshot?.rawData?.normalized || {};
    const playerStats = safeArray(normalized?.playerStats);
    const shotmap = safeArray(normalized?.shotmap);
    const events = safeArray(normalized?.eventsDetailed?.all);
    const shotmapXg = sumNumbers(shotmap, 'xg');
    const playerXg = sumNumbers(playerStats, 'xg');
    const shotmapNpxg = sumNumbers(shotmap, 'npxg');
    const playerNpxg = sumNumbers(playerStats, 'npxg');
    const passes = sumNumbers(playerStats, 'passes');
    const accuratePasses = sumNumbers(playerStats, 'accuratePasses');
    const touches = sumNumbers(playerStats, 'touches');
    const substitutions = countRows(events, (event) => eventText(event).includes('sub'));
    const varReviews = countRows(events, (event) => eventText(event).includes('var'));

    const stats = {
      shots: safeNumber(snapshot.homeShots) + safeNumber(snapshot.awayShots) || shotmap.length,
      shotsOnTarget: safeNumber(snapshot.homeShotsOnTarget) + safeNumber(snapshot.awayShotsOnTarget) || countRows(shotmap, (shot) => Boolean(shot?.isOnTarget)),
      corners: safeNumber(snapshot.homeCorners) + safeNumber(snapshot.awayCorners),
      attacks: safeNumber(snapshot.homeAttacks) + safeNumber(snapshot.awayAttacks),
      dangerousAttacks: safeNumber(snapshot.homeDangerousAttacks) + safeNumber(snapshot.awayDangerousAttacks),
      possessionSamples: [nullableNumber(snapshot.homePossession), nullableNumber(snapshot.awayPossession)].filter((value) => value !== null) as number[],
      xg: playerXg || shotmapXg,
      npxg: playerNpxg || shotmapNpxg,
      xa: sumNumbers(playerStats, 'xa'),
      passes,
      accuratePasses,
      passAccuracySamples: passes > 0 && accuratePasses > 0 ? [Number(((accuratePasses / passes) * 100).toFixed(1))] : [] as number[],
      keyPasses: sumNumbers(playerStats, 'keyPasses'),
      crosses: sumNumbers(playerStats, 'crosses'),
      accurateCrosses: sumNumbers(playerStats, 'accurateCrosses'),
      tackles: sumNumbers(playerStats, 'tackles'),
      interceptions: sumNumbers(playerStats, 'interceptions'),
      clearances: sumNumbers(playerStats, 'clearances'),
      blocks: sumNumbers(playerStats, 'blocks'),
      saves: sumNumbers(playerStats, 'saves'),
      goalsPrevented: sumNumbers(playerStats, 'goalsPrevented'),
      touches,
      foulsCommitted: sumNumbers(playerStats, 'foulsCommitted'),
      foulsWon: sumNumbers(playerStats, 'foulsWon'),
      duelsWon: sumNumbers(playerStats, 'duelsWon'),
      duelsLost: sumNumbers(playerStats, 'duelsLost'),
      aerialWon: sumNumbers(playerStats, 'aerialWon'),
      highXgChances: countRows(shotmap, (shot) => safeNumber(shot?.xg) >= 0.35),
      detailedEvents: events.length,
      substitutions,
      varReviews,
      playerStatsRows: playerStats.length,
      hasTheStatsExtras: snapshot?.provider === 'THE_STATS_API_EXTRAS' || playerStats.length > 0 || shotmap.length > 0 || events.length > 0,
    };
    const hasData = stats.shots > 0 || stats.shotsOnTarget > 0 || stats.corners > 0 || stats.attacks > 0 || stats.dangerousAttacks > 0 || stats.possessionSamples.length > 0 || stats.playerStatsRows > 0 || stats.detailedEvents > 0;
    if (hasData) return { ...stats, hasData: true, capturedAt: snapshot.capturedAt };
  }
  return { shots: 0, shotsOnTarget: 0, corners: 0, attacks: 0, dangerousAttacks: 0, possessionSamples: [] as number[], xg: 0, npxg: 0, xa: 0, passes: 0, accuratePasses: 0, passAccuracySamples: [] as number[], keyPasses: 0, crosses: 0, accurateCrosses: 0, tackles: 0, interceptions: 0, clearances: 0, blocks: 0, saves: 0, goalsPrevented: 0, touches: 0, foulsCommitted: 0, foulsWon: 0, duelsWon: 0, duelsLost: 0, aerialWon: 0, highXgChances: 0, detailedEvents: 0, substitutions: 0, varReviews: 0, playerStatsRows: 0, hasTheStatsExtras: false, hasData: false, capturedAt: snapshots[0]?.capturedAt || null };
}

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

function getTeamAggregate(map: Map<string, TeamAggregate>, team: any) {
  const id = String(team?.id || team?.code || team?.name || 'unknown');
  const existing = map.get(id);
  if (existing) return existing;
  const created: TeamAggregate = {
    id,
    name: team?.name || team?.code || 'غير متوفر',
    code: team?.code || '',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
  };
  map.set(id, created);
  return created;
}

function applyResult(team: TeamAggregate, goalsFor: number, goalsAgainst: number) {
  team.played += 1;
  team.goalsFor += goalsFor;
  team.goalsAgainst += goalsAgainst;
  if (goalsAgainst === 0) team.cleanSheets += 1;
  if (goalsFor > goalsAgainst) team.wins += 1;
  else if (goalsFor === goalsAgainst) team.draws += 1;
  else team.losses += 1;
}

function pickTopTeam(teams: TeamAggregate[], primary: keyof TeamAggregate, secondary: keyof TeamAggregate = 'played') {
  return [...teams]
    .filter((team) => team.played > 0)
    .sort((a, b) => Number(b[primary]) - Number(a[primary]) || Number(b[secondary]) - Number(a[secondary]) || a.name.localeCompare(b.name))[0] || null;
}

export async function GET() {
  try {
    const [matches, yellowEventCount, redEventCount, snapshotsCount, rawPlayers, teamCount, matchEvents] = await Promise.all([
      prisma.match.findMany({
        select: {
          id: true,
          status: true,
          homeScore: true,
          awayScore: true,
          matchDate: true,
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
          statsSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 10,
            select: {
              provider: true,
              minute: true,
              homePossession: true,
              awayPossession: true,
              homeAttacks: true,
              awayAttacks: true,
              homeDangerousAttacks: true,
              awayDangerousAttacks: true,
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
              rawData: true,
              capturedAt: true,
            },
          },
        },
      }),
      prisma.matchEvent.count({ where: { type: { in: ['yellow_card', 'yellow', 'card_yellow'] } } }),
      prisma.matchEvent.count({ where: { type: { in: ['red_card', 'red', 'card_red'] } } }),
      prisma.matchStatsSnapshot.count().catch(() => 0),
      prisma.asset.findMany({
        where: { type: 'PLAYER' },
        select: {
          id: true,
          name: true,
          code: true,
          image: true,
          position: true,
          age: true,
          club: true,
          teamId: true,
          team: { select: { id: true, name: true, code: true } },
        },
        take: 10000,
      }),
      prisma.asset.count({ where: { type: 'TEAM' } }),
      prisma.matchEvent.findMany({
        select: {
          type: true,
          detail: true,
          createdAt: true,
          updatedAt: true,
        },
        take: 10000,
      }).catch(() => []),
    ]);

    const dedupedPlayers = dedupePlayers(rawPlayers);
    const linkedDedupedPlayers = dedupedPlayers.filter((player) => player.teamId);
    const playerCount = linkedDedupedPlayers.length;
    const rawPlayerRows = rawPlayers.length;
    const hiddenDuplicatePlayerRows = Math.max(0, rawPlayerRows - dedupedPlayers.length);
    const estimatedFinalSquadCapacity = teamCount * 26;

    let finishedMatches = 0;
    let liveMatches = 0;
    let scheduledMatches = 0;
    let totalGoals = 0;
    let liveGoals = 0;
    let snapshotYellowCards = 0;
    let snapshotRedCards = 0;
    let rawPenaltyTotal = 0;
    let rawPenaltyScored = 0;
    let rawPenaltyMissed = 0;
    let rawPenaltyUnknown = 0;
    let matchesWithCardSnapshots = 0;
    let matchesWithPenaltySnapshots = 0;
    let matchesWithFinalSnapshots = 0;
    let matchesWithTheStatsExtras = 0;
    let totalShots = 0;
    let totalShotsOnTarget = 0;
    let totalCorners = 0;
    let totalAttacks = 0;
    let totalDangerousAttacks = 0;
    let totalXg = 0;
    let totalNpxg = 0;
    let totalXa = 0;
    let totalPasses = 0;
    let totalAccuratePasses = 0;
    let totalKeyPasses = 0;
    let totalCrosses = 0;
    let totalAccurateCrosses = 0;
    let totalTackles = 0;
    let totalInterceptions = 0;
    let totalClearances = 0;
    let totalBlocks = 0;
    let totalSaves = 0;
    let totalGoalsPrevented = 0;
    let totalTouches = 0;
    let totalFoulsCommitted = 0;
    let totalFoulsWon = 0;
    let totalDuelsWon = 0;
    let totalDuelsLost = 0;
    let totalAerialWon = 0;
    let totalHighXgChances = 0;
    let totalDetailedEvents = 0;
    let totalSubstitutions = 0;
    let totalVarReviews = 0;
    let totalPlayerStatsRows = 0;
    let possessionSampleTotal = 0;
    let possessionSampleCount = 0;
    let passAccuracySampleTotal = 0;
    let passAccuracySampleCount = 0;
    let latestCardsUpdatedAt: string | null = null;
    let latestPenaltyUpdatedAt: string | null = null;
    let latestFinalStatsUpdatedAt: string | null = null;
    let cardRawBookingsMatches = 0;
    let cardSnapshotStatsMatches = 0;
    const teamAggregates = new Map<string, TeamAggregate>();
    let biggestScore: null | {
      matchId: string;
      homeTeam: { name: string; code: string };
      awayTeam: { name: string; code: string };
      homeScore: number;
      awayScore: number;
      totalGoals: number;
      goalDifference: number;
      matchDate: string;
    } = null;

    for (const match of matches) {
      const finished = isFinishedStatus(match.status);
      const live = isLiveStatus(match.status);

      if (finished) finishedMatches += 1;
      if (live) liveMatches += 1;
      if (isScheduledStatus(match.status)) scheduledMatches += 1;

      const homeScore = safeNumber(match.homeScore);
      const awayScore = safeNumber(match.awayScore);
      const matchGoals = homeScore + awayScore;
      const goalDifference = Math.abs(homeScore - awayScore);

      if (finished) {
        totalGoals += matchGoals;
        const homeAgg = getTeamAggregate(teamAggregates, match.homeTeam);
        const awayAgg = getTeamAggregate(teamAggregates, match.awayTeam);
        applyResult(homeAgg, homeScore, awayScore);
        applyResult(awayAgg, awayScore, homeScore);

        if (matchGoals > 0 && (!biggestScore || matchGoals > biggestScore.totalGoals || (matchGoals === biggestScore.totalGoals && goalDifference > biggestScore.goalDifference))) {
          biggestScore = {
            matchId: match.id,
            homeTeam: { name: match.homeTeam?.name || 'غير متوفر', code: match.homeTeam?.code || '' },
            awayTeam: { name: match.awayTeam?.name || 'غير متوفر', code: match.awayTeam?.code || '' },
            homeScore,
            awayScore,
            totalGoals: matchGoals,
            goalDifference,
            matchDate: match.matchDate instanceof Date ? match.matchDate.toISOString() : String(match.matchDate || ''),
          };
        }
      } else if (live) {
        liveGoals += matchGoals;
      }

      const finalStats = latestFinalStatsFromSnapshots(match.statsSnapshots);
      if (finalStats.hasData) {
        matchesWithFinalSnapshots += 1;
        if (finalStats.hasTheStatsExtras) matchesWithTheStatsExtras += 1;
        totalShots += finalStats.shots;
        totalShotsOnTarget += finalStats.shotsOnTarget;
        totalCorners += finalStats.corners;
        totalAttacks += finalStats.attacks;
        totalDangerousAttacks += finalStats.dangerousAttacks;
        totalXg += finalStats.xg;
        totalNpxg += finalStats.npxg;
        totalXa += finalStats.xa;
        totalPasses += finalStats.passes;
        totalAccuratePasses += finalStats.accuratePasses;
        totalKeyPasses += finalStats.keyPasses;
        totalCrosses += finalStats.crosses;
        totalAccurateCrosses += finalStats.accurateCrosses;
        totalTackles += finalStats.tackles;
        totalInterceptions += finalStats.interceptions;
        totalClearances += finalStats.clearances;
        totalBlocks += finalStats.blocks;
        totalSaves += finalStats.saves;
        totalGoalsPrevented += finalStats.goalsPrevented;
        totalTouches += finalStats.touches;
        totalFoulsCommitted += finalStats.foulsCommitted;
        totalFoulsWon += finalStats.foulsWon;
        totalDuelsWon += finalStats.duelsWon;
        totalDuelsLost += finalStats.duelsLost;
        totalAerialWon += finalStats.aerialWon;
        totalHighXgChances += finalStats.highXgChances;
        totalDetailedEvents += finalStats.detailedEvents;
        totalSubstitutions += finalStats.substitutions;
        totalVarReviews += finalStats.varReviews;
        totalPlayerStatsRows += finalStats.playerStatsRows;
        possessionSampleTotal += finalStats.possessionSamples.reduce((sum, value) => sum + value, 0);
        possessionSampleCount += finalStats.possessionSamples.length;
        passAccuracySampleTotal += finalStats.passAccuracySamples.reduce((sum, value) => sum + value, 0);
        passAccuracySampleCount += finalStats.passAccuracySamples.length;
      }
      const finalStatsCapturedAt = finalStats.capturedAt instanceof Date ? finalStats.capturedAt.toISOString() : String(finalStats.capturedAt || '');
      if (finalStatsCapturedAt && (!latestFinalStatsUpdatedAt || finalStatsCapturedAt > latestFinalStatsUpdatedAt)) latestFinalStatsUpdatedAt = finalStatsCapturedAt;

      const cardTotals = bestCardTotalsFromSnapshots(match.statsSnapshots);
      snapshotYellowCards += cardTotals.yellow;
      snapshotRedCards += cardTotals.red;
      if (cardTotals.hasData) matchesWithCardSnapshots += 1;
      if (cardTotals.source === 'raw_bookings') cardRawBookingsMatches += 1;
      if (cardTotals.source === 'snapshot_stats') cardSnapshotStatsMatches += 1;
      const cardCapturedAt = cardTotals.capturedAt instanceof Date ? cardTotals.capturedAt.toISOString() : String(cardTotals.capturedAt || '');
      if (cardCapturedAt && (!latestCardsUpdatedAt || cardCapturedAt > latestCardsUpdatedAt)) latestCardsUpdatedAt = cardCapturedAt;

      const penaltyTotals = bestPenaltyTotalsFromSnapshots(match.statsSnapshots);
      rawPenaltyTotal += penaltyTotals.total;
      rawPenaltyScored += penaltyTotals.scored;
      rawPenaltyMissed += penaltyTotals.missed;
      rawPenaltyUnknown += penaltyTotals.unknown;
      if (penaltyTotals.total > 0) matchesWithPenaltySnapshots += 1;
      const penaltyCapturedAt = penaltyTotals.capturedAt instanceof Date ? penaltyTotals.capturedAt.toISOString() : String(penaltyTotals.capturedAt || '');
      if (penaltyCapturedAt && (!latestPenaltyUpdatedAt || penaltyCapturedAt > latestPenaltyUpdatedAt)) latestPenaltyUpdatedAt = penaltyCapturedAt;
    }

    const yellowCards = Math.max(snapshotYellowCards, yellowEventCount);
    const redCards = Math.max(snapshotRedCards, redEventCount);
    const penaltyEvents = matchEvents.filter((event) => isPenaltyEvent(event.type, event.detail));
    const eventPenaltiesScored = penaltyEvents.filter((event) => isPenaltyScored(event.type, event.detail)).length;
    const eventPenaltiesMissed = penaltyEvents.filter((event) => isPenaltyMissed(event.type, event.detail)).length;
    const eventPenaltiesUnknown = Math.max(0, penaltyEvents.length - eventPenaltiesScored - eventPenaltiesMissed);
    const useRawPenalties = rawPenaltyTotal >= penaltyEvents.length;
    const penaltiesScored = useRawPenalties ? rawPenaltyScored : eventPenaltiesScored;
    const penaltiesMissed = useRawPenalties ? rawPenaltyMissed : eventPenaltiesMissed;
    const penaltiesUnknown = useRawPenalties ? rawPenaltyUnknown : eventPenaltiesUnknown;
    const penaltiesTotal = useRawPenalties ? rawPenaltyTotal : penaltyEvents.length;
    const latestEventUpdatedAt = matchEvents
      .map((event) => event.updatedAt instanceof Date ? event.updatedAt.toISOString() : event.createdAt instanceof Date ? event.createdAt.toISOString() : '')
      .filter(Boolean)
      .sort()
      .pop() || null;

    const teamRows = Array.from(teamAggregates.values());
    const topScoringTeam = pickTopTeam(teamRows, 'goalsFor', 'played');
    const mostConcedingTeam = pickTopTeam(teamRows, 'goalsAgainst', 'played');
    const bestCleanSheetTeam = pickTopTeam(teamRows, 'cleanSheets', 'played');
    const cleanSheets = teamRows.reduce((sum, team) => sum + team.cleanSheets, 0);
    const averageGoalsPerFinishedMatch = finishedMatches > 0 ? Number((totalGoals / finishedMatches).toFixed(2)) : null;
    const averageShotsPerFinishedMatch = finishedMatches > 0 && totalShots > 0 ? Number((totalShots / finishedMatches).toFixed(1)) : null;
    const averagePossessionSample = possessionSampleCount > 0 ? Number((possessionSampleTotal / possessionSampleCount).toFixed(1)) : null;
    const passAccuracyPercent = totalPasses > 0 && totalAccuratePasses > 0 ? Number(((totalAccuratePasses / totalPasses) * 100).toFixed(1)) : passAccuracySampleCount > 0 ? Number((passAccuracySampleTotal / passAccuracySampleCount).toFixed(1)) : null;
    const crossAccuracyPercent = totalCrosses > 0 && totalAccurateCrosses > 0 ? Number(((totalAccurateCrosses / totalCrosses) * 100).toFixed(1)) : null;
    const duelWinPercent = totalDuelsWon + totalDuelsLost > 0 ? Number(((totalDuelsWon / (totalDuelsWon + totalDuelsLost)) * 100).toFixed(1)) : null;

    return NextResponse.json({
      ok: true,
      source: 'database_summary_from_matches_snapshots_events_rawdata_and_assets',
      totalMatches: matches.length,
      finishedMatches,
      liveMatches,
      scheduledMatches,
      teamCount,
      playerCount,
      playerCountSource: 'deduped_linked_player_assets',
      rawPlayerRows,
      hiddenDuplicatePlayerRows,
      estimatedFinalSquadCapacity,
      overEstimatedCapacityBy: Math.max(0, playerCount - estimatedFinalSquadCapacity),
      totalGoals,
      liveGoals,
      averageGoalsPerFinishedMatch,
      yellowCards,
      redCards,
      penalties: {
        available: penaltiesTotal > 0 || rawPenaltyTotal > 0 || penaltyEvents.length > 0,
        total: penaltiesTotal,
        scored: penaltiesScored,
        missed: penaltiesMissed,
        unknown: penaltiesUnknown,
        source: useRawPenalties ? 'MatchStatsSnapshot.rawData' : 'MatchEvent fallback',
      },
      biggestScore,
      teamLeaders: {
        topScoringTeam,
        mostConcedingTeam,
        bestCleanSheetTeam,
      },
      cleanSheets,
      finalStats: {
        matchesWithFinalSnapshots,
        matchesWithTheStatsExtras,
        totalShots,
        totalShotsOnTarget,
        totalCorners,
        totalAttacks,
        totalDangerousAttacks,
        totalXg: Number(totalXg.toFixed(2)),
        totalNpxg: Number(totalNpxg.toFixed(2)),
        totalXa: Number(totalXa.toFixed(2)),
        totalPasses,
        totalAccuratePasses,
        passAccuracyPercent,
        totalKeyPasses,
        totalCrosses,
        totalAccurateCrosses,
        crossAccuracyPercent,
        totalTackles,
        totalInterceptions,
        totalClearances,
        totalBlocks,
        totalSaves,
        totalGoalsPrevented: Number(totalGoalsPrevented.toFixed(2)),
        totalTouches,
        totalFoulsCommitted,
        totalFoulsWon,
        totalDuelsWon,
        totalDuelsLost,
        duelWinPercent,
        totalAerialWon,
        totalHighXgChances,
        totalDetailedEvents,
        totalSubstitutions,
        totalVarReviews,
        totalPlayerStatsRows,
        averageShotsPerFinishedMatch,
        averagePossessionSample,
      },
      snapshotsCount,
      cardsSource: {
        yellow: snapshotYellowCards >= yellowEventCount ? 'MatchStatsSnapshot/rawData' : 'MatchEvent fallback',
        red: snapshotRedCards >= redEventCount ? 'MatchStatsSnapshot/rawData' : 'MatchEvent fallback',
        snapshotYellowCards,
        snapshotRedCards,
        yellowEventCount,
        redEventCount,
        cardRawBookingsMatches,
        cardSnapshotStatsMatches,
      },
      penaltySource: {
        rawPenaltyTotal,
        rawPenaltyScored,
        rawPenaltyMissed,
        rawPenaltyUnknown,
        eventPenaltyTotal: penaltyEvents.length,
        eventPenaltiesScored,
        eventPenaltiesMissed,
        eventPenaltiesUnknown,
        matchesWithPenaltySnapshots,
      },
      matchesWithCardSnapshots,
      latestCardsUpdatedAt,
      latestPenaltyUpdatedAt,
      latestFinalStatsUpdatedAt,
      latestEventUpdatedAt,
      latestUpdatedAt: maxIsoDate(latestCardsUpdatedAt, latestPenaltyUpdatedAt, latestFinalStatsUpdatedAt, latestEventUpdatedAt),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('summary-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
