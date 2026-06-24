import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BREAK'];

function boolFrom(value: string | null | undefined, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberFrom(value: string | null | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function statusList(allowLive: boolean) {
  return allowLive ? [...FINISHED_STATUSES, ...LIVE_STATUSES] : FINISHED_STATUSES;
}

function snapshotHasFullExtras(snapshot: any) {
  const raw = snapshot?.rawData || {};
  const normalized = raw.normalized || {};
  const counts = raw.counts || {};
  const shots = Array.isArray(normalized.shotmap) ? normalized.shotmap.length : Number(counts.shots || 0);
  const playerStats = Array.isArray(normalized.playerStats) ? normalized.playerStats.length : Number(counts.playerStats || 0);
  const lineups = normalized.lineups ? Number(counts.lineups || 1) : Number(counts.lineups || 0);
  return shots > 0 || playerStats > 0 || lineups > 0;
}

function isRateLimitError(error: any) {
  const text = `${error?.message || ''} ${error?.status || ''} ${error?.code || ''} ${JSON.stringify(error?.payload || {})}`.toLowerCase();
  return text.includes('429') || text.includes('rate limit') || text.includes('too many requests');
}

async function alreadyHasRecentFullExtras(matchId: string, freshnessHours: number) {
  const since = new Date(Date.now() - freshnessHours * 60 * 60 * 1000);
  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      matchId,
      provider: { startsWith: 'THE_STATS_API' },
      capturedAt: { gte: since },
    },
    orderBy: { capturedAt: 'desc' },
    take: 8,
    select: { rawData: true, capturedAt: true, provider: true },
  }).catch(() => []);

  return snapshots.some(snapshotHasFullExtras);
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const limit = numberFrom(url.searchParams.get('limit') || process.env.MATCH_EXTRAS_SYNC_LIMIT, 5, 1, 20);
  const lookbackDays = numberFrom(url.searchParams.get('lookbackDays') || process.env.MATCH_EXTRAS_SYNC_LOOKBACK_DAYS, 14, 1, 90);
  const freshnessHours = numberFrom(url.searchParams.get('freshnessHours') || process.env.MATCH_EXTRAS_SYNC_FRESHNESS_HOURS, 12, 1, 168);
  const timeoutMs = numberFrom(url.searchParams.get('timeoutMs') || process.env.MATCH_EXTRAS_TIMEOUT_MS || process.env.THE_STATS_API_TIMEOUT_MS, 15000, 3000, 60000);
  const allowLive = boolFrom(url.searchParams.get('allowLive') || process.env.MATCH_EXTRAS_SYNC_ALLOW_LIVE, false);
  const force = boolFrom(url.searchParams.get('force') || process.env.MATCH_EXTRAS_SYNC_FORCE, false);
  const dryRun = boolFrom(url.searchParams.get('dryRun') || process.env.MATCH_EXTRAS_SYNC_DRY_RUN, false);
  const includeRaw = boolFrom(url.searchParams.get('includeRaw') || process.env.MATCH_EXTRAS_INCLUDE_RAW, false);
  const stopOnRateLimit = boolFrom(url.searchParams.get('stopOnRateLimit') || process.env.MATCH_EXTRAS_SYNC_STOP_ON_RATE_LIMIT, true);

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.match.findMany({
    where: {
      matchDate: { gte: since, lte: new Date(Date.now() + 6 * 60 * 60 * 1000) },
      status: { in: statusList(allowLive) },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'desc' },
    take: limit * 4,
  });

  const generated: any[] = [];
  const skipped: any[] = [];
  let stoppedEarly: null | string = null;

  for (const match of candidates) {
    if (generated.length >= limit) break;
    if (stoppedEarly) break;

    if (!force) {
      const hasRecent = await alreadyHasRecentFullExtras(match.id, freshnessHours);
      if (hasRecent) {
        skipped.push({ matchId: match.id, reason: 'recent_full_extras_snapshot_exists' });
        continue;
      }
    }

    try {
      const result = await collectTheStatsMatchExtras(match, {
        dryRun,
        save: !dryRun,
        includeRaw,
        endpointMode: 'full',
        timeoutMs,
      });
      generated.push({
        matchId: match.id,
        title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
        ok: result.ok,
        saved: result.saved,
        snapshotId: result.snapshotId,
        counts: result.counts,
        endpointsOk: result.endpointsOk,
        endpointsFailed: result.endpointsFailed,
        rateLimited: result.rateLimited,
      });

      if (stopOnRateLimit && result.rateLimited) {
        stoppedEarly = 'rate_limited';
        break;
      }
    } catch (error: any) {
      const rateLimited = isRateLimitError(error);
      generated.push({ matchId: match.id, ok: false, rateLimited, error: String(error?.message || error) });
      if (stopOnRateLimit && rateLimited) {
        stoppedEarly = 'rate_limited_exception';
        break;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'db_only_cron_match_extras_sync',
    limit,
    lookbackDays,
    freshnessHours,
    allowLive,
    force,
    dryRun,
    stopOnRateLimit,
    stoppedEarly,
    candidates: candidates.length,
    generated,
    skipped,
    note: 'This cron calls TheStats server-side and saves DB snapshots. Public pages still read the database only.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
