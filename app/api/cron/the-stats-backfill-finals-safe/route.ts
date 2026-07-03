import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const n = Number(url.searchParams.get(name) ?? fallback);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function dateParam(url: URL, name: string, fallback: string) {
  const raw = String(url.searchParams.get(name) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function numberId(value: unknown) { const n = Number(String(value || '').replace(/\D/g, '')); return Number.isFinite(n) ? n : 0; }
function num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : null; }

function countsFrom(normalized: any) {
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  const playerRatings = players.filter((p: any) => p?.rating !== null && p?.rating !== undefined && p?.rating !== '').length;
  return { stats: Object.keys(stats).length, events: events.length, shots: shots.length, players: players.length, playerRatings, lineups: normalized?.lineups ? 1 : 0 };
}

function existingCounts(snapshot: any) { return countsFrom(snapshot?.rawData?.normalized || {}); }
function completeEnough(snapshot: any, requireEvents: boolean) {
  if (!snapshot) return false;
  const c = existingCounts(snapshot);
  const hasColumnStats = [snapshot.homePossession, snapshot.homeShots, snapshot.homeShotsOnTarget].some((v) => v !== null && v !== undefined);
  return Boolean((c.stats > 0 || hasColumnStats) && c.players > 0 && (!requireEvents || c.events > 0));
}

function statPair(stats: any, key: string) {
  const value = stats?.[key] || {};
  return { home: num(value.home), away: num(value.away) };
}

function columns(normalized: any) {
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  const possession = statPair(stats, 'possession');
  const shots = statPair(stats, 'shots');
  const onTarget = statPair(stats, 'shotsOnTarget');
  const offTarget = statPair(stats, 'shotsOffTarget');
  const corners = statPair(stats, 'corners');
  const yellow = statPair(stats, 'yellowCards');
  const red = statPair(stats, 'redCards');
  return {
    homePossession: possession.home, awayPossession: possession.away,
    homeShots: shots.home, awayShots: shots.away,
    homeShotsOnTarget: onTarget.home, awayShotsOnTarget: onTarget.away,
    homeShotsOffTarget: offTarget.home, awayShotsOffTarget: offTarget.away,
    homeCorners: corners.home, awayCorners: corners.away,
    homeYellowCards: yellow.home, awayYellowCards: yellow.away,
    homeRedCards: red.home, awayRedCards: red.away,
  };
}

function endpointsFailed(collected: any) { return Array.isArray(collected?.endpointsFailed) ? collected.endpointsFailed : []; }
function endpointStatus(item: any) { return Number(item?.status ?? item?.error?.status ?? 0) || 0; }
function all404(collected: any) {
  const failed = endpointsFailed(collected);
  return failed.length > 0 && failed.every((item: any) => endpointStatus(item) === 404);
}
function any429(collected: any) {
  return endpointsFailed(collected).some((item: any) => endpointStatus(item) === 429 || /\b429\b|rate.?limit|too many|quota/i.test(String(item?.message || item?.error?.message || '')));
}

async function ensureSkipTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TheStatsBackfillSkip" (
      "matchId" TEXT PRIMARY KEY,
      "reason" TEXT NOT NULL,
      "providerMatchId" TEXT NULL,
      "retryAfter" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
}

async function markSkip(matchId: string, reason: string, providerMatchId: string | null, retryAfter: Date) {
  await ensureSkipTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TheStatsBackfillSkip" ("matchId", "reason", "providerMatchId", "retryAfter", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT ("matchId") DO UPDATE SET "reason" = EXCLUDED."reason", "providerMatchId" = EXCLUDED."providerMatchId", "retryAfter" = EXCLUDED."retryAfter", "updatedAt" = NOW()`,
    matchId,
    reason.slice(0, 500),
    providerMatchId,
    retryAfter,
  ).catch(() => undefined);
}

async function activeSkips() {
  await ensureSkipTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT "matchId", "reason", "providerMatchId", "retryAfter" FROM "TheStatsBackfillSkip" WHERE "retryAfter" > NOW()`).catch(() => []);
  return new Map(rows.map((row) => [row.matchId, row]));
}

async function deleteOldTheStats(matchId: string) {
  const snapshots = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, provider: { startsWith: 'THE_STATS_API' } } });
  const events = await prisma.matchEvent.deleteMany({ where: { matchId, OR: [{ sourceName: { startsWith: 'THE_STATS_API' } }, { sourceName: { contains: 'TheStats' } }, { sourceName: { contains: 'THE_STATS' } }] } });
  return { snapshots: snapshots.count, events: events.count };
}

async function saveSnapshot(match: any, collected: any, includeRaw: boolean) {
  const normalized = collected?.debug?.normalizedPreview || {};
  const deleted = await deleteOldTheStats(match.id);
  const snapshot = await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId: match.id,
      provider: 'THE_STATS_API_EXTRAS',
      providerMatchId: numberId(collected?.resolvedProviderMatchId),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      ...columns(normalized),
      rawData: {
        provider: 'THE_STATS_API',
        mode: 'safe_backfill_snapshot_only_skip_404_v3_single_match_default',
        importedAt: new Date().toISOString(),
        resolvedProviderMatchId: collected?.resolvedProviderMatchId,
        resolvedBy: collected?.resolvedBy,
        noDuplicatePolicy: { storage: 'snapshot-only', matchEventsWritten: false, deletedOldTheStatsMatchEvents: true },
        counts: countsFrom(normalized),
        normalized,
        ...(includeRaw && collected?.debug?.endpoints ? { raw: collected.debug.endpoints } : {}),
      },
    },
    select: { id: true },
  });
  return { snapshotId: snapshot.id, counts: countsFrom(normalized), deleted };
}

async function loadCandidates(options: { from: string; to: string; limit: number; requireEvents: boolean; skip404: boolean }) {
  const skipMap = options.skip404 ? await activeSkips() : new Map();
  const matches = await prisma.match.findMany({
    where: { status: { in: FINISHED }, matchDate: { gte: new Date(`${options.from}T00:00:00.000Z`), lte: new Date(`${options.to}T23:59:59.999Z`) } },
    orderBy: { matchDate: 'asc' },
    take: 160,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: { where: { provider: { startsWith: 'THE_STATS_API' } }, orderBy: { capturedAt: 'desc' }, take: 1, select: { id: true, homePossession: true, homeShots: true, homeShotsOnTarget: true, rawData: true } },
    },
  });

  const skippedActive: any[] = [];
  const candidates = [];
  for (const match of matches) {
    if (completeEnough(match.statsSnapshots[0], options.requireEvents)) continue;
    const skipped = skipMap.get(match.id);
    if (skipped) {
      skippedActive.push({ matchId: match.id, teams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, reason: skipped.reason, retryAfter: skipped.retryAfter });
      continue;
    }
    candidates.push(match);
    if (candidates.length >= options.limit) break;
  }
  return { candidates, skippedActive };
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const url = new URL(req.url);
  const startedAt = Date.now();
  const from = dateParam(url, 'from', process.env.WORLD_CUP_TOURNAMENT_START_DATE || '2026-06-14');
  const to = dateParam(url, 'to', todayIso());
  const limit = intParam(url, 'limit', 1, 1, 2);
  const requestsPerMinute = intParam(url, 'requestsPerMinute', 30, 10, 60);
  const delayMs = Math.max(intParam(url, 'delayMs', 2500, 0, 15000), Math.ceil(60000 / requestsPerMinute));
  const betweenMatchesDelayMs = intParam(url, 'betweenMatchesDelayMs', 2500, 0, 30000);
  const timeoutMs = intParam(url, 'timeoutMs', 15000, 3000, 45000);
  const includeRaw = boolParam(url, 'includeRaw', false);
  const requireEvents = boolParam(url, 'requireEvents', false);
  const dryRun = boolParam(url, 'dryRun', false);
  const skip404 = boolParam(url, 'skip404', true);
  const skipHours = intParam(url, 'skipHours', 12, 1, 72);
  const stopOn429 = boolParam(url, 'stopOn429', true);

  const providerParams = new URLSearchParams(url.searchParams);
  providerParams.set('date_from', from);
  providerParams.set('date_to', to);
  const providerQuery = defaultTheStatsQuery(providerParams);
  const { candidates, skippedActive } = await loadCandidates({ from, to, limit, requireEvents, skip404 });
  const processed: any[] = [];
  let stoppedEarly: any = null;
  let estimatedProviderRequests = 0;

  for (const match of candidates) {
    const teams = `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`;
    if (dryRun) { processed.push({ matchId: match.id, teams, status: 'dry_run_candidate' }); continue; }
    const collected = await collectTheStatsMatchExtras(match, { dryRun: true, save: false, includeRaw, endpointMode: 'full', timeoutMs, delayMs, query: providerQuery });
    estimatedProviderRequests += 6;

    if (!collected.ok) {
      if (skip404 && all404(collected)) {
        const retryAfter = new Date(Date.now() + skipHours * 36e5);
        await markSkip(match.id, 'all details endpoints returned 404', (collected as any)?.resolvedProviderMatchId || null, retryAfter);
        processed.push({ matchId: match.id, teams, status: 'skipped_404_temporarily', retryAfter, endpointsFailed: endpointsFailed(collected) });
        if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
        continue;
      }

      if (stopOn429 && any429(collected)) {
        processed.push({ matchId: match.id, teams, status: 'rate_limited_stop', error: collected.error, endpointsFailed: endpointsFailed(collected) });
        stoppedEarly = { reason: '429 from TheStats', matchId: match.id, teams };
        break;
      }

      processed.push({ matchId: match.id, teams, status: 'failed_collect', error: collected.error || 'no useful data', resolved: collected.resolved || null, endpointsFailed: endpointsFailed(collected) });
      if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
      continue;
    }

    const normalized = (collected as any)?.debug?.normalizedPreview || {};
    const counts = countsFrom(normalized);
    if (requireEvents && counts.events <= 0) {
      processed.push({ matchId: match.id, teams, status: 'skipped_no_events_from_source', providerMatchId: (collected as any).resolvedProviderMatchId, counts });
      if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
      continue;
    }
    const saved = await saveSnapshot(match, collected, includeRaw);
    processed.push({ matchId: match.id, teams, status: 'saved_snapshot_only_no_duplicate_events', providerMatchId: (collected as any).resolvedProviderMatchId, resolvedBy: (collected as any).resolvedBy, snapshotId: saved.snapshotId, counts: saved.counts, deleted: saved.deleted });
    if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
  }

  const savedCount = processed.filter((item) => item.status === 'saved_snapshot_only_no_duplicate_events').length;
  const revalidation = savedCount > 0 ? revalidateStatsViews('the-stats-safe-backfill') : null;

  return json({
    ok: true,
    mode: 'the_stats_backfill_finals_safe_v3_single_match_default_cached_stats',
    durationMs: Date.now() - startedAt,
    dryRun,
    stoppedEarly,
    scope: { from, to, limit, selected: candidates.length, requireEvents, skip404, skipHours },
    rateLimit: { requestsPerMinute, delayMs, betweenMatchesDelayMs, estimatedProviderRequests, stopOn429 },
    noDuplicatePolicy: { writeMatchEvents: false, storage: 'THE_STATS_API_EXTRAS snapshot only', deletesOldTheStatsMatchEventRows: true },
    cache: { revalidated: Boolean(revalidation), revalidation },
    skippedActive,
    processed,
    nextRunHint: stoppedEarly ? 'Wait 10-20 minutes, then run again with limit=1.' : 'Run again to process the next match. Default is intentionally one match per request to avoid Render 502.',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
