import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        rewards: true,
        referrals: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();

    // Check Daily Reward status
    // A daily reward can be claimed if it's been more than 24 hours since the last one
    let canClaimDaily = true;
    let nextDailyAt = null;
    const lastDaily = user.rewards.filter(r => r.type === 'DAILY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
    if (lastDaily) {
      const msSinceLastDaily = now.getTime() - lastDaily.claimedAt.getTime();
      const hours24 = 24 * 60 * 60 * 1000;
      if (msSinceLastDaily < hours24) {
        canClaimDaily = false;
        nextDailyAt = new Date(lastDaily.claimedAt.getTime() + hours24);
      }
    }

    // Check Weekly Reward status
    let canClaimWeekly = true;
    let nextWeeklyAt = null;
    const lastWeekly = user.rewards.filter(r => r.type === 'WEEKLY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
    if (lastWeekly) {
      const msSinceLastWeekly = now.getTime() - lastWeekly.claimedAt.getTime();
      const days7 = 7 * 24 * 60 * 60 * 1000;
      if (msSinceLastWeekly < days7) {
        canClaimWeekly = false;
        nextWeeklyAt = new Date(lastWeekly.claimedAt.getTime() + days7);
      }
    }

    // Prepare Referral code if it doesn't exist
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = `WCE-${user.id.substring(user.id.length - 6).toUpperCase()}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode }
      });
    }

    // Calculate how many successful referrals they've made
    const successfulReferrals = user.referrals.length;

    return NextResponse.json({
      daily: {
        available: canClaimDaily,
        nextAvailableAt: nextDailyAt,
        amount: 500
      },
      weekly: {
        available: canClaimWeekly,
        nextAvailableAt: nextWeeklyAt,
        amount: 5000
      },
      referral: {
        code: referralCode,
        totalReferred: successfulReferrals,
        amountPerReferral: 2000
      }
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
