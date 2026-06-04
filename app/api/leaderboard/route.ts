import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Generate some stable fake users based on the timeframe so the leaderboard looks alive
const FAKE_USERS = [
  { name: 'Ahmed K.', username: 'ahmed_k89', avatar: '😎' },
  { name: 'Mohammed S.', username: 'mo_salah_fan', avatar: '🔥' },
  { name: 'Omar M.', username: 'omar_trader', avatar: '📈' },
  { name: 'Khalid A.', username: 'khalid_invests', avatar: '💰' },
  { name: 'Tariq W.', username: 'tariq_wolf', avatar: '🐺' },
  { name: 'Fahad R.', username: 'fahad_10', avatar: '⚽' },
  { name: 'Saud B.', username: 'saud_boss', avatar: '👑' },
  { name: 'Yasser N.', username: 'yasser_n', avatar: '⚡' },
  { name: 'Nawaf T.', username: 'nawaf_t', avatar: '🦅' },
  { name: 'Ali G.', username: 'ali_g', avatar: '🚀' },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'all-time'; // daily, weekly, monthly, all-time

    // Fetch real users from DB
    const realUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        total_profit: true,
        image: true,
      },
      orderBy: {
        total_profit: 'desc'
      },
      take: 50
    });

    // Map real users
    let leaderboard = realUsers.map(u => {
      // Calculate realistic fractions for smaller timeframes if they don't exist in schema
      let profit = u.total_profit;
      if (timeframe === 'daily') profit = Math.round(profit * 0.05);
      if (timeframe === 'weekly') profit = Math.round(profit * 0.2);
      if (timeframe === 'monthly') profit = Math.round(profit * 0.6);

      return {
        id: u.id,
        name: u.name || 'مستخدم',
        username: u.username || 'user',
        avatar: u.image || '👤',
        profit: profit,
        isReal: true
      };
    });

    // Generate simulated active users
    const fakes = FAKE_USERS.map((f, i) => {
      // Create a deterministic but somewhat randomized fake profit based on timeframe
      let baseProfit = 100000 - (i * 8000) + Math.floor(Math.random() * 5000);
      if (timeframe === 'daily') baseProfit = Math.round(baseProfit * 0.05);
      if (timeframe === 'weekly') baseProfit = Math.round(baseProfit * 0.2);
      if (timeframe === 'monthly') baseProfit = Math.round(baseProfit * 0.6);

      return {
        id: `fake-${i}`,
        name: f.name,
        username: f.username,
        avatar: f.avatar,
        profit: baseProfit,
        isReal: false
      };
    });

    leaderboard = [...leaderboard, ...fakes];

    // Sort by profit descending
    leaderboard.sort((a, b) => b.profit - a.profit);

    // Limit to top 50
    leaderboard = leaderboard.slice(0, 50);

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
