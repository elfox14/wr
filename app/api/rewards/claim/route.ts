import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Reward configurations
const TASK_REWARDS: Record<string, number> = {
  'TASK_FIRST_TRADE': 150,
  'TASK_UNDERVALUED': 100,
  'TASK_PROFIT_SELL': 100,
  'TASK_WATCHLIST': 50,
  'TASK_DIVERSIFY': 200,
  'ACH_FIRST_TRADE': 300,
  'ACH_FIRST_PROFIT': 300,
  'ACH_10_TRADES': 500,
  'ACH_50_TRADES': 1000,
  'ACH_100_TRADES': 2000,
  'ACH_TOP_100': 1000,
  'ACH_TOP_10': 3000,
  'ACH_LEAGUE_CREATE': 500,
  'ACH_OWN_QUALIFIED': 500,
  'ACH_OWN_GROUP_WINNER': 1000,
  'SEASON_START': 1000,
  'SEASON_GROUP_END': 1000,
  'SEASON_KNOCKOUT_START': 1500,
  'SEASON_FINAL': 1500,
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { taskId } = await req.json();

    if (!taskId || !TASK_REWARDS[taskId]) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { rewards: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const isDailyTask = taskId.startsWith('TASK_');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if already claimed
    if (isDailyTask) {
      const claimedToday = user.rewards.some(r => r.type === taskId && r.claimedAt >= todayStart);
      if (claimedToday) {
        return NextResponse.json({ error: 'تم استلام هذه المكافأة اليوم مسبقاً.' }, { status: 400 });
      }
    } else {
      // Achievements and Season rewards are one-time
      const claimedEver = user.rewards.some(r => r.type === taskId);
      if (claimedEver) {
        return NextResponse.json({ error: 'تم استلام هذا الإنجاز مسبقاً.' }, { status: 400 });
      }
    }

    let amountToGrant = TASK_REWARDS[taskId];

    // Daily Cap logic only applies to daily tasks
    if (isDailyTask) {
      const dailyCappedTypes = ['DAILY', 'AD_WATCH', 'TASK_FIRST_TRADE', 'TASK_UNDERVALUED', 'TASK_PROFIT_SELL', 'TASK_WATCHLIST', 'TASK_DIVERSIFY'];
      let earnedToday = 0;
      user.rewards.forEach(r => {
        if (r.claimedAt >= todayStart && dailyCappedTypes.includes(r.type)) {
          earnedToday += r.amount;
        }
      });

      if (earnedToday >= 1500) {
        return NextResponse.json({ error: 'لقد وصلت للحد الأقصى للمكافآت اليومية (1500).' }, { status: 400 });
      }
      amountToGrant = Math.min(amountToGrant, 1500 - earnedToday);
    }

    // Grant reward
    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: user.id,
          type: taskId,
          amount: amountToGrant
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: amountToGrant },
          rewardCreditsEarned: { increment: amountToGrant }
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: "تم استلام المكافأة!",
          message: `تم إضافة ${amountToGrant}¢ إلى رصيدك.`,
          type: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({ 
      message: 'Reward claimed successfully', 
      amount: amountToGrant
    });

  } catch (error) {
    console.error('Error claiming reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
