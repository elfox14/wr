import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const SNAPSHOT_STAT_COLUMNS = [
  'homePossession', 'awayPossession', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget',
  'homeShotsOffTarget', 'awayShotsOffTarget', 'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards',
  'homeRedCards', 'awayRedCards', 'homeAttacks', 'awayAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks',
];

type AuditStatus = 'ready' | 'missing_the_stats' | 'missing_stats' | 'missing_events' | 'missing_player_stats';
type SnapshotCounts = { stats: number; events: number; shots: number; playerStats: number; lineups: number };

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function numberParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of ['all', 'events', 'timeline', 'incidents', 'commentary', 'items', 'data', 'results', 'shotmap', 'shots', 'players', 'playerStats', 'player_stats']) {
    if (Array.isArray(object[key])) return object[key];
  }
  return [];
}

function isTheStatsSnapshot(snapshot: any) {
  const provider = String(snapshot?.provider || '').toUpperCase();
  const raw = asObject(snapshot?.rawData);
  return provider.includes('THE_STATS') || String(raw.provider || '').toUpperCase().includes('THE_STATS');
}

function hasNumber(value: unknown) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function countSnapshotColumnStats(snapshot: any) {
  let count = 0;
  for (const key of SNAPSHOT_STAT_COLUMNS) if (hasNumber(snapshot?.[key])) count += 1;
  return count;
}

function countObjectStats(value: unknown) {
  const object = asObject(value);
  return Object.values(object).filter((entry) => {
    if (entry === null || entry === undefined || entry === '') return false;
    if (typeof entry === 'object') {
      const nested = asObject(entry);
      return hasNumber(nested.home) || hasNumber(nested.away) || hasNumber(nested.home_value) || hasNumber(nested.away_value);
    }
    return true;
  }).length;
}

function snapshotCounts(snapshot: any): SnapshotCounts {
  const data = asObject(snapshot?.rawData);
  const normalized = asObject(data.normalized);
  const liveStats = asObject(normalized.liveStats);
  const eventsDetailed = asObject(normalized.eventsDetailed);

  const statsCount = Math.max(
    countSnapshotColumnStats(snapshot),
    countObjectStats(liveStats.stats),
    countObjectStats(asObject(data.liveStats).stats),
    countObjectStats(data.stats),
  );

  const events = [
    ...asList(eventsDetailed.all),
    ...asList(normalized.eventsDetailed),
    ...asList(normalized.events),
    ...asList(data.eventsDetailed),
    ...asList(data.events),
  ];
  const shots = [...asList(normalized.shotmap), ...asList(normalized.shots), ...asList(data.shotmap), ...asList(data.shots)];
  const playerStats = [...asList(normalized.playerStats), ...asList(normalized.players), ...asList(data.playerStats), ...asList(data.players)];
  const lineups = normalized.lineups || data.lineups ? 1 : 0;
  return { stats: statsCount, events: events.length, shots: shots.length, playerStats: playerStats.length, lineups };
}

function pickBestTheStatsSnapshot(snapshots: any[]) {
  const theStats = snapshots.filter(isTheStatsSnapshot);
  const withDetails = theStats
    .map((snapshot) => ({ snapshot, counts: snapshotCounts(snapshot) }))
    .filter(({ counts }) => counts.events > 0 || counts.playerStats > 0 || counts.shots > 0)
    .sort((a, b) => (b.counts.events + b.counts.playerStats + b.counts.shots) - (a.counts.events + a.counts.playerStats + a.counts.shots));
  if (withDetails[0]) return withDetails[0];
  const latest = theStats[0];
  return latest ? { snapshot: latest, counts: snapshotCounts(latest) } : null;
}

function auditStatus(best: { snapshot: any; counts: SnapshotCounts } | null): AuditStatus {
  if (!best) return 'missing_the_stats';
  if (best.counts.stats <= 0) return 'missing_stats';
  if (best.counts.events <= 0) return 'missing_events';
  if (best.counts.playerStats <= 0) return 'missing_player_stats';
  return 'ready';
}

function statusLabel(status: AuditStatus) {
  switch (status) {
    case 'ready': return 'جاهزة';
    case 'missing_the_stats': return 'لا يوجد Snapshot نهائي من TheStats';
    case 'missing_stats': return 'ناقص إحصائيات نهائية';
    case 'missing_events': return 'ناقص أحداث TheStats النهائية';
    case 'missing_player_stats': return 'ناقص تقييمات/إحصائيات اللاعبين';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bearer(req: Request) {
  const auth = req.headers.get('authorization') || '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

function querySecret(url: URL) {
  return url.searchParams.get('key') || url.searchParams.get('secret') || url.searchParams.get('token') || '';
}

function buildFinalizeUrl(req: Request, matchId: string, apply: boolean) {
  const incomingUrl = new URL(req.url);
  const target = new URL('/api/cron/the-stats-finalize-matches', incomingUrl.origin);
  const token = querySecret(incomingUrl);
  if (token) target.searchParams.set('key', token);
  target.searchParams.set(apply ? 'apply' : 'dryRun', apply ? 'true' : 'true');
  target.searchParams.set('matchId', matchId);
  target.searchParams.set('endpointMode', 'full');
  target.searchParams.set('includeRaw', incomingUrl.searchParams.get('includeRaw') || 'false');
  target.searchParams.set('writeMatchEvents', 'false');
  target.searchParams.set('purgeISportsEvents', 'false');
  target.searchParams.set('purgeISportsSnapshots', 'false');
  target.searchParams.set('purgeFootballDataEvents', 'false');
  target.searchParams.set('purgeTheStatsMatchEvents', 'false');
  target.searchParams.set('replaceTheStatsFinal', 'true');
  target.searchParams.set('timeoutMs', incomingUrl.searchParams.get('timeoutMs') || '18000');
  target.searchParams.set('requestsPerMinute', incomingUrl.searchParams.get('requestsPerMinute') || '45');
  return target;
}

async function callFinalize(req: Request, matchId: string, apply: boolean) {
  const target = buildFinalizeUrl(req, matchId, apply);
  const token = bearer(req);
  const response = await fetch(target.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const apply = boolParam(url, 'apply', false) && !boolParam(url, 'dryRun', false);
  const matchId = url.searchParams.get('matchId');
  const limit = numberParam(url, 'limit', 1, 1, 3);
  const scanLimit = numberParam(url, 'scanLimit', 80, 1, 200);
  const days = numberParam(url, 'days', 30, 1, 180);
  const delayMs = numberParam(url, 'delayMs', 1500, 0, 15000);
  const includeMissingTheStats = boolParam(url, 'includeMissingTheStats', true);
  const since = new Date(Date.now() - days * 864e5);

  const matches = await prisma.match.findMany({
    where: matchId ? { id: matchId } as any : { status: { in: FINISHED_STATUSES }, matchDate: { gte: since } } as any,
    orderBy: { matchDate: 'desc' },
    take: matchId ? 1 : scanLimit,
    include: {
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 24 },
    },
  } as any) as any[];

  const candidates = matches.map((match) => {
    const snapshots = match.statsSnapshots || [];
    const best = pickBestTheStatsSnapshot(snapshots);
    const status = auditStatus(best);
    return {
      match,
      best,
      auditStatus: status,
      title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
    };
  }).filter((item) => item.auditStatus !== 'ready' && (includeMissingTheStats || item.auditStatus !== 'missing_the_stats')).slice(0, limit);

  const processed = [];
  for (const item of candidates) {
    const before = item.best?.counts || { stats: 0, events: 0, shots: 0, playerStats: 0, lineups: 0 };
    const finalize = await callFinalize(req, item.match.id, apply);
    processed.push({
      matchId: item.match.id,
      title: item.title,
      matchDate: item.match.matchDate instanceof Date ? item.match.matchDate.toISOString() : item.match.matchDate,
      auditStatus: item.auditStatus,
      label: statusLabel(item.auditStatus),
      before,
      action: apply ? 'applied_the_stats_full_finalize' : 'dry_run_the_stats_full_finalize',
      finalizeStatus: finalize.status,
      finalizeOk: finalize.ok,
      finalize: finalize.payload,
      pageDataCheckUrl: `/api/matches/${item.match.id}/page-data-check`,
    });
    if (delayMs > 0) await sleep(delayMs);
  }

  return NextResponse.json({
    ok: true,
    mode: 'the_stats_final_backfill_v1_safe_runner',
    dryRun: !apply,
    note: apply
      ? 'Processed missing finished matches through TheStats full finalize. iSports and Football-Data data were not purged.'
      : 'Dry run only. Add apply=true to write final TheStats snapshots.',
    safety: {
      maxWriteLimit: 3,
      writeMatchEvents: false,
      purgeISportsEvents: false,
      purgeISportsSnapshots: false,
      purgeFootballDataEvents: false,
      purgeTheStatsMatchEvents: false,
      endpointMode: 'full',
    },
    scope: { matchId, days, scanLimit, limit, scanned: matches.length, candidates: candidates.length, includeMissingTheStats },
    processed,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
