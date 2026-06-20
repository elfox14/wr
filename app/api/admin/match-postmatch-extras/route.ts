import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function endpointMode(value: string | null): 'essential' | 'full' {
  return value === 'full' || value === 'all' ? 'full' : 'essential';
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const save = bool(url.searchParams.get('save'), true);
  const includeRaw = bool(url.searchParams.get('includeRaw'), false);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  const delayMs = int(url.searchParams.get('delayMs'), 700, 0, 5000);
  const mode = endpointMode(url.searchParams.get('endpointMode') || url.searchParams.get('mode'));
  const limit = int(url.searchParams.get('limit'), 1, 1, 3);
  const minutesBack = int(url.searchParams.get('minutesBack'), 720, 30, 1440);
  const now = Date.now();
  const query = defaultTheStatsQuery(url.searchParams);

  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { status: { in: FINISHED }, matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now) } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'desc' }, take: limit });

    const results = [];
    for (const match of matches) {
      if (!FINISHED.includes(String(match.status || '').toUpperCase()) && !matchId) continue;
      try {
        const result = await collectTheStatsMatchExtras(match, { dryRun, save, includeRaw, timeoutMs, query, endpointMode: mode, delayMs });
        results.push(result);
        if ((result as any).rateLimited) break;
      } catch (error: any) {
        const safe = safeTheStatsApiError(error);
        results.push({ ok: false, matchId: match.id, rateLimited: Number(safe?.status) === 429, error: safe });
        if (Number(safe?.status) === 429) break;
      }
    }

    const successful = results.filter((item: any) => item.ok);
    const rateLimited = results.some((item: any) => item.rateLimited || item.error?.status === 429);
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_postmatch_extras', endpointMode: mode, delayMs, dryRun, saved: !dryRun && save, rateLimited, advice: rateLimited ? 'TheStats rate limit reached. Wait 1-2 minutes, then retry. Default mode now uses only essential endpoints sequentially.' : undefined, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, snapshotsSaved: successful.filter((item: any) => item.saved).length, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_postmatch_extras', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
