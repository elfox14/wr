import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch } from '@/lib/apiFootball';

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

function isValidDate(date: string | null) {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));
}

function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';

  return [bearer, headerSecret].some((value) => value && value === expectedSecret);
}

async function requireAdmin(req: Request) {
  if (hasValidAdminSecret(req)) return { secret: true };

  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

async function getDailyProviderUsage() {
  const todayStart = getTodayStart();
  const syncedFixtures = await prisma.playerPerformance.findMany({
    where: {
      provider: 'API_FOOTBALL',
      createdAt: { gte: todayStart },
      providerFixtureId: { not: null },
    },
    distinct: ['providerFixtureId'],
    select: { providerFixtureId: true },
  });

  return syncedFixtures.length;
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const team = searchParams.get('team');
  const next = searchParams.get('next');
  const last = searchParams.get('last');

  if (!isValidDate(date) && !team && !next && !last) {
    return NextResponse.json({
      error: 'Provide date=YYYY-MM-DD, team, next, or last',
    }, { status: 400 });
  }

  const dailyBudget = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 90);
  const dailyReserve = Number(process.env.API_FOOTBALL_DAILY_RESERVE || 10);
  const usedToday = await getDailyProviderUsage();
  const safeLimit = Math.max(0, dailyBudget - dailyReserve);

  if (usedToday >= safeLimit) {
    return NextResponse.json({
      error: 'Daily safe budget reached',
      usedToday,
      dailyBudget,
      dailyReserve,
      safeLimit,
      message: 'تم إيقاف جلب المباريات من API-Football لحماية حد الطلبات اليومي.',
    }, { status: 429 });
  }

  const params: Record<string, string | number> = {};
  if (date) params.date = date;
  if (league) params.league = league;
  if (season) params.season = season;
  if (team) params.team = team;
  if (next) params.next = next;
  if (last) params.last = last;

  try {
    const payload = await apiFootballFetch<{ response?: any[] }>('/fixtures', params);
    const fixtures = payload.response || [];
    const fixtureIds = fixtures.map((item) => item.fixture?.id).filter(Boolean);

    const synced = await prisma.playerPerformance.findMany({
      where: {
        providerFixtureId: { in: fixtureIds },
      },
      distinct: ['providerFixtureId'],
      select: { providerFixtureId: true },
    });

    const syncedSet = new Set(synced.map((item) => item.providerFixtureId).filter(Boolean));

    return NextResponse.json({
      success: true,
      authMode: admin.secret ? 'secret' : 'session',
      externalRequestsUsed: 1,
      dailyUsage: {
        usedToday,
        afterEstimate: usedToday + 1,
        dailyBudget,
        dailyReserve,
        safeLimit,
      },
      query: params,
      fixtures: fixtures.map((item) => {
        const fixtureId = item.fixture?.id;
        return {
          fixtureId,
          date: item.fixture?.date,
          timestamp: item.fixture?.timestamp,
          status: item.fixture?.status?.short || item.fixture?.status?.long,
          statusLong: item.fixture?.status?.long,
          league: item.league?.name,
          country: item.league?.country,
          season: item.league?.season,
          round: item.league?.round,
          homeTeam: {
            id: item.teams?.home?.id,
            name: item.teams?.home?.name,
            logo: item.teams?.home?.logo,
          },
          awayTeam: {
            id: item.teams?.away?.id,
            name: item.teams?.away?.name,
            logo: item.teams?.away?.logo,
          },
          goals: item.goals,
          score: item.score,
          alreadySynced: syncedSet.has(fixtureId),
        };
      }),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to fetch API-Football fixtures',
      details: error.payload || null,
    }, { status: error.status || 500 });
  }
}
