import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function boolFrom(value: string | null, fallback = false) {
  if (value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function intFrom(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function queryForMatch(matchDate: Date) {
  const params = new URLSearchParams();
  params.set('date_from', dateOnly(addDays(matchDate, -1)));
  params.set('date_to', dateOnly(addDays(matchDate, 1)));
  return defaultTheStatsQuery(params);
}

function rateLimited(result: any) {
  return Boolean(result?.rateLimited) || JSON.stringify(result?.endpointsFailed || '').includes('429') || JSON.stringify(result?.error || '').includes('429');
}

async function hasRecentBasicSnapshot(matchId: string, freshnessHours: number) {
  const since = new Date(Date.now() - freshnessHours * 60 * 60 * 1000);
  const snapshot = await prisma.matchStatsSnapshot.findFirst({
    where: {
      matchId,
      provider: { in: ['THE_STATS_API_EXTRAS', 'THE_STATS_API_MANUAL_BASIC', 'THE_STATS_API_MANUAL_FINAL'] },
      capturedAt: { gte: since },
    },
    orderBy: { capturedAt: 'desc' },
    select: { id: true, rawData: true },
  }).catch(() => null);

  const raw = snapshot?.rawData as any;
  const normalized = raw?.normalized || {};
  const stats = normalized.liveStats?.stats || normalized.stats || {};
  return Boolean(snapshot?.id && (Object.keys(stats).length > 0 || normalized.lineups));
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const limit = intFrom(url.searchParams.get('limit'), 3, 1, 10);
  const freshnessHours = intFrom(url.searchParams.get('freshnessHours'), 24, 1, 720);
  const timeoutMs = intFrom(url.searchParams.get('timeoutMs'), 30000, 3000, 60000);
  const delayMs = intFrom(url.searchParams.get('delayMs'), 2500, 0, 15000);
  const matchDelayMs = intFrom(url.searchParams.get('matchDelayMs'), 60000, 0, 600000);
  const force = boolFrom(url.searchParams.get('force'), false);
  const dryRun = boolFrom(url.searchParams.get('dryRun'), false);
  const includeRaw = boolFrom(url.searchParams.get('includeRaw'), false);
  const stopOnRateLimit = !['0', 'false', 'no'].includes(String(url.searchParams.get('stopOnRateLimit') || 'true').toLowerCase());

  const dateFrom = url.searchParams.get('dateFrom') || url.searchParams.get('date_from') || '2026-06-11';
  const dateTo = url.searchParams.get('dateTo') || url.searchParams.get('date_to') || dateOnly(new Date());

  const matches = await prisma.match.findMany({
    where: {
      matchDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lte: new Date(`${dateTo}T23:59:59.999Z`) },
      status: { in: FINISHED_STATUSES },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take: limit * 4,
  });

  const processed: any[] = [];
  let stoppedEarly: string | null = null;

  for (const match of matches) {
    if (processed.filter((item) => !item.skipped).length >= limit) break;
    if (stoppedEarly) break;

    if (!force && await hasRecentBasicSnapshot(match.id, freshnessHours)) {
      processed.push({ matchId: match.id, title: `${match.homeTeam?.name} ضد ${match.awayTeam?.name}`, skipped: true, reason: 'recent_basic_snapshot_exists' });
      continue;
    }

    const query = queryForMatch(match.matchDate);
    const result = await collectTheStatsMatchExtras(match, {
      dryRun,
      save: !dryRun,
      includeRaw,
      endpointMode: 'essential',
      timeoutMs,
      delayMs,
      query,
    });

    processed.push({
      matchId: match.id,
      title: `${match.homeTeam?.name} ضد ${match.awayTeam?.name}`,
      matchDate: match.matchDate,
      ok: result.ok,
      providerMatchId: result.resolvedProviderMatchId || result.resolved?.id || null,
      resolvedBy: result.resolvedBy || result.resolved?.by || null,
      resolution: result.resolved || null,
      endpointsOk: result.endpointsOk || [],
      endpointsFailed: result.endpointsFailed || [],
      counts: result.counts || { stats: 0, detailedEvents: 0, shots: 0, playerStats: 0, lineups: 0 },
      saved: result.saved,
      snapshotId: result.snapshotId,
      rateLimited: rateLimited(result),
    });

    if (stopOnRateLimit && rateLimited(result)) {
      stoppedEarly = 'rate_limited';
      break;
    }

    if (matchDelayMs > 0) await sleep(matchDelayMs);
  }

  return NextResponse.json({
    ok: true,
    mode: 'multi_basic_import_v1',
    dateFrom,
    dateTo,
    limit,
    freshnessHours,
    timeoutMs,
    delayMs,
    matchDelayMs,
    force,
    dryRun,
    includeRaw,
    candidates: matches.length,
    processed,
    stoppedEarly,
    note: 'Basic import fetches only matchInfo, stats and lineups for fast launch-safe article data.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
