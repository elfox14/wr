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

    // Check Referrer's monthly limit (Max 10 paid referrals per month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const referrerPaidReferralsThisMonth = await prisma.reward.count({
      where: {
        userId: referrer.id,
        type: 'REFERRAL_REGISTER',
        claimedAt: { gte: monthStart }
      }
    });

    const amount = 500; // Stage 1 (Register)

    // Build transaction
    const transactionSteps: any[] = [];

    // 1. Update current user with referrer ID and give them 500
    transactionSteps.push(
      prisma.user.update({
        where: { id: user.id },
        data: {
          referredById: referrer.id,
          balance: { increment: amount },
          rewardCreditsEarned: { increment: amount }
        }
      })
    );

    transactionSteps.push(
      prisma.reward.create({
        data: {
          userId: user.id,
          type: 'REFERRAL_APPLIED_REGISTER',
          amount
        }
      })
    );

    // 2. Give referrer 500 if under monthly cap
    if (referrerPaidReferralsThisMonth < 10) {
      transactionSteps.push(
        prisma.reward.create({
          data: {
            userId: referrer.id,
            type: 'REFERRAL_REGISTER',
            amount
          }
        })
      );
      transactionSteps.push(
        prisma.user.update({
          where: { id: referrer.id },
          data: { 
            balance: { increment: amount },
            rewardCreditsEarned: { increment: amount }
          }
        })
      );
      transactionSteps.push(
        prisma.notification.create({
          data: {
            userId: referrer.id,
            title: "إحالة ناجحة! 🎉",
            message: `سجل ${user.name || user.username || 'مستخدم جديد'} بكودك! تمت إضافة ${amount}¢ لرصيدك (المرحلة 1).`,
            type: "SUCCESS"
          }
        })
      );
    }

    await prisma.$transaction(transactionSteps);

    return NextResponse.json({ 
      message: `تم تفعيل الكود بنجاح! حصلت على ${amount}¢ كمكافأة تسجيل. ستحصل على المزيد عند التداول.`, 
    });

  } catch (error) {
    console.error('Error applying referral:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
