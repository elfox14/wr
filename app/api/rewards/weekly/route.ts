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
      include: { rewards: true, transactions: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday start
    weekStart.setHours(0, 0, 0, 0);

    // Check cooldown (if already claimed this week)
    const lastWeekly = user.rewards.filter(r => r.type === 'WEEKLY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
    if (lastWeekly && lastWeekly.claimedAt >= weekStart) {
      return NextResponse.json({ error: 'لقد قمت بالمطالبة بمكافأة هذا الأسبوع مسبقاً.' }, { status: 400 });
    }

    // Determine login days this week
    const loginRewardsThisWeek = user.rewards.filter(r => r.type === 'DAILY' && r.claimedAt >= weekStart);
    const loginDaysThisWeek = new Set(loginRewardsThisWeek.map(r => r.claimedAt.toDateString())).size;

    if (loginDaysThisWeek < 5) {
      return NextResponse.json({ error: `تحتاج لتسجيل الدخول 5 أيام على الأقل هذا الأسبوع. (الحالي: ${loginDaysThisWeek})` }, { status: 400 });
    }

    let amount = 1500;
    if (loginDaysThisWeek >= 7) amount = 2500;

    // Check 3 trades bonus
    const tradesThisWeek = user.transactions.filter(t => t.timestamp >= weekStart).length;
    if (tradesThisWeek >= 3) {
      amount += 500;
    }

    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'WEEKLY',
          amount
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: amount },
          lastWeeklyReward: now,
          rewardCreditsEarned: { increment: amount }
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: "مكافأة أسبوعية",
          message: `تمت إضافة ${amount}¢ لرصيدك!`,
          type: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({ 
      message: `تم استلام المكافأة الأسبوعية: ${amount}¢`, 
      amount
    });

  } catch (error) {
    console.error('Error claiming weekly reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
