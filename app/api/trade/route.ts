import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAndAwardAchievements } from "@/lib/achievements";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, type, quantity, positionType = 'LONG' } = await request.json();
    
    if (positionType !== 'LONG') {
      return NextResponse.json(
        { error: 'Short selling is currently disabled' },
        { status: 400 }
      );
    }
    
    if (!assetId || !type || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const tradePrice = Math.round(asset.marketPrice ?? asset.current_price);
    const totalValue = tradePrice * qty;

    if (type === 'BUY') {
      // Calculate trading fee
      const buyTransactionsCount = await prisma.transaction.count({
        where: { userId: user.id, type: 'BUY' }
      });
      
      const isFreeBuy = buyTransactionsCount < 5;
      const tradingFee = isFreeBuy ? 0 : Math.round(totalValue * 0.02);
      const totalCost = totalValue + tradingFee;

      if (user.balance < totalCost) {
        return NextResponse.json({ error: 'الرصيد غير كافٍ لإتمام العملية (بما في ذلك رسوم التداول)' }, { status: 400 });
      }

      // --- Rule: 1 Distinct Player Per Position ---
      if (asset.type === 'PLAYER' && asset.position) {
        const userHoldings = await prisma.holding.findMany({
          where: { userId: user.id },
          include: { asset: true }
        });

        const conflict = userHoldings.find(h => 
          h.asset.type === 'PLAYER' && 
          h.asset.position === asset.position && 
          h.asset.id !== asset.id &&
          h.quantity > 0
        );

        if (conflict) {
          const positionNames: Record<string, string> = { 'GK': 'حارس مرمى', 'DEF': 'مدافع', 'MID': 'لاعب وسط', 'FWD': 'مهاجم' };
          const posAr = positionNames[asset.position] || asset.position;
          return NextResponse.json({ error: `لقد قمت بشراء لاعب في مركز ${posAr} مسبقاً. يجب شراء لاعب واحد فقط في كل مركز.` }, { status: 400 });
        }
      }

      // Find existing holding
      const existingHolding = await prisma.holding.findFirst({
        where: { userId: user.id, assetId: asset.id, positionType }
      });

      let newAvgPrice = tradePrice;

      if (existingHolding) {
        const totalCostOld = existingHolding.quantity * existingHolding.avg_buy_price;
        const totalCostNew = qty * tradePrice;
        newAvgPrice = (totalCostOld + totalCostNew) / (existingHolding.quantity + qty);

        await prisma.holding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: existingHolding.quantity + qty,
            avg_buy_price: newAvgPrice
          }
        });
      } else {
        await prisma.holding.create({
          data: {
            userId: user.id,
            assetId: asset.id,
            positionType,
            quantity: qty,
            avg_buy_price: tradePrice
          }
        });
      }

      // Deduct balance and record transaction
      await prisma.user.update({
        where: { id: user.id },
        data: { balance: user.balance - totalCost }
      });

      await prisma.transaction.create({
        data: {
          userId: user.id,
          assetId: asset.id,
          type: 'BUY',
          quantity: qty,
          price_at_time: tradePrice
        }
      });

      // Supply & Demand Engine
      const isIPOPhase = process.env.NEXT_PUBLIC_MARKET_STATE === 'IPO';
      const newMarketDemand = Math.min(100, (asset.marketDemand ?? 50) + Math.min(2, qty * 0.05));
      
      let updateData: any = {
        marketDemand: newMarketDemand
      };

      if (!isIPOPhase) {
        const priceIncreaseRatio = 1 + (qty * 0.0005);
        const calculatedNewPriceBuy = Math.round(tradePrice * priceIncreaseRatio);
        
        // Find start of day price to apply correct volatility cap
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstPriceToday = await prisma.priceHistory.findFirst({
          where: { assetId: asset.id, timestamp: { gte: today } },
          orderBy: { timestamp: 'asc' }
        });
        const startOfDayPrice = firstPriceToday ? firstPriceToday.price : tradePrice;
        
        const volatilityRisk = (asset.volatilityScore ?? 50) / 100;
        const { applyVolatilityCap } = await import('@/lib/liveEngine');
        const finalNewPriceBuy = applyVolatilityCap(startOfDayPrice, calculatedNewPriceBuy, volatilityRisk);
        
        if (finalNewPriceBuy !== tradePrice) {
          updateData = {
            ...updateData,
            current_price: finalNewPriceBuy,
            marketPrice: finalNewPriceBuy,
            high_price: Math.max(asset.high_price, finalNewPriceBuy),
            low_price: Math.min(asset.low_price, finalNewPriceBuy),
            priceHistory: {
              create: {
                price: finalNewPriceBuy
              }
            }
          };
        }
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: updateData
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'تم الشراء بنجاح',
          message: `تم تنفيذ أمر شراء عدد ${qty} سهم من ${asset.name}`,
          type: 'SUCCESS'
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: `تم الشراء (${positionType}) ${qty} من ${asset.name}` + (tradingFee > 0 ? ` (رسوم التداول: ${tradingFee})` : ''),
        fee: tradingFee,
        totalCost: totalCost
      });
    } 
    
    if (type === 'SELL') {
      const existingHolding = await prisma.holding.findFirst({
        where: { userId: user.id, assetId: asset.id, positionType }
      });

      if (!existingHolding || existingHolding.quantity < qty) {
        return NextResponse.json({ error: 'Insufficient holdings to sell' }, { status: 400 });
      }

      // Calculate profit/loss based on positionType
      const costBasis = existingHolding.avg_buy_price * qty;
      let profit = 0;
      let grossPayout = 0;

      if (existingHolding.positionType === 'LONG') {
        profit = totalValue - costBasis;
        grossPayout = totalValue;
      } else {
        // SHORT position: Profit if current price is lower than buy price
        profit = costBasis - totalValue;
        grossPayout = Math.max(0, costBasis + profit); // User loses margin if price goes too high, max loss = costBasis
      }

      // Capital Gains Tax: 10% tax if profit > 50% of cost basis
      let tax = 0;
      if (profit > costBasis * 0.5) {
        tax = Math.round(profit * 0.10);
      }

      const finalPayout = grossPayout - tax;
      const finalProfit = profit - tax;

      if (existingHolding.quantity === qty) {
        // Sell all
        await prisma.holding.delete({ where: { id: existingHolding.id } });
      } else {
        // Sell partial
        await prisma.holding.update({
          where: { id: existingHolding.id },
          data: { quantity: existingHolding.quantity - qty }
        });
      }

      // Add balance and record transaction
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          balance: user.balance + finalPayout,
          total_profit: user.total_profit + finalProfit
        }
      });

      await prisma.transaction.create({
        data: {
          userId: user.id,
          assetId: asset.id,
          type: 'SELL',
          quantity: qty,
          price_at_time: tradePrice
        }
      });

      // Supply & Demand Engine
      const isIPOPhase = process.env.NEXT_PUBLIC_MARKET_STATE === 'IPO';
      const newMarketDemand = Math.max(0, (asset.marketDemand ?? 50) - Math.min(2, qty * 0.05));
      
      let updateData: any = {
        marketDemand: newMarketDemand
      };

      if (!isIPOPhase) {
        const priceDecreaseRatio = 1 - (qty * 0.0005);
        const calculatedNewPriceSell = Math.max(1, Math.round(tradePrice * priceDecreaseRatio));
        
        // Find start of day price to apply correct volatility cap
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstPriceToday = await prisma.priceHistory.findFirst({
          where: { assetId: asset.id, timestamp: { gte: today } },
          orderBy: { timestamp: 'asc' }
        });
        const startOfDayPrice = firstPriceToday ? firstPriceToday.price : tradePrice;
        
        const volatilityRisk = (asset.volatilityScore ?? 50) / 100;
        const { applyVolatilityCap } = await import('@/lib/liveEngine');
        const finalNewPriceSell = applyVolatilityCap(startOfDayPrice, calculatedNewPriceSell, volatilityRisk);
        
        if (finalNewPriceSell !== tradePrice) {
          updateData = {
            ...updateData,
            current_price: finalNewPriceSell,
            marketPrice: finalNewPriceSell,
            high_price: Math.max(asset.high_price, finalNewPriceSell),
            low_price: Math.min(asset.low_price, finalNewPriceSell),
            priceHistory: {
              create: {
                price: finalNewPriceSell
              }
            }
          };
        }
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: updateData
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'تم البيع بنجاح',
          message: `تم تنفيذ أمر بيع عدد ${qty} سهم من ${asset.name}`,
          type: 'INFO'
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: `تم البيع (${existingHolding.positionType}) ${qty} من ${asset.name}` + (tax > 0 ? ` (ضريبة الأرباح: ${tax})` : ''),
        profit: finalProfit,
        tax
      });
    }

    return NextResponse.json({ error: 'Invalid trade type' }, { status: 400 });

  } catch (error) {
    console.error('Trade error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
