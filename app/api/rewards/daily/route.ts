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
      where: { id: session.user.id },
      include: { rewards: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 1. Check cooldown (24 hours)
    if (user.lastDailyReward) {
      const hoursSinceLast = (now.getTime() - user.lastDailyReward.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 24) {
        return NextResponse.json({ error: 'لم يمر 24 ساعة منذ آخر تسجيل دخول.' }, { status: 400 });
      }
    }

    // 2. Manage Streak
    let newStreak = user.dailyStreak;
    if (user.lastDailyReward) {
      const hoursSinceLast = (now.getTime() - user.lastDailyReward.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast > 48) {
        // Streak broken
        newStreak = 0;
      } else {
        newStreak++;
      }
    } else {
      newStreak = 0; // First time
    }

    // Reset streak after Day 7 (index 6, but since we incremented, 7 means 8th day)
    if (newStreak > 6) {
      newStreak = 0;
    }

    // 3. Determine amount
    let baseAmount = 300;
    if (newStreak === 0) baseAmount = 300;
    else if (newStreak === 1) baseAmount = 350;
    else if (newStreak === 2) baseAmount = 400;
    else if (newStreak === 3) baseAmount = 450;
    else if (newStreak === 4) baseAmount = 500;
    else if (newStreak === 5) baseAmount = 600;
    else if (newStreak === 6) baseAmount = 1000;

    // 4. Check Daily Cap
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

    const amountToGrant = Math.min(baseAmount, 1500 - earnedToday);

    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'DAILY',
          amount: amountToGrant
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: amountToGrant },
          lastDailyReward: now,
          dailyStreak: newStreak,
          rewardCreditsEarned: { increment: amountToGrant }
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: "مكافأة تسجيل الدخول",
          message: `تمت إضافة ${amountToGrant}¢ لرصيدك! اليوم ${newStreak + 1} في السلسلة.`,
          type: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({ 
      message: `تم استلام المكافأة اليومية: ${amountToGrant}¢`, 
      amount: amountToGrant,
      streak: newStreak
    });

  } catch (error) {
    console.error('Error claiming daily reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
