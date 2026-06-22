import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  ensureStatsTable,
  getLatestSnapshot,
  getSnapshotHistory,
  publicSnapshot,
} from '@/lib/live-match-stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function snapshotMinute(snapshot: any) { const minute = nullableNumber(snapshot?.minute); return minute !== null && minute > 0 ? minute : null; }
function snapshotHasScore(snapshot: any) { return nullableNumber(snapshot?.homeScore) !== null || nullableNumber(snapshot?.awayScore) !== null; }
function cleanPublicSnapshot(snapshot: any) { if (!snapshot) return null; if (snapshotMinute(snapshot) !== null) return snapshot; return { ...snapshot, minute: null }; }
function hasAnyStat(snapshot: any) {
  if (!snapshot) return false;
  return ['homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget', 'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards'].some((key) => snapshot[key] !== null && snapshot[key] !== undefined);
}
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
  const merged: any = { ...latest, id: `combined-${latest.id}`, provider: 'DB_COMBINED', sourceProviders: providers };
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
    const syncParam = String(searchParams.get('sync') || '').toLowerCase();
    const syncRequested = syncParam === '1' || syncParam === 'true' || searchParams.get('force') === '1' || searchParams.get('force') === 'true';

    if (!providerMatchId && !dbMatchId) return NextResponse.json({ ok: false, error: 'matchId or dbMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    const match = await prisma.match.findFirst({
      where: dbMatchId ? { id: dbMatchId } : { animationMatchId: providerMatchId },
      include: { homeTeam: { select: { id: true, name: true, code: true, image: true } }, awayTeam: { select: { id: true, name: true, code: true, image: true } } },
    });
    if (!match) return NextResponse.json({ ok: false, linkedInDatabase: false, error: 'Match is not linked in database yet.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const latest = await getLatestSnapshot(match.id);
    const historyRows = await getSnapshotHistory(match.id, MERGE_HISTORY_LIMIT);
    const mergedSnapshot = mergeSnapshots([latest, ...historyRows]);
    const rawLatestPublic = publicSnapshot(mergedSnapshot || latest);
    const latestPublic = cleanPublicSnapshot(rawLatestPublic);
    const ignoredSnapshotScore = Boolean(latestPublic && snapshotHasScore(latestPublic));
    const hasStats = hasAnyStat(latestPublic);
    const history = publicHistoryRows(historyRows);

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds: 30,
      providerSyncEnabled: false,
      autoSyncCandidate: false,
      hasStats,
      sourceStatus: {
        primary: latestPublic?.provider || 'DATABASE',
        statsProvider: latestPublic?.provider || 'DATABASE',
        mode: 'database_only_no_provider_fetch',
        externalFetchFromPublicEndpoint: false,
      },
      sync: syncRequested
        ? { status: 'ignored_database_only', note: 'This public endpoint never calls external providers, even when sync/force is supplied. Use the internal ingest endpoint or a cron worker to write snapshots first.' }
        : { status: 'database_only', note: 'Public live-stats reads saved database snapshots only.' },
      scorePolicy: { source: 'match', ignoredSnapshotScore, timeInferenceDisabled: true, statusSource: 'database_provider_state', note: 'The public endpoint never turns SCHEDULED/LIVE/FINISHED based on elapsed clock time.' },
      match: { id: match.id, animationMatchId: match.animationMatchId, status: match.status, matchDate: toIso(match.matchDate), homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0, homeTeam: match.homeTeam, awayTeam: match.awayTeam },
      latest: latestPublic,
      history,
      historyMeta: { returned: history.length, limit: PUBLIC_HISTORY_LIMIT, filteredEmptyRows: true },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
