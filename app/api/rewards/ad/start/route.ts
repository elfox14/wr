import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const DAILY_CAPPED_TYPES = [
  'DAILY', 'AD_WATCH', 'AD_WATCH_BOOSTED', 'TASK_FIRST_TRADE',
  'TASK_UNDERVALUED', 'TASK_PROFIT_SELL', 'TASK_WATCHLIST', 'TASK_DIVERSIFY'
];

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
      include: { rewards: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.adsWatchedToday >= 10) {
      return NextResponse.json({ error: 'Daily ad limit reached (10/10)' }, { status: 400 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (requestType === 'BOOSTED') {
      const claimedBoostedToday = user.rewards.some(
        (reward) => reward.type === 'AD_WATCH_BOOSTED' && reward.claimedAt >= todayStart
      );
      if (claimedBoostedToday) {
        return NextResponse.json({ error: 'لقد شاهدت الإعلان المعزز اليوم مسبقاً.' }, { status: 400 });
      }
    }

    const adRewardAmount = requestType === 'BOOSTED' ? 100 : 50;
    const earnedToday = user.rewards.reduce((sum, reward) => {
      if (reward.claimedAt >= todayStart && DAILY_CAPPED_TYPES.includes(reward.type)) {
        return sum + reward.amount;
      }
      return sum;
    }, 0);

    if (earnedToday + adRewardAmount > 1500) {
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
    });

  } catch (error) {
    console.error('Error starting ad session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
