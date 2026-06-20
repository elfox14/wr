import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  if (!matchId) return json({ ok: false, error: 'matchId is required' }, 400);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  const includeRaw = ['1', 'true', 'yes', 'on'].includes(String(url.searchParams.get('includeRaw') || '').toLowerCase());
  const query = defaultTheStatsQuery(url.searchParams);

  try {
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
    if (!match) return json({ ok: false, error: 'match not found', matchId }, 404);
    const result = await collectTheStatsMatchExtras(match, { dryRun: true, save: false, includeRaw, timeoutMs, query });
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_extra_debug', result, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_extra_debug', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}
