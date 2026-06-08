import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        holdings: {
          include: {
            asset: true
          }
        },
        captain: true,
        achievements: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.referralCode) {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      user = await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: newCode },
        include: { 
          holdings: { include: { asset: true } },
          captain: true,
          achievements: true,
        }
      });
    }

    // Calculate portfolio stats
    let totalHoldingsValue = 0;
    const holdingsWithStats = user.holdings.map(holding => {
      const currentPrice = Math.round(
        holding.asset.marketPrice ?? holding.asset.current_price
      );
      const value = holding.quantity * currentPrice;
      const costBasis = holding.quantity * holding.avg_buy_price;
      const profitLoss = value - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
      
      totalHoldingsValue += value;

      return {
        ...holding,
        currentValue: value,
        costBasis,
        profitLoss,
        profitLossPercent
      };
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        total_profit: user.total_profit,
        total_holdings_value: totalHoldingsValue,
        net_worth: user.balance + totalHoldingsValue,
        referralCode: user.referralCode,
        referredById: user.referredById,
        lastDailyReward: user.lastDailyReward,
        lastWeeklyReward: user.lastWeeklyReward,
      },
      holdings: holdingsWithStats,
      captain: user.captain,
      achievements: user.achievements,
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
