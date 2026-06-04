import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { name, email, password, referralCode: inputReferralCode } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'الرجاء إدخال جميع الحقول' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 });
    }

    // Check referring user if code provided
    let referringUser = null;
    if (inputReferralCode) {
      referringUser = await prisma.user.findUnique({
        where: { referralCode: inputReferralCode }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = `WCE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create user and maybe reward the referrer in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          username: email.split('@')[0] + Math.floor(Math.random() * 1000), // temp username
          password: hashedPassword,
          referralCode: newReferralCode,
          referredById: referringUser ? referringUser.id : null,
        },
      });

      if (referringUser) {
        // Reward referrer
        const referralAmount = 2000;
        await tx.reward.create({
          data: {
            userId: referringUser.id,
            type: 'REFERRAL',
            amount: referralAmount,
          }
        });
        await tx.user.update({
          where: { id: referringUser.id },
          data: { balance: { increment: referralAmount } }
        });
        await tx.notification.create({
          data: {
            userId: referringUser.id,
            title: "مكافأة دعوة صديق! 🎉",
            message: `لقد سجل شخص جديد باستخدام كودك! تم إضافة ${referralAmount}¢ إلى رصيدك.`,
            type: "SUCCESS"
          }
        });
      }

      return newUser;
    });

    return NextResponse.json({ success: true, message: 'تم إنشاء الحساب بنجاح', user: { id: user.id, email: user.email } }, { status: 201 });
  } catch (error) {
    console.error('Registration Error:', error);
    return NextResponse.json({ error: 'حدث خطأ داخلي في الخادم' }, { status: 500 });
  }
}
