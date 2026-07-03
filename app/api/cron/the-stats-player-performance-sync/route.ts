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

function providerKey(snapshot: any) {
  const raw = snapshot?.rawData && typeof snapshot.rawData === 'object' ? snapshot.rawData : {};
  const resolved = raw?.resolvedProviderMatchId || snapshot?.providerMatchId || 'unknown';
  return `${snapshot?.matchId || 'match'}:${resolved}`;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const startedAt = Date.now();
  const matchId = String(url.searchParams.get('matchId') || '').trim() || null;
  const limit = intParam(url, 'limit', 5, 1, 25);
  const offset = matchId ? 0 : intParam(url, 'offset', 0, 0, 500);
  const lookbackDays = intParam(url, 'lookbackDays', 30, 1, 365);
  const maxScan = matchId ? 50 : intParam(url, 'maxScan', 1000, 50, 3000);
  const dryRun = boolParam(url, 'dryRun', false);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      provider: { startsWith: 'THE_STATS_API' },
      capturedAt: { gte: since },
      ...(matchId ? { matchId } : {}),
    },
    orderBy: { capturedAt: 'desc' },
    take: maxScan,
    include: {
      match: {
        include: {
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const uniqueSnapshots: any[] = [];
  const seen = new Set<string>();
  let snapshotsWithoutPlayerStats = 0;
  let duplicateSnapshotsSkipped = 0;

  for (const snapshot of snapshots) {
    const playerStats = snapshotPlayerStats(snapshot);
    if (!playerStats.length) {
      snapshotsWithoutPlayerStats += 1;
      continue;
    }
    const key = providerKey(snapshot);
    if (seen.has(key)) {
      duplicateSnapshotsSkipped += 1;
      continue;
    }
    seen.add(key);
    uniqueSnapshots.push(snapshot);
  }

  const selectedSnapshots = matchId ? uniqueSnapshots.slice(0, limit) : uniqueSnapshots.slice(offset, offset + limit);
  const processed: any[] = [];
  for (const snapshot of selectedSnapshots) {
    const normalized = (snapshot.rawData as any)?.normalized || {};
    const playerStats = snapshotPlayerStats(snapshot);
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
  const nextOffset = matchId ? null : offset + processed.length;
  const hasMoreUniqueSnapshots = !matchId && nextOffset !== null && nextOffset < uniqueSnapshots.length;

  return json({
    ok: true,
    mode: 'the_stats_player_performance_sync_v4_unique_offset',
    durationMs: Date.now() - startedAt,
    dryRun,
    scope: {
      matchId,
      limit,
      offset,
      nextOffset,
      lookbackDays,
      maxScan,
      snapshotsScanned: snapshots.length,
      uniqueSnapshotsWithPlayerStats: uniqueSnapshots.length,
      duplicateSnapshotsSkipped,
      snapshotsWithoutPlayerStats,
      hasMoreUniqueSnapshots,
    },
    processed,
    cache: { revalidated: Boolean(revalidation), revalidation },
    nextRunHint: matchId
      ? 'Match-specific sync complete. Open /statistics after cache revalidation.'
      : hasMoreUniqueSnapshots
        ? `Run again with offset=${nextOffset}. Offset now paginates unique matches, not raw duplicate snapshots.`
        : 'No more unique TheStats snapshots with playerStats inside the scanned window.',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
