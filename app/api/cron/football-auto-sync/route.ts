import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'FINISHED', 'ENDED']);
const UPCOMING_STATUSES = new Set(['NS', 'TBD', 'SCHEDULED']);

function toDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (LIVE_STATUSES.has(value)) return 'IN_PLAY';
  if (FINISHED_STATUSES.has(value)) return 'FINISHED';
  if (UPCOMING_STATUSES.has(value)) return 'SCHEDULED';
  return value || 'SCHEDULED';
}

function isActiveOrDone(status?: string | null) {
  const normalized = normalizeStatus(status);
  return normalized === 'IN_PLAY' || normalized === 'FINISHED';
}

function hasValidCronSecret(req: Request) {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET;
  if (!expected) return true;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  const adminHeader = req.headers.get('x-admin-secret') || '';

  return [bearer, cronHeader, adminHeader].some((value) => value && value === expected);
}

function normalizeTeamName(name?: string | null) {
  return normalizeName(name || '')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findTeamAsset(providerId?: number | string | null, name?: string | null) {
  const providerNumber = providerId == null ? null : Number(providerId);
  if (providerNumber && Number.isFinite(providerNumber)) {
    const byApiId = await prisma.asset.findFirst({ where: { type: 'TEAM', apiFootballId: providerNumber } });
    if (byApiId) return { asset: byApiId, matchMethod: 'apiFootballId' };

    const byIsportsId = await prisma.asset.findFirst({ where: { type: 'TEAM', isportsId: providerNumber } });
    if (byIsportsId) return { asset: byIsportsId, matchMethod: 'isportsId' };
  }

  const normalizedName = normalizeTeamName(name);
  if (!normalizedName || normalizedName.length < 3) return null;

  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
  const exact = teams.find((team) => normalizeTeamName(team.name) === normalizedName);
  if (exact) return { asset: exact, matchMethod: 'exactName' };

  const codeMatch = teams.find((team) => normalizeTeamName(team.code) === normalizedName);
  if (codeMatch) return { asset: codeMatch, matchMethod: 'exactCode' };

  return null;
}

async function upsertFixtureMatch(fixture: any) {
  const fixtureId = fixture.fixture?.id;
  const home = fixture.teams?.home || {};
  const away = fixture.teams?.away || {};

  if (!fixtureId || !home.name || !away.name) {
    return { status: 'skipped_missing_fixture_data', fixtureId, providerHome: home.name, providerAway: away.name };
  }

  const [homeMatch, awayMatch] = await Promise.all([
    findTeamAsset(home.id, home.name),
    findTeamAsset(away.id, away.name),
  ]);

  if (!homeMatch || !awayMatch) {
    return {
      status: 'skipped_team_not_matched',
      fixtureId,
      providerHome: { id: home.id, name: home.name },
      providerAway: { id: away.id, name: away.name },
      homeMatched: Boolean(homeMatch),
      awayMatched: Boolean(awayMatch),
    };
  }

  const homeTeam = homeMatch.asset;
  const awayTeam = awayMatch.asset;

  if (homeTeam.id === awayTeam.id) {
    return {
      status: 'skipped_same_team_match_guard',
      fixtureId,
      providerHome: { id: home.id, name: home.name },
      providerAway: { id: away.id, name: away.name },
      matchedTeam: homeTeam.name,
      homeMatchMethod: homeMatch.matchMethod,
      awayMatchMethod: awayMatch.matchMethod,
    };
  }

  const rawStatus = fixture.fixture?.status?.short || fixture.fixture?.status?.long;
  const status = normalizeStatus(rawStatus);
  const matchDate = fixture.fixture?.date ? new Date(fixture.fixture.date) : new Date();
  const externalId = String(fixtureId);
  const homeScore = Number.isFinite(Number(fixture.goals?.home)) ? Number(fixture.goals.home) : 0;
  const awayScore = Number.isFinite(Number(fixture.goals?.away)) ? Number(fixture.goals.away) : 0;

  await prisma.match.upsert({
    where: { externalId },
    create: {
      externalId,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchDate,
      status,
      homeScore,
      awayScore,
      groupPhase: fixture.league?.round || fixture.league?.name || null,
      stage: 'group',
    },
    update: {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchDate,
      status,
      homeScore,
      awayScore,
      groupPhase: fixture.league?.round || fixture.league?.name || null,
    },
  });

  return {
    status: 'match_upserted',
    fixtureId,
    matchStatus: status,
    providerHome: { id: home.id, name: home.name },
    providerAway: { id: away.id, name: away.name },
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeMatchMethod: homeMatch.matchMethod,
    awayMatchMethod: awayMatch.matchMethod,
  };
}

async function syncPlayerPerformance(req: Request, fixtureId: number, force = false) {
  const origin = new URL(req.url).origin;
  const secret = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';

  const response = await fetch(`${origin}/api/admin/sync-player-performance`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ fixtureId, force, limit: 100 }),
  });

  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, fixtureId, payload };
}

export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || toDateString();
  const force = searchParams.get('force') === 'true';
  const syncFinished = searchParams.get('syncFinished') !== 'false';

  const summary: any = {
    success: true,
    date,
    fixturesFetched: 0,
    livesFetched: 0,
    matches: [],
    performanceSyncs: [],
    errors: [],
  };

  try {
    const fixturesPayload = await apiFootballFetch<{ response?: any[] }>('/fixtures', { date });
    const fixtures = fixturesPayload.response || [];
    summary.fixturesFetched = fixtures.length;

    for (const fixture of fixtures) {
      const matchResult = await upsertFixtureMatch(fixture);
      summary.matches.push(matchResult);
    }
  } catch (error: any) {
    summary.errors.push({ stage: 'fixtures', message: error.message || 'Failed to fetch fixtures', details: error.payload || null });
  }

  let liveFixtures: any[] = [];
  try {
    const livePayload = await apiFootballFetch<{ response?: any[] }>('/livescores', { live: 'all', date });
    liveFixtures = livePayload.response || [];
    summary.livesFetched = liveFixtures.length;

    for (const fixture of liveFixtures) {
      const matchResult = await upsertFixtureMatch(fixture);
      summary.matches.push({ ...matchResult, source: 'live' });
    }
  } catch (error: any) {
    summary.errors.push({ stage: 'livescores', message: error.message || 'Failed to fetch live scores', details: error.payload || null });
  }

  const syncCandidates = new Map<number, { fixture: any; force: boolean }>();

  for (const fixture of liveFixtures) {
    const fixtureId = Number(fixture.fixture?.id);
    const status = fixture.fixture?.status?.short || fixture.fixture?.status?.long;
    if (fixtureId && isActiveOrDone(status)) {
      syncCandidates.set(fixtureId, { fixture, force: true });
    }
  }

  if (syncFinished) {
    const todayMatches = await prisma.match.findMany({
      where: {
        externalId: { not: null },
        matchDate: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lt: new Date(`${date}T23:59:59.999Z`),
        },
        status: { in: ['IN_PLAY', 'FINISHED'] },
        NOT: { homeTeamId: { equals: prisma.match.fields.awayTeamId } },
      },
      take: 50,
    });

    for (const match of todayMatches) {
      const fixtureId = Number(match.externalId);
      if (fixtureId && !syncCandidates.has(fixtureId)) {
        syncCandidates.set(fixtureId, { fixture: null, force: match.status === 'IN_PLAY' || force });
      }
    }
  }

  for (const [fixtureId, item] of syncCandidates) {
    try {
      const syncResult = await syncPlayerPerformance(req, fixtureId, item.force || force);
      summary.performanceSyncs.push(syncResult);
    } catch (error: any) {
      summary.errors.push({ stage: 'player_performance', fixtureId, message: error.message || 'Failed to sync performance' });
    }
  }

  return NextResponse.json(summary, { status: summary.errors.length ? 207 : 200 });
}

export async function POST(req: Request) {
  return GET(req);
}
