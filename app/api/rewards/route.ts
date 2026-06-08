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
      where: { id: session.user.id },
      include: {
        rewards: true,
        referrals: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Calculate Earned Today against the Cap
    const dailyCappedTypes = ['DAILY', 'AD_WATCH', 'TASK_FIRST_TRADE', 'TASK_UNDERVALUED', 'TASK_PROFIT_SELL', 'TASK_WATCHLIST', 'TASK_DIVERSIFY'];
    
    let earnedToday = 0;
    user.rewards.forEach(r => {
      if (r.claimedAt >= todayStart && dailyCappedTypes.includes(r.type)) {
        earnedToday += r.amount;
      }
    });

    const dailyRewardCap = 1500;
    const remainingToday = Math.max(0, dailyRewardCap - earnedToday);

    // 2. Check Daily Login status
    let canClaimDaily = true;
    let nextDailyAt = null;
    let dailyStreak = user.dailyStreak;
    
    const lastDaily = user.rewards.filter(r => r.type === 'DAILY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
    if (lastDaily) {
      const msSinceLastDaily = now.getTime() - lastDaily.claimedAt.getTime();
      const hours24 = 24 * 60 * 60 * 1000;
      if (msSinceLastDaily < hours24) {
        canClaimDaily = false;
        nextDailyAt = new Date(lastDaily.claimedAt.getTime() + hours24);
      }
    }

    // Determine next daily amount
    let nextDailyAmount = 300;
    if (dailyStreak === 0) nextDailyAmount = 300;
    else if (dailyStreak === 1) nextDailyAmount = 350;
    else if (dailyStreak === 2) nextDailyAmount = 400;
    else if (dailyStreak === 3) nextDailyAmount = 450;
    else if (dailyStreak === 4) nextDailyAmount = 500;
    else if (dailyStreak === 5) nextDailyAmount = 600;
    else if (dailyStreak === 6) nextDailyAmount = 1000;
    else if (dailyStreak >= 7) nextDailyAmount = 1000;

    // 3. Weekly Rewards Status (Determine login days this week)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday start
    weekStart.setHours(0, 0, 0, 0);

    const loginRewardsThisWeek = user.rewards.filter(r => r.type === 'DAILY' && r.claimedAt >= weekStart);
    // Unique days claimed this week
    const loginDaysThisWeek = new Set(loginRewardsThisWeek.map(r => r.claimedAt.toDateString())).size;

    let canClaimWeekly = true;
    let nextWeeklyAt = null;
    const lastWeekly = user.rewards.filter(r => r.type === 'WEEKLY').sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())[0];
    if (lastWeekly && lastWeekly.claimedAt >= weekStart) {
      canClaimWeekly = false; // Already claimed this week
      nextWeeklyAt = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000); // Next Sunday
    }

    // 4. Referral System
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = `WCE-${user.id.substring(user.id.length - 6).toUpperCase()}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode }
      });
    }

    // Cap referrals to 10 per month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidReferralsThisMonth = await prisma.reward.count({
      where: {
        userId: user.id,
        type: 'REFERRAL_REGISTER',
        claimedAt: { gte: monthStart }
      }
    });

    // 5. Tasks Status
    const tasks = {
      firstTrade: user.rewards.some(r => r.type === 'TASK_FIRST_TRADE' && r.claimedAt >= todayStart),
      undervalued: user.rewards.some(r => r.type === 'TASK_UNDERVALUED' && r.claimedAt >= todayStart),
      profitSell: user.rewards.some(r => r.type === 'TASK_PROFIT_SELL' && r.claimedAt >= todayStart),
      watchlist: user.rewards.some(r => r.type === 'TASK_WATCHLIST' && r.claimedAt >= todayStart),
      diversify: user.rewards.some(r => r.type === 'TASK_DIVERSIFY' && r.claimedAt >= todayStart),
    };

    return NextResponse.json({
      dailyCap: dailyRewardCap,
      earnedToday,
      remainingToday,
      daily: {
        available: canClaimDaily,
        nextAvailableAt: nextDailyAt,
        amount: Math.min(nextDailyAmount, remainingToday), // Respect cap
        streak: dailyStreak
      },
      weekly: {
        available: canClaimWeekly,
        nextAvailableAt: nextWeeklyAt,
        loginDaysThisWeek,
        amount5Days: 1500,
        amount7Days: 2500
      },
      referral: {
        code: referralCode,
        totalReferred: user.referrals.length,
        paidReferralsThisMonth,
        maxReferralsPerMonth: 10
      },
      ads: {
        watchedToday: user.adsWatchedToday,
        maxPerDay: 10,
        amountPerAd: 50,
        available: user.adsWatchedToday < 10 && remainingToday >= 50
      },
      tasks
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
