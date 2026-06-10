import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch } from '@/lib/apiFootball';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function getOrigin(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(req.url).origin;
}

async function callInternal(req: Request, path: string, init: RequestInit = {}) {
  const origin = getOrigin(req);
  const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';

  const response = await fetch(`${origin}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

function simplifyFixture(item: any) {
  return {
    fixtureId: item.fixture?.id,
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
      winner: item.teams?.home?.winner,
    },
    awayTeam: {
      id: item.teams?.away?.id,
      name: item.teams?.away?.name,
      logo: item.teams?.away?.logo,
      winner: item.teams?.away?.winner,
    },
    goals: item.goals,
    score: item.score,
  };
}

function simplifyPlayerStats(item: any) {
  const stats = item.statistics?.[0] || {};
  const games = stats.games || {};
  const goals = stats.goals || {};
  const shots = stats.shots || {};
  const passes = stats.passes || {};
  const tackles = stats.tackles || {};
  const cards = stats.cards || {};

  return {
    providerPlayerId: item.player?.id,
    name: item.player?.name,
    teamName: stats.team?.name,
    position: games.position,
    minutes: games.minutes,
    rating: games.rating,
    goals: goals.total,
    assists: goals.assists,
    saves: goals.saves,
    goalsConceded: goals.conceded,
    shotsTotal: shots.total,
    shotsOnTarget: shots.on,
    passes: passes.total,
    keyPasses: passes.key,
    passAccuracy: passes.accuracy,
    tackles: tackles.total,
    interceptions: tackles.interceptions,
    yellowCards: cards.yellow,
    redCards: cards.red,
  };
}

async function countInvalidMatches() {
  const all = await prisma.match.findMany({
    where: { externalId: { not: null } },
    select: { homeTeamId: true, awayTeamId: true },
  });
  return all.filter((match) => match.homeTeamId === match.awayTeamId).length;
}

async function healthCheck() {
  const [assets, teams, players, matches, performances, news, invalidMatches] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.match.count(),
    prisma.playerPerformance.count(),
    prisma.marketNews.count(),
    countInvalidMatches(),
  ]);

  return {
    ok: true,
    time: new Date().toISOString(),
    env: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      nextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
      nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      adminApiSecret: Boolean(process.env.ADMIN_API_SECRET),
      cronSecret: Boolean(process.env.CRON_SECRET),
      apiFootballKey: Boolean(process.env.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEYS),
      isportsKey: Boolean(process.env.ISPORTS_API_KEY || process.env.ISPORTS_API_KEYS),
      marketState: process.env.NEXT_PUBLIC_MARKET_STATE || null,
    },
    database: { assets, teams, players, matches, performances, news, invalidMatches },
  };
}

async function recentMatches(limit = 30) {
  const matches = await prisma.match.findMany({
    where: { externalId: { not: null } },
    orderBy: { matchDate: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    include: {
      homeTeam: { select: { id: true, name: true, image: true } },
      awayTeam: { select: { id: true, name: true, image: true } },
    },
  });

  const fixtureIds = matches.map((match) => Number(match.externalId)).filter((id) => Number.isFinite(id));
  const performanceCounts = await prisma.playerPerformance.groupBy({
    by: ['providerFixtureId'],
    where: { providerFixtureId: { in: fixtureIds } },
    _count: { id: true },
  });
  const countsByFixtureId = new Map(performanceCounts.map((item) => [item.providerFixtureId, item._count.id]));

  return {
    ok: true,
    count: matches.length,
    matches: matches.map((match) => {
      const fixtureId = Number(match.externalId);
      return {
        id: match.id,
        fixtureId,
        matchDate: match.matchDate,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        isInvalidSameTeam: match.homeTeamId === match.awayTeamId,
        performanceRecords: countsByFixtureId.get(fixtureId) || 0,
      };
    }),
  };
}

async function invalidMatches() {
  const matches = await prisma.match.findMany({
    where: { externalId: { not: null } },
    orderBy: { matchDate: 'desc' },
    take: 500,
    include: {
      homeTeam: { select: { id: true, name: true, image: true } },
      awayTeam: { select: { id: true, name: true, image: true } },
    },
  });

  const invalid = matches.filter((match) => match.homeTeamId === match.awayTeamId);
  return {
    ok: true,
    count: invalid.length,
    matches: invalid.map((match) => ({
      id: match.id,
      fixtureId: Number(match.externalId),
      matchDate: match.matchDate,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
    })),
  };
}

async function cleanupInvalidMatches(dryRun = true) {
  const scan = await invalidMatches();
  const ids = scan.matches.map((match: any) => match.id);
  const fixtureIds = scan.matches.map((match: any) => match.fixtureId).filter(Boolean);

  if (dryRun || ids.length === 0) {
    return {
      ...scan,
      ok: true,
      dryRun,
      deletedMatches: 0,
      deletedPerformances: 0,
    };
  }

  const [performanceDelete, matchDelete] = await prisma.$transaction([
    prisma.playerPerformance.deleteMany({ where: { providerFixtureId: { in: fixtureIds } } }),
    prisma.match.deleteMany({ where: { id: { in: ids } } }),
  ]);

  return {
    ok: true,
    dryRun,
    scannedInvalidMatches: scan.count,
    deletedMatches: matchDelete.count,
    deletedPerformances: performanceDelete.count,
    fixtureIds,
  };
}

async function providerFixtures(date: string) {
  const payload = await apiFootballFetch<{ response?: any[] }>('/fixtures', { date });
  const fixtures = payload.response || [];
  return { ok: true, source: 'provider', endpoint: '/fixtures', date, count: fixtures.length, fixtures: fixtures.map(simplifyFixture), raw: fixtures };
}

async function providerLiveScores() {
  const payload = await apiFootballFetch<{ response?: any[] }>('/livescores', { live: 'all' });
  const fixtures = payload.response || [];
  return { ok: true, source: 'provider', endpoint: '/livescores', count: fixtures.length, fixtures: fixtures.map(simplifyFixture), raw: fixtures };
}

async function providerPlayerStats(fixtureId: string) {
  const payload = await apiFootballFetch<{ response?: any[] }>('/fixtures/players', { fixture: Number(fixtureId) });
  const players = payload.response || [];
  return { ok: true, source: 'provider', endpoint: '/fixtures/players', fixtureId: Number(fixtureId), count: players.length, players: players.map(simplifyPlayerStats), raw: players };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'health';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const fixtureId = searchParams.get('fixtureId');
  const force = searchParams.get('force') === 'true';
  const dryRun = searchParams.get('dryRun') !== 'false';
  const limit = Number(searchParams.get('limit') || 30);

  try {
    if (action === 'health') return NextResponse.json(await healthCheck());
    if (action === 'recent-matches') return NextResponse.json(await recentMatches(limit));
    if (action === 'invalid-matches') return NextResponse.json(await invalidMatches());
    if (action === 'cleanup-invalid-matches') return NextResponse.json(await cleanupInvalidMatches(dryRun));
    if (action === 'provider-fixtures') return NextResponse.json(await providerFixtures(date));
    if (action === 'provider-live') return NextResponse.json(await providerLiveScores());
    if (action === 'provider-player-stats') {
      if (!fixtureId) return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
      return NextResponse.json(await providerPlayerStats(fixtureId));
    }

    if (action === 'fixtures') {
      const result = await callInternal(req, `/api/admin/api-football-fixtures?date=${encodeURIComponent(date)}`);
      return NextResponse.json(result, { status: result.ok ? 200 : result.status });
    }

    if (action === 'auto-sync') {
      const params = new URLSearchParams({ date });
      if (force) params.set('force', 'true');
      const result = await callInternal(req, `/api/cron/football-auto-sync?${params.toString()}`);
      return NextResponse.json(result, { status: result.ok ? 200 : result.status });
    }

    if (action === 'sync-performance') {
      if (!fixtureId) return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
      const result = await callInternal(req, '/api/admin/sync-player-performance', {
        method: 'POST',
        body: JSON.stringify({ fixtureId: Number(fixtureId), force, limit: 100 }),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Admin control action failed', details: error.payload || null }, { status: error.status || 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return GET(new Request(url.toString(), { headers: req.headers }));
}
