import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: Add admin check here
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { assetId, ratio } = await request.json();
    
    if (!assetId || !ratio || ratio <= 1) {
      return NextResponse.json({ error: 'Invalid input. Ratio must be > 1.' }, { status: 400 });
    }

    const splitRatio = parseInt(ratio, 10);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Update all holdings for this asset
      const holdings = await tx.holding.findMany({ where: { assetId } });
      for (const holding of holdings) {
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            quantity: holding.quantity * splitRatio,
            avg_buy_price: holding.avg_buy_price / splitRatio
          }
        });
      }

      // 2. Update the asset price
      const newPrice = Math.max(1, Math.floor(asset.current_price / splitRatio));
      await tx.asset.update({
        where: { id: assetId },
        data: {
          current_price: newPrice,
          high_price: newPrice, // Reset high/low for simplicity after split
          low_price: newPrice
        }
      });

      // 3. Record price history for the split
      await tx.priceHistory.create({
        data: {
          assetId,
          price: newPrice
        }
      });

      // 4. Create market news announcement
      await tx.marketNews.create({
        data: {
          assetId,
          eventType: 'stock_split',
          titleAr: `تجزئة أسهم ${asset.name}`,
          bodyAr: `تم تجزئة أسهم ${asset.name} بنسبة 1:${splitRatio}. السعر الجديد هو ${newPrice} عملة. تم ضرب كمياتك المملوكة في ${splitRatio}.`,
          titleEn: `${asset.name} Stock Split`,
          bodyEn: `Shares of ${asset.name} have been split 1:${splitRatio}. The new price is ${newPrice}. Your holdings have been multiplied by ${splitRatio}.`
        }
      });
    });

    return NextResponse.json({ success: true, message: `Stock split completed successfully for ${asset.name} (1:${splitRatio})` });

  } catch (error) {
    console.error('Stock split error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
