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
    const { type } = await req.json();

    if (!['DAILY', 'WEEKLY'].includes(type)) {
      return NextResponse.json({ error: 'Invalid reward type' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        rewards: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    let amount = 0;

    // Validate request based on type
    if (type === 'DAILY') {
      const lastDaily = user.rewards.filter(r => r.type === 'DAILY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
      if (lastDaily) {
        const msSinceLastDaily = now.getTime() - lastDaily.claimedAt.getTime();
        const hours24 = 24 * 60 * 60 * 1000;
        if (msSinceLastDaily < hours24) {
          return NextResponse.json({ error: 'Daily reward not yet available' }, { status: 400 });
        }
      }
      amount = 500;
    } else if (type === 'WEEKLY') {
      const lastWeekly = user.rewards.filter(r => r.type === 'WEEKLY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
      if (lastWeekly) {
        const msSinceLastWeekly = now.getTime() - lastWeekly.claimedAt.getTime();
        const days7 = 7 * 24 * 60 * 60 * 1000;
        if (msSinceLastWeekly < days7) {
          return NextResponse.json({ error: 'Weekly reward not yet available' }, { status: 400 });
        }
      }
      amount = 5000;
    }

    // Execute claim transaction
    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: user.id,
          type,
          amount
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: amount }
        }
      }),
      // Also trigger a notification for the user
      prisma.notification.create({
        data: {
          userId: user.id,
          title: "تم استلام المكافأة!",
          message: `تم إضافة ${amount}¢ إلى رصيدك. (${type === 'DAILY' ? 'مكافأة يومية' : 'مكافأة أسبوعية'})`,
          type: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({ 
      message: 'Reward claimed successfully', 
      amount,
      newBalance: user.balance + amount
    });

  } catch (error) {
    console.error('Error claiming reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
