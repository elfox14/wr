import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const DAILY_CAPPED_TYPES = [
  'DAILY', 'AD_WATCH', 'AD_WATCH_BOOSTED', 'TASK_FIRST_TRADE',
  'TASK_UNDERVALUED', 'TASK_PROFIT_SELL', 'TASK_WATCHLIST', 'TASK_DIVERSIFY'
];

const AD_REWARD_TYPES = ['AD_WATCH', 'AD_WATCH_BOOSTED'];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let requestType = 'REGULAR';
    try {
      const body = await req.json();
      if (body?.type === 'BOOSTED') requestType = 'BOOSTED';
    } catch {
      // ignore JSON parse error
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [adsClaimedToday, boostedClaimedToday, earnedToday] = await Promise.all([
      prisma.reward.count({
        where: {
          userId: user.id,
          type: { in: AD_REWARD_TYPES },
          claimedAt: { gte: todayStart },
        },
      }),
      prisma.reward.count({
        where: {
          userId: user.id,
          type: 'AD_WATCH_BOOSTED',
          claimedAt: { gte: todayStart },
        },
      }),
      prisma.reward.aggregate({
        where: {
          userId: user.id,
          type: { in: DAILY_CAPPED_TYPES },
          claimedAt: { gte: todayStart },
        },
        _sum: { amount: true },
      }),
    ]);

    if (adsClaimedToday >= 10) {
      return NextResponse.json({ error: 'Daily ad limit reached (10/10)' }, { status: 400 });
    }

    if (requestType === 'BOOSTED' && boostedClaimedToday > 0) {
      return NextResponse.json({ error: 'لقد شاهدت الإعلان المعزز اليوم مسبقاً.' }, { status: 400 });
    }

    const adRewardAmount = requestType === 'BOOSTED' ? 100 : 50;
    const totalEarnedToday = earnedToday._sum.amount || 0;

    if (totalEarnedToday + adRewardAmount > 1500) {
      return NextResponse.json({ error: 'Daily reward cap reached (1500/1500)' }, { status: 400 });
    }

    const token = crypto.randomUUID();
    await prisma.adSession.create({
      data: {
        userId: user.id,
        adType: requestType,
        provider: 'INTERNAL',
        status: 'STARTED',
        rewardAmount: adRewardAmount,
        placement: 'rewards_page',
        externalAdId: token,
      }
    });

    return NextResponse.json({
      success: true,
      token,
      reward: adRewardAmount,
      adsClaimedToday,
    });

  } catch (error) {
    console.error('Error starting ad session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
