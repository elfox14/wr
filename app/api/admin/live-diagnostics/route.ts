import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch } from '@/lib/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminSession = {
  user?: { id?: string; email?: string | null; role?: string | null };
} | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function getHeaderOrQuerySecret(req: Request) {
  const expected = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';
  if (!expected) return { valid: false, method: null };
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const adminHeader = req.headers.get('x-admin-secret') || '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  const { searchParams } = new URL(req.url);
  const adminQuery = searchParams.get('adminSecret') || '';
  const cronQuery = searchParams.get('cronSecret') || '';
  const matched = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'cronSecret_query', value: cronQuery },
  ].find((item) => item.value && item.value === expected);
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

async function requireAdmin(req: Request) {
  const secretAuth = getHeaderOrQuerySecret(req);
  if (secretAuth.valid) return { ok: true, authMethod: secretAuth.method };
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (session?.user && isAdminSession(session)) return { ok: true, authMethod: 'admin_session' };
  return { ok: false, authMethod: null };
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function liveWindowRange() {
  const now = new Date();
  return {
    from: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    to: new Date(now.getTime() + 4 * 60 * 60 * 1000),
  };
}

async function runProviderProbe() {
  try {
    const payload = await apiFootballFetch<{ response?: any[]; _provider?: string }>('/livescores', { live: 'all', date: new Date().toISOString().slice(0, 10) });
    const fixtures = payload.response || [];
    return {
      ok: true,
      providerUsed: payload._provider || 'UNKNOWN',
      fixturesFetched: fixtures.length,
      sample: fixtures.slice(0, 5).map((fixture: any) => ({
        fixtureId: fixture.fixture?.id,
        status: fixture.fixture?.status?.short || fixture.fixture?.status?.long,
        home: fixture.teams?.home?.name,
        away: fixture.teams?.away?.name,
        score: fixture.goals,
      })),
    };
  } catch (error: any) {
    return { ok: false, providerUsed: error.provider || null, message: error.message || 'Provider probe failed', details: error.payload || null };
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const { searchParams } = new URL(req.url);
  const probeProvider = searchParams.get('probe') === 'true';
  const { start, end } = todayRange();
  const { from, to } = liveWindowRange();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalMatches, todayMatches, liveWindowMatches, inPlayMatches, matchesWithExternalId, matchesWithAnimationId, assets, teamAssets, priceHistoryRecent, marketNewsRecent, recentMatches, recentPriceEvents] = await Promise.all([
    prisma.match.count(),
    prisma.match.count({ where: { matchDate: { gte: start, lt: end } } }),
    prisma.match.count({ where: { OR: [{ status: 'IN_PLAY' }, { status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY'] }, matchDate: { gte: from, lte: to } }, { status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY'] }, matchDate: { gte: start, lt: end } }] } }),
    prisma.match.count({ where: { status: 'IN_PLAY' } }),
    prisma.match.count({ where: { externalId: { not: null } } }),
    prisma.match.count({ where: { animationMatchId: { not: null } } }),
    prisma.asset.count(),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.priceHistory.count({ where: { timestamp: { gte: last24h } } }),
    prisma.marketNews.count({ where: { publishedAt: { gte: last24h } } }),
    prisma.match.findMany({
      orderBy: { matchDate: 'asc' },
      take: 12,
      where: { matchDate: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
      include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } },
    }),
    prisma.marketNews.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 8,
      select: { id: true, eventType: true, titleAr: true, priceBefore: true, priceAfter: true, changePercent: true, publishedAt: true, localeGroupKey: true },
    }),
  ]);

  const providerProbe = probeProvider ? await runProviderProbe() : null;
  const blockers: string[] = [];
  if (!process.env.ISPORTS_API_KEY && !process.env.ISPORTS_API_KEYS) blockers.push('ISPORTS_API_KEY/ISPORTS_API_KEYS is missing');
  if (!process.env.API_FOOTBALL_KEY && !process.env.API_FOOTBALL_KEYS) blockers.push('API_FOOTBALL_KEY/API_FOOTBALL_KEYS fallback is missing');
  if (!process.env.CRON_SECRET && !process.env.ADMIN_API_SECRET) blockers.push('CRON_SECRET or ADMIN_API_SECRET is missing');
  if (totalMatches === 0) blockers.push('No matches in database');
  if (teamAssets === 0) blockers.push('No TEAM assets in database');
  if (matchesWithAnimationId === 0) blockers.push('No matches have animationMatchId yet');
  if (liveWindowMatches === 0) blockers.push('No local match today or within the extended live recovery window; cron will skip provider fetch by design');

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    authMethod: auth.authMethod,
    providerPriority: ['ISPORTS', 'API_FOOTBALL'],
    environment: {
      isportsKey: Boolean(process.env.ISPORTS_API_KEY || process.env.ISPORTS_API_KEYS),
      apiFootballKey: Boolean(process.env.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEYS),
      cronSecret: Boolean(process.env.CRON_SECRET),
      adminApiSecret: Boolean(process.env.ADMIN_API_SECRET),
      isportsAnimationAccessKey: Boolean(process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY),
    },
    database: { assets, teamAssets, totalMatches, todayMatches, liveWindowMatches, inPlayMatches, matchesWithExternalId, matchesWithAnimationId, priceHistoryLast24h: priceHistoryRecent, marketNewsLast24h: marketNewsRecent },
    providerProbe,
    recentMatches: recentMatches.map((match) => ({ id: match.id, externalId: match.externalId, animationMatchId: match.animationMatchId, status: match.status, matchDate: match.matchDate, score: `${match.homeScore}-${match.awayScore}`, homeTeam: match.homeTeam?.name, awayTeam: match.awayTeam?.name })),
    recentPriceEvents,
    blockers,
    nextActions: blockers.length ? ['Fix blockers above, then call /api/cron/live-market-sync with the cron/admin secret.', 'Run this endpoint again with ?probe=true to verify provider response.'] : ['System prerequisites look ready. Trigger /api/cron/live-market-sync and verify priceHistoryLast24h / marketNewsLast24h increase after live events.'],
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
}

export async function POST(req: Request) { return GET(req); }
