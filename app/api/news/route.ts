import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    return NextResponse.json({ news: marketNews });

  } catch (error) {
    console.error('Error in news API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
