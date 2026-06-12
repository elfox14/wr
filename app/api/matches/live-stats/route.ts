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
import { getProviderQuotaBlock } from '@/lib/provider-quota-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toIso(value: any) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function isLiveLike(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return ['IN_PLAY', 'LIVE', 'HT'].includes(value);
}

function isFinished(status?: string | null) {
  return String(status || '').toUpperCase() === 'FINISHED';
}

function shouldSync(match: any, latest: any, force: boolean) {
  if (force) return true;
  if (!match?.animationMatchId) return false;
  if (!latest) return true;
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return true;
  const ageMs = Date.now() - capturedAt;
  if (isLiveLike(match.status) || isFinished(match.status)) return ageMs >= 300_000;
  return ageMs >= 300_000;
}

function hasAnyStat(snapshot: any) {
  if (!snapshot) return false;
  return [
    'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
    'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
    'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
    'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  ].some((key) => snapshot[key] !== null && snapshot[key] !== undefined);
}

export async function GET(request: Request) {
  const now = new Date();
  try {
    await ensureStatsTable();
    const { searchParams } = new URL(request.url);
    const providerMatchId = Number(searchParams.get('matchId') || searchParams.get('animationMatchId') || 0);
    const dbMatchId = searchParams.get('dbMatchId') || searchParams.get('id') || '';
    const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true';
    const allowProviderSync = searchParams.get('sync') === '1' || searchParams.get('sync') === 'true' || force;

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
    const quotaBlock = await getProviderQuotaBlock('ISPORTS');

    if (allowProviderSync && shouldSync(match, latest, force)) {
      try {
        syncResult = await syncMatchStats(match, { debug: false, force });
        latest = await getLatestSnapshot(match.id);
      } catch (error: any) {
        syncResult = { status: 'failed', ...providerErrorDetails(error) };
      }
    } else {
      syncResult = allowProviderSync ? { status: 'cached_recent_snapshot' } : { status: 'database_only', note: 'UI polling reads stored snapshots only to protect API quota. Provider sync is handled by cron.' };
    }

    const historyRows = await getSnapshotHistory(match.id, 80);

    const latestPublic = publicSnapshot(latest);
    const latestHomeScore = latestPublic?.homeScore ?? match.homeScore;
    const latestAwayScore = latestPublic?.awayScore ?? match.awayScore;
    const hasStats = hasAnyStat(latestPublic);
    const sourceStatus = quotaBlock
      ? {
          primary: 'FOOTBALL_DATA',
          statsProvider: latestPublic?.provider || 'ISPORTS',
          mode: 'fallback_due_to_isports_quota',
          isportsBlocked: true,
          blockedUntil: quotaBlock.blockedUntil instanceof Date ? quotaBlock.blockedUntil.toISOString() : quotaBlock.blockedUntil,
          reason: quotaBlock.reason,
        }
      : {
          primary: 'ISPORTS',
          statsProvider: latestPublic?.provider || 'ISPORTS',
          mode: 'isports_primary',
          isportsBlocked: false,
        };

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds: 300,
      providerSyncEnabled: allowProviderSync,
      hasStats,
      sourceStatus,
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
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
