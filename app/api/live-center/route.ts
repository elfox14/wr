import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TEAM_SELECT = { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true, change: true };
const MATCH_SELECT = {
  id: true,
  externalId: true,
  animationMatchId: true,
  status: true,
  matchDate: true,
  homeScore: true,
  awayScore: true,
  groupPhase: true,
  stage: true,
  homeTeam: { select: TEAM_SELECT },
  awayTeam: { select: TEAM_SELECT },
};

type CacheEntry = { createdAt: number; payload: any };
const CACHE_TTL_MS = 12_000;
let liveCenterCache: CacheEntry | null = null;

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickScore(snapshotValue: unknown, matchValue: unknown) {
  return nullableNumber(snapshotValue) ?? nullableNumber(matchValue) ?? 0;
}

function categoryFromEvent(eventType?: string | null) {
  const value = String(eventType || '').toLowerCase();
  if (value.includes('goal') || value.includes('match') || value.includes('fixture')) return 'match';
  if (value.includes('price') || value.includes('market') || value.includes('trade') || value.includes('buy') || value.includes('sell')) return 'trading';
  return 'platform';
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function fetchLatestStatsForMatches(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  try {
    const idList = matchIds.map(quoteSql).join(',');
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON ("matchId")
        "id", "matchId", "provider", "providerMatchId", "minute",
        "homePossession", "awayPossession", "homeAttacks", "awayAttacks",
        "homeDangerousAttacks", "awayDangerousAttacks", "homeShots", "awayShots",
        "homeShotsOnTarget", "awayShotsOnTarget", "homeShotsOffTarget", "awayShotsOffTarget",
        "homeScore", "awayScore", "capturedAt"
      FROM "MatchStatsSnapshot"
      WHERE "matchId" IN (${idList})
      ORDER BY "matchId", "capturedAt" DESC
    `);
    return new Map(rows.map((row) => [row.matchId, row]));
  } catch (error: any) {
    if (String(error?.message || '').includes('MatchStatsSnapshot')) return new Map<string, any>();
    console.warn('live-center stats lookup failed:', error?.message || error);
    return new Map<string, any>();
  }
}

function formatLiveStats(row?: any) {
  if (!row) return null;
  const homeDangerousAttacks = nullableNumber(row.homeDangerousAttacks);
  const awayDangerousAttacks = nullableNumber(row.awayDangerousAttacks);
  const homeShots = nullableNumber(row.homeShots);
  const awayShots = nullableNumber(row.awayShots);
  const homeShotsOnTarget = nullableNumber(row.homeShotsOnTarget);
  const awayShotsOnTarget = nullableNumber(row.awayShotsOnTarget);
  const homePossession = nullableNumber(row.homePossession);
  const awayPossession = nullableNumber(row.awayPossession);
  const momentum = Math.round((
    ((homePossession ?? 50) - (awayPossession ?? 50)) * 0.15 +
    ((homeDangerousAttacks ?? 0) - (awayDangerousAttacks ?? 0)) * 1.5 +
    ((homeShots ?? 0) - (awayShots ?? 0)) * 1.2 +
    ((homeShotsOnTarget ?? 0) - (awayShotsOnTarget ?? 0)) * 2
  ) * 10) / 10;

  return {
    id: row.id,
    provider: row.provider || 'ISPORTS',
    providerMatchId: nullableNumber(row.providerMatchId),
    minute: nullableNumber(row.minute),
    capturedAt: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : row.capturedAt,
    dataStatus: 'live_unofficial',
    momentum,
    home: {
      possession: homePossession,
      attacks: nullableNumber(row.homeAttacks),
      dangerousAttacks: homeDangerousAttacks,
      shots: homeShots,
      shotsOnTarget: homeShotsOnTarget,
      shotsOffTarget: nullableNumber(row.homeShotsOffTarget),
      score: nullableNumber(row.homeScore),
    },
    away: {
      possession: awayPossession,
      attacks: nullableNumber(row.awayAttacks),
      dangerousAttacks: awayDangerousAttacks,
      shots: awayShots,
      shotsOnTarget: awayShotsOnTarget,
      shotsOffTarget: nullableNumber(row.awayShotsOffTarget),
      score: nullableNumber(row.awayScore),
    },
  };
}

function formatMatch(match: any, statsMap: Map<string, any>) {
  const statsRow = statsMap.get(match.id);
  const liveStats = formatLiveStats(statsRow);
  const homeScore = pickScore(statsRow?.homeScore, match.homeScore);
  const awayScore = pickScore(statsRow?.awayScore, match.awayScore);

  return {
    id: match.id,
    externalId: match.externalId,
    animationMatchId: match.animationMatchId,
    status: match.status,
    matchDate: match.matchDate.toISOString(),
    homeScore,
    awayScore,
    scoreSource: liveStats ? 'snapshot' : 'match',
    groupPhase: match.groupPhase,
    stage: match.stage,
    homeTeam: match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name, code: match.homeTeam.code, image: match.homeTeam.image, price: Math.round(toNumber(match.homeTeam.marketPrice ?? match.homeTeam.current_price)), change: toNumber(match.homeTeam.change) } : null,
    awayTeam: match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name, code: match.awayTeam.code, image: match.awayTeam.image, price: Math.round(toNumber(match.awayTeam.marketPrice ?? match.awayTeam.current_price)), change: toNumber(match.awayTeam.change) } : null,
    liveStats,
  };
}

function response(payload: any, fromCache = false) {
  return NextResponse.json({ ...payload, fromCache }, { headers: { 'Cache-Control': 'private, max-age=0, no-cache, must-revalidate' } });
}

export async function GET() {
  try {
    const nowMs = Date.now();
    if (liveCenterCache && nowMs - liveCenterCache.createdAt < CACHE_TTL_MS) {
      return response(liveCenterCache.payload, true);
    }

    const now = new Date();
    const nearUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const recentSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [liveMatches, upcomingMatches, recentMatches, movers, linkedMatches, unlinkedNearMatches] = await Promise.all([
      prisma.match.findMany({
        where: { status: { in: ['IN_PLAY', 'LIVE'] } },
        orderBy: { matchDate: 'asc' },
        take: 20,
        select: MATCH_SELECT,
      }),
      prisma.match.findMany({
        where: { status: 'SCHEDULED', matchDate: { gte: now, lte: nearUntil } },
        orderBy: { matchDate: 'asc' },
        take: 20,
        select: MATCH_SELECT,
      }),
      prisma.match.findMany({
        where: { status: 'FINISHED', matchDate: { gte: recentSince, lte: now } },
        orderBy: { matchDate: 'desc' },
        take: 20,
        select: MATCH_SELECT,
      }),

      prisma.asset.findMany({
        where: { type: 'TEAM' },
        orderBy: { change: 'desc' },
        take: 8,
        select: TEAM_SELECT,
      }),
      prisma.match.count({ where: { animationMatchId: { not: null } } }),
      prisma.match.count({ where: { animationMatchId: null, matchDate: { gte: dayStart, lte: nearUntil } } }),
    ]);

    const statsMap = await fetchLatestStatsForMatches([...liveMatches, ...upcomingMatches, ...recentMatches].map((match) => match.id));

    const news: any[] = [];
    const matchNews: any[] = [];
    const tradingNews: any[] = [];
    const pollingSeconds = liveMatches.length > 0 ? 15 : upcomingMatches.length > 0 ? 45 : 60;

    const payload = {
      ok: true,
      updatedAt: now.toISOString(),
      pollingSeconds,
      cacheSeconds: Math.round(CACHE_TTL_MS / 1000),
      health: {
        liveCount: liveMatches.length,
        upcomingCount: upcomingMatches.length,
        recentCount: recentMatches.length,
        linkedMatches,
        unlinkedNearMatches,
        providerMode: 'iSports-first / latest-score-snapshot fallback / API-Football protected',
      },
      matches: {
        live: liveMatches.map((match) => formatMatch(match, statsMap)),
        upcoming: upcomingMatches.map((match) => formatMatch(match, statsMap)),
        recent: recentMatches.map((match) => formatMatch(match, statsMap)),
      },
      news: {
        latest: news,
        match: matchNews,
        trading: tradingNews,
      },
      movers: movers.map((asset) => ({
        id: asset.id,
        name: asset.name,
        code: asset.code,
        image: asset.image,
        price: Math.round(toNumber(asset.marketPrice ?? asset.current_price)),
        change: Math.round(toNumber(asset.change) * 10) / 10,
      })),
    };

    liveCenterCache = { createdAt: nowMs, payload };
    return response(payload, false);
  } catch (error: any) {
    console.error('live-center error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
