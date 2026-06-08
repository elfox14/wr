import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
} | null;

function getTodayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('adminSecret') || '';

  return [bearer, headerSecret, querySecret].some((value) => value && value === expectedSecret);
}

async function requireAdmin(req: Request) {
  if (hasValidAdminSecret(req)) return { secret: true };

  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const todayStart = getTodayStart();
  const dailyBudget = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 90);
  const dailyReserve = Number(process.env.API_FOOTBALL_DAILY_RESERVE || 10);
  const safeLimit = Math.max(0, dailyBudget - dailyReserve);

  const syncedFixtures = await prisma.playerPerformance.findMany({
    where: {
      provider: 'API_FOOTBALL',
      createdAt: { gte: todayStart },
      providerFixtureId: { not: null },
    },
    distinct: ['providerFixtureId'],
    select: { providerFixtureId: true },
  });

  const updatedPlayers = await prisma.playerPerformance.count({
    where: {
      provider: 'API_FOOTBALL',
      createdAt: { gte: todayStart },
    },
  });

  const usedToday = syncedFixtures.length;

  return NextResponse.json({
    success: true,
    authMode: admin.secret ? 'secret' : 'session',
    date: todayStart.toISOString(),
    dailyBudget,
    dailyReserve,
    safeLimit,
    usedToday,
    remainingSafe: Math.max(0, safeLimit - usedToday),
    updatedPlayers,
    syncedFixtures: syncedFixtures.map((item) => item.providerFixtureId).filter(Boolean),
  });
}
