import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET || 'dev_secret_123'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Expected format from Make.com or external API
    // { "teamCode": "ARG", "event": "GOAL" }
    const { teamCode, event, customMessage } = await request.json();

    if (!teamCode || !event) {
      return NextResponse.json({ error: 'Missing payload data' }, { status: 400 });
    }

    const asset = await prisma.asset.findFirst({ where: { code: teamCode } });
    if (!asset) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    let percentChange = 0;
    let title = customMessage;

    switch (event) {
      case 'GOAL': percentChange = 5; title = title || `⚽ هدف جديد لصالح ${asset.name}!`; break;
      case 'RED_CARD': percentChange = -8; title = title || `🟥 بطاقة حمراء للاعب من ${asset.name}!`; break;
      case 'WIN': percentChange = 10; title = title || `🏆 فوز ${asset.name} في المباراة!`; break;
      case 'LOSS': percentChange = -10; title = title || `❌ خسارة ${asset.name}`; break;
      default: return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

    const changeAmount = Math.round(asset.current_price * (percentChange / 100));
    const newPrice = asset.current_price + changeAmount;

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        current_price: newPrice,
        change: percentChange,
        high_price: Math.max(asset.high_price, newPrice),
        low_price: Math.min(asset.low_price, newPrice),
        priceHistory: { create: { price: newPrice } }
      }
    });

    await prisma.news.create({
      data: {
        assetId: asset.id,
        title: title,
        impact: percentChange
      }
    });

    // Send WhatsApp Alert
    await sendWhatsAppNotification(`عاجل 🚨\n${title}\nالسعر الجديد لسهم ${asset.name} هو ${newPrice} ¢`);

    return NextResponse.json({ success: true, message: 'Event processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
