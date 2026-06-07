import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { assetId, eventType, impactPercentage, customNews } = await request.json();
    
    // In a real app, verify admin session here.
    
    if (!assetId || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Economy Refactor: News Impact Engine
    let momentumChange = 0;
    let demandChange = 0;
    let newsTitle = customNews;

    if (impactPercentage) {
      momentumChange = parseFloat(impactPercentage);
    } else {
      switch (eventType) {
        case 'WIN': momentumChange = 20; demandChange = 15; newsTitle = `فوز ${asset.name}!`; break;
        case 'QUALIFY': momentumChange = 30; demandChange = 20; newsTitle = `تأهل ${asset.name} للدور القادم!`; break;
        case 'LOSS': momentumChange = -20; demandChange = -15; newsTitle = `خسارة ${asset.name}`; break;
        case 'ELIMINATED': momentumChange = -40; demandChange = -30; newsTitle = `خروج ${asset.name} من البطولة`; break;
        case 'GOAL': momentumChange = 10; demandChange = 5; newsTitle = `هدف لصالح ${asset.name}`; break;
        case 'ASSIST': momentumChange = 6; demandChange = 2; newsTitle = `صناعة هدف بواسطة ${asset.name}`; break;
        case 'INJURY': momentumChange = -15; demandChange = -10; newsTitle = `إصابة ${asset.name}`; break;
        case 'RED_CARD': momentumChange = -12; demandChange = -8; newsTitle = `طرد ${asset.name}`; break;
        default: momentumChange = 0; demandChange = 0;
      }
    }

    if (!newsTitle) newsTitle = 'تحديث مهم';

    // Update momentum and demand (clamp between 0-100)
    const newMomentum = Math.min(Math.max((asset.momentum || 50) + momentumChange, 0), 100);
    const newDemand = Math.min(Math.max((asset.marketDemand || 50) + demandChange, 0), 100);

    // Calculate percentChange based on volatilityScore
    const volatility = asset.volatilityScore || 10;
    // Base change is momentumChange, scaled by volatility. 
    // E.g. Yamal (vol=70) with goal (mom=+10) -> (10 * 70/100) = +7%
    // Messi (vol=15) with goal (mom=+10) -> (10 * 15/100) = +1.5%
    const percentChange = momentumChange * (volatility / 100);

    // Calculate new price (Using marketPrice if available, fallback to current_price)
    const basePrice = asset.marketPrice || asset.current_price;
    const changeAmount = Math.round(basePrice * (percentChange / 100));
    const newPrice = basePrice + changeAmount;
    
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        momentum: newMomentum,
        marketDemand: newDemand,
        marketPrice: newPrice,
        current_price: newPrice, // Kept for backwards compatibility
        change: percentChange, 
        high_price: Math.max(asset.high_price, newPrice),
        low_price: Math.min(asset.low_price, newPrice),
        priceHistory: {
          create: {
            price: newPrice
          }
        }
      }
    });

    // Record News
    await prisma.marketNews.create({
      data: {
        assetId: asset.id,
        eventType: eventType,
        severity: Math.abs(percentChange) > 10 ? 'high' : 'normal',
        priceBefore: asset.current_price,
        priceAfter: newPrice,
        changePercent: percentChange,
        titleAr: newsTitle,
        titleEn: 'Admin Event',
        bodyAr: `تم تحديث سعر الأصل بنسبة ${percentChange}% بناءً على حدث إداري.`,
        bodyEn: `Asset price updated by ${percentChange}% due to an admin event.`,
      }
    });

    // Notify all users holding this asset
    const holders = await prisma.holding.findMany({
      where: { assetId: asset.id },
      select: { userId: true }
    });

    if (holders.length > 0) {
      const notifications = holders.map(h => ({
        userId: h.userId,
        title: percentChange > 0 ? 'ارتفاع مفاجئ!' : 'هبوط مفاجئ!',
        message: `${newsTitle}. لقد ${percentChange > 0 ? 'ارتفع' : 'انخفض'} سهمك في ${asset.name} بنسبة ${percentChange}%`,
        type: percentChange > 0 ? 'SUCCESS' : 'ERROR'
      }));

      await prisma.notification.createMany({
        data: notifications
      });
    }

    return NextResponse.json({ success: true, message: 'Event applied successfully', newPrice });
  } catch (error) {
    console.error('Admin Event Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
