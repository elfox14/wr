import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  ensureStatsTable,
  getLatestSnapshot,
  getSnapshotHistory,
  providerErrorDetails,
  publicSnapshot,
  syncMatchStats,
} from '@/lib/live-match-stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toIso(value: any) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function isLiveLike(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return ['IN_PLAY', 'LIVE', 'HT'].includes(value);
}

function shouldSync(match: any, latest: any, force: boolean) {
  if (force) return true;
  if (!match?.animationMatchId) return false;
  if (!latest) return true;
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return true;
  const ageMs = Date.now() - capturedAt;
  if (isLiveLike(match.status)) return ageMs >= 4_800;
  if (String(match.status || '').toUpperCase() === 'FINISHED') return ageMs >= 120_000;
  return ageMs >= 30_000;
}

export async function GET(request: Request) {
  const now = new Date();
  try {
    await ensureStatsTable();
    const { searchParams } = new URL(request.url);
    const providerMatchId = Number(searchParams.get('matchId') || searchParams.get('animationMatchId') || 0);
    const dbMatchId = searchParams.get('dbMatchId') || searchParams.get('id') || '';
    const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true';

    if (!providerMatchId && !dbMatchId) {
      return NextResponse.json({ ok: false, error: 'matchId or dbMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const match = await prisma.match.findFirst({
      where: dbMatchId ? { id: dbMatchId } : { animationMatchId: providerMatchId },
      include: {
        homeTeam: { select: { id: true, name: true, code: true, image: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ ok: false, linkedInDatabase: false, error: 'Match is not linked in database yet.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    let latest = await getLatestSnapshot(match.id);
    let syncResult: any = null;
    if (shouldSync(match, latest, force)) {
      try {
        syncResult = await syncMatchStats(match, { debug: false, force });
        latest = await getLatestSnapshot(match.id);
      } catch (error: any) {
        syncResult = { status: 'failed', ...providerErrorDetails(error) };
      }
    } else {
      syncResult = { status: 'cached_recent_snapshot' };
    }

    const [historyRows, events] = await Promise.all([
      getSnapshotHistory(match.id, 80),
      prisma.matchEvent.findMany({
        where: { matchId: match.id },
        orderBy: [{ minute: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ]);

    const latestPublic = publicSnapshot(latest);
    const latestHomeScore = latestPublic?.homeScore ?? match.homeScore;
    const latestAwayScore = latestPublic?.awayScore ?? match.awayScore;

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds: isLiveLike(match.status) ? 5 : 30,
      sync: syncResult,
      match: {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        matchDate: toIso(match.matchDate),
        homeScore: latestHomeScore,
        awayScore: latestAwayScore,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      latest: latestPublic,
      history: historyRows.map(publicSnapshot).reverse(),
      events: events.map((event) => ({
        id: event.id,
        minute: event.minute,
        type: event.type,
        teamId: event.teamId,
        playerId: event.playerId,
        playerName: event.playerName,
        detail: event.detail,
        sourceName: event.sourceName,
        createdAt: toIso(event.createdAt),
        updatedAt: toIso(event.updatedAt),
      })),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
