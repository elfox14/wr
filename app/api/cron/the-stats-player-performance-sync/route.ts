import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';
import { syncTheStatsPlayerPerformances } from '@/lib/theStatsPlayerPerformanceSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function snapshotPlayerStats(snapshot: any) {
  const raw = snapshot?.rawData && typeof snapshot.rawData === 'object' ? snapshot.rawData : {};
  const normalized = raw?.normalized && typeof raw.normalized === 'object' ? raw.normalized : {};
  return Array.isArray(normalized.playerStats) ? normalized.playerStats : [];
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const startedAt = Date.now();
  const matchId = String(url.searchParams.get('matchId') || '').trim() || null;
  const limit = intParam(url, 'limit', 5, 1, 25);
  const lookbackDays = intParam(url, 'lookbackDays', 30, 1, 365);
  const dryRun = boolParam(url, 'dryRun', false);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      provider: { startsWith: 'THE_STATS_API' },
      capturedAt: { gte: since },
      ...(matchId ? { matchId } : {}),
    },
    orderBy: { capturedAt: 'desc' },
    take: matchId ? 10 : limit * 5,
    include: {
      match: {
        include: {
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const processed: any[] = [];
  for (const snapshot of snapshots) {
    if (processed.length >= limit) break;
    const normalized = (snapshot.rawData as any)?.normalized || {};
    const playerStats = snapshotPlayerStats(snapshot);
    if (!playerStats.length) continue;

    const result = await syncTheStatsPlayerPerformances({
      match: snapshot.match,
      normalized,
      providerMatchId: (snapshot.rawData as any)?.resolvedProviderMatchId || snapshot.providerMatchId,
      dryRun,
    });

    processed.push({
      matchId: snapshot.matchId,
      snapshotId: snapshot.id,
      provider: snapshot.provider,
      providerMatchId: snapshot.providerMatchId,
      teams: `${snapshot.match.homeTeam?.name || snapshot.match.homeTeamId} vs ${snapshot.match.awayTeam?.name || snapshot.match.awayTeamId}`,
      playerStats: playerStats.length,
      result,
    });
  }

  const changed = processed.some((item) => Number(item.result?.upserted || 0) > 0);
  const revalidation = changed && !dryRun ? revalidateStatsViews('the-stats-player-performance-sync') : null;

  return json({
    ok: true,
    mode: 'the_stats_player_performance_sync_v1',
    durationMs: Date.now() - startedAt,
    dryRun,
    scope: { matchId, limit, lookbackDays, snapshotsScanned: snapshots.length },
    processed,
    cache: { revalidated: Boolean(revalidation), revalidation },
    nextRunHint: 'Run after TheStats safe backfill when player tables in /statistics need to be refreshed.',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
