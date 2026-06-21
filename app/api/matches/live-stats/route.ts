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

const AUTO_SYNC_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'PAUSED'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];
const MERGE_HISTORY_LIMIT = 80;
const PUBLIC_HISTORY_LIMIT = 25;
const SNAPSHOT_FIELDS = [
  'minute', 'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  'homeScore', 'awayScore',
];

function toIso(value: any) { return value instanceof Date ? value.toISOString() : value || null; }
function headerName(...parts: string[]) { return parts.join('-'); }
function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const valid = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
  if (valid.length === 0) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get(headerName('x', 'admin', 'secret'))?.trim() || '', req.headers.get(headerName('x', 'cron', 'secret'))?.trim() || '', searchParams.get('key')?.trim() || '', searchParams.get('adminSecret')?.trim() || '', searchParams.get('cronSecret')?.trim() || ''];
  return candidates.some((value) => value && valid.includes(value));
}
function normalizeStatus(status?: string | null) { return String(status || '').toUpperCase(); }
function isProviderLiveStatus(status?: string | null) { return AUTO_SYNC_STATUSES.includes(normalizeStatus(status)); }
function isFinishedStatus(status?: string | null) { return FINISHED_STATUSES.includes(normalizeStatus(status)); }
function isAutoSyncCandidate(match: any, force: boolean) {
  if (force) return Boolean(match?.animationMatchId);
  if (!match?.animationMatchId) return false;
  if (isFinishedStatus(match?.status)) return false;
  return isProviderLiveStatus(match?.status);
}
function shouldSync(match: any, latest: any, force: boolean) {
  if (force) return Boolean(match?.animationMatchId);
  if (!isAutoSyncCandidate(match, force)) return false;
  if (!latest) return true;
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return true;
  return Date.now() - capturedAt >= 60_000;
}
function hasAnyStat(snapshot: any) {
  if (!snapshot) return false;
  return ['homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget', 'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards'].some((key) => snapshot[key] !== null && snapshot[key] !== undefined);
}
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function snapshotMinute(snapshot: any) { const minute = nullableNumber(snapshot?.minute); return minute !== null && minute > 0 ? minute : null; }
function snapshotHasScore(snapshot: any) { return nullableNumber(snapshot?.homeScore) !== null || nullableNumber(snapshot?.awayScore) !== null; }
function cleanPublicSnapshot(snapshot: any) { if (!snapshot) return null; if (snapshotMinute(snapshot) !== null) return snapshot; return { ...snapshot, minute: null }; }
function byCapturedDesc(a: any, b: any) {
  const at = new Date(a?.capturedAt || 0).getTime();
  const bt = new Date(b?.capturedAt || 0).getTime();
  return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
}
function pairValues(row: any, homeKey: string, awayKey: string) { return [nullableNumber(row?.[homeKey]), nullableNumber(row?.[awayKey])] as const; }
function inRange(value: number | null, max: number) { return value === null || (value >= 0 && value <= max); }
function plausibleSnapshot(row: any) {
  if (!row) return false;
  const provider = String(row.provider || '').toUpperCase();
  if (provider !== 'ISPORTS_REMOTE_LIVE') return true;
  const [hp, ap] = pairValues(row, 'homePossession', 'awayPossession');
  if (!inRange(hp, 100) || !inRange(ap, 100)) return false;
  if (hp !== null && ap !== null && Math.abs(hp + ap - 100) > 5) return false;
  const [ha, aa] = pairValues(row, 'homeAttacks', 'awayAttacks');
  if (!inRange(ha, 500) || !inRange(aa, 500)) return false;
  for (const [h, a] of [pairValues(row, 'homeShots', 'awayShots'), pairValues(row, 'homeShotsOnTarget', 'awayShotsOnTarget'), pairValues(row, 'homeShotsOffTarget', 'awayShotsOffTarget')]) {
    if (!inRange(h, 100) || !inRange(a, 100)) return false;
  }
  return true;
}
function firstWithValue(rows: any[], field: string) {
  const preferred = rows.find((row) => row?.[field] !== null && row?.[field] !== undefined);
  return preferred ? preferred[field] : null;
}
function mergeSnapshots(rows: any[]) {
  const ordered = rows.filter(plausibleSnapshot).sort(byCapturedDesc);
  if (!ordered.length) return null;
  const latest = ordered[0];
  const providers = Array.from(new Set(ordered.map((row) => String(row.provider || '')).filter(Boolean)));
  const merged: any = { ...latest, id: `combined-${latest.id}`, provider: 'ISPORTS_COMBINED', sourceProviders: providers };
  for (const field of SNAPSHOT_FIELDS) merged[field] = firstWithValue(ordered, field);
  return merged;
}
function publicHistoryRows(rows: any[]) {
  return rows
    .filter(plausibleSnapshot)
    .map((row) => cleanPublicSnapshot(publicSnapshot(row)))
    .filter((row) => hasAnyStat(row))
    .slice(0, PUBLIC_HISTORY_LIMIT)
    .reverse();
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

    const historyRows = await getSnapshotHistory(match.id, MERGE_HISTORY_LIMIT);
    const mergedSnapshot = mergeSnapshots([latest, ...historyRows]);
    const rawLatestPublic = publicSnapshot(mergedSnapshot || latest);
    const latestPublic = cleanPublicSnapshot(rawLatestPublic);
    const ignoredSnapshotScore = Boolean(latestPublic && snapshotHasScore(latestPublic));
    const effectiveStatus = match.status;
    const hasStats = hasAnyStat(latestPublic);
    const sourceStatus = quotaBlock ? {
      primary: 'DATABASE', statsProvider: latestPublic?.provider || 'DATABASE', mode: 'database_first_provider_blocked', isportsBlocked: true,
      blockedUntil: quotaBlock.blockedUntil instanceof Date ? quotaBlock.blockedUntil.toISOString() : quotaBlock.blockedUntil, reason: quotaBlock.reason,
    } : { primary: latestPublic?.provider || 'DATABASE', statsProvider: latestPublic?.provider || 'DATABASE', mode: 'database_first_no_time_inference', isportsBlocked: false };

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds: 30,
      providerSyncEnabled: allowProviderSync,
      autoSyncCandidate,
      hasStats,
      sourceStatus,
      sync: syncResult,
      scorePolicy: { source: 'match', ignoredSnapshotScore, timeInferenceDisabled: true, statusSource: 'database_provider_state', note: 'The public endpoint never turns SCHEDULED/LIVE/FINISHED based on elapsed clock time.' },
      match: { id: match.id, animationMatchId: match.animationMatchId, status: effectiveStatus, matchDate: toIso(match.matchDate), homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0, homeTeam: match.homeTeam, awayTeam: match.awayTeam },
      latest: latestPublic,
      history: publicHistoryRows(historyRows),
      historyMeta: { returned: Math.min(publicHistoryRows(historyRows).length, PUBLIC_HISTORY_LIMIT), limit: PUBLIC_HISTORY_LIMIT, filteredEmptyRows: true },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
