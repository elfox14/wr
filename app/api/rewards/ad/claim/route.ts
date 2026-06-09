import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const adSession = await prisma.adSession.findFirst({
      where: { externalAdId: String(token) },
      include: { user: { include: { rewards: true } } }
    });

    if (!adSession || adSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Invalid ad session' }, { status: 400 });
    }

    if (adSession.status === 'COMPLETED') {
      return NextResponse.json({ error: 'This ad reward has already been claimed' }, { status: 400 });
    }

    if (adSession.status !== 'STARTED') {
      return NextResponse.json({ error: 'Invalid ad session status' }, { status: 400 });
    }

    const now = new Date();
    const elapsedSeconds = (now.getTime() - adSession.createdAt.getTime()) / 1000;

    if (elapsedSeconds > 60) {
      await prisma.adSession.update({
        where: { id: adSession.id },
        data: { status: 'FAILED' }
      });
      return NextResponse.json({ error: 'Ad session expired (60 seconds limit)' }, { status: 400 });
    }

    if (elapsedSeconds < 15) {
      return NextResponse.json({ error: 'يرجى مشاهدة الإعلان لمدة 15 ثانية على الأقل.' }, { status: 400 });
    }

    const user = adSession.user;

    if (user.adsWatchedToday >= 10) {
      return NextResponse.json({ error: 'Daily ad limit reached (10/10)' }, { status: 400 });
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (adSession.adType === 'BOOSTED') {
      const claimedBoostedToday = user.rewards.some(
        (reward) => reward.type === 'AD_WATCH_BOOSTED' && reward.claimedAt >= todayStart
      );
      if (claimedBoostedToday) {
        return NextResponse.json({ error: 'لقد شاهدت الإعلان المعزز اليوم مسبقاً.' }, { status: 400 });
      }
    }

    const adRewardAmount = Number(adSession.rewardAmount || (adSession.adType === 'BOOSTED' ? 100 : 50));
    const rewardTypeDb = adSession.adType === 'BOOSTED' ? 'AD_WATCH_BOOSTED' : 'AD_WATCH';

    const earnedToday = user.rewards.reduce((sum, reward) => {
      if (reward.claimedAt >= todayStart && DAILY_CAPPED_TYPES.includes(reward.type)) {
        return sum + reward.amount;
      }
      return sum;
    }, 0);

    if (earnedToday + adRewardAmount > 1500) {
      return NextResponse.json({ error: 'Daily reward cap reached (1500/1500)' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.adSession.update({
        where: { id: adSession.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          rewardAmount: adRewardAmount,
        }
      }),
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
          type: rewardTypeDb,
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
