import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TickerItem = {
  id: string;
  type: string;
  title: string;
  body?: string;
  assetId?: string;
  assetName?: string;
  assetImage?: string;
  marketPrice?: number;
  changePercent?: number;
  matchId?: string;
  href?: string;
  timestamp: string;
  source: string;
  severity?: string;
  priority: number;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function matchStatusLabel(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'IN_PLAY' || value === 'LIVE') return 'مباشر الآن';
  if (value === 'FINISHED') return 'انتهت';
  return 'قادمة';
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function scoreLabel(match: any, scoreSnapshot?: any) {
  const homeScore = nullableNumber(scoreSnapshot?.homeScore) ?? nullableNumber(match.homeScore) ?? 0;
  const awayScore = nullableNumber(scoreSnapshot?.awayScore) ?? nullableNumber(match.awayScore) ?? 0;
  return `${homeScore} - ${awayScore}`;
}

async function fetchLatestScoreSnapshots(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  try {
    const idList = matchIds.map(quoteSql).join(',');
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON ("matchId")
        "matchId", "homeScore", "awayScore", "capturedAt"
      FROM "MatchStatsSnapshot"
      WHERE "matchId" IN (${idList})
      ORDER BY "matchId", "capturedAt" DESC
    `);
    return new Map(rows.map((row) => [row.matchId, row]));
  } catch (error: any) {
    if (!String(error?.message || '').includes('MatchStatsSnapshot')) {
      console.warn('live ticker score snapshot lookup failed:', error?.message || error);
    }
    return new Map<string, any>();
  }
}

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

function sortTickerItems(items: TickerItem[]) {
  return items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function stripInternalFields(item: TickerItem) {
  const { priority, ...publicItem } = item;
  return publicItem;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 6), 60);
    const now = new Date();
    const liveWindowStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const liveWindowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const finishedWindowStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const newsWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const upcomingWindow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const [marketNews, priceHistory, liveMatches, finishedMatches, upcomingMatches] = await Promise.all([
      prisma.marketNews.findMany({
        where: { publishedAt: { gte: newsWindowStart } },
        orderBy: { publishedAt: 'desc' },
        take: 12,
        include: {
          asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true } },
        },
      }),
      prisma.priceHistory.findMany({
        where: { timestamp: { gte: newsWindowStart } },
        orderBy: { timestamp: 'desc' },
        take: 16,
        include: {
          asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true, change: true } },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { in: ['IN_PLAY', 'LIVE'] },
          matchDate: { gte: liveWindowStart, lte: liveWindowEnd },
        },
        orderBy: { matchDate: 'asc' },
        take: 8,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          status: 'FINISHED',
          matchDate: { gte: finishedWindowStart, lte: now },
        },
        orderBy: { matchDate: 'desc' },
        take: 6,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED'] },
          matchDate: { gte: now, lte: upcomingWindow },
        },
        orderBy: { matchDate: 'asc' },
        take: 6,
        include: { homeTeam: true, awayTeam: true },
      }),
    ]);

    const scoreSnapshots = await fetchLatestScoreSnapshots([...liveMatches, ...finishedMatches].map((match) => match.id));
    const items: TickerItem[] = [];
    const seenPriceAssetIds = new Set<string>();

    for (const match of liveMatches) {
      items.push({
        id: `match-live-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status)}: ${match.homeTeam?.name || 'الفريق الأول'} ${scoreLabel(match, scoreSnapshots.get(match.id))} ${match.awayTeam?.name || 'الفريق الثاني'}`,
        matchId: match.id,
        href: '/live',
        timestamp: now.toISOString(),
        source: 'live_match',
        priority: 100,
      });
    }

    for (const match of finishedMatches) {
      items.push({
        id: `match-finished-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status)}: ${match.homeTeam?.name || 'الفريق الأول'} ${scoreLabel(match, scoreSnapshots.get(match.id))} ${match.awayTeam?.name || 'الفريق الثاني'}`,
        matchId: match.id,
        href: '/live',
        timestamp: now.toISOString(),
        source: 'finished_match',
        priority: 90,
      });
    }

    for (const item of marketNews) {
      const rendered = renderMarketNews(item, 'ar');
      const change = toNumber(item.changePercent, 0);
      const priceAfter = item.priceAfter == null ? null : Math.round(toNumber(item.priceAfter));
      const isMatchEvent = item.eventType?.includes('goal') || item.eventType?.includes('match');
      items.push({
        id: `news-${item.id}`,
        type: isMatchEvent ? 'MATCH_EVENT' : change >= 0 ? 'PRICE_UP' : 'PRICE_DOWN',
        title: rendered.title,
        body: rendered.body,
        assetId: item.asset?.id,
        assetName: item.asset?.name,
        assetImage: item.asset?.image,
        marketPrice: priceAfter ?? Math.round(toNumber(item.asset?.marketPrice ?? item.asset?.current_price)),
        changePercent: change,
        href: item.asset?.id ? `/asset/${item.asset.id}` : '/market',
        timestamp: item.publishedAt.toISOString(),
        source: 'market_news',
        severity: item.severity,
        priority: isMatchEvent ? 80 : 70,
      });
    }

    for (const entry of priceHistory) {
      if (!entry.asset || seenPriceAssetIds.has(entry.asset.id)) continue;
      seenPriceAssetIds.add(entry.asset.id);
      const change = toNumber(entry.asset.change, 0);
      if (Math.abs(change) < 0.1) continue;
      items.push({
        id: `price-${entry.id}`,
        type: change >= 0 ? 'PRICE_UP' : 'PRICE_DOWN',
        title: `${entry.asset.name} ${change >= 0 ? 'صعد' : 'تراجع'} ${formatSignedPercent(change)} — آخر سعر ${Math.round(toNumber(entry.price))}¢`,
        assetId: entry.asset.id,
        assetName: entry.asset.name,
        assetImage: entry.asset.image,
        marketPrice: Math.round(toNumber(entry.price)),
        changePercent: change,
        href: `/asset/${entry.asset.id}`,
        timestamp: entry.timestamp.toISOString(),
        source: 'price_history',
        priority: 60,
      });
    }

    for (const match of upcomingMatches) {
      items.push({
        id: `match-upcoming-${match.id}`,
        type: 'MATCH_EVENT',
        title: `مباراة قريبة: ${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'} — ${new Date(match.matchDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
        matchId: match.id,
        href: '/live',
        timestamp: match.matchDate.toISOString(),
        source: 'upcoming_match',
        priority: 40,
      });
    }

    return NextResponse.json({
      success: true,
      updatedAt: now.toISOString(),
      responseMode: 'prioritized',
      scoreSource: 'latest_snapshot_then_match',
      counts: {
        live: liveMatches.length,
        finished: finishedMatches.length,
        news: marketNews.length,
        priceMovers: seenPriceAssetIds.size,
        upcoming: upcomingMatches.length,
      },
      items: sortTickerItems(items).slice(0, limit).map(stripInternalFields),
    }, { headers: noStoreHeaders });
  } catch (error: any) {
    console.error('Live ticker error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch live ticker' }, { status: 500, headers: noStoreHeaders });
  }
}
