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

function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const valid = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
  if (valid.length === 0) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret')?.trim() || '',
    req.headers.get('x-cron-secret')?.trim() || '',
    searchParams.get('key')?.trim() || '',
    searchParams.get('adminSecret')?.trim() || '',
    searchParams.get('cronSecret')?.trim() || '',
  ];
  return candidates.some((value) => value && valid.includes(value));
}

function isLiveLike(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return ['IN_PLAY', 'LIVE', 'HT'].includes(value);
}

function isScheduledButProbablyLive(match: any) {
  if (String(match?.status || '').toUpperCase() !== 'SCHEDULED') return false;
  if (!match?.matchDate) return false;
  const start = new Date(match.matchDate).getTime();
  if (!Number.isFinite(start)) return false;
  const diffMinutes = Math.floor((Date.now() - start) / 60_000);
  return diffMinutes >= -10 && diffMinutes <= 150;
}

function isAutoSyncCandidate(match: any, force: boolean) {
  if (force) return true;
  if (!match?.animationMatchId) return false;
  return isLiveLike(match.status) || isScheduledButProbablyLive(match);
}

function shouldSync(match: any, latest: any, force: boolean) {
  if (force) return true;
  if (!match?.animationMatchId) return false;
  if (!isAutoSyncCandidate(match, force)) return false;
  if (!latest) return true;
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return true;
  return Date.now() - capturedAt >= 300_000;
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
    const syncParam = String(searchParams.get('sync') || '').toLowerCase();
    const manualSyncRequested = syncParam === '1' || syncParam === 'true' || force;
    const authorizedSync = manualSyncRequested && isAuthorized(request, searchParams);

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
    const autoSyncCandidate = isAutoSyncCandidate(match, force);
    const allowProviderSync = authorizedSync;

    if (manualSyncRequested && !authorizedSync) {
      syncResult = { status: 'database_only_unauthorized_sync_ignored', autoSync: autoSyncCandidate, note: 'Public requests never call external providers. Scheduled/admin sync must pass a valid secret.' };
    } else if (!allowProviderSync) {
      syncResult = { status: 'database_only', autoSync: autoSyncCandidate, note: 'Public live-stats reads from the database only. External providers are updated by cron/admin sync jobs.' };
    } else if (quotaBlock) {
      syncResult = {
        status: 'isports_guard_active',
        note: 'Manual provider sync skipped because iSports is temporarily blocked by the quota guard.',
        blockedUntil: quotaBlock.blockedUntil instanceof Date ? quotaBlock.blockedUntil.toISOString() : quotaBlock.blockedUntil,
        reason: quotaBlock.reason,
      };
    } else if (shouldSync(match, latest, force)) {
      try {
        syncResult = await syncMatchStats(match, { debug: false, force });
        latest = await getLatestSnapshot(match.id);
      } catch (error: any) {
        syncResult = { status: 'failed', ...providerErrorDetails(error) };
      }
    } else {
      syncResult = { status: 'cached_recent_snapshot', autoSync: autoSyncCandidate, note: 'Latest snapshot is still fresh.' };
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
          primary: latestPublic?.provider || 'DATABASE',
          statsProvider: latestPublic?.provider || 'DATABASE',
          mode: 'database_first_public_endpoint',
          isportsBlocked: false,
        };

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds: 300,
      providerSyncEnabled: allowProviderSync,
      autoSyncCandidate,
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
