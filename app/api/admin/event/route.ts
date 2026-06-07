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

    // Recalculate fairValue
    // Dynamically import to prevent circular dependencies if needed, or static import
    const { calculateAssetScore, calculateFairValue } = await import('@/lib/scoring');

    // Create a temporary object to calculate the new score
    const tempAsset = {
      ...asset,
      momentum: newMomentum,
      marketDemand: newDemand,
    };
    
    const newScore = calculateAssetScore(tempAsset);
    const newFairValue = calculateFairValue(newScore, asset.type as 'PLAYER' | 'TEAM');
    
    // We update fairValue, momentum, and demand. MarketPrice remains unchanged.
    // However, we record the percentage change in fairValue for notification purposes.
    const oldFairValue = asset.fairValue || asset.current_price;
    const percentChange = ((newFairValue - oldFairValue) / oldFairValue) * 100;
    
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        momentum: newMomentum,
        marketDemand: newDemand,
        score: newScore,
        fairValue: newFairValue,
      }
    });

    // Record News
    await prisma.marketNews.create({
      data: {
        assetId: asset.id,
        eventType: eventType,
        severity: Math.abs(percentChange) > 10 ? 'high' : 'normal',
        priceBefore: oldFairValue,
        priceAfter: newFairValue,
        changePercent: percentChange,
        titleAr: newsTitle,
        titleEn: 'Admin Event',
        bodyAr: `تم تحديث القيمة العادلة للأصل بنسبة ${percentChange.toFixed(1)}% بناءً على حدث إداري.`,
        bodyEn: `Asset fair value updated by ${percentChange.toFixed(1)}% due to an admin event.`,
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

    return NextResponse.json({ success: true, message: 'Event applied successfully', newFairValue });
  } catch (error) {
    console.error('Admin Event Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
