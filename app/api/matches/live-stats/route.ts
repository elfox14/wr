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

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const SNAPSHOT_FIELDS = [
  'minute', 'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  'homeScore', 'awayScore',
];

function toIso(value: any) { return value instanceof Date ? value.toISOString() : value || null; }
function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const valid = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
  if (valid.length === 0) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get('x-admin-secret')?.trim() || '', req.headers.get('x-cron-secret')?.trim() || '', searchParams.get('key')?.trim() || '', searchParams.get('adminSecret')?.trim() || '', searchParams.get('cronSecret')?.trim() || ''];
  return candidates.some((value) => value && valid.includes(value));
}
function normalizeStatus(status?: string | null) { return String(status || '').toUpperCase(); }
function isLiveLike(status?: string | null) { return LIVE_STATUSES.includes(normalizeStatus(status)); }
function isFinishedStatus(status?: string | null) { return FINISHED_STATUSES.includes(normalizeStatus(status)); }
function isGroupStage(match: any) { return String(match?.groupPhase || match?.group || match?.stage || '').toUpperCase().includes('GROUP'); }
function maxLiveMinutes(match: any) { return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES; }
function elapsedMinutes(match: any) { if (!match?.matchDate) return null; const start = new Date(match.matchDate).getTime(); if (!Number.isFinite(start)) return null; return Math.floor((Date.now() - start) / 60_000); }
function isStaleLive(match: any) { if (!isLiveLike(match?.status)) return false; const elapsed = elapsedMinutes(match); if (elapsed === null) return false; return elapsed >= maxLiveMinutes(match); }
function isScheduledButProbablyLive(match: any) { if (normalizeStatus(match?.status) !== 'SCHEDULED') return false; const diffMinutes = elapsedMinutes(match); return diffMinutes !== null && diffMinutes >= -10 && diffMinutes < maxLiveMinutes(match); }
function isFinishedMatch(match: any) { return isFinishedStatus(match?.status) || isStaleLive(match); }
function isAutoSyncCandidate(match: any, force: boolean) { if (force) return true; if (!match?.animationMatchId) return false; if (isFinishedMatch(match)) return false; return isLiveLike(match.status) || isScheduledButProbablyLive(match); }
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
  return ['homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget', 'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards'].some((key) => snapshot[key] !== null && snapshot[key] !== undefined);
}
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function snapshotMinute(snapshot: any) { const minute = nullableNumber(snapshot?.minute); return minute !== null && minute > 0 ? minute : null; }
function snapshotHasScore(snapshot: any) { return nullableNumber(snapshot?.homeScore) !== null || nullableNumber(snapshot?.awayScore) !== null; }
function cleanPublicSnapshot(match: any, snapshot: any) { if (!snapshot) return null; if (snapshotMinute(snapshot) !== null) return snapshot; return { ...snapshot, minute: null }; }
function byCapturedDesc(a: any, b: any) {
  const at = new Date(a?.capturedAt || 0).getTime();
  const bt = new Date(b?.capturedAt || 0).getTime();
  return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
}
function firstWithValue(rows: any[], field: string) {
  const preferred = rows.find((row) => row?.[field] !== null && row?.[field] !== undefined);
  return preferred ? preferred[field] : null;
}
function mergeSnapshots(rows: any[]) {
  const ordered = rows.filter(Boolean).sort(byCapturedDesc);
  if (!ordered.length) return null;
  const latest = ordered[0];
  const providers = Array.from(new Set(ordered.map((row) => String(row.provider || '')).filter(Boolean)));
  const merged: any = { ...latest, id: `combined-${latest.id}`, provider: 'ISPORTS_COMBINED', sourceProviders: providers };
  for (const field of SNAPSHOT_FIELDS) merged[field] = firstWithValue(ordered, field);
  return merged;
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

    if (!providerMatchId && !dbMatchId) return NextResponse.json({ ok: false, error: 'matchId or dbMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    const match = await prisma.match.findFirst({
      where: dbMatchId ? { id: dbMatchId } : { animationMatchId: providerMatchId },
      include: { homeTeam: { select: { id: true, name: true, code: true, image: true } }, awayTeam: { select: { id: true, name: true, code: true, image: true } } },
    });
    if (!match) return NextResponse.json({ ok: false, linkedInDatabase: false, error: 'Match is not linked in database yet.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    let latest = await getLatestSnapshot(match.id);
    let syncResult: any = null;
    const quotaBlock = await getProviderQuotaBlock('ISPORTS');
    const autoSyncCandidate = isAutoSyncCandidate(match, force);
    const allowProviderSync = authorizedSync;

    if (manualSyncRequested && !authorizedSync) syncResult = { status: 'database_only_unauthorized_sync_ignored', autoSync: autoSyncCandidate, note: 'Public requests never call external providers. Scheduled/admin sync must pass a valid secret.' };
    else if (!allowProviderSync) syncResult = { status: 'database_only', autoSync: autoSyncCandidate, note: 'Public live-stats reads from the database only. External providers are updated by cron/admin sync jobs.' };
    else if (quotaBlock) syncResult = { status: 'isports_guard_active', note: 'Manual provider sync skipped because iSports is temporarily blocked by the quota guard.', blockedUntil: quotaBlock.blockedUntil instanceof Date ? quotaBlock.blockedUntil.toISOString() : quotaBlock.blockedUntil, reason: quotaBlock.reason };
    else if (shouldSync(match, latest, force)) {
      try { syncResult = await syncMatchStats(match, { debug: false, force }); latest = await getLatestSnapshot(match.id); }
      catch (error: any) { syncResult = { status: 'failed', ...providerErrorDetails(error) }; }
    } else syncResult = { status: 'cached_recent_snapshot', autoSync: autoSyncCandidate, note: 'Latest snapshot is still fresh.' };

    const historyRows = await getSnapshotHistory(match.id, 80);
    const mergedSnapshot = mergeSnapshots([latest, ...historyRows]);
    const rawLatestPublic = publicSnapshot(mergedSnapshot || latest);
    const latestPublic = cleanPublicSnapshot(match, rawLatestPublic);
    const ignoredSnapshotScore = Boolean(latestPublic && snapshotHasScore(latestPublic));
    const effectiveStatus = isFinishedMatch(match) ? 'FINISHED' : match.status;
    const hasStats = hasAnyStat(latestPublic);
    const sourceStatus = quotaBlock ? {
      primary: 'FOOTBALL_DATA', statsProvider: latestPublic?.provider || 'ISPORTS', mode: 'fallback_due_to_isports_quota', isportsBlocked: true,
      blockedUntil: quotaBlock.blockedUntil instanceof Date ? quotaBlock.blockedUntil.toISOString() : quotaBlock.blockedUntil, reason: quotaBlock.reason,
    } : { primary: latestPublic?.provider || 'DATABASE', statsProvider: latestPublic?.provider || 'DATABASE', mode: 'database_first_public_endpoint', isportsBlocked: false };

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds: 60,
      providerSyncEnabled: allowProviderSync,
      autoSyncCandidate,
      hasStats,
      sourceStatus,
      sync: syncResult,
      scorePolicy: { source: 'match', ignoredSnapshotScore, ignoredMinuteZeroSnapshot: Boolean(latestPublic && snapshotHasScore(latestPublic) && snapshotMinute(latestPublic) === null) },
      match: { id: match.id, animationMatchId: match.animationMatchId, status: effectiveStatus, matchDate: toIso(match.matchDate), homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0, homeTeam: match.homeTeam, awayTeam: match.awayTeam },
      latest: latestPublic,
      history: historyRows.map((row) => cleanPublicSnapshot(match, publicSnapshot(row))).reverse(),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
