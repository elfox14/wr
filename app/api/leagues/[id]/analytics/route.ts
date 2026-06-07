import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const resolvedParams = await params;
    const leagueId = resolvedParams.id;

    // Fetch the league and its members
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          include: {
            user: {
              include: {
                holdings: {
                  include: {
                    asset: true
                  }
                },
                transactions: {
                  include: {
                    asset: true
                  },
                  orderBy: { timestamp: 'desc' },
                  take: 50 // Limit transactions per user to avoid memory overload
                }
              }
            }
          }
        }
      }
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Check if user is a member
    const isMember = league.members.some(m => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this league' }, { status: 403 });
    }

    let totalLeagueNetWorth = 0;
    const membersData = league.members.map(member => {
      const u = member.user;
      
      let holdingsValue = 0;
      let totalCostBasis = 0;
      let totalWeightedRisk = 0;

      let bestHolding: any = null;
      let highestHoldingPnLPercent = -Infinity;

      // Calculate holding values
      const enrichedHoldings = u.holdings.map(h => {
        const marketPrice = Math.round(h.asset.marketPrice ?? h.asset.current_price);
        const currentValue = h.quantity * marketPrice;
        const costBasis = h.quantity * h.avg_buy_price;
        const pnl = currentValue - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        
        holdingsValue += currentValue;
        totalCostBasis += costBasis;
        totalWeightedRisk += (h.asset.volatilityScore || 10) * currentValue;

        if (pnlPercent > highestHoldingPnLPercent) {
          highestHoldingPnLPercent = pnlPercent;
          bestHolding = {
            assetName: h.asset.name,
            assetImage: h.asset.image,
            pnlPercent,
            pnl
          };
        }

        return { ...h, currentValue, pnl, pnlPercent, marketPrice };
      });

      const netWorth = u.balance + holdingsValue;
      totalLeagueNetWorth += netWorth;

      const unrealizedPnL = holdingsValue - totalCostBasis;
      const unrealizedPnLPercent = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;
      const roi = ((netWorth - 10000) / 10000) * 100;
      
      const portfolioRisk = holdingsValue > 0 ? totalWeightedRisk / holdingsValue : 0;
      let riskLabel = 'Conservative';
      let riskLabelAr = 'محافظ';
      if (portfolioRisk > 30 && portfolioRisk <= 60) {
        riskLabel = 'Balanced';
        riskLabelAr = 'متوازن';
      } else if (portfolioRisk > 60) {
        riskLabel = 'Aggressive';
        riskLabelAr = 'هجومي';
      }

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        image: u.image,
        isCreator: league.creatorId === u.id,
        joinedAt: member.joinedAt,
        balance: u.balance,
        realizedProfit: u.total_profit,
        netWorth,
        roi,
        unrealizedPnL,
        unrealizedPnLPercent,
        tradesCount: u.transactions.length,
        assetsCount: u.holdings.length,
        portfolioRisk,
        riskLabel,
        riskLabelAr,
        bestHolding,
        recentTransactions: u.transactions.map(t => ({
          id: t.id,
          type: t.type,
          assetName: t.asset.name,
          quantity: t.quantity,
          price_at_time: t.price_at_time,
          timestamp: t.timestamp
        }))
      };
    });

    // Sort leaderboard by netWorth descending
    membersData.sort((a, b) => b.netWorth - a.netWorth);

    // Add rank to members
    membersData.forEach((m, idx) => {
      (m as any).rank = idx + 1;
    });

    const currentUserData = membersData.find(m => m.id === userId);
    const totalMembers = membersData.length;
    const averageNetWorth = totalMembers > 0 ? totalLeagueNetWorth / totalMembers : 0;
    const highestNetWorth = membersData.length > 0 ? membersData[0].netWorth : 0;
    const topPerformer = membersData.length > 0 ? membersData[0] : null;
    
    // Most active trader
    let mostActiveTrader = membersData[0];
    for (const m of membersData) {
      if (m.tradesCount > (mostActiveTrader?.tradesCount || 0)) {
        mostActiveTrader = m;
      }
    }

    // Collect all recent activity from the entire league, sorted by time
    const allActivity = [];
    for (const m of membersData) {
      for (const t of m.recentTransactions) {
        allActivity.push({
          userName: m.name || m.username || 'User',
          ...t
        });
      }
    }
    allActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        creatorId: league.creatorId,
        memberCount: totalMembers,
        createdAt: league.createdAt
      },
      currentUserRank: currentUserData ? (currentUserData as any).rank : null,
      currentUserNetWorth: currentUserData ? currentUserData.netWorth : 0,
      totalMembers,
      averageNetWorth,
      highestNetWorth,
      topPerformer: topPerformer ? { name: topPerformer.name || topPerformer.username, netWorth: topPerformer.netWorth } : null,
      mostActiveTrader: mostActiveTrader ? { name: mostActiveTrader.name || mostActiveTrader.username, tradesCount: mostActiveTrader.tradesCount } : null,
      leaderboard: membersData,
      recentActivity: allActivity.slice(0, 50) // Return only 50 most recent global league activities
    });

  } catch (error) {
    console.error('Error fetching league analytics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
