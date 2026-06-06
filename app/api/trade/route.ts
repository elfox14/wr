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
    
    if (!assetId || !type || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const totalValue = asset.current_price * qty;

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

      let newAvgPrice = asset.current_price;

      if (existingHolding) {
        const totalCostOld = existingHolding.quantity * existingHolding.avg_buy_price;
        const totalCostNew = qty * asset.current_price;
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
            avg_buy_price: asset.current_price
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
          price_at_time: asset.current_price
        }
      });

      // Supply & Demand Engine: Increase price by 0.05% per unit bought
      // During IPO phase, price remains fixed.
      const isIPOPhase = process.env.NEXT_PUBLIC_MARKET_STATE === 'IPO';
      
      if (!isIPOPhase) {
        const priceIncreaseRatio = 1 + (qty * 0.0005);
        const newPriceBuy = Math.round(asset.current_price * priceIncreaseRatio);
        
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            current_price: newPriceBuy,
            high_price: Math.max(asset.high_price, newPriceBuy),
            low_price: Math.min(asset.low_price, newPriceBuy),
            priceHistory: {
              create: {
                price: newPriceBuy
              }
            }
          }
        });
      }

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
          price_at_time: asset.current_price
        }
      });

      // Supply & Demand Engine: Decrease price by 0.05% per unit sold
      const isIPOPhase = process.env.NEXT_PUBLIC_MARKET_STATE === 'IPO';

      if (!isIPOPhase) {
        const priceDecreaseRatio = 1 - (qty * 0.0005);
        const newPriceSell = Math.max(1, Math.round(asset.current_price * priceDecreaseRatio)); // Prevent price from dropping below 1
        
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            current_price: newPriceSell,
            high_price: Math.max(asset.high_price, newPriceSell),
            low_price: Math.min(asset.low_price, newPriceSell),
            priceHistory: {
              create: {
                price: newPriceSell
              }
            }
          }
        });
      }

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
