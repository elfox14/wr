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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        holdings: {
          include: {
            asset: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let holdingsValue = 0;
    let totalCostBasis = 0;
    let unrealizedPnL = 0;
    let totalRiskWeight = 0;

    let bestPerformer: any = null;
    let worstPerformer: any = null;

    let teamsValue = 0;
    let playersValue = 0;

    let positionValue = {
      GK: 0,
      DEF: 0,
      MID: 0,
      FWD: 0
    };

    let riskValue = {
      low: 0,     // 0-30
      medium: 0,  // 31-60
      high: 0     // 61-100
    };

    const enhancedHoldings = user.holdings.map(holding => {
      const tradePrice = Math.round(holding.asset.marketPrice ?? holding.asset.current_price);
      const fairValue = Math.round(holding.asset.fairValue ?? holding.asset.current_price);
      const currentValue = holding.quantity * tradePrice;
      const costBasis = holding.quantity * holding.avg_buy_price;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      const premiumDiscountPercent = fairValue > 0 ? ((tradePrice - fairValue) / fairValue) * 100 : 0;

      holdingsValue += currentValue;
      totalCostBasis += costBasis;
      unrealizedPnL += pnl;

      const risk = holding.asset.volatilityScore ?? 0;
      totalRiskWeight += risk * currentValue;

      if (holding.asset.type === 'TEAM') {
        teamsValue += currentValue;
      } else {
        playersValue += currentValue;
        if (holding.asset.position) {
          const pos = holding.asset.position as keyof typeof positionValue;
          if (positionValue[pos] !== undefined) {
             positionValue[pos] += currentValue;
          }
        }
      }

      if (risk <= 30) riskValue.low += currentValue;
      else if (risk <= 60) riskValue.medium += currentValue;
      else riskValue.high += currentValue;

      const enhanced = {
        ...holding,
        tradePrice,
        fairValue,
        currentValue,
        costBasis,
        pnl,
        pnlPercent,
        premiumDiscountPercent,
        volatilityScore: risk,
        momentum: holding.asset.momentum ?? 0,
        marketDemand: holding.asset.marketDemand ?? 0
      };

      if (!bestPerformer || pnlPercent > bestPerformer.pnlPercent) bestPerformer = enhanced;
      if (!worstPerformer || pnlPercent < worstPerformer.pnlPercent) worstPerformer = enhanced;

      return enhanced;
    });

    const netWorth = user.balance + holdingsValue;
    const unrealizedPnLPercent = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;
    
    const portfolioRisk = holdingsValue > 0 ? Math.round(totalRiskWeight / holdingsValue) : 0;

    const allocationByType = {
      teams: holdingsValue > 0 ? Math.round((teamsValue / holdingsValue) * 100) : 0,
      players: holdingsValue > 0 ? Math.round((playersValue / holdingsValue) * 100) : 0
    };

    const playersTotalValue = playersValue > 0 ? playersValue : 1; 
    const allocationByPosition = {
      GK: playersValue > 0 ? Math.round((positionValue.GK / playersTotalValue) * 100) : 0,
      DEF: playersValue > 0 ? Math.round((positionValue.DEF / playersTotalValue) * 100) : 0,
      MID: playersValue > 0 ? Math.round((positionValue.MID / playersTotalValue) * 100) : 0,
      FWD: playersValue > 0 ? Math.round((positionValue.FWD / playersTotalValue) * 100) : 0
    };

    const allocationByRisk = {
      low: holdingsValue > 0 ? Math.round((riskValue.low / holdingsValue) * 100) : 0,
      medium: holdingsValue > 0 ? Math.round((riskValue.medium / holdingsValue) * 100) : 0,
      high: holdingsValue > 0 ? Math.round((riskValue.high / holdingsValue) * 100) : 0
    };

    if (enhancedHoldings.length === 0) {
      bestPerformer = null;
      worstPerformer = null;
    }

    return NextResponse.json({
      balance: user.balance,
      holdingsValue,
      netWorth,
      totalCostBasis,
      unrealizedPnL,
      unrealizedPnLPercent,
      bestPerformer,
      worstPerformer,
      allocationByType,
      allocationByPosition,
      allocationByRisk,
      portfolioRisk,
      holdings: enhancedHoldings
    });
  } catch (error) {
    console.error('Error fetching portfolio analytics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
