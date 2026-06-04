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
    if (user.lastDailyReward) {
      const hoursSinceLast = (now.getTime() - user.lastDailyReward.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 24) {
        return NextResponse.json({ error: 'لم يمر 24 ساعة منذ آخر مكافأة يومية.' }, { status: 400 });
      }
    }

    const amount = 500; // As agreed

    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'DAILY',
          amount
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: amount },
          lastDailyReward: now
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: "مكافأة يومية",
          message: `تمت إضافة ${amount}¢ لرصيدك!`,
          type: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({ 
      message: `تم استلام المكافأة اليومية: ${amount}¢`, 
      amount
    });

  } catch (error) {
    console.error('Error claiming daily reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
