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
      where: { id: session.user.id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    
    // Check cooldown
    if (user.lastWeeklyReward) {
      const hoursSinceLast = (now.getTime() - user.lastWeeklyReward.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 168) { // 7 days
        return NextResponse.json({ error: 'لم يمر أسبوع منذ آخر مكافأة أسبوعية.' }, { status: 400 });
      }
    }

    const amount = 5000; // As agreed

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
          lastWeeklyReward: now
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
