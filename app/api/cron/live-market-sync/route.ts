import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { applyVolatilityCap } from '@/lib/liveEngine';

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'FINISHED', 'ENDED']);
const UPCOMING_STATUSES = new Set(['NS', 'TBD', 'SCHEDULED']);

function normalizeStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (LIVE_STATUSES.has(value)) return 'IN_PLAY';
  if (FINISHED_STATUSES.has(value)) return 'FINISHED';
  if (UPCOMING_STATUSES.has(value)) return 'SCHEDULED';
  return value || 'SCHEDULED';
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

function toScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function hasPotentialLiveWindow() {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 60 * 1000);
  const to = new Date(now.getTime() + 150 * 60 * 1000);

  const count = await prisma.match.count({
    where: {
      OR: [
        { status: 'IN_PLAY' },
        {
          status: { in: ['SCHEDULED', 'LIVE'] },
          matchDate: { gte: from, lte: to },
        },
      ],
    },
  });

  return count > 0;
}

async function findTeamAsset(providerId?: number | string | null, name?: string | null) {
  const providerNumber = providerId == null ? null : Number(providerId);
  if (providerNumber && Number.isFinite(providerNumber)) {
    const byApiId = await prisma.asset.findFirst({ where: { type: 'TEAM', apiFootballId: providerNumber } });
    if (byApiId) return byApiId;

    const byIsportsId = await prisma.asset.findFirst({ where: { type: 'TEAM', isportsId: providerNumber } });
    if (byIsportsId) return byIsportsId;
  }

  const normalizedName = normalizeTeamName(name);
  if (!normalizedName || normalizedName.length < 3) return null;

  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
  return teams.find((team) => normalizeTeamName(team.name) === normalizedName) ||
    teams.find((team) => normalizeTeamName(team.code) === normalizedName) ||
    null;
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

  if (nextPrice !== currentPrice) {
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
  }

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
      bodyAr: nextPrice === currentPrice
        ? `${params.bodyAr} لم يتغير السعر بسبب حدود التذبذب الحالية.`
        : `${params.bodyAr} السعر الجديد: ${nextPrice}¢ (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%).`,
      titleEn: params.titleAr,
      bodyEn: params.bodyAr,
      context: { fixtureId: params.fixtureId, multiplier: params.multiplier, capped: nextPrice !== requestedPrice } as any,
    },
  });

  return {
    status: nextPrice === currentPrice ? 'capped_no_change' : 'price_updated',
    assetId: asset.id,
    name: asset.name,
    priceBefore: currentPrice,
    priceAfter: nextPrice,
    changePercent: Math.round(changePercent * 10) / 10,
  };
}

async function processLiveFixture(fixture: any) {
  const fixtureId = Number(fixture.fixture?.id);
  const home = fixture.teams?.home || {};
  const away = fixture.teams?.away || {};
  if (!fixtureId || !home.name || !away.name) {
    return { status: 'skipped_missing_fixture_data', fixtureId };
  }

  const [homeTeam, awayTeam] = await Promise.all([
    findTeamAsset(home.id, home.name),
    findTeamAsset(away.id, away.name),
  ]);

  if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) {
    return {
      status: 'skipped_team_not_matched',
      fixtureId,
      homeMatched: Boolean(homeTeam),
      awayMatched: Boolean(awayTeam),
      providerHome: home.name,
      providerAway: away.name,
    };
  }

  const externalId = String(fixtureId);
  const rawStatus = fixture.fixture?.status?.short || fixture.fixture?.status?.long;
  const status = normalizeStatus(rawStatus);
  const matchDate = fixture.fixture?.date ? new Date(fixture.fixture.date) : new Date();
  const homeScore = toScore(fixture.goals?.home);
  const awayScore = toScore(fixture.goals?.away);
  const previousMatch = await prisma.match.findUnique({ where: { externalId } });
  const previousHomeScore = previousMatch?.homeScore ?? 0;
  const previousAwayScore = previousMatch?.awayScore ?? 0;

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

  const priceUpdates: any[] = [];
  if (status === 'IN_PLAY') {
    const homeDelta = Math.max(0, homeScore - previousHomeScore);
    const awayDelta = Math.max(0, awayScore - previousAwayScore);

    for (let index = 1; index <= homeDelta; index += 1) {
      const goalNumber = previousHomeScore + index;
      priceUpdates.push(await applyLiveTeamPriceEvent({
        assetId: homeTeam.id,
        fixtureId,
        localeGroupKey: `${fixtureId}:live_goal:home:${goalNumber}`,
        eventType: 'live_goal_for',
        multiplier: 1.03,
        titleAr: `⚽ هدف لـ ${homeTeam.name}`,
        bodyAr: `تحرك سعر ${homeTeam.name} صعودًا بعد تسجيل هدف مباشر أمام ${awayTeam.name}.`,
      }));
      priceUpdates.push(await applyLiveTeamPriceEvent({
        assetId: awayTeam.id,
        fixtureId,
        localeGroupKey: `${fixtureId}:live_goal_against:away:${goalNumber}`,
        eventType: 'live_goal_against',
        multiplier: 0.98,
        titleAr: `📉 هدف مستقبَل على ${awayTeam.name}`,
        bodyAr: `تحرك سعر ${awayTeam.name} هبوطًا بعد استقبال هدف مباشر من ${homeTeam.name}.`,
      }));
    }

    for (let index = 1; index <= awayDelta; index += 1) {
      const goalNumber = previousAwayScore + index;
      priceUpdates.push(await applyLiveTeamPriceEvent({
        assetId: awayTeam.id,
        fixtureId,
        localeGroupKey: `${fixtureId}:live_goal:away:${goalNumber}`,
        eventType: 'live_goal_for',
        multiplier: 1.03,
        titleAr: `⚽ هدف لـ ${awayTeam.name}`,
        bodyAr: `تحرك سعر ${awayTeam.name} صعودًا بعد تسجيل هدف مباشر أمام ${homeTeam.name}.`,
      }));
      priceUpdates.push(await applyLiveTeamPriceEvent({
        assetId: homeTeam.id,
        fixtureId,
        localeGroupKey: `${fixtureId}:live_goal_against:home:${goalNumber}`,
        eventType: 'live_goal_against',
        multiplier: 0.98,
        titleAr: `📉 هدف مستقبَل على ${homeTeam.name}`,
        bodyAr: `تحرك سعر ${homeTeam.name} هبوطًا بعد استقبال هدف مباشر من ${awayTeam.name}.`,
      }));
    }
  }

  return {
    status: 'live_fixture_processed',
    fixtureId,
    matchStatus: status,
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    previousScore: `${previousHomeScore}-${previousAwayScore}`,
    currentScore: `${homeScore}-${awayScore}`,
    priceUpdates,
  };
}

export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary: any = {
    success: true,
    mode: 'light_live_market_sync',
    externalRequestsUsed: 0,
    skippedProviderFetch: false,
    fixturesFetched: 0,
    processed: [],
    errors: [],
  };

  const shouldFetchLive = await hasPotentialLiveWindow();
  if (!shouldFetchLive) {
    summary.skippedProviderFetch = true;
    summary.reason = 'No local match is currently live or near kickoff, so no provider request was used.';
    return NextResponse.json(summary);
  }

  try {
    const payload = await apiFootballFetch<{ response?: any[] }>('/livescores', { live: 'all', date: dateKey() });
    const fixtures = payload.response || [];
    summary.externalRequestsUsed = 1;
    summary.fixturesFetched = fixtures.length;

    for (const fixture of fixtures) {
      summary.processed.push(await processLiveFixture(fixture));
    }
  } catch (error: any) {
    summary.errors.push({ message: error.message || 'Failed to run light live market sync', details: error.payload || null });
  }

  return NextResponse.json(summary, { status: summary.errors.length ? 207 : 200 });
}

export async function POST(req: Request) {
  return GET(req);
}
