import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { dedupePlayers } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isLiveStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'IN_PLAY' || value === 'LIVE' || value === 'HT';
}

function isFinishedStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'FINISHED' || value === 'FT' || value === 'AET' || value === 'PEN';
}

function isScheduledStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'SCHEDULED' || value === 'TIMED' || value === 'NOT_STARTED' || value === 'NS';
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
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
          homeTeam: { select: { name: true, code: true } },
          awayTeam: { select: { name: true, code: true } },
          statsSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 10,
            select: {
              provider: true,
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
    let snapshotYellowCards = 0;
    let snapshotRedCards = 0;
    let rawPenaltyTotal = 0;
    let rawPenaltyScored = 0;
    let rawPenaltyMissed = 0;
    let rawPenaltyUnknown = 0;
    let matchesWithCardSnapshots = 0;
    let matchesWithPenaltySnapshots = 0;
    let latestCardsUpdatedAt: string | null = null;
    let latestPenaltyUpdatedAt: string | null = null;
    let cardRawBookingsMatches = 0;
    let cardSnapshotStatsMatches = 0;
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

      if (finished || live) {
        const homeScore = safeNumber(match.homeScore);
        const awayScore = safeNumber(match.awayScore);
        const matchGoals = homeScore + awayScore;
        const goalDifference = Math.abs(homeScore - awayScore);
        totalGoals += matchGoals;

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
      }

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
      latestEventUpdatedAt,
      latestUpdatedAt: maxIsoDate(latestCardsUpdatedAt, latestPenaltyUpdatedAt, latestEventUpdatedAt),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('summary-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
