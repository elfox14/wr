import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { rewards: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check daily limit for ads (Max 10 ads/day)
    if (user.adsWatchedToday >= 10) {
      return NextResponse.json({ error: 'Daily ad limit reached (10/10)' }, { status: 400 });
    }

    const adRewardAmount = 50;

    // Check Daily Cap (1500)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyCappedTypes = ['DAILY', 'AD_WATCH', 'TASK_FIRST_TRADE', 'TASK_UNDERVALUED', 'TASK_PROFIT_SELL', 'TASK_WATCHLIST', 'TASK_DIVERSIFY'];
    
    let earnedToday = 0;
    user.rewards.forEach(r => {
      if (r.claimedAt >= todayStart && dailyCappedTypes.includes(r.type)) {
        earnedToday += r.amount;
      }
    });

    if (earnedToday + adRewardAmount > 1500) {
      return NextResponse.json({ error: 'Daily reward cap reached (1500/1500)' }, { status: 400 });
    }

    // Transaction to update user and add reward history
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: adRewardAmount },
          adsWatchedToday: { increment: 1 },
          adsWatchedLifetime: { increment: 1 },
          rewardCreditsEarned: { increment: adRewardAmount }
        }
      }),
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'AD_WATCH',
          amount: adRewardAmount
        }
      })
    ]);

    return NextResponse.json({ 
      success: true, 
      message: 'Ad reward claimed successfully',
      reward: adRewardAmount,
      newBalance: user.balance + adRewardAmount,
      adsWatchedToday: user.adsWatchedToday + 1
    });

  } catch (error) {
    console.error('Error claiming ad reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
