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

type SnapshotCounts = {
  stats: number;
  events: number;
  shots: number;
  playerStats: number;
  lineups: number;
};

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
  for (const key of SNAPSHOT_STAT_COLUMNS) {
    if (hasNumber(snapshot?.[key])) count += 1;
  }
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

  const shots = [
    ...asList(normalized.shotmap),
    ...asList(normalized.shots),
    ...asList(data.shotmap),
    ...asList(data.shots),
  ];

  const playerStats = [
    ...asList(normalized.playerStats),
    ...asList(normalized.players),
    ...asList(data.playerStats),
    ...asList(data.players),
  ];

  const lineups = normalized.lineups || data.lineups ? 1 : 0;

  return {
    stats: statsCount,
    events: events.length,
    shots: shots.length,
    playerStats: playerStats.length,
    lineups,
  };
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

function finalizeUrl(matchId: string) {
  return `/api/cron/the-stats-finalize-matches?key=YOUR_SECRET&apply=true&matchId=${encodeURIComponent(matchId)}&endpointMode=full&includeRaw=false&writeMatchEvents=false&purgeISportsEvents=false&purgeISportsSnapshots=false&purgeFootballDataEvents=false&purgeTheStatsMatchEvents=false&replaceTheStatsFinal=true&timeoutMs=18000&requestsPerMinute=45`;
}

function shouldInclude(status: AuditStatus, includeReady: boolean) {
  return includeReady || status !== 'ready';
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId');
  const includeReady = boolParam(url, 'includeReady', false);
  const limit = numberParam(url, 'limit', 50, 1, 200);
  const days = numberParam(url, 'days', 30, 1, 180);
  const since = new Date(Date.now() - days * 864e5);

  const matches = await prisma.match.findMany({
    where: matchId ? { id: matchId } as any : { status: { in: FINISHED_STATUSES }, matchDate: { gte: since } } as any,
    orderBy: { matchDate: 'desc' },
    take: matchId ? 1 : limit,
    include: {
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 24 },
      _count: { select: { events: true } },
    },
  } as any) as any[];

  const rows = matches.map((match) => {
    const snapshots = match.statsSnapshots || [];
    const best = pickBestTheStatsSnapshot(snapshots);
    const status = auditStatus(best);
    const theStatsSnapshots = snapshots.filter(isTheStatsSnapshot);
    return {
      matchId: match.id,
      title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
      status: match.status,
      matchDate: match.matchDate instanceof Date ? match.matchDate.toISOString() : match.matchDate,
      auditStatus: status,
      label: statusLabel(status),
      ready: status === 'ready',
      counts: {
        stats: best?.counts.stats || 0,
        events: best?.counts.events || 0,
        shots: best?.counts.shots || 0,
        playerStats: best?.counts.playerStats || 0,
        lineups: best?.counts.lineups || 0,
        dbEvents: match._count?.events || 0,
        snapshots: snapshots.length,
        theStatsSnapshots: theStatsSnapshots.length,
      },
      latestTheStatsSnapshot: best?.snapshot ? {
        id: best.snapshot.id,
        provider: best.snapshot.provider,
        capturedAt: best.snapshot.capturedAt instanceof Date ? best.snapshot.capturedAt.toISOString() : best.snapshot.capturedAt,
      } : null,
      recommendedAction: status === 'ready' ? 'none' : 'run_the_stats_full_finalize',
      finalizeUrl: status === 'ready' ? null : finalizeUrl(match.id),
      pageDataCheckUrl: `/api/matches/${match.id}/page-data-check`,
    };
  }).filter((row) => shouldInclude(row.auditStatus, includeReady));

  const summary = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.auditStatus] = (acc[row.auditStatus] || 0) + 1;
    if (row.ready) acc.ready += 1;
    else acc.needsBackfill += 1;
    return acc;
  }, { total: 0, ready: 0, needsBackfill: 0 } as Record<string, number>);

  return NextResponse.json({
    ok: true,
    mode: 'the_stats_final_audit_v1_db_only',
    note: 'DB-only audit. It does not call TheStats and does not delete iSports data.',
    scope: { matchId, days, limit, includeReady, scanned: matches.length, returned: rows.length },
    summary,
    rows,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
