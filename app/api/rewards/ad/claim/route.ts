import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const result = await prisma.$transaction(async (tx) => {
      const adSession = await tx.adSession.findFirst({
        where: { externalAdId: String(token) },
      });

      if (!adSession || adSession.userId !== session.user.id) {
        return { error: 'Invalid ad session', status: 400 };
      }

      if (adSession.status === 'COMPLETED') {
        return { error: 'This ad reward has already been claimed', status: 400 };
      }

      if (adSession.status !== 'STARTED') {
        return { error: 'Invalid ad session status', status: 400 };
      }

      const elapsedSeconds = (now.getTime() - adSession.createdAt.getTime()) / 1000;

      if (elapsedSeconds > 60) {
        await tx.adSession.update({
          where: { id: adSession.id },
          data: { status: 'FAILED' }
        });
        return { error: 'Ad session expired (60 seconds limit)', status: 400 };
      }

      if (elapsedSeconds < 15) {
        return { error: 'يرجى مشاهدة الإعلان لمدة 15 ثانية على الأقل.', status: 400 };
      }

      const adRewardAmount = Number(adSession.rewardAmount || (adSession.adType === 'BOOSTED' ? 100 : 50));
      const rewardTypeDb = adSession.adType === 'BOOSTED' ? 'AD_WATCH_BOOSTED' : 'AD_WATCH';

      const [adsClaimedToday, boostedClaimedToday, earnedToday, user] = await Promise.all([
        tx.reward.count({
          where: {
            userId: adSession.userId,
            type: { in: AD_REWARD_TYPES },
            claimedAt: { gte: todayStart },
          },
        }),
        tx.reward.count({
          where: {
            userId: adSession.userId,
            type: 'AD_WATCH_BOOSTED',
            claimedAt: { gte: todayStart },
          },
        }),
        tx.reward.aggregate({
          where: {
            userId: adSession.userId,
            type: { in: DAILY_CAPPED_TYPES },
            claimedAt: { gte: todayStart },
          },
          _sum: { amount: true },
        }),
        tx.user.findUnique({
          where: { id: adSession.userId },
          select: { balance: true },
        }),
      ]);

      if (!user) {
        return { error: 'User not found', status: 404 };
      }

      if (adsClaimedToday >= 10) {
        return { error: 'Daily ad limit reached (10/10)', status: 400 };
      }

      if (adSession.adType === 'BOOSTED' && boostedClaimedToday > 0) {
        return { error: 'لقد شاهدت الإعلان المعزز اليوم مسبقاً.', status: 400 };
      }

      const totalEarnedToday = earnedToday._sum.amount || 0;
      if (totalEarnedToday + adRewardAmount > 1500) {
        return { error: 'Daily reward cap reached (1500/1500)', status: 400 };
      }

      await tx.adSession.update({
        where: { id: adSession.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          rewardAmount: adRewardAmount,
        }
      });

      await tx.user.update({
        where: { id: adSession.userId },
        data: {
          balance: { increment: adRewardAmount },
          adsWatchedLifetime: { increment: 1 },
          rewardCreditsEarned: { increment: adRewardAmount }
        }
      });

      await tx.reward.create({
        data: {
          userId: adSession.userId,
          type: rewardTypeDb,
          amount: adRewardAmount
        }
      });

      return {
        success: true,
        message: 'Ad reward claimed successfully',
        reward: adRewardAmount,
        newBalance: user.balance + adRewardAmount,
        adsWatchedToday: adsClaimedToday + 1
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error claiming ad reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
