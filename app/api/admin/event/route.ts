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

    // Determine impact
    let percentChange = 0;
    let newsTitle = customNews;

    if (impactPercentage) {
      percentChange = parseFloat(impactPercentage);
    } else {
      // Equations from PRD
      switch (eventType) {
        case 'WIN': percentChange = 10; newsTitle = `فوز ${asset.name}!`; break;
        case 'QUALIFY': percentChange = 15; newsTitle = `تأهل ${asset.name} للدور القادم!`; break;
        case 'LOSS': percentChange = -10; newsTitle = `خسارة ${asset.name}`; break;
        case 'ELIMINATED': percentChange = -20; newsTitle = `خروج ${asset.name} من البطولة`; break;
        case 'GOAL': percentChange = 5; newsTitle = `هدف لصالح ${asset.name}`; break;
        case 'INJURY': percentChange = -5; newsTitle = `إصابة ${asset.name}`; break;
        case 'RED_CARD': percentChange = -8; newsTitle = `طرد ${asset.name}`; break;
        default: percentChange = 0;
      }
    }

    if (!newsTitle) newsTitle = 'تحديث مهم';

    // Calculate new price
    const changeAmount = Math.round(asset.current_price * (percentChange / 100));
    const newPrice = asset.current_price + changeAmount;
    
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        current_price: newPrice,
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
