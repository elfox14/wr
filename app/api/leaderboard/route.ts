import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/auth';

const SHOW_FAKE_USERS = process.env.NEXT_PUBLIC_DEMO_LEADERBOARD === 'true';

const FAKE_USERS = [
  { name: 'Ahmed K.', username: 'ahmed_k89', avatar: '😎' },
  { name: 'Mohammed S.', username: 'mo_salah_fan', avatar: '🔥' },
  { name: 'Omar M.', username: 'omar_trader', avatar: '📈' },
  { name: 'Khalid A.', username: 'khalid_invests', avatar: '💰' },
  { name: 'Tariq W.', username: 'tariq_wolf', avatar: '🐺' },
  { name: 'Fahad R.', username: 'fahad_10', avatar: '⚽' },
  { name: 'Saud B.', username: 'saud_boss', avatar: '👑' },
  { name: 'Yasser N.', username: 'yasser_n', avatar: '⚡' },
  { name: 'Nawaf T.', username: 'nawaf_t', avatar: '🦅' },
  { name: 'Ali G.', username: 'ali_g', avatar: '🚀' },
];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'netWorth'; // netWorth, roi, unrealizedPnL, realizedProfit, tradesCount, portfolioRisk

    const realUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        balance: true,
        image: true,
        total_profit: true,
        holdings: {
          select: {
            quantity: true,
            avg_buy_price: true,
            asset: {
              select: { 
                id: true,
                name: true,
                current_price: true,
                marketPrice: true,
                volatilityScore: true
              }
            }
          }
        },
        transactions: {
          select: { id: true, createdAt: true }
        }
      }
    });

    let highestNetWorth = 0;
    let highestROI = -Infinity;
    let highestUnrealizedPnL = -Infinity;
    let totalNetWorth = 0;

    let leaderboard = realUsers.map(u => {
      let holdingsValue = 0;
      let totalCostBasis = 0;
      let riskSum = 0;
      let bestHolding = null;
      let bestHoldingPercent = -Infinity;

      u.holdings.forEach(h => {
        const marketPrice = h.asset.marketPrice ?? h.asset.current_price;
        const currentVal = h.quantity * marketPrice;
        const costBasis = h.quantity * h.avg_buy_price;
        
        holdingsValue += currentVal;
        totalCostBasis += costBasis;
        riskSum += (h.asset.volatilityScore || 10) * currentVal;

        const pnl = currentVal - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        
        if (pnlPercent > bestHoldingPercent && h.quantity > 0) {
          bestHoldingPercent = pnlPercent;
          bestHolding = { name: h.asset.name, pnlPercent };
        }
      });

      const unrealizedPnL = holdingsValue - totalCostBasis;
      const unrealizedPnLPercent = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;
      const netWorth = u.balance + holdingsValue;
      const roi = ((netWorth - 10000) / 10000) * 100;
      const portfolioRisk = holdingsValue > 0 ? riskSum / holdingsValue : 0;

      const riskLabel = portfolioRisk <= 30 ? 'Conservative' : portfolioRisk <= 60 ? 'Balanced' : 'Aggressive';
      const riskLabelAr = portfolioRisk <= 30 ? 'محافظ' : portfolioRisk <= 60 ? 'متوازن' : 'هجومي';

      totalNetWorth += netWorth;
      if (netWorth > highestNetWorth) highestNetWorth = netWorth;
      if (roi > highestROI) highestROI = roi;
      if (unrealizedPnL > highestUnrealizedPnL) highestUnrealizedPnL = unrealizedPnL;

      return {
        id: u.id,
        name: u.name || 'مستخدم',
        username: u.username || 'user',
        avatar: u.image || '👤',
        netWorth: Math.round(netWorth),
        balance: Math.round(u.balance),
        holdingsValue: Math.round(holdingsValue),
        totalCostBasis: Math.round(totalCostBasis),
        unrealizedPnL: Math.round(unrealizedPnL),
        unrealizedPnLPercent: Number(unrealizedPnLPercent.toFixed(2)),
        roi: Number(roi.toFixed(2)),
        realizedProfit: Math.round(u.total_profit),
        tradesCount: u.transactions.length,
        assetsCount: u.holdings.filter(h => h.quantity > 0).length,
        portfolioRisk: Math.round(portfolioRisk),
        riskLabel,
        riskLabelAr,
        bestHolding,
        isReal: true
      };
    });

    if (SHOW_FAKE_USERS) {
      const fakes = FAKE_USERS.map((f, i) => {
        const netWorth = 100000 - (i * 8000) + Math.floor(Math.random() * 5000);
        return {
          id: `fake-${i}`,
          name: f.name,
          username: f.username,
          avatar: f.avatar,
          netWorth: netWorth,
          balance: netWorth * 0.2,
          holdingsValue: netWorth * 0.8,
          totalCostBasis: netWorth * 0.6,
          unrealizedPnL: netWorth * 0.2,
          unrealizedPnLPercent: 33.3,
          roi: Number((((netWorth) - 10000) / 10000 * 100).toFixed(2)),
          realizedProfit: 5000,
          tradesCount: 150 - (i * 5),
          assetsCount: 8,
          portfolioRisk: 45,
          riskLabel: 'Balanced',
          riskLabelAr: 'متوازن',
          bestHolding: { name: 'البرازيل', pnlPercent: 45 },
          isReal: false
        };
      });
      leaderboard = [...leaderboard, ...fakes];
    }

    // Sort leaderboard based on sortBy
    leaderboard.sort((a, b) => {
      if (sortBy === 'roi') return b.roi - a.roi;
      if (sortBy === 'unrealizedPnL') return b.unrealizedPnL - a.unrealizedPnL;
      if (sortBy === 'realizedProfit') return b.realizedProfit - a.realizedProfit;
      if (sortBy === 'tradesCount') return b.tradesCount - a.tradesCount;
      if (sortBy === 'portfolioRisk') return a.portfolioRisk - b.portfolioRisk; // Lowest risk first
      return b.netWorth - a.netWorth; // default netWorth
    });

    // Assign rank
    leaderboard = leaderboard.map((u, i) => ({ ...u, rank: i + 1 }));

    let currentUserRank = null;
    if (session?.user?.id) {
      const u = leaderboard.find(user => user.id === session.user.id);
      if (u) currentUserRank = u.rank;
    }

    // Limit to top 50
    const top50 = leaderboard.slice(0, 50);

    // Global Stats queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: today } },
      select: { quantity: true, price_at_time: true, userId: true }
    });

    const totalTradingVolumeToday = todayTransactions.reduce((acc, tx) => acc + (tx.quantity * tx.price_at_time), 0);
    const totalTradesToday = todayTransactions.length;

    let mostActiveTrader = '-';
    if (todayTransactions.length > 0) {
      const userTxCount: Record<string, number> = {};
      let maxTx = 0;
      let maxUser = null;
      todayTransactions.forEach(tx => {
        userTxCount[tx.userId] = (userTxCount[tx.userId] || 0) + 1;
        if (userTxCount[tx.userId] > maxTx) {
          maxTx = userTxCount[tx.userId];
          maxUser = tx.userId;
        }
      });
      if (maxUser) {
        const u = realUsers.find(r => r.id === maxUser);
        if (u) mostActiveTrader = u.name || u.username || 'مستخدم';
      }
    }

    return NextResponse.json({
      stats: {
        totalUsers: realUsers.length,
        totalNetWorth: Math.round(totalNetWorth),
        totalTradingVolumeToday: Math.round(totalTradingVolumeToday),
        totalTradesToday,
        highestNetWorth: Math.round(highestNetWorth),
        highestROI: Number(highestROI.toFixed(2)),
        highestUnrealizedPnL: Math.round(highestUnrealizedPnL),
        mostActiveTrader
      },
      currentUserRank,
      leaderboard: top50
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
