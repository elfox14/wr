import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EXPECTED_TOURNAMENT_MATCHES = 104;
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'ET', 'BT', 'P', 'PEN_LIVE'];
const SCHEDULED = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

type MatchRow = {
  id: string;
  externalId: string | null;
  syncSource: string | null;
  status: string;
  stage: string | null;
  groupPhase: string | null;
  matchDate: Date;
  lastSyncedAt: Date | null;
  homeTeam: { id: string; name: string; code: string | null };
  awayTeam: { id: string; name: string; code: string | null };
};

type SnapshotCoverageRow = {
  matchId: string;
  latestSnapshotAt: Date | string | null;
  hasTeamStats: boolean | null;
  hasPlayerStats: boolean | null;
  hasDetailedEvents: boolean | null;
  hasShotmap: boolean | null;
};

type EventCoverageRow = {
  matchId: string;
  events: bigint | number | string;
};

function upper(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function statusKind(value?: string | null) {
  const status = upper(value);
  if (FINISHED.includes(status)) return 'finished' as const;
  if (LIVE.includes(status)) return 'live' as const;
  if (SCHEDULED.includes(status)) return 'scheduled' as const;
  return 'scheduled' as const;
}

function stageKey(match: MatchRow) {
  const raw = `${match.stage || ''} ${match.groupPhase || ''}`.trim().toLowerCase();
  if (raw.includes('third') || raw.includes('bronze')) return 'third_place';
  if (raw.includes('semi')) return 'semi_finals';
  if (raw.includes('quarter')) return 'quarter_finals';
  if (raw.includes('round_of_16') || raw.includes('last_16') || raw.includes('r16') || raw.includes('round of 16')) return 'round_of_16';
  if (raw.includes('round_of_32') || raw.includes('last_32') || raw.includes('r32') || raw.includes('round of 32')) return 'round_of_32';
  if (raw === 'final' || raw.includes(' final')) return 'final';
  const group = raw.match(/group[_\s-]*([a-l])/i)?.[1] || 'group';
  return `group_${group.toUpperCase()}`;
}

function canonicalPriority(match: MatchRow) {
  const fifa = upper(match.syncSource).includes('FIFA') || String(match.externalId || '').toLowerCase().startsWith('fifa-');
  return (fifa ? 1_000_000_000_000_000 : 0) + Number(match.lastSyncedAt?.getTime() || 0);
}

function canonicalize(matches: MatchRow[]) {
  const byFixture = new Map<string, MatchRow>();
  for (const match of matches) {
    const pair = [match.homeTeam.id, match.awayTeam.id].sort().join('|');
    const key = `${stageKey(match)}:${pair}`;
    const current = byFixture.get(key);
    if (!current || canonicalPriority(match) > canonicalPriority(current)) byFixture.set(key, match);
  }
  return [...byFixture.values()];
}

function percent(covered: number, total: number) {
  return total > 0 ? Number(((covered / total) * 100).toFixed(1)) : 100;
}

function asNumber(value: bigint | number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function latestIso(values: Array<Date | string | null | undefined>) {
  return values.map(iso).filter((value): value is string => Boolean(value)).sort().pop() || null;
}

export async function GET() {
  try {
    const [
      rawMatches,
      snapshotCoverage,
      matchEventCoverage,
      snapshots,
      theStatsSnapshots,
      playerPerformanceRows,
      goalRows,
      assistRows,
      saveRows,
      eventGoals,
      latestSnapshots,
      performanceFreshness,
    ] = await Promise.all([
      prisma.match.findMany({
        select: {
          id: true,
          externalId: true,
          syncSource: true,
          status: true,
          stage: true,
          groupPhase: true,
          matchDate: true,
          lastSyncedAt: true,
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
        },
        orderBy: { matchDate: 'asc' },
      }),
      prisma.$queryRawUnsafe<SnapshotCoverageRow[]>(`
        SELECT
          s."matchId",
          MAX(s."capturedAt") AS "latestSnapshotAt",
          BOOL_OR(
            s."provider" LIKE 'THE_STATS_API%'
            AND (
              s."homePossession" IS NOT NULL OR s."awayPossession" IS NOT NULL
              OR s."homeShots" IS NOT NULL OR s."awayShots" IS NOT NULL
              OR s."homeShotsOnTarget" IS NOT NULL OR s."awayShotsOnTarget" IS NOT NULL
              OR s."homeCorners" IS NOT NULL OR s."awayCorners" IS NOT NULL
              OR (
                jsonb_typeof(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,liveStats,stats}') = 'object'
                AND COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,liveStats,stats}' <> '{}'::jsonb
              )
            )
          ) AS "hasTeamStats",
          BOOL_OR(
            s."provider" LIKE 'THE_STATS_API%'
            AND CASE
              WHEN jsonb_typeof(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,playerStats}') = 'array'
              THEN jsonb_array_length(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,playerStats}')
              ELSE 0
            END > 0
          ) AS "hasPlayerStats",
          BOOL_OR(
            s."provider" LIKE 'THE_STATS_API%'
            AND CASE
              WHEN jsonb_typeof(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,eventsDetailed,all}') = 'array'
              THEN jsonb_array_length(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,eventsDetailed,all}')
              ELSE 0
            END > 0
          ) AS "hasDetailedEvents",
          BOOL_OR(
            s."provider" LIKE 'THE_STATS_API%'
            AND CASE
              WHEN jsonb_typeof(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,shotmap}') = 'array'
              THEN jsonb_array_length(COALESCE(s."rawData"::jsonb, '{}'::jsonb) #> '{normalized,shotmap}')
              ELSE 0
            END > 0
          ) AS "hasShotmap"
        FROM "MatchStatsSnapshot" s
        GROUP BY s."matchId"
      `),
      prisma.$queryRawUnsafe<EventCoverageRow[]>(`
        SELECT "matchId", COUNT(*) AS events
        FROM "MatchEvent"
        GROUP BY "matchId"
      `),
      prisma.matchStatsSnapshot.count(),
      prisma.matchStatsSnapshot.count({ where: { provider: { startsWith: 'THE_STATS_API' } } }),
      prisma.playerPerformance.count(),
      prisma.playerPerformance.count({ where: { goals: { gt: 0 } } }),
      prisma.playerPerformance.count({ where: { assists: { gt: 0 } } }),
      prisma.playerPerformance.count({ where: { saves: { gt: 0 } } }),
      prisma.matchEvent.count({ where: { type: 'goal' } }),
      prisma.matchStatsSnapshot.findMany({
        orderBy: { capturedAt: 'desc' },
        take: 8,
        select: { matchId: true, provider: true, capturedAt: true, providerMatchId: true },
      }),
      prisma.playerPerformance.aggregate({ _max: { updatedAt: true } }),
    ]);

    const matches = canonicalize(rawMatches as MatchRow[]).sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());
    const finishedMatches = matches.filter((match) => statusKind(match.status) === 'finished');
    const liveMatches = matches.filter((match) => statusKind(match.status) === 'live');
    const scheduledMatches = matches.filter((match) => statusKind(match.status) === 'scheduled');
    const snapshotByMatch = new Map(snapshotCoverage.map((row) => [row.matchId, row]));
    const eventsByMatch = new Map(matchEventCoverage.map((row) => [row.matchId, asNumber(row.events)]));

    let finishedWithTeamStats = 0;
    let finishedWithPlayerStats = 0;
    let finishedWithDetailedEvents = 0;
    let finishedWithShotmap = 0;
    const missingMatches: Array<{
      matchId: string;
      teams: string;
      matchDate: string;
      stage: string;
      missing: string[];
    }> = [];

    for (const match of finishedMatches) {
      const coverage = snapshotByMatch.get(match.id);
      const hasTeamStats = Boolean(coverage?.hasTeamStats);
      const hasPlayerStats = Boolean(coverage?.hasPlayerStats);
      const hasDetailedEvents = Boolean(coverage?.hasDetailedEvents) || (eventsByMatch.get(match.id) || 0) > 0;
      const hasShotmap = Boolean(coverage?.hasShotmap);
      if (hasTeamStats) finishedWithTeamStats += 1;
      if (hasPlayerStats) finishedWithPlayerStats += 1;
      if (hasDetailedEvents) finishedWithDetailedEvents += 1;
      if (hasShotmap) finishedWithShotmap += 1;

      const missing = [
        !hasTeamStats ? 'team_statistics' : null,
        !hasPlayerStats ? 'player_statistics' : null,
        !hasDetailedEvents ? 'events' : null,
        !hasShotmap ? 'shotmap' : null,
      ].filter((value): value is string => Boolean(value));

      if (missing.length && missingMatches.length < 24) {
        missingMatches.push({
          matchId: match.id,
          teams: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          matchDate: match.matchDate.toISOString(),
          stage: stageKey(match),
          missing,
        });
      }
    }

    const stageCoverage = Object.entries(matches.reduce<Record<string, number>>((acc, match) => {
      const key = stageKey(match);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}))
      .map(([stage, confirmed]) => ({ stage, confirmed }))
      .sort((a, b) => a.stage.localeCompare(b.stage));

    const latestSnapshotAt = latestIso(snapshotCoverage.map((row) => row.latestSnapshotAt));
    const latestPerformanceAt = iso(performanceFreshness._max.updatedAt);
    const latestMatchSyncAt = latestIso(matches.map((match) => match.lastSyncedAt));
    const latestDataAt = latestIso([latestSnapshotAt, latestPerformanceAt, latestMatchSyncAt]);
    const generatedAt = new Date();
    const stalenessMinutes = latestDataAt
      ? Math.max(0, Math.round((generatedAt.getTime() - new Date(latestDataAt).getTime()) / 60000))
      : null;

    const coverage = {
      confirmedFixtures: {
        covered: matches.length,
        total: EXPECTED_TOURNAMENT_MATCHES,
        percent: percent(matches.length, EXPECTED_TOURNAMENT_MATCHES),
      },
      finishedTeamStatistics: {
        covered: finishedWithTeamStats,
        total: finishedMatches.length,
        percent: percent(finishedWithTeamStats, finishedMatches.length),
      },
      finishedPlayerStatistics: {
        covered: finishedWithPlayerStats,
        total: finishedMatches.length,
        percent: percent(finishedWithPlayerStats, finishedMatches.length),
      },
      finishedEvents: {
        covered: finishedWithDetailedEvents,
        total: finishedMatches.length,
        percent: percent(finishedWithDetailedEvents, finishedMatches.length),
      },
      finishedShotmaps: {
        covered: finishedWithShotmap,
        total: finishedMatches.length,
        percent: percent(finishedWithShotmap, finishedMatches.length),
      },
    };

    return NextResponse.json({
      ok: true,
      mode: 'statistics_health_v2_complete_tournament_coverage',
      complete: {
        schedule: matches.length >= EXPECTED_TOURNAMENT_MATCHES,
        finishedTeamStatistics: finishedWithTeamStats >= finishedMatches.length,
        finishedPlayerStatistics: finishedWithPlayerStats >= finishedMatches.length,
        finishedEvents: finishedWithDetailedEvents >= finishedMatches.length,
        allVerifiedData: matches.length >= EXPECTED_TOURNAMENT_MATCHES
          && finishedWithTeamStats >= finishedMatches.length
          && finishedWithPlayerStats >= finishedMatches.length
          && finishedWithDetailedEvents >= finishedMatches.length,
      },
      tournament: {
        expectedMatches: EXPECTED_TOURNAMENT_MATCHES,
        confirmedCanonicalMatches: matches.length,
        unconfirmedFixtures: Math.max(0, EXPECTED_TOURNAMENT_MATCHES - matches.length),
        finishedMatches: finishedMatches.length,
        liveMatches: liveMatches.length,
        scheduledMatches: scheduledMatches.length,
        rawMatchRows: rawMatches.length,
        duplicateRowsExcluded: Math.max(0, rawMatches.length - matches.length),
        stageCoverage,
        note: 'Final and third-place fixtures remain unconfirmed until FIFA publishes both official participants; no placeholder teams are fabricated.',
      },
      coverage,
      counts: {
        matches: rawMatches.length,
        canonicalMatches: matches.length,
        snapshots,
        theStatsSnapshots,
        playerPerformanceRows,
        playerRowsWithGoals: goalRows,
        playerRowsWithAssists: assistRows,
        playerRowsWithSaves: saveRows,
        matchEventGoals: eventGoals,
      },
      missingMatches,
      freshness: {
        latestSnapshotAt,
        latestPerformanceAt,
        latestMatchSyncAt,
        latestDataAt,
        stalenessMinutes,
      },
      latestSnapshots,
      generatedAt: generatedAt.toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    console.error('statistics health error', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'statistics_health_failed',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
