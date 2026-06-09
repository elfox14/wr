import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

class TradeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function canRetry(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

async function serialTx<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt < 3 && canRetry(error)) continue;
      throw error;
    }
  }
  throw new Error('Transaction failed');
}

function updateAssetData(asset: any, price: number, qty: number, action: 'BUY' | 'SELL', nextPrice: number) {
  const demandDelta = Math.min(2, qty * 0.05);
  const data: any = {
    marketDemand: action === 'BUY'
      ? Math.min(100, (asset.marketDemand ?? 50) + demandDelta)
      : Math.max(0, (asset.marketDemand ?? 50) - demandDelta),
  };

  if (nextPrice !== price) {
    data.current_price = nextPrice;
    data.marketPrice = nextPrice;
    data.high_price = Math.max(asset.high_price, nextPrice);
    data.low_price = Math.min(asset.low_price, nextPrice);
    data.priceHistory = { create: { price: nextPrice } };
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, type, quantity, positionType = 'LONG' } = await request.json();
    const qty = Number(quantity);

    if (positionType !== 'LONG') {
      return NextResponse.json({ error: 'Only LONG positions are enabled' }, { status: 400 });
    }

    if (!assetId || !['BUY', 'SELL'].includes(type) || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const result = await serialTx(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: session.user.id } });
      if (!user) throw new TradeError('User not found', 404);

      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw new TradeError('Asset not found', 404);

      const price = Math.max(1, Math.round(asset.marketPrice ?? asset.current_price));
      const value = price * qty;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstPriceToday = await tx.priceHistory.findFirst({
        where: { assetId: asset.id, timestamp: { gte: today } },
        orderBy: { timestamp: 'asc' },
      });

      const { applyVolatilityCap } = await import('@/lib/liveEngine');
      const startPrice = firstPriceToday?.price || price;
      const risk = (asset.volatilityScore ?? 50) / 100;
      const isIPO = process.env.NEXT_PUBLIC_MARKET_STATE === 'IPO';

      if (type === 'BUY') {
        const buyCount = await tx.transaction.count({ where: { userId: user.id, type: 'BUY' } });
        const fee = buyCount < 5 ? 0 : Math.round(value * 0.02);
        const totalCost = value + fee;

        if (user.balance < totalCost) {
          throw new TradeError('الرصيد غير كافٍ لإتمام العملية (بما في ذلك رسوم التداول)', 400);
        }

        if (asset.type === 'PLAYER' && asset.position) {
          const conflict = await tx.holding.findFirst({
            where: {
              userId: user.id,
              positionType: 'LONG',
              quantity: { gt: 0 },
              asset: {
                type: 'PLAYER',
                position: asset.position,
                id: { not: asset.id },
              },
            },
          });

          if (conflict) {
            const names: Record<string, string> = { GK: 'حارس مرمى', DEF: 'مدافع', MID: 'لاعب وسط', FWD: 'مهاجم' };
            const pos = names[asset.position] || asset.position;
            throw new TradeError(`لقد قمت بشراء لاعب في مركز ${pos} مسبقاً. يجب شراء لاعب واحد فقط في كل مركز.`, 400);
          }
        }

        const holding = await tx.holding.findFirst({
          where: { userId: user.id, assetId: asset.id, positionType: 'LONG' },
        });

        if (holding) {
          const newAvg = ((holding.quantity * holding.avg_buy_price) + (qty * price)) / (holding.quantity + qty);
          await tx.holding.update({
            where: { id: holding.id },
            data: { quantity: { increment: qty }, avg_buy_price: newAvg },
          });
        } else {
          await tx.holding.create({
            data: { userId: user.id, assetId: asset.id, positionType: 'LONG', quantity: qty, avg_buy_price: price },
          });
        }

        await tx.user.update({ where: { id: user.id }, data: { balance: { decrement: totalCost } } });
        await tx.transaction.create({ data: { userId: user.id, assetId: asset.id, type: 'BUY', quantity: qty, price_at_time: price } });

        const nextPrice = isIPO ? price : applyVolatilityCap(startPrice, Math.round(price * (1 + qty * 0.0005)), risk);
        await tx.asset.update({ where: { id: asset.id }, data: updateAssetData(asset, price, qty, 'BUY', nextPrice) });
        await tx.notification.create({ data: { userId: user.id, title: 'تم الشراء بنجاح', message: `تم تنفيذ أمر شراء عدد ${qty} سهم من ${asset.name}`, type: 'SUCCESS' } });

        return {
          success: true,
          message: `تم الشراء (LONG) ${qty} من ${asset.name}` + (fee > 0 ? ` (رسوم التداول: ${fee})` : ''),
          fee,
          totalCost,
        };
      }

      const holding = await tx.holding.findFirst({
        where: { userId: user.id, assetId: asset.id, positionType: 'LONG' },
      });

      if (!holding || holding.quantity < qty) {
        throw new TradeError('Insufficient holdings to sell', 400);
      }

      const costBasis = holding.avg_buy_price * qty;
      const profit = value - costBasis;
      const tax = profit > costBasis * 0.5 ? Math.round(profit * 0.10) : 0;
      const payout = value - tax;
      const netProfit = profit - tax;

      if (holding.quantity === qty) {
        await tx.holding.delete({ where: { id: holding.id } });
      } else {
        await tx.holding.update({ where: { id: holding.id }, data: { quantity: { decrement: qty } } });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { balance: { increment: payout }, total_profit: { increment: netProfit } },
      });
      await tx.transaction.create({ data: { userId: user.id, assetId: asset.id, type: 'SELL', quantity: qty, price_at_time: price } });

      const nextPrice = isIPO ? price : applyVolatilityCap(startPrice, Math.max(1, Math.round(price * (1 - qty * 0.0005))), risk);
      await tx.asset.update({ where: { id: asset.id }, data: updateAssetData(asset, price, qty, 'SELL', nextPrice) });
      await tx.notification.create({ data: { userId: user.id, title: 'تم البيع بنجاح', message: `تم تنفيذ أمر بيع عدد ${qty} سهم من ${asset.name}`, type: 'INFO' } });

      return {
        success: true,
        message: `تم البيع (LONG) ${qty} من ${asset.name}` + (tax > 0 ? ` (ضريبة الأرباح: ${tax})` : ''),
        profit: netProfit,
        tax,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TradeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Trade error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
