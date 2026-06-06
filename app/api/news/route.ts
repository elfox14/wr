import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Parser from 'rss-parser';

export async function GET() {
  try {
    // 1. Generate Internal Market News
    const topAssets = await prisma.asset.findMany({
      orderBy: { change: 'desc' },
      take: 3
    });
    
    const bottomAssets = await prisma.asset.findMany({
      orderBy: { change: 'asc' },
      take: 2
    });

    const marketNews = [];
    
    if (topAssets.length > 0) {
      marketNews.push({
        id: `market-up-1`,
        title: `صعود صاروخي: أسهم ${topAssets[0].name} تقفز بنسبة +${topAssets[0].change}% بعد موجة شراء ضخمة!`,
        source: 'حركة السوق الداخلية',
        date: new Date().toISOString(),
        type: 'market_up'
      });
      if (topAssets[1]) {
        marketNews.push({
          id: `market-up-2`,
          title: `ارتفاع ملحوظ في قيمة ${topAssets[1].name} لتسجل +${topAssets[1].change}%.`,
          source: 'حركة السوق الداخلية',
          date: new Date().toISOString(),
          type: 'market_up'
        });
      }
    }

    if (bottomAssets.length > 0) {
      marketNews.push({
        id: `market-down-1`,
        title: `هبوط حاد: تراجع أسهم ${bottomAssets[0].name} بنسبة ${bottomAssets[0].change}% والمستثمرون يبيعون بخسارة.`,
        source: 'حركة السوق الداخلية',
        date: new Date().toISOString(),
        type: 'market_down'
      });
    }

    // 2. Fetch External News via RSS (e.g., from Kooora or Google News Arabic)
    let externalNews: any[] = [];
    try {
      const parser = new Parser();
      // Using an encoded URL to prevent ERR_UNESCAPED_CHARACTERS
      const feedUrl = 'https://news.google.com/rss/search?q=%D9%83%D8%B1%D8%A9+%D8%A7%D9%84%D9%82%D8%AF%D9%85+%D9%83%D8%A3%D8%B3+%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%85&hl=ar&gl=EG&ceid=EG:ar';
      const feed = await parser.parseURL(feedUrl);
      
      externalNews = feed.items.slice(0, 10).map((item, index) => ({
        id: `ext-${index}`,
        title: item.title?.replace(/ - .*/, ''), // Remove publisher name from end if exists
        source: item.source || 'أخبار الرياضة',
        link: item.link,
        date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        type: 'external'
      }));
    } catch (rssError) {
      console.error('Error fetching RSS:', rssError);
      // Fallback external news if RSS fails
      externalNews = [
        {
          id: 'ext-fallback-1',
          title: 'الفيفا تعلن عن تحديثات جديدة في قرعة كأس العالم 2026',
          source: 'وكالات',
          date: new Date().toISOString(),
          type: 'external'
        }
      ];
    }

    // Combine and return
    const allNews = [...marketNews, ...externalNews];

    return NextResponse.json({ news: allNews });

  } catch (error) {
    console.error('Error in news API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
