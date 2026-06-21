import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { applyVolatilityCap } from '@/lib/liveEngine';
import { requireAdmin } from '@/lib/adminAuth';

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



function normalizeTeamName(name?: string | null) {
  return normalizeName(name || '')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
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

async function applyLiveTeamPriceEvent(params: {
  assetId: string;
  fixtureId: number;
  localeGroupKey: string;
  eventType: string;
  multiplier: number;
  titleAr: string;
  bodyAr: string;
}) {
  const existingNews = await prisma.marketNews.findFirst({ where: { localeGroupKey: params.localeGroupKey } });
  if (existingNews) return { status: 'already_processed', localeGroupKey: params.localeGroupKey };

  const asset = await prisma.asset.findUnique({ where: { id: params.assetId } });
  if (!asset) return { status: 'asset_not_found', assetId: params.assetId };

  const currentPrice = Math.max(1, Math.round(Number(asset.marketPrice || asset.current_price || 1)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstPriceToday = await prisma.priceHistory.findFirst({
    where: { assetId: asset.id, timestamp: { gte: today } },
    orderBy: { timestamp: 'asc' },
  });
  const startPrice = firstPriceToday?.price || currentPrice;
  const risk = Math.max(0, Math.min(100, Number(asset.volatilityScore ?? 50))) / 100;
  const requestedPrice = Math.max(1, Math.round(currentPrice * params.multiplier));
  const nextPrice = applyVolatilityCap(startPrice, requestedPrice, risk);
  const changePercent = currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;

  if (nextPrice === currentPrice) {
    await prisma.marketNews.create({
      data: {
        assetId: asset.id,
        eventType: params.eventType,
        severity: 'normal',
        localeGroupKey: params.localeGroupKey,
        priceBefore: currentPrice,
        priceAfter: nextPrice,
        changePercent: 0,
        titleAr: params.titleAr,
        bodyAr: `${params.bodyAr} لم يتغير السعر بسبب حدود التذبذب الحالية.`,
        titleEn: params.titleAr,
        bodyEn: params.bodyAr,
        context: { fixtureId: params.fixtureId, multiplier: params.multiplier, capped: true } as any,
      },
    });
    return { status: 'capped_no_change', assetId: asset.id, name: asset.name, price: currentPrice };
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      current_price: nextPrice,
      marketPrice: nextPrice,
      change: changePercent,
      high_price: Math.max(asset.high_price || nextPrice, nextPrice),
      low_price: Math.min(asset.low_price || nextPrice, nextPrice),
      priceHistory: { create: { price: nextPrice } },
    },
  });

  await prisma.marketNews.create({
    data: {
      assetId: asset.id,
      eventType: params.eventType,
      severity: Math.abs(changePercent) >= 5 ? 'high' : 'normal',
      localeGroupKey: params.localeGroupKey,
      priceBefore: currentPrice,
      priceAfter: nextPrice,
      changePercent,
      titleAr: params.titleAr,
      bodyAr: `${params.bodyAr} السعر الجديد: ${nextPrice}¢ (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%).`,
      titleEn: params.titleAr,
      bodyEn: params.bodyAr,
      context: { fixtureId: params.fixtureId, multiplier: params.multiplier } as any,
    },
  });

  return {
    status: 'price_updated',
    assetId: asset.id,
    name: asset.name,
    priceBefore: currentPrice,
    priceAfter: nextPrice,
    changePercent: Math.round(changePercent * 10) / 10,
  };
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
  const homeScore = toScore(fixture.goals?.home);
  const awayScore = toScore(fixture.goals?.away);
  const previousMatch = await prisma.match.findUnique({ where: { externalId } });

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
    previousHomeScore: previousMatch?.homeScore ?? 0,
    previousAwayScore: previousMatch?.awayScore ?? 0,
    homeScore,
    awayScore,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    providerHome: { id: home.id, name: home.name },
    providerAway: { id: away.id, name: away.name },
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeMatchMethod: homeMatch.matchMethod,
    awayMatchMethod: awayMatch.matchMethod,
  };
}

async function processScorePriceMovements(matchResult: any) {
  if (matchResult.status !== 'match_upserted' || matchResult.matchStatus !== 'IN_PLAY') return [];

  const updates: any[] = [];
  const fixtureId = Number(matchResult.fixtureId);
  const previousHomeScore = toScore(matchResult.previousHomeScore);
  const previousAwayScore = toScore(matchResult.previousAwayScore);
  const homeScore = toScore(matchResult.homeScore);
  const awayScore = toScore(matchResult.awayScore);
  const homeDelta = Math.max(0, homeScore - previousHomeScore);
  const awayDelta = Math.max(0, awayScore - previousAwayScore);

  for (let index = 1; index <= homeDelta; index += 1) {
    const goalNumber = previousHomeScore + index;
    updates.push(await applyLiveTeamPriceEvent({
      assetId: matchResult.homeTeamId,
      fixtureId,
      localeGroupKey: `${fixtureId}:live_goal:home:${goalNumber}`,
      eventType: 'live_goal_for',
      multiplier: 1.03,
      titleAr: `⚽ هدف لـ ${matchResult.homeTeam}`,
      bodyAr: `تحرك سعر ${matchResult.homeTeam} صعودًا بعد تسجيل هدف مباشر أمام ${matchResult.awayTeam}.`,
    }));
    updates.push(await applyLiveTeamPriceEvent({
      assetId: matchResult.awayTeamId,
      fixtureId,
      localeGroupKey: `${fixtureId}:live_goal_against:away:${goalNumber}`,
      eventType: 'live_goal_against',
      multiplier: 0.98,
      titleAr: `📉 هدف مستقبَل على ${matchResult.awayTeam}`,
      bodyAr: `تحرك سعر ${matchResult.awayTeam} هبوطًا بعد استقبال هدف مباشر من ${matchResult.homeTeam}.`,
    }));
  }

  for (let index = 1; index <= awayDelta; index += 1) {
    const goalNumber = previousAwayScore + index;
    updates.push(await applyLiveTeamPriceEvent({
      assetId: matchResult.awayTeamId,
      fixtureId,
      localeGroupKey: `${fixtureId}:live_goal:away:${goalNumber}`,
      eventType: 'live_goal_for',
      multiplier: 1.03,
      titleAr: `⚽ هدف لـ ${matchResult.awayTeam}`,
      bodyAr: `تحرك سعر ${matchResult.awayTeam} صعودًا بعد تسجيل هدف مباشر أمام ${matchResult.homeTeam}.`,
    }));
    updates.push(await applyLiveTeamPriceEvent({
      assetId: matchResult.homeTeamId,
      fixtureId,
      localeGroupKey: `${fixtureId}:live_goal_against:home:${goalNumber}`,
      eventType: 'live_goal_against',
      multiplier: 0.98,
      titleAr: `📉 هدف مستقبَل على ${matchResult.homeTeam}`,
      bodyAr: `تحرك سعر ${matchResult.homeTeam} هبوطًا بعد استقبال هدف مباشر من ${matchResult.awayTeam}.`,
    }));
  }

  return updates;
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
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

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
    livePriceUpdates: [],
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
      const priceUpdates = await processScorePriceMovements(matchResult);
      if (priceUpdates.length > 0) summary.livePriceUpdates.push(...priceUpdates);
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
      },
      take: 50,
    });

    for (const match of todayMatches) {
      if (match.homeTeamId === match.awayTeamId) continue;
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
