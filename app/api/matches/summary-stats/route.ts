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
  return textIncludesAny(text, ['penalty_scored', 'penalty goal', 'scored penalty', 'goal penalty', 'penalty converted', 'سجل', 'مسجلة', 'هدف من ركلة جزاء']);
}

function maxIsoDate(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().pop() || null;
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
            take: 1,
            select: {
              homeYellowCards: true,
              awayYellowCards: true,
              homeRedCards: true,
              awayRedCards: true,
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
    let matchesWithCardSnapshots = 0;
    let latestCardsUpdatedAt: string | null = null;
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

      const latest = match.statsSnapshots[0];
      if (latest) {
        const matchYellowCards = safeNumber(latest.homeYellowCards) + safeNumber(latest.awayYellowCards);
        const matchRedCards = safeNumber(latest.homeRedCards) + safeNumber(latest.awayRedCards);
        snapshotYellowCards += matchYellowCards;
        snapshotRedCards += matchRedCards;
        if (matchYellowCards > 0 || matchRedCards > 0) matchesWithCardSnapshots += 1;
        const capturedAt = latest.capturedAt instanceof Date ? latest.capturedAt.toISOString() : String(latest.capturedAt || '');
        if (capturedAt && (!latestCardsUpdatedAt || capturedAt > latestCardsUpdatedAt)) latestCardsUpdatedAt = capturedAt;
      }
    }

    const yellowCards = Math.max(snapshotYellowCards, yellowEventCount);
    const redCards = Math.max(snapshotRedCards, redEventCount);

    const penaltyEvents = matchEvents.filter((event) => isPenaltyEvent(event.type, event.detail));
    const penaltiesScored = penaltyEvents.filter((event) => isPenaltyScored(event.type, event.detail)).length;
    const penaltiesMissed = penaltyEvents.filter((event) => isPenaltyMissed(event.type, event.detail)).length;
    const penaltiesUnknown = Math.max(0, penaltyEvents.length - penaltiesScored - penaltiesMissed);
    const latestEventUpdatedAt = matchEvents
      .map((event) => event.updatedAt instanceof Date ? event.updatedAt.toISOString() : event.createdAt instanceof Date ? event.createdAt.toISOString() : '')
      .filter(Boolean)
      .sort()
      .pop() || null;

    return NextResponse.json({
      ok: true,
      source: 'database_summary_from_matches_snapshots_events_and_assets',
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
        available: matchEvents.length > 0,
        total: penaltyEvents.length,
        scored: penaltiesScored,
        missed: penaltiesMissed,
        unknown: penaltiesUnknown,
        source: matchEvents.length > 0 ? 'MatchEvent' : 'غير متوفر في المصادر',
      },
      biggestScore,
      snapshotsCount,
      cardsSource: {
        yellow: snapshotYellowCards >= yellowEventCount ? 'MatchStatsSnapshot' : 'MatchEvent fallback',
        red: snapshotRedCards >= redEventCount ? 'MatchStatsSnapshot' : 'MatchEvent fallback',
        snapshotYellowCards,
        snapshotRedCards,
        yellowEventCount,
        redEventCount,
      },
      matchesWithCardSnapshots,
      latestCardsUpdatedAt,
      latestEventUpdatedAt,
      latestUpdatedAt: maxIsoDate(latestCardsUpdatedAt, latestEventUpdatedAt),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('summary-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
