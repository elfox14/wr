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

function categoryFromEvent(eventType?: string | null) {
  const value = String(eventType || '').toLowerCase();
  if (value.includes('goal') || value.includes('match') || value.includes('fixture')) return 'match';
  if (value.includes('price') || value.includes('market') || value.includes('trade') || value.includes('buy') || value.includes('sell')) return 'trading';
  return 'platform';
}

function formatMatch(match: any) {
  return {
    id: match.id,
    externalId: match.externalId,
    animationMatchId: match.animationMatchId,
    status: match.status,
    matchDate: match.matchDate.toISOString(),
    homeScore: toNumber(match.homeScore),
    awayScore: toNumber(match.awayScore),
    groupPhase: match.groupPhase,
    stage: match.stage,
    homeTeam: match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name, code: match.homeTeam.code, image: match.homeTeam.image, price: Math.round(toNumber(match.homeTeam.marketPrice ?? match.homeTeam.current_price)), change: toNumber(match.homeTeam.change) } : null,
    awayTeam: match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name, code: match.awayTeam.code, image: match.awayTeam.image, price: Math.round(toNumber(match.awayTeam.marketPrice ?? match.awayTeam.current_price)), change: toNumber(match.awayTeam.change) } : null,
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

    const [liveMatches, upcomingMatches, recentMatches, newsRows, movers, linkedMatches, unlinkedNearMatches] = await Promise.all([
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
      prisma.marketNews.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 30,
        include: { asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true } } },
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

    const news = newsRows.map((item) => {
      const rendered = renderMarketNews(item, 'ar');
      const category = categoryFromEvent(item.eventType);
      return {
        id: item.id,
        title: rendered.title,
        body: rendered.body,
        category,
        eventType: item.eventType,
        severity: item.severity,
        publishedAt: item.publishedAt.toISOString(),
        asset: item.asset ? {
          id: item.asset.id,
          name: item.asset.name,
          code: item.asset.code,
          image: item.asset.image,
          price: Math.round(toNumber(item.priceAfter ?? item.asset.marketPrice ?? item.asset.current_price)),
        } : null,
        changePercent: Math.round(toNumber(item.changePercent) * 10) / 10,
      };
    });

    const matchNews = news.filter((item) => item.category === 'match');
    const tradingNews = news.filter((item) => item.category === 'trading');
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
        providerMode: 'iSports-first / API-Football protected',
      },
      matches: {
        live: liveMatches.map(formatMatch),
        upcoming: upcomingMatches.map(formatMatch),
        recent: recentMatches.map(formatMatch),
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
