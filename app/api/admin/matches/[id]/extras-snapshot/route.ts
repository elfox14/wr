import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function boolFrom(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function run(req: Request, matchId: string) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const url = new URL(req.url);
  const dryRun = boolFrom(url.searchParams.get('dryRun'), false);
  const includeRaw = boolFrom(url.searchParams.get('includeRaw'), false);
  const timeoutMs = Math.max(3000, Math.min(60000, Number(url.searchParams.get('timeoutMs') || process.env.THE_STATS_API_TIMEOUT_MS || 15000)));

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true },
  });

  if (!match) {
    return NextResponse.json({ ok: false, error: 'Match not found', matchId }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await collectTheStatsMatchExtras(match, {
    dryRun,
    save: !dryRun,
    includeRaw,
    endpointMode: 'full',
    timeoutMs,
  });

  return NextResponse.json({
    ok: Boolean(result.ok),
    mode: 'db_only_saved_match_extras_snapshot',
    matchId,
    endpointMode: 'full',
    dryRun,
    error: result.error,
    resolved: result.resolved,
    saved: result.saved,
    snapshotId: result.snapshotId,
    counts: result.counts,
    heatmapDiagnostics: result.heatmapDiagnostics,
    endpointsOk: result.endpointsOk,
    endpointsFailed: result.endpointsFailed,
    rateLimited: result.rateLimited,
    note: 'This admin route calls TheStats from the server, saves the response as a DB snapshot, and public pages still read the database only.',
  }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, id);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, id);
}
