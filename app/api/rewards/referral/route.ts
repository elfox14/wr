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
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'الرجاء إدخال كود الدعوة' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.referredById) {
      return NextResponse.json({ error: 'لقد قمت باستخدام كود دعوة مسبقاً' }, { status: 400 });
    }

    if (user.referralCode === code) {
      return NextResponse.json({ error: 'لا يمكنك استخدام كودك الخاص' }, { status: 400 });
    }

    // Find the referring user
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code }
    });

    if (!referrer) {
      return NextResponse.json({ error: 'كود الدعوة غير صحيح' }, { status: 404 });
    }

    const amount = 2000; // As agreed

    await prisma.$transaction([
      // Update the current user
      prisma.user.update({
        where: { id: user.id },
        data: {
          referredById: referrer.id,
          balance: { increment: amount }
        }
      }),
      // Reward record for current user
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'REFERRAL_APPLIED',
          amount
        }
      }),
      // Reward the referrer
      prisma.reward.create({
        data: {
          userId: referrer.id,
          type: 'REFERRAL',
          amount
        }
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { balance: { increment: amount } }
      }),
      // Notify the referrer
      prisma.notification.create({
        data: {
          userId: referrer.id,
          title: "مكافأة دعوة صديق! 🎉",
          message: `استخدم ${user.name || user.email} كود الدعوة الخاص بك! تم إضافة ${amount}¢ إلى رصيدك.`,
          type: "SUCCESS"
        }
      })
    ]);

    return NextResponse.json({ 
      message: `تم تفعيل الكود بنجاح! حصلت على ${amount}¢`, 
    });

  } catch (error) {
    console.error('Error applying referral:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
