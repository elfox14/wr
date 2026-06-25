import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function numberParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function statPair(stats: Record<string, any>, key: string) {
  const pair = stats?.[key] || {};
  const home = Number(pair.home);
  const away = Number(pair.away);
  return {
    home: Number.isFinite(home) ? Math.round(home) : null,
    away: Number.isFinite(away) ? Math.round(away) : null,
  };
}

function snapshotStatColumns(normalized: any) {
  const stats = normalized?.liveStats?.stats || {};
  const possession = statPair(stats, 'possession');
  const shots = statPair(stats, 'shots');
  const shotsOnTarget = statPair(stats, 'shotsOnTarget');
  const shotsOffTarget = statPair(stats, 'shotsOffTarget');
  const corners = statPair(stats, 'corners');
  const yellowCards = statPair(stats, 'yellowCards');
  const redCards = statPair(stats, 'redCards');
  return {
    homePossession: possession.home,
    awayPossession: possession.away,
    homeShots: shots.home,
    awayShots: shots.away,
    homeShotsOnTarget: shotsOnTarget.home,
    awayShotsOnTarget: shotsOnTarget.away,
    homeShotsOffTarget: shotsOffTarget.home,
    awayShotsOffTarget: shotsOffTarget.away,
    homeCorners: corners.home,
    awayCorners: corners.away,
    homeYellowCards: yellowCards.home,
    awayYellowCards: yellowCards.away,
    homeRedCards: redCards.home,
    awayRedCards: redCards.away,
  };
}

function providerMatchNumber(value: unknown) {
  const n = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function deleteOldProviderData(matchId: string, options: { purgeISportsEvents: boolean; purgeISportsSnapshots: boolean; purgeFootballDataEvents: boolean; replaceTheStatsFinal: boolean; purgeTheStatsMatchEvents: boolean }) {
  const deleted: Record<string, number> = { snapshots: 0, events: 0 };

  if (options.replaceTheStatsFinal) {
    const stats = await prisma.matchStatsSnapshot.deleteMany({
      where: {
        matchId,
        provider: { in: ['THE_STATS_API_EXTRAS', 'THE_STATS_API_FINAL_CANONICAL', 'THE_STATS_API_MANUAL_FINAL'] },
      },
    });
    deleted.snapshots += stats.count;
  }

  if (options.purgeTheStatsMatchEvents) {
    const events = await prisma.matchEvent.deleteMany({
      where: {
        matchId,
        OR: [
          { sourceName: { startsWith: 'THE_STATS_API_FINAL' } },
          { sourceName: { startsWith: 'THE_STATS_API_MANUAL' } },
          { sourceName: 'THE_STATS_API_MANUAL_FINAL' },
          { sourceName: 'THE_STATS_API_FINAL_CANONICAL' },
          { sourceName: 'THE_STATS_API_FINAL_TIMELINE' },
          { sourceName: 'THE_STATS_API_FINAL_SHOTMAP' },
          { sourceName: 'TheStats' },
        ],
      },
    });
    deleted.events += events.count;
  }

  if (options.purgeISportsSnapshots) {
    const stats = await prisma.matchStatsSnapshot.deleteMany({
      where: {
        matchId,
        OR: [
          { provider: { contains: 'ISPORTS' } },
          { provider: { contains: 'WORKER_ISPORTS' } },
          { provider: { contains: 'AUTOMATED_LIVE_INGEST' } },
        ],
      },
    });
    deleted.snapshots += stats.count;
  }

  if (options.purgeISportsEvents) {
    const events = await prisma.matchEvent.deleteMany({
      where: {
        matchId,
        OR: [
          { sourceName: { contains: 'iSports' } },
          { sourceName: { contains: 'ISPORTS' } },
          { sourceName: { contains: 'Automated Live Ingest' } },
          { sourceName: { contains: 'Live Ingest' } },
        ],
      },
    });
    deleted.events += events.count;
  }

  if (options.purgeFootballDataEvents) {
    const events = await prisma.matchEvent.deleteMany({
      where: {
        matchId,
        OR: [
          { sourceName: { contains: 'Football-Data' } },
          { sourceName: { contains: 'FOOTBALL_DATA' } },
        ],
      },
    });
    deleted.events += events.count;
  }

  return deleted;
}

function localMatchWhere(since: Date, matchId?: string | null) {
  if (matchId) return { id: matchId } as any;
  return {
    status: { in: FINISHED_STATUSES },
    matchDate: { gte: since },
  } as any;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const dryRun = boolParam(url, 'dryRun', true) && !boolParam(url, 'apply', false);
  const limit = numberParam(url, 'limit', 2, 1, 12);
  const days = numberParam(url, 'days', 3, 1, 60);
  const timeoutMs = numberParam(url, 'timeoutMs', 30000, 3000, 60000);
  const requestsPerMinute = numberParam(url, 'requestsPerMinute', 90, 10, 120);
  const delayMs = Math.max(numberParam(url, 'delayMs', 0, 0, 10000), Math.ceil(60000 / requestsPerMinute));
  const includeRaw = boolParam(url, 'includeRaw', false);
  // Keep iSports stat snapshots by default, because they can supply fallback-only metrics such as attacks/dangerous attacks.
  const purgeISportsEvents = boolParam(url, 'purgeISportsEvents', true);
  const purgeISportsSnapshots = boolParam(url, 'purgeISportsSnapshots', false);
  const purgeFootballDataEvents = boolParam(url, 'purgeFootballDataEvents', true);
  const purgeTheStatsMatchEvents = boolParam(url, 'purgeTheStatsMatchEvents', true);
  const replaceTheStatsFinal = boolParam(url, 'replaceTheStatsFinal', true);
  const writeMatchEvents = boolParam(url, 'writeMatchEvents', false);
  const matchId = url.searchParams.get('matchId');
  const since = new Date(Date.now() - days * 864e5);
  const providerQuery = defaultTheStatsQuery(url.searchParams);

  const matches = await prisma.match.findMany({
    where: localMatchWhere(since, matchId),
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: { matchDate: 'desc' },
    take: matchId ? 1 : limit,
  });

  const processed = [];
  let providerRequestsBudgetApprox = 0;

  for (const match of matches) {
    try {
      const collected = await collectTheStatsMatchExtras(match, {
        dryRun: true,
        save: false,
        includeRaw,
        endpointMode: 'full',
        timeoutMs,
        delayMs,
        query: providerQuery,
      });
      providerRequestsBudgetApprox += 6;

      const normalized = (collected as any)?.debug?.normalizedPreview;
      const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
      const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
      const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
      const statsCount = Object.keys(normalized?.liveStats?.stats || {}).length;
      const hasUsefulData = Boolean(normalized) && (statsCount > 0 || events.length > 0 || shots.length > 0 || players.length > 0 || Boolean(normalized?.lineups));

      if (!collected.ok || !hasUsefulData) {
        processed.push({ matchId: match.id, status: 'skipped_no_final_the_stats_data', collected });
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }

      const providerMatchId = (collected as any).resolvedProviderMatchId;
      let deleted = { snapshots: 0, events: 0 };
      let snapshotId: string | null = null;
      let insertedEvents = 0;

      if (!dryRun) {
        deleted = await deleteOldProviderData(match.id, { purgeISportsEvents, purgeISportsSnapshots, purgeFootballDataEvents, replaceTheStatsFinal, purgeTheStatsMatchEvents });
        const snapshot = await prisma.matchStatsSnapshot.create({
          data: {
            id: randomUUID(),
            matchId: match.id,
            provider: 'THE_STATS_API_EXTRAS',
            providerMatchId: providerMatchNumber(providerMatchId),
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            ...snapshotStatColumns(normalized),
            rawData: {
              provider: 'THE_STATS_API',
              mode: 'final_canonical_after_match_snapshot_only',
              importedAt: new Date().toISOString(),
              resolvedProviderMatchId: providerMatchId,
              resolvedBy: (collected as any).resolvedBy,
              rateLimitPolicy: { requestsPerMinute, delayMs, note: 'Throttled to stay at or below TheStatsAPI request limit.' },
              displayPolicy: { eventsSource: 'snapshot.normalized.eventsDetailed.all', writeMatchEvents, fallbackMetrics: 'iSports snapshots may be kept for attacks/dangerous attacks only.', note: 'Final TheStats events are kept in the snapshot by default to avoid duplicating MatchEvent rows.' },
              normalized,
            },
          },
          select: { id: true },
        });
        snapshotId = snapshot.id;
        insertedEvents = 0;
      }

      processed.push({
        matchId: match.id,
        teams: `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`,
        status: dryRun ? 'dry_run_ok' : 'finalized_from_the_stats_snapshot_only',
        providerMatchId,
        resolvedBy: (collected as any).resolvedBy,
        counts: { stats: statsCount, events: events.length, shots: shots.length, playerStats: players.length, lineups: normalized?.lineups ? 1 : 0 },
        deleted,
        snapshotId,
        insertedEvents,
        writeMatchEvents,
      });
    } catch (error: any) {
      processed.push({ matchId: match.id, status: 'failed', error: error?.message || String(error), code: error?.code || null, providerStatus: error?.status || null });
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return NextResponse.json({
    ok: true,
    mode: 'the_stats_finalize_matches_v2_snapshot_only',
    dryRun,
    note: dryRun ? 'Add apply=true or dryRun=false to write final canonical TheStats snapshot.' : 'Final TheStats snapshot was written as THE_STATS_API_EXTRAS. TheStats events are snapshot-only by default; iSports stat snapshots can remain for fallback attack metrics.',
    policy: {
      sourceOfTruth: 'THE_STATS_API for final post-match events and statistics',
      fallbackStats: 'iSports snapshots may be used only for metrics TheStats does not provide, such as attacks/dangerous attacks.',
      resultsSource: 'Football-Data may remain source of score/status unless you explicitly replace it elsewhere.',
      eventsStorage: writeMatchEvents ? 'MatchEvent rows enabled by query param' : 'snapshot-only to avoid duplicates',
      requestsPerMinute,
      delayMs,
      theStatsLimitSafety: requestsPerMinute <= 120,
    },
    cleanup: { purgeISportsEvents, purgeISportsSnapshots, purgeFootballDataEvents, purgeTheStatsMatchEvents, replaceTheStatsFinal },
    scope: { matchId, limit: matchId ? 1 : limit, days, localMatches: matches.length },
    providerRequestsBudgetApprox,
    processed,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
