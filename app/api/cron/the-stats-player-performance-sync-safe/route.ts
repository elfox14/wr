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

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const parsed = Number(url.searchParams.get(name) ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function playerStatsFrom(snapshot: any) {
  const raw = snapshot?.rawData && typeof snapshot.rawData === 'object' ? snapshot.rawData : {};
  const normalized = raw?.normalized && typeof raw.normalized === 'object' ? raw.normalized : {};
  return Array.isArray(normalized.playerStats) ? normalized.playerStats : [];
}

function snapshotKey(snapshot: any) {
  const raw = snapshot?.rawData && typeof snapshot.rawData === 'object' ? snapshot.rawData : {};
  return `${snapshot.matchId}:${raw.resolvedProviderMatchId || snapshot.providerMatchId || 'unknown'}`;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const startedAt = Date.now();
  const matchId = String(url.searchParams.get('matchId') || '').trim() || null;
  const limit = intParam(url, 'limit', 2, 1, 3);
  const offset = matchId ? 0 : intParam(url, 'offset', 0, 0, 500);
  const pageSize = matchId ? 20 : intParam(url, 'pageSize', 40, 10, 80);
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
    skip: matchId ? 0 : offset,
    take: pageSize,
    select: {
      id: true,
      matchId: true,
      provider: true,
      providerMatchId: true,
      rawData: true,
      match: {
        select: {
          id: true,
          matchDate: true,
          homeTeamId: true,
          awayTeamId: true,
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const selected: any[] = [];
  let duplicateSnapshotsSkipped = 0;
  let snapshotsWithoutPlayerStats = 0;

  for (const snapshot of snapshots) {
    const playerStats = playerStatsFrom(snapshot);
    if (!playerStats.length) {
      snapshotsWithoutPlayerStats += 1;
      continue;
    }
    const key = snapshotKey(snapshot);
    if (seen.has(key)) {
      duplicateSnapshotsSkipped += 1;
      continue;
    }
    seen.add(key);
    selected.push(snapshot);
    if (selected.length >= limit) break;
  }

  const processed: any[] = [];
  for (const snapshot of selected) {
    const raw = snapshot.rawData as any;
    const normalized = raw?.normalized || {};
    const result = await syncTheStatsPlayerPerformances({
      match: snapshot.match,
      normalized,
      providerMatchId: raw?.resolvedProviderMatchId || snapshot.providerMatchId,
      dryRun,
    });
    processed.push({
      matchId: snapshot.matchId,
      snapshotId: snapshot.id,
      provider: snapshot.provider,
      providerMatchId: snapshot.providerMatchId,
      teams: `${snapshot.match.homeTeam?.name || snapshot.match.homeTeamId} vs ${snapshot.match.awayTeam?.name || snapshot.match.awayTeamId}`,
      playerStats: playerStatsFrom(snapshot).length,
      result,
    });
  }

  const changed = processed.some((item) => Number(item.result?.upserted || 0) > 0);
  const revalidation = changed && !dryRun ? revalidateStatsViews('the-stats-player-performance-sync-safe') : null;
  const nextOffset = matchId ? null : offset + snapshots.length;

  return json({
    ok: true,
    mode: 'the_stats_player_performance_sync_safe_v1_render_low_memory',
    durationMs: Date.now() - startedAt,
    dryRun,
    scope: { matchId, limit, offset, nextOffset, pageSize, lookbackDays, snapshotsScanned: snapshots.length, duplicateSnapshotsSkipped, snapshotsWithoutPlayerStats },
    processed,
    cache: { revalidated: Boolean(revalidation), revalidation },
    nextRunHint: matchId ? 'Match-specific safe sync complete.' : `Run again with offset=${nextOffset}. This safe route paginates raw snapshots in small pages to avoid Render 502.`,
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
