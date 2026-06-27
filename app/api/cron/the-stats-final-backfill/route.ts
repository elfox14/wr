import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';

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

type FinalizeResult = {
  ok: boolean;
  status: string;
  endpointMode: 'full';
  providerMatchId?: unknown;
  resolvedBy?: unknown;
  counts?: { stats: number; events: number; shots: number; playerStats: number; lineups: number };
  snapshotId?: string | null;
  collected?: unknown;
  error?: string;
  code?: string | null;
  providerStatus?: number | null;
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

function statPair(stats: Record<string, any>, key: string) {
  const pair = stats?.[key] || {};
  const home = Number(pair.home);
  const away = Number(pair.away);
  return { home: Number.isFinite(home) ? Math.round(home) : null, away: Number.isFinite(away) ? Math.round(away) : null };
}

function snapshotStatColumns(normalized: any) {
  const stats = normalized?.liveStats?.stats || {};
  const possession = statPair(stats, 'possession');
  const shots = statPair(stats, 'shots');
  const shotsOnTarget = statPair(stats, 'shotsOnTarget');
  const shotsOffTarget = statPair(stats, 'shotsOffTarget');
  const corners = statPair(stats, 'corners');
  const yellowCards = statPair(stats, 'yellowCards');
  const redCards = statPair(stats, 'redCards');
  return {
    homePossession: possession.home,
    awayPossession: possession.away,
    homeShots: shots.home,
    awayShots: shots.away,
    homeShotsOnTarget: shotsOnTarget.home,
    awayShotsOnTarget: shotsOnTarget.away,
    homeShotsOffTarget: shotsOffTarget.home,
    awayShotsOffTarget: shotsOffTarget.away,
    homeCorners: corners.home,
    awayCorners: corners.away,
    homeYellowCards: yellowCards.home,
    awayYellowCards: yellowCards.away,
    homeRedCards: redCards.home,
    awayRedCards: redCards.away,
  };
}

function providerMatchNumber(value: unknown) {
  const n = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function countCollected(normalized: any) {
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  const stats = Object.keys(normalized?.liveStats?.stats || {}).length;
  return { stats, events: events.length, shots: shots.length, playerStats: players.length, lineups: normalized?.lineups ? 1 : 0 };
}

async function finalizeMatchFromTheStats(match: any, reqUrl: URL, apply: boolean): Promise<FinalizeResult> {
  try {
    const includeRaw = boolParam(reqUrl, 'includeRaw', false);
    const timeoutMs = numberParam(reqUrl, 'timeoutMs', 18000, 3000, 60000);
    const delayMs = numberParam(reqUrl, 'innerDelayMs', 0, 0, 15000);
    const requestsPerMinute = numberParam(reqUrl, 'requestsPerMinute', 45, 10, 90);
    const providerQuery = defaultTheStatsQuery(reqUrl.searchParams);
    const collected = await collectTheStatsMatchExtras(match, {
      dryRun: true,
      save: false,
      includeRaw,
      endpointMode: 'full',
      timeoutMs,
      delayMs,
      query: providerQuery,
    });

    const normalized = (collected as any)?.debug?.normalizedPreview;
    const counts = countCollected(normalized);
    const hasUsefulData = Boolean(normalized) && (counts.stats > 0 || counts.events > 0 || counts.shots > 0 || counts.playerStats > 0 || counts.lineups > 0);
    if (!(collected as any)?.ok || !hasUsefulData) {
      return { ok: false, status: 'skipped_no_final_the_stats_data', endpointMode: 'full', counts, collected };
    }

    const providerMatchId = (collected as any).resolvedProviderMatchId;
    let snapshotId: string | null = null;

    if (apply) {
      await prisma.matchStatsSnapshot.deleteMany({
        where: {
          matchId: match.id,
          provider: { in: ['THE_STATS_API_EXTRAS', 'THE_STATS_API_FINAL_CANONICAL', 'THE_STATS_API_MANUAL_FINAL'] },
        },
      });

      const snapshot = await prisma.matchStatsSnapshot.create({
        data: {
          id: randomUUID(),
          matchId: match.id,
          provider: 'THE_STATS_API_EXTRAS',
          providerMatchId: providerMatchNumber(providerMatchId),
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          ...snapshotStatColumns(normalized),
          rawData: {
            provider: 'THE_STATS_API',
            mode: 'final_canonical_after_match_snapshot_only',
            endpointMode: 'full',
            importedAt: new Date().toISOString(),
            resolvedProviderMatchId: providerMatchId,
            resolvedBy: (collected as any).resolvedBy,
            rateLimitPolicy: {
              requestsPerMinute,
              note: 'Backfill runner writes one safe final snapshot per selected missing match.',
            },
            displayPolicy: {
              eventsSource: 'snapshot.normalized.eventsDetailed.all',
              writeMatchEvents: false,
              nonDestructive: true,
            },
            normalized,
          },
        },
        select: { id: true },
      });
      snapshotId = snapshot.id;
    }

    return {
      ok: true,
      status: apply ? 'finalized_from_the_stats_snapshot_only' : 'dry_run_ok',
      endpointMode: 'full',
      providerMatchId,
      resolvedBy: (collected as any).resolvedBy,
      counts,
      snapshotId,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 'failed',
      endpointMode: 'full',
      error: error?.message || String(error),
      code: error?.code || null,
      providerStatus: error?.status || null,
    };
  }
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const apply = boolParam(url, 'apply', false) && !boolParam(url, 'dryRun', false);
  const matchId = url.searchParams.get('matchId');
  const limit = numberParam(url, 'limit', 1, 1, 3);
  const scanLimit = numberParam(url, 'scanLimit', 20, 1, 50);
  const page = numberParam(url, 'page', 1, 1, 1000);
  const snapshotTake = numberParam(url, 'snapshotTake', 24, 1, 50);
  const days = numberParam(url, 'days', 30, 1, 180);
  const delayMs = numberParam(url, 'delayMs', 1500, 0, 15000);
  const includeMissingTheStats = boolParam(url, 'includeMissingTheStats', true);
  const since = new Date(Date.now() - days * 864e5);
  const where = matchId ? { id: matchId } as any : { status: { in: FINISHED_STATUSES }, matchDate: { gte: since } } as any;
  const skip = matchId ? 0 : (page - 1) * scanLimit;

  const [matches, totalFinishedInWindow] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { matchDate: 'desc' },
      skip,
      take: matchId ? 1 : scanLimit,
      include: {
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
        statsSnapshots: {
          where: { provider: { contains: 'THE_STATS' } },
          orderBy: { capturedAt: 'desc' },
          take: snapshotTake,
          select: {
            id: true,
            provider: true,
            capturedAt: true,
            rawData: true,
            homePossession: true,
            awayPossession: true,
            homeShots: true,
            awayShots: true,
            homeShotsOnTarget: true,
            awayShotsOnTarget: true,
            homeShotsOffTarget: true,
            awayShotsOffTarget: true,
            homeCorners: true,
            awayCorners: true,
            homeYellowCards: true,
            awayYellowCards: true,
            homeRedCards: true,
            awayRedCards: true,
            homeAttacks: true,
            awayAttacks: true,
            homeDangerousAttacks: true,
            awayDangerousAttacks: true,
          },
        },
      },
    } as any),
    matchId ? Promise.resolve(1) : prisma.match.count({ where }),
  ]) as any[];

  const candidates = matches.map((match: any) => {
    const snapshots = match.statsSnapshots || [];
    const best = pickBestTheStatsSnapshot(snapshots);
    const status = auditStatus(best);
    return {
      match,
      best,
      auditStatus: status,
      title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
    };
  }).filter((item: any) => item.auditStatus !== 'ready' && (includeMissingTheStats || item.auditStatus !== 'missing_the_stats')).slice(0, limit);

  const processed = [];
  let wroteFinalSnapshots = false;
  for (const item of candidates) {
    const before = item.best?.counts || { stats: 0, events: 0, shots: 0, playerStats: 0, lineups: 0 };
    const finalize = await finalizeMatchFromTheStats(item.match, url, apply);
    if (apply && finalize.ok && finalize.snapshotId) wroteFinalSnapshots = true;
    processed.push({
      matchId: item.match.id,
      title: item.title,
      matchDate: item.match.matchDate instanceof Date ? item.match.matchDate.toISOString() : item.match.matchDate,
      auditStatus: item.auditStatus,
      label: statusLabel(item.auditStatus),
      before,
      action: apply ? 'applied_the_stats_full_finalize' : 'dry_run_the_stats_full_finalize',
      finalizeOk: finalize.ok,
      finalize,
      pageDataCheckUrl: `/api/matches/${item.match.id}/page-data-check`,
    });
    if (delayMs > 0) await sleep(delayMs);
  }

  const revalidated = wroteFinalSnapshots ? revalidateStatsViews('the-stats-final-backfill') : null;

  return NextResponse.json({
    ok: true,
    mode: 'the_stats_final_backfill_v3_paged_the_stats_only',
    dryRun: !apply,
    note: apply
      ? 'Processed missing finished matches directly through TheStats full finalize. iSports and Football-Data data were not purged.'
      : 'Dry run only. Add apply=true to write final TheStats snapshots.',
    safety: {
      maxWriteLimit: 3,
      writeMatchEvents: false,
      purgeISportsEvents: false,
      purgeISportsSnapshots: false,
      purgeFootballDataEvents: false,
      purgeTheStatsMatchEvents: false,
      endpointMode: 'full',
      noSelfFetch: true,
      snapshotFilter: 'provider contains THE_STATS',
      maxScanLimit: 50,
      paged: true,
    },
    scope: {
      matchId,
      days,
      scanLimit,
      page,
      snapshotTake,
      offset: skip,
      limit,
      scanned: matches.length,
      candidates: candidates.length,
      totalFinishedInWindow,
      hasNextPage: !matchId && skip + matches.length < totalFinishedInWindow,
      nextPage: !matchId && skip + matches.length < totalFinishedInWindow ? page + 1 : null,
      includeMissingTheStats,
    },
    processed,
    revalidated,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
