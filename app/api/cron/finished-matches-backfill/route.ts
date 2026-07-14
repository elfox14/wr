import { NextResponse } from 'next/server';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { runFinishedMatchesBackfill } from '@/lib/finishedMatchesBackfill';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function boolFrom(value: string | null | undefined, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberFrom(value: string | null | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const result = await runFinishedMatchesBackfill({
    matchId: url.searchParams.get('matchId') || process.env.FINISHED_MATCHES_BACKFILL_MATCH_ID || null,
    limit: numberFrom(url.searchParams.get('limit') || process.env.FINISHED_MATCHES_BACKFILL_LIMIT, 5, 1, 20),
    lookbackDays: numberFrom(url.searchParams.get('lookbackDays') || process.env.FINISHED_MATCHES_BACKFILL_LOOKBACK_DAYS, 14, 1, 120),
    freshnessHours: numberFrom(url.searchParams.get('freshnessHours') || process.env.FINISHED_MATCHES_BACKFILL_FRESHNESS_HOURS, 24, 1, 720),
    timeoutMs: numberFrom(url.searchParams.get('timeoutMs') || process.env.FINISHED_MATCHES_BACKFILL_TIMEOUT_MS || process.env.THE_STATS_API_TIMEOUT_MS, 30000, 3000, 60000),
    force: boolFrom(url.searchParams.get('force') || process.env.FINISHED_MATCHES_BACKFILL_FORCE, false),
    dryRun: boolFrom(url.searchParams.get('dryRun') || process.env.FINISHED_MATCHES_BACKFILL_DRY_RUN, false),
    includeRaw: boolFrom(url.searchParams.get('includeRaw') || process.env.FINISHED_MATCHES_BACKFILL_INCLUDE_RAW, false),
    stopOnRateLimit: boolFrom(url.searchParams.get('stopOnRateLimit') || process.env.FINISHED_MATCHES_BACKFILL_STOP_ON_RATE_LIMIT, true),
    syncAnimation: boolFrom(url.searchParams.get('syncAnimation') || process.env.FINISHED_MATCHES_BACKFILL_SYNC_ANIMATION, true),
    markVerified: boolFrom(url.searchParams.get('markVerified') || process.env.FINISHED_MATCHES_BACKFILL_MARK_VERIFIED, true),
    retryCooldownHours: numberFrom(url.searchParams.get('retryCooldownHours') || process.env.FINISHED_MATCHES_BACKFILL_RETRY_COOLDOWN_HOURS, 6, 1, 72),
    fetchPlayerHeatmaps: boolFrom(url.searchParams.get('fetchPlayerHeatmaps') || process.env.FINISHED_MATCHES_BACKFILL_FETCH_PLAYER_HEATMAPS, false),
  });

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
