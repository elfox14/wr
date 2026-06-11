import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

type NewsCategory = 'match' | 'trading' | 'platform';

type NewsItem = {
  id: string;
  title: string;
  body?: string;
  source: string;
  category: NewsCategory;
  type: string;
  link?: string;
  assetId?: string | null;
  assetName?: string | null;
  assetImage?: string | null;
  marketPrice?: number | null;
  changePercent?: number | null;
  date: string;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function newsCategory(eventType?: string | null, source?: string | null): NewsCategory {
  const value = `${eventType || ''} ${source || ''}`.toLowerCase();
  if (value.includes('goal') || value.includes('match') || value.includes('fixture') || value.includes('live_match') || value.includes('upcoming_match')) return 'match';
  if (value.includes('price') || value.includes('trade') || value.includes('market') || value.includes('buy') || value.includes('sell')) return 'trading';
  return 'platform';
}

function typeFromNews(item: any) {
  const category = newsCategory(item.eventType, 'market_news');
  if (category === 'match') return 'match_event';
  return toNumber(item.changePercent, 0) >= 0 ? 'market_up' : 'market_down';
}

function matchStatusLabel(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'IN_PLAY' || value === 'LIVE') return 'مباشر الآن';
  if (value === 'FINISHED') return 'انتهت';
  return 'قادمة';
}

export async function GET() {
  try {
    const now = new Date();
    const upcomingWindow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const [marketNewsRows, liveMatches, upcomingMatches] = await Promise.all([
      prisma.marketNews.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 60,
        include: { asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true } } },
      }),
      prisma.match.findMany({
        where: { status: { in: ['IN_PLAY', 'LIVE', 'FINISHED'] }, matchDate: { lte: now } },
        orderBy: { matchDate: 'desc' },
        take: 12,
        include: { homeTeam: { select: { name: true, image: true } }, awayTeam: { select: { name: true, image: true } } },
      }),
      prisma.match.findMany({
        where: { status: 'SCHEDULED', matchDate: { gte: now, lte: upcomingWindow } },
        orderBy: { matchDate: 'asc' },
        take: 12,
        include: { homeTeam: { select: { name: true, image: true } }, awayTeam: { select: { name: true, image: true } } },
      }),
    ]);

    const news: NewsItem[] = marketNewsRows.map((item) => {
      const rendered = renderMarketNews(item, 'ar');
      const category = newsCategory(item.eventType, 'market_news');
      const priceAfter = item.priceAfter == null ? null : Math.round(toNumber(item.priceAfter));
      return {
        id: item.id,
        title: rendered.title,
        body: rendered.body,
        source: category === 'match' ? 'أحداث المباريات' : 'تداول المنصة',
        category,
        type: typeFromNews(item),
        link: item.assetId ? `/asset/${item.assetId}` : '/market',
        assetId: item.assetId,
        assetName: item.asset?.name,
        assetImage: item.asset?.image,
        marketPrice: priceAfter ?? Math.round(toNumber(item.asset?.marketPrice ?? item.asset?.current_price)),
        changePercent: toNumber(item.changePercent),
        date: item.publishedAt.toISOString(),
      };
    });

    for (const match of liveMatches) {
      news.push({
        id: `match-${match.id}`,
        title: `${matchStatusLabel(match.status)}: ${match.homeTeam?.name || 'الفريق الأول'} ${toNumber(match.homeScore)} - ${toNumber(match.awayScore)} ${match.awayTeam?.name || 'الفريق الثاني'}`,
        body: 'تحديث مباشر من جدول المباريات داخل المنصة.',
        source: 'المباريات',
        category: 'match',
        type: 'match_event',
        link: `/matches/${match.id}`,
        date: match.matchDate.toISOString(),
      });
    }

    for (const match of upcomingMatches) {
      news.push({
        id: `upcoming-${match.id}`,
        title: `مباراة قريبة: ${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}`,
        body: `موعد المباراة: ${new Date(match.matchDate).toLocaleString('ar-EG')}`,
        source: 'جدول المباريات',
        category: 'match',
        type: 'match_event',
        link: `/matches/${match.id}`,
        date: match.matchDate.toISOString(),
      });
    }

    if (news.length === 0) {
      news.push({
        id: 'platform-welcome',
        title: 'مرحباً بك في بورصة المونديال — تابع الأخبار والمباريات والتداول من صفحة واحدة.',
        body: 'ستظهر هنا أخبار التداول وأخبار المباريات بمجرد توفر أحداث جديدة.',
        source: 'إدارة المنصة',
        category: 'platform',
        type: 'info',
        link: '/market',
        date: now.toISOString(),
      });
    }

    news.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      news,
      sections: {
        match: news.filter((item) => item.category === 'match'),
        trading: news.filter((item) => item.category === 'trading'),
        platform: news.filter((item) => item.category === 'platform'),
      },
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error in news API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
