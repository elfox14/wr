import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const THE_STATS_PROVIDERS = ['THE_STATS_API_EXTRAS', 'THE_STATS_API_FINAL_CANONICAL', 'THE_STATS_API_MANUAL_FINAL', 'THE_STATS_API_MANUAL_BASIC'];

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function dateParam(url: URL, name: string, fallback: string) {
  const raw = String(url.searchParams.get(name) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function n(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function statPair(stats: Record<string, any>, key: string) {
  const pair = stats?.[key] || {};
  const home = n(pair.home);
  const away = n(pair.away);
  return {
    home: home === null ? null : Math.round(home),
    away: away === null ? null : Math.round(away),
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

function countsFromNormalized(normalized: any) {
  const stats = normalized?.liveStats?.stats || {};
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  const playerRatings = players.filter((player: any) => player?.rating !== null && player?.rating !== undefined && player?.rating !== '').length;
  return {
    stats: Object.keys(stats || {}).length,
    events: events.length,
    shots: shots.length,
    players: players.length,
    playerRatings,
    lineups: normalized?.lineups ? 1 : 0,
  };
}

function snapshotCounts(snapshot: any) {
  const normalized = snapshot?.rawData?.normalized || {};
  return countsFromNormalized(normalized);
}

function completeEnough(snapshot: any, requireEvents: boolean) {
  if (!snapshot) return false;
  const counts = snapshotCounts(snapshot);
  const hasStats = counts.stats > 0 || [snapshot.homePossession, snapshot.homeShots, snapshot.homeShotsOnTarget].some((value) => value !== null && value !== undefined);
  const hasPlayers = counts.players > 0 || counts.playerRatings > 0;
  const hasEvents = counts.events > 0;
  return Boolean(hasStats && hasPlayers && (!requireEvents || hasEvents));
}

function providerMatchNumber(value: unknown) {
  const number = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(number) ? number : 0;
}

async function deleteOldTheStatsData(matchId: string) {
  const deletedSnapshots = await prisma.matchStatsSnapshot.deleteMany({
    where: {
      matchId,
      OR: [
        { provider: { in: THE_STATS_PROVIDERS } },
        { provider: { startsWith: 'THE_STATS_API' } },
      ],
    },
  });

  const deletedEvents = await prisma.matchEvent.deleteMany({
    where: {
      matchId,
      OR: [
        { sourceName: { startsWith: 'THE_STATS_API' } },
        { sourceName: { contains: 'TheStats' } },
        { sourceName: { contains: 'THE_STATS' } },
      ],
    },
  });

  return { snapshots: deletedSnapshots.count, events: deletedEvents.count };
}

async function candidateMatches(options: { from: string; to: string; limit: number; force: boolean; requireEvents: boolean }) {
  const matches = await prisma.match.findMany({
    where: {
      status: { in: FINISHED_STATUSES },
      matchDate: {
        gte: new Date(`${options.from}T00:00:00.000Z`),
        lte: new Date(`${options.to}T23:59:59.999Z`),
      },
    },
    orderBy: { matchDate: 'asc' },
    take: 120,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: {
        where: { provider: { startsWith: 'THE_STATS_API' } },
        orderBy: { capturedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          provider: true,
          providerMatchId: true,
          capturedAt: true,
          homePossession: true,
          homeShots: true,
          homeShotsOnTarget: true,
          rawData: true,
        },
      },
    },
  });

  const filtered = options.force
    ? matches
    : matches.filter((match) => !completeEnough(match.statsSnapshots[0], options.requireEvents));

  return filtered.slice(0, options.limit);
}

async function saveSnapshot(match: any, collected: any, options: { includeRaw: boolean; requestsPerMinute: number; delayMs: number }) {
  const normalized = collected?.debug?.normalizedPreview || {};
  const counts = countsFromNormalized(normalized);
  const providerMatchId = collected?.resolvedProviderMatchId;
  const deleted = await deleteOldTheStatsData(match.id);

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
        mode: 'final_backfill_5_matches_snapshot_only_v1',
        importedAt: new Date().toISOString(),
        resolvedProviderMatchId: providerMatchId,
        resolvedBy: collected?.resolvedBy,
        noDuplicatePolicy: {
          storage: 'snapshot-only',
          matchEventsWritten: false,
          replacedOldTheStatsSnapshots: true,
          deletedOldTheStatsMatchEvents: true,
        },
        rateLimitPolicy: {
          requestsPerMinute: options.requestsPerMinute,
          delayMs: options.delayMs,
          estimatedProviderRequestsForThisMatch: 6,
        },
        counts,
        normalized,
        ...(options.includeRaw && collected?.debug?.endpoints ? { raw: collected.debug.endpoints } : {}),
      },
    },
    select: { id: true },
  });

  return { snapshotId: snapshot.id, counts, deleted };
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return response({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const startedAt = Date.now();
  const from = dateParam(url, 'from', process.env.WORLD_CUP_TOURNAMENT_START_DATE || '2026-06-14');
  const to = dateParam(url, 'to', todayIso());
  const limit = intParam(url, 'limit', 5, 1, 5);
  const requestsPerMinute = intParam(url, 'requestsPerMinute', 120, 30, 120);
  const delayMs = Math.max(intParam(url, 'delayMs', 0, 0, 5000), Math.ceil(60000 / requestsPerMinute));
  const timeoutMs = intParam(url, 'timeoutMs', 15000, 3000, 60000);
  const force = boolParam(url, 'force', false);
  const includeRaw = boolParam(url, 'includeRaw', false);
  const requireEvents = boolParam(url, 'requireEvents', true);
  const dryRun = boolParam(url, 'dryRun', false);

  const providerParams = new URLSearchParams(url.searchParams);
  providerParams.set('date_from', from);
  providerParams.set('date_to', to);
  providerParams.set('providerMatchesPerPage', String(intParam(url, 'providerMatchesPerPage', 100, 50, 100)));
  const providerQuery = defaultTheStatsQuery(providerParams);

  const matches = await candidateMatches({ from, to, limit, force, requireEvents });
  const processed = [];
  let estimatedProviderRequests = 0;

  for (const match of matches) {
    const label = `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`;
    try {
      if (dryRun) {
        processed.push({ matchId: match.id, teams: label, status: 'dry_run_candidate', date: match.matchDate, existingSnapshotId: match.statsSnapshots[0]?.id || null, existingCounts: snapshotCounts(match.statsSnapshots[0]) });
        continue;
      }

      const collected = await collectTheStatsMatchExtras(match, {
        dryRun: true,
        save: false,
        includeRaw,
        endpointMode: 'full',
        timeoutMs,
        delayMs,
        query: providerQuery,
      });
      estimatedProviderRequests += 6;

      if (!collected.ok) {
        processed.push({ matchId: match.id, teams: label, status: 'failed_collect', error: collected.error || 'no useful data', resolved: collected.resolved || null, endpointsFailed: collected.endpointsFailed || [] });
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }

      const normalized = (collected as any)?.debug?.normalizedPreview || {};
      const counts = countsFromNormalized(normalized);
      if (requireEvents && counts.events <= 0) {
        processed.push({ matchId: match.id, teams: label, status: 'skipped_no_timeline_events_from_source', providerMatchId: (collected as any).resolvedProviderMatchId, counts });
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }

      const saved = await saveSnapshot(match, collected, { includeRaw, requestsPerMinute, delayMs });
      processed.push({
        matchId: match.id,
        teams: label,
        status: 'saved_snapshot_only_no_duplicate_events',
        providerMatchId: (collected as any).resolvedProviderMatchId,
        resolvedBy: (collected as any).resolvedBy,
        snapshotId: saved.snapshotId,
        counts: saved.counts,
        deleted: saved.deleted,
      });
    } catch (error: any) {
      processed.push({ matchId: match.id, teams: label, status: 'failed', error: error?.message || String(error), code: error?.code || null, providerStatus: error?.status || null });
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return response({
    ok: true,
    mode: 'the_stats_backfill_finals_v1_5_matches_snapshot_only',
    durationMs: Date.now() - startedAt,
    dryRun,
    scope: { from, to, limit, selected: matches.length, force, requireEvents },
    rateLimit: { requestsPerMinute, delayMs, estimatedProviderRequests, safeUnder120PerMinute: requestsPerMinute <= 120 },
    noDuplicatePolicy: {
      writeMatchEvents: false,
      storage: 'THE_STATS_API_EXTRAS snapshot only',
      replacesOldTheStatsSnapshots: true,
      deletesOldTheStatsMatchEventRows: true,
      keepsFootballDataAndISportsData: true,
    },
    processed,
    nextRunHint: matches.length === 0 ? 'No more finished matches need TheStats backfill in this date range.' : 'Run the same URL again to process the next 5 matches.',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
