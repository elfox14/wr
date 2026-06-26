import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
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

function hasFinalEvents(snapshot: any) {
  const normalized = snapshot?.rawData?.normalized || {};
  const events = normalized?.eventsDetailed?.all;
  return Array.isArray(events) && events.length > 0;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return response({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId');
  const limit = intParam(url, 'limit', 20, 1, 100);
  const dryRun = boolParam(url, 'dryRun', true) && !boolParam(url, 'apply', false);

  const matches = await prisma.match.findMany({
    where: matchId ? { id: matchId } : { status: { in: FINISHED } },
    orderBy: { matchDate: 'asc' },
    take: matchId ? 1 : limit,
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      events: { select: { id: true, sourceName: true }, take: 500 },
      statsSnapshots: {
        where: { provider: { startsWith: 'THE_STATS_API' } },
        orderBy: { capturedAt: 'desc' },
        take: 3,
        select: { id: true, provider: true, rawData: true },
      },
    },
  });

  const processed = [];
  for (const match of matches) {
    const finalSnapshot = match.statsSnapshots.find(hasFinalEvents) || null;
    const eventsCount = match.events.length;
    const teams = `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`;

    if (!finalSnapshot) {
      processed.push({ matchId: match.id, teams, status: 'skipped_no_final_the_stats_events', eventsCount });
      continue;
    }

    if (eventsCount <= 0) {
      processed.push({ matchId: match.id, teams, status: 'already_clean', finalSnapshotId: finalSnapshot.id, eventsCount });
      continue;
    }

    let deleted = 0;
    if (!dryRun) {
      const result = await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });
      deleted = result.count;
    }

    processed.push({
      matchId: match.id,
      teams,
      status: dryRun ? 'dry_run_would_delete_match_events' : 'purged_match_events_use_final_snapshot',
      finalSnapshotId: finalSnapshot.id,
      beforeEventsCount: eventsCount,
      deleted,
      note: 'Match page will now fall back to TheStats final events from the snapshot, avoiding duplicated MatchEvent rows.',
    });
  }

  return response({
    ok: true,
    mode: 'purge_final_match_events_v1_snapshot_events_preferred',
    dryRun,
    scope: { matchId, limit, selected: matches.length },
    policy: {
      finalEventsSource: 'THE_STATS_API snapshot rawData.normalized.eventsDetailed.all',
      matchEventPolicy: 'Remove old DB MatchEvent rows after final TheStats events exist to avoid duplicates and stale events.',
    },
    processed,
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
