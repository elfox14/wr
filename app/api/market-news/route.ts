import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

/**
 * GET /api/market-news
 * Query params:
 *  - limit: number (max 100, default 20)
 *  - locale: 'ar' | 'en' (default 'ar')
 *  - asset: assetId filter (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const locale = (searchParams.get('locale') === 'en' ? 'en' : 'ar') as 'ar' | 'en';
    const assetFilter = searchParams.get('asset');

    const news = await prisma.marketNews.findMany({
      where: assetFilter ? { assetId: assetFilter } : undefined,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
          },
        },
      },
    });

    // Render with locale-aware templates
    const items = news.map((item) => {
      const rendered = renderMarketNews(item, locale);
      return {
        id: item.id,
        eventType: item.eventType,
        severity: item.severity,
        changePercent: item.changePercent,
        publishedAt: item.publishedAt,
        title: rendered.title,
        body: rendered.body,
        // Also include raw for backward compat
        titleAr: item.titleAr,
        bodyAr: item.bodyAr,
        titleEn: item.titleEn,
        bodyEn: item.bodyEn,
        asset: item.asset,
      };
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Fetch Market News Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
