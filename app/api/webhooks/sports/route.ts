import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { calculateSpike, calculateRatingChange, applyVolatilityCap, MatchEvent, Position } from '@/lib/liveEngine';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET || 'dev_secret_123'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Expected format:
    // { "assetId": "...", "event": "GOAL" } OR { "assetId": "...", "oldRating": 6.0, "newRating": 7.5 }
    const payload = await request.json();
    const { assetId, event, oldRating, newRating, customMessage } = payload;

    if (!assetId) {
      return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    let multiplier = 1.0;
    let title = customMessage || '';
    let isSpike = false;

    // 1. Check if it's an Event Spike
    if (event) {
      const position = asset.position || 'MID'; // Default to MID if not found
      multiplier = calculateSpike(event as MatchEvent, position as Position);
      isSpike = true;
      
      if (!title) {
        // Generate Arabic title for the spike
        const eventNames: Record<string, string> = {
          'GOAL': '⚽ هدف جديد!',
          'ASSIST': '👟 تمريرة حاسمة!',
          'RED_CARD': '🟥 بطاقة حمراء!',
          'YELLOW_CARD': '🟨 بطاقة صفراء',
          'PENALTY_MISS': '❌ إهدار ركلة جزاء',
          'PENALTY_SAVE': '🧤 تصدي لركلة جزاء',
          'OWN_GOAL': '🤦 هدف عكسي',
          'CLEAN_SHEET': '🛡️ شباك نظيفة',
          'BIG_CHANCE_MISSED': '📉 إضاعة فرصة محققة',
          'GOAL_LINE_CLEARANCE': '🧱 تشتيت من خط المرمى'
        };
        title = `${eventNames[event] || event} - ${asset.name}`;
      }
    } 
    // 2. Or check if it's a Rating Update (e.g. SofaScore update)
    else if (oldRating !== undefined && newRating !== undefined) {
      multiplier = calculateRatingChange(oldRating, newRating);
      title = `📊 تحديث تقييم ${asset.name} (${oldRating} ➡️ ${newRating})`;
    } else {
      return NextResponse.json({ error: 'Missing event or rating data' }, { status: 400 });
    }

    if (multiplier === 1.0) {
      return NextResponse.json({ success: true, message: 'No price change required' });
    }

    const calculatedNewPrice = Math.round(asset.current_price * multiplier);

    // Get today's starting price for Volatility Cap
    // In a real app, this would query a daily snapshot. We will use the asset's 'low_price' or 'high_price' as an approximation, or just use current_price if we don't have a snapshot.
    // For the engine design, we assume startOfDayPrice = asset.current_price (since we didn't add a 'start_of_day_price' field).
    // Actually, let's look for the first price of the day in PriceHistory, or default to current_price.
    // To save DB calls, we will just use current_price as the baseline for this spike. (In reality, AMM + Spikes combined should be checked against Daily Start, but for MVP this is fine).
    
    // We use riskIndex for Volatility Cap (0.0 to 1.0)
    const riskIndex = asset.riskIndex || 0.5;
    
    // Apply Volatility Circuit Breaker
    const finalNewPrice = applyVolatilityCap(asset.current_price, calculatedNewPrice, riskIndex);
    
    const percentChange = ((finalNewPrice - asset.current_price) / asset.current_price) * 100;

    // Only update if price actually changed
    if (finalNewPrice !== asset.current_price) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          current_price: finalNewPrice,
          change: percentChange,
          high_price: Math.max(asset.high_price, finalNewPrice),
          low_price: Math.min(asset.low_price, finalNewPrice),
          priceHistory: { create: { price: finalNewPrice } }
        }
      });

      await prisma.marketNews.create({
        data: {
          assetId: asset.id,
          eventType: isSpike ? 'price_spike' : 'rating_update',
          severity: Math.abs(percentChange) > 10 ? 'high' : 'normal',
          priceBefore: asset.current_price,
          priceAfter: finalNewPrice,
          changePercent: percentChange,
          titleAr: title,
          titleEn: title,
          bodyAr: `تم تحديث سعر الأصل بنسبة ${percentChange.toFixed(2)}% بناءً على هذا الحدث. السعر الجديد: ${finalNewPrice}¢`,
          bodyEn: `Asset price updated by ${percentChange.toFixed(2)}% due to this event.`,
        }
      });

      // Send WhatsApp Alert for Spikes or major moves
      if (Math.abs(percentChange) >= 5) {
        await sendWhatsAppNotification(`عاجل 🚨\n${title}\nالسعر الجديد لسهم ${asset.name} هو ${finalNewPrice} ¢ (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Event processed',
      oldPrice: asset.current_price,
      newPrice: finalNewPrice,
      capped: finalNewPrice !== calculatedNewPrice
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
