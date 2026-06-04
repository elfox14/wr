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

    const amount = 500; // As per UI

    await prisma.$transaction([
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'AD_WATCH',
          amount
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: amount },
        }
      })
    ]);

    return NextResponse.json({ 
      message: `تم إضافة ${amount}¢ لمشاهدة الإعلان!`, 
      amount
    });

  } catch (error) {
    console.error('Error claiming ad reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
