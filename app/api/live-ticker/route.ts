import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function scoreLabel(match: any) {
  return `${toNumber(match.homeScore)} - ${toNumber(match.awayScore)}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 6), 60);
    const now = new Date();
    const upcomingWindow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const [marketNews, priceHistory, liveMatches, upcomingMatches] = await Promise.all([
      prisma.marketNews.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 12,
        include: {
          asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true } },
        },
      }),
      prisma.priceHistory.findMany({
        orderBy: { timestamp: 'desc' },
        take: 16,
        include: {
          asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true, change: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: { in: ['IN_PLAY', 'LIVE'] } },
        orderBy: { matchDate: 'asc' },
        take: 8,
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

    const items: any[] = [];
    const seenPriceAssetIds = new Set<string>();

    for (const item of marketNews) {
      const rendered = renderMarketNews(item, 'ar');
      const change = toNumber(item.changePercent, 0);
      const priceAfter = item.priceAfter == null ? null : Math.round(toNumber(item.priceAfter));
      items.push({
        id: `news-${item.id}`,
        type: item.eventType?.includes('goal') || item.eventType?.includes('match') ? 'MATCH_EVENT' : change >= 0 ? 'PRICE_UP' : 'PRICE_DOWN',
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
      });
    }

    for (const match of liveMatches) {
      items.push({
        id: `match-live-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status)}: ${match.homeTeam?.name || 'الفريق الأول'} ${scoreLabel(match)} ${match.awayTeam?.name || 'الفريق الثاني'}`,
        matchId: match.id,
        href: '/matches',
        timestamp: now.toISOString(),
        source: 'live_match',
      });
    }

    for (const match of upcomingMatches) {
      items.push({
        id: `match-upcoming-${match.id}`,
        type: 'MATCH_EVENT',
        title: `مباراة قريبة: ${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'} — ${new Date(match.matchDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
        matchId: match.id,
        href: '/matches',
        timestamp: match.matchDate.toISOString(),
        source: 'upcoming_match',
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      updatedAt: now.toISOString(),
      items: items.slice(0, limit),
    });
  } catch (error: any) {
    console.error('Live ticker error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch live ticker' }, { status: 500 });
  }
}
