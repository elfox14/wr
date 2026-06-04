import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'الرجاء إدخال البريد الإلكتروني' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success even if user doesn't exist for security reasons
      return NextResponse.json({ success: true, message: 'إذا كان البريد مسجلاً لدينا، ستتلقى رابطاً للاستعادة' });
    }

    // Create a mock reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000); // 1 hour

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      }
    });

    // MOCK EMAIL SENDING
    console.log('\n\n==============================================');
    console.log(`📩 بريد إلكتروني افتراضي لاستعادة كلمة المرور`);
    console.log(`إلى: ${email}`);
    console.log(`الرابط: http://localhost:3000/reset-password?token=${token}`);
    console.log('==============================================\n\n');

    return NextResponse.json({ success: true, message: 'تم إرسال رابط الاستعادة إلى بريدك (راجع الـ Console للمحاكاة)' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return NextResponse.json({ error: 'حدث خطأ داخلي في الخادم' }, { status: 500 });
  }
}
