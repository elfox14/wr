import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { blendRecentFundamental, calculatePlayerPerformanceRating } from '@/lib/playerPerformance';
import { blendTeamFundamental, calculateTeamMatchPerformanceRating } from '@/lib/teamPerformance';
import { calculateAssetScore, calculateFairValue } from '@/lib/scoring';
import { applyVolatilityCap } from '@/lib/liveEngine';

type ApiFootballPlayerStats = {
  player?: {
    id?: number;
    name?: string;
  };
  statistics?: Array<any>;
};

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
} | null;

type TeamBucket = {
  teamId?: string | null;
  teamName?: string | null;
  playerRatings: number[];
  goalsFor: number;
  goalsAgainst: number;
  yellowCards: number;
  redCards: number;
};

const DAILY_PROVIDER_REQUEST_BUDGET = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 90);
const DAILY_PROVIDER_REQUEST_RESERVE = Number(process.env.API_FOOTBALL_DAILY_RESERVE || 10);

function getTodayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePercent(value: any) {
  if (typeof value === 'string') return toNumber(value.replace('%', ''));
  return toNumber(value);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mapPosition(position?: string | null) {
  const p = String(position || '').toLowerCase();
  if (p.includes('goalkeeper')) return 'GK';
  if (p.includes('defender')) return 'DEF';
  if (p.includes('midfielder')) return 'MID';
  if (p.includes('attacker') || p.includes('forward')) return 'FWD';
  return String(position || '').toUpperCase();
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

function getTeamNameFromStats(stats: any) {
  return stats?.team?.name || stats?.games?.team || null;
}

function extractPerformance(apiPlayer: ApiFootballPlayerStats) {
  const stats = apiPlayer.statistics?.[0] || {};
  const games = stats.games || {};
  const goals = stats.goals || {};
  const shots = stats.shots || {};
  const passes = stats.passes || {};
  const tackles = stats.tackles || {};
  const cards = stats.cards || {};
  const goalkeeper = stats.goals || {};

  const position = mapPosition(games.position);
  const minutes = toNumber(games.minutes);
  const started = String(games.captain || '').toLowerCase() === 'true' || toNumber(games.lineups) > 0 || minutes >= 45;
  const apiRating = games.rating == null ? null : toNumber(games.rating, 0);

  const performanceInput = {
    position,
    minutes,
    started,
    goals: toNumber(goals.total),
    assists: toNumber(goals.assists),
    shotsTotal: toNumber(shots.total),
    shotsOnTarget: toNumber(shots.on),
    passes: toNumber(passes.total),
    keyPasses: toNumber(passes.key),
    passAccuracy: parsePercent(passes.accuracy),
    tackles: toNumber(tackles.total),
    interceptions: toNumber(tackles.interceptions),
    saves: toNumber(goalkeeper.saves),
    goalsConceded: toNumber(goals.conceded),
    yellowCards: toNumber(cards.yellow),
    redCards: toNumber(cards.red),
    apiRating,
  };

  return {
    stats,
    performanceInput,
    calculated: calculatePlayerPerformanceRating(performanceInput),
  };
}

async function findLocalAsset(apiPlayer: ApiFootballPlayerStats) {
  const providerPlayerId = apiPlayer.player?.id;
  const playerName = apiPlayer.player?.name || '';

  if (providerPlayerId) {
    const byProviderId = await prisma.asset.findFirst({
      where: { type: 'PLAYER', apiFootballId: providerPlayerId },
    });
    if (byProviderId) return byProviderId;
  }

  const normalizedApiName = normalizeName(playerName);
  if (!normalizedApiName) return null;

  const candidates = await prisma.asset.findMany({
    where: { type: 'PLAYER' },
    take: 2500,
  });

  return candidates.find((asset) => normalizeName(asset.name) === normalizedApiName) ||
    candidates.find((asset) => normalizeName(asset.name).includes(normalizedApiName) || normalizedApiName.includes(normalizeName(asset.name))) ||
    null;
}

async function findLocalTeam(teamId?: string | null, teamName?: string | null) {
  if (teamId) {
    const byId = await prisma.asset.findFirst({ where: { id: teamId, type: 'TEAM' } });
    if (byId) return byId;
  }

  const normalizedTeamName = normalizeName(teamName || '');
  if (!normalizedTeamName) return null;

  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
  return teams.find((asset) => normalizeName(asset.name) === normalizedTeamName) ||
    teams.find((asset) => normalizeName(asset.name).includes(normalizedTeamName) || normalizedTeamName.includes(normalizeName(asset.name))) ||
    null;
}

function addToTeamBucket(buckets: Map<string, TeamBucket>, item: {
  teamId?: string | null;
  teamName?: string | null;
  internalRating: number;
  goals: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
}) {
  const key = item.teamId || `name:${normalizeName(item.teamName || '')}`;
  if (!key || key === 'name:') return;

  const bucket = buckets.get(key) || {
    teamId: item.teamId,
    teamName: item.teamName,
    playerRatings: [],
    goalsFor: 0,
    goalsAgainst: 0,
    yellowCards: 0,
    redCards: 0,
  };

  bucket.playerRatings.push(item.internalRating);
  bucket.goalsFor += item.goals;
  bucket.goalsAgainst = Math.max(bucket.goalsAgainst, item.goalsConceded);
  bucket.yellowCards += item.yellowCards;
  bucket.redCards += item.redCards;
  buckets.set(key, bucket);
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

async function calculateImmediateMarketPrice(asset: any, fairValue: number) {
  const currentPrice = Math.max(1, Math.round(Number(asset.marketPrice || asset.current_price || fairValue)));
  const firstPriceToday = await prisma.priceHistory.findFirst({
    where: { assetId: asset.id, timestamp: { gte: getTodayStart() } },
    orderBy: { timestamp: 'asc' },
  });

  const startOfDayPrice = firstPriceToday?.price || currentPrice;
  const volatilityRisk = clamp(Number(asset.volatilityScore ?? 50), 0, 100) / 100;
  return applyVolatilityCap(startOfDayPrice, Math.round(fairValue), volatilityRisk);
}

function buildImmediatePriceUpdate(asset: any, nextMarketPrice: number) {
  const currentPrice = Math.max(1, Math.round(Number(asset.marketPrice || asset.current_price || nextMarketPrice)));
  const data: any = {
    current_price: nextMarketPrice,
    marketPrice: nextMarketPrice,
    high_price: Math.max(asset.high_price || nextMarketPrice, nextMarketPrice),
    low_price: Math.min(asset.low_price || nextMarketPrice, nextMarketPrice),
  };

  if (nextMarketPrice !== currentPrice) {
    data.priceHistory = {
      create: { price: nextMarketPrice },
    };
  }

  return data;
}

async function updateTeamsFromBuckets(buckets: Map<string, TeamBucket>, fixtureId: number, dryRun: boolean) {
  const teamResults: any[] = [];

  for (const bucket of buckets.values()) {
    const team = await findLocalTeam(bucket.teamId, bucket.teamName);

    if (!team) {
      teamResults.push({ teamName: bucket.teamName, status: 'team_not_matched' });
      continue;
    }

    const averagePlayerRating = bucket.playerRatings.length
      ? bucket.playerRatings.reduce((sum, rating) => sum + rating, 0) / bucket.playerRatings.length
      : 50;

    const calculated = calculateTeamMatchPerformanceRating({
      averagePlayerRating,
      playerCount: bucket.playerRatings.length,
      goalsFor: bucket.goalsFor,
      goalsAgainst: bucket.goalsAgainst,
      yellowCards: bucket.yellowCards,
      redCards: bucket.redCards,
    });

    const newMomentum = clamp(Number(team.momentum ?? 50) + calculated.momentumImpact);
    const newMarketDemand = clamp(Number(team.marketDemand ?? 50) + calculated.marketImpact);
    const newFundamental = blendTeamFundamental(team.fundamental, calculated.teamRating);

    const players = await prisma.asset.findMany({ where: { type: 'PLAYER', teamId: team.id } });
    const score = calculateAssetScore({
      ...team,
      fundamental: newFundamental,
      momentum: newMomentum,
      marketDemand: newMarketDemand,
    }, players);
    const fairValue = calculateFairValue(score, 'TEAM');
    const oldMarketPrice = Number(team.marketPrice || team.current_price || fairValue);
    const nextMarketPrice = await calculateImmediateMarketPrice(team, fairValue);
    const changePercent = oldMarketPrice > 0 ? ((nextMarketPrice - oldMarketPrice) / oldMarketPrice) * 100 : 0;

    if (!dryRun) {
      await prisma.asset.update({
        where: { id: team.id },
        data: {
          lastPerformanceRating: calculated.teamRating,
          lastPerformanceSyncAt: new Date(),
          fundamental: newFundamental,
          momentum: newMomentum,
          marketDemand: newMarketDemand,
          score,
          fairValue,
          ...buildImmediatePriceUpdate(team, nextMarketPrice),
        },
      });

      const localeGroupKey = `${team.id}:team_performance:${fixtureId}`;
      const existingNews = await prisma.marketNews.findFirst({ where: { localeGroupKey } });
      if (!existingNews) {
        await prisma.marketNews.create({
          data: {
            assetId: team.id,
            eventType: 'team_performance',
            severity: Math.abs(changePercent) >= 8 ? 'high' : 'normal',
            localeGroupKey,
            priceBefore: oldMarketPrice,
            priceAfter: nextMarketPrice,
            changePercent,
            titleAr: `تحديث أداء ${team.name}`,
            bodyAr: `تم تحديث سعر المنتخب فورًا بعد المباراة. تقييم الأداء: ${calculated.teamRating.toFixed(1)}/100، ومتوسط أداء اللاعبين: ${averagePlayerRating.toFixed(1)}/100.`,
            titleEn: `${team.name} market price update`,
            bodyEn: `Team market price updated immediately after match performance. Rating: ${calculated.teamRating.toFixed(1)}/100, average player rating: ${averagePlayerRating.toFixed(1)}/100.`,
            context: {
              fixtureId,
              averagePlayerRating,
              goalsFor: bucket.goalsFor,
              goalsAgainst: bucket.goalsAgainst,
              yellowCards: bucket.yellowCards,
              redCards: bucket.redCards,
              momentumImpact: calculated.momentumImpact,
              marketImpact: calculated.marketImpact,
              fairValue,
              oldMarketPrice,
              nextMarketPrice,
            } as any,
          },
        });
      }
    }

    teamResults.push({
      assetId: team.id,
      name: team.name,
      status: dryRun ? 'team_matched_dry_run' : 'team_updated',
      playerCount: bucket.playerRatings.length,
      averagePlayerRating: Math.round(averagePlayerRating * 10) / 10,
      goalsFor: bucket.goalsFor,
      goalsAgainst: bucket.goalsAgainst,
      teamRating: calculated.teamRating,
      momentumImpact: calculated.momentumImpact,
      marketImpact: calculated.marketImpact,
      fairValueBefore: Number(team.fairValue || team.current_price || fairValue),
      fairValueAfter: fairValue,
      marketPriceBefore: oldMarketPrice,
      marketPriceAfter: nextMarketPrice,
      changePercent: Math.round(changePercent * 10) / 10,
    });
  }

  return teamResults;
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const body = await req.json().catch(() => ({}));
  const fixtureId = Number(body.fixtureId);
  const dryRun = body.dryRun === true;
  const force = body.force === true;
  const limit = Math.min(100, Math.max(1, Number(body.limit || 50)));

  if (!fixtureId || Number.isNaN(fixtureId)) {
    return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
  }

  const existingRecords = await prisma.playerPerformance.count({
    where: { providerFixtureId: fixtureId },
  });

  if (existingRecords > 0 && !force) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'fixture already synced',
      fixtureId,
      existingRecords,
      externalRequestsUsed: 0,
      message: 'تم تخطي المزامنة لحماية حد 100 طلب يوميًا. استخدم force=true فقط عند الحاجة.',
    });
  }

  const usedToday = await getDailyProviderUsage();
  const safeLimit = Math.max(0, DAILY_PROVIDER_REQUEST_BUDGET - DAILY_PROVIDER_REQUEST_RESERVE);

  if (!force && !dryRun && usedToday >= safeLimit) {
    return NextResponse.json({
      error: 'Daily API-Football safe budget reached',
      usedToday,
      budget: DAILY_PROVIDER_REQUEST_BUDGET,
      reserve: DAILY_PROVIDER_REQUEST_RESERVE,
      safeLimit,
      message: 'تم إيقاف المزامنة لحماية حد 100 طلب يوميًا. يمكن استخدام force=true يدويًا في الحالات الضرورية فقط.',
    }, { status: 429 });
  }

  try {
    const payload = await apiFootballFetch<{ response?: ApiFootballPlayerStats[] }>('/fixtures/players', {
      fixture: fixtureId,
    });

    const apiPlayers = (payload.response || []).slice(0, limit);
    const results: any[] = [];
    const teamBuckets = new Map<string, TeamBucket>();

    for (const apiPlayer of apiPlayers) {
      const localAsset = await findLocalAsset(apiPlayer);

      if (!localAsset) {
        results.push({
          providerPlayerId: apiPlayer.player?.id,
          providerName: apiPlayer.player?.name,
          status: 'not_matched',
        });
        continue;
      }

      const { stats, performanceInput, calculated } = extractPerformance(apiPlayer);
      const teamName = getTeamNameFromStats(stats);
      const providerPlayerId = apiPlayer.player?.id;
      const internalRating = calculated.internalRating;
      const momentum = clamp(Number(localAsset.momentum ?? 50) + calculated.momentumImpact);
      const marketDemand = clamp(Number(localAsset.marketDemand ?? 50) + calculated.marketImpact);
      const fundamental = blendRecentFundamental(localAsset.fundamental, internalRating);
      const playerScore = calculateAssetScore({
        ...localAsset,
        fundamental,
        momentum,
        marketDemand,
      });
      const playerFairValue = calculateFairValue(playerScore, 'PLAYER');
      const oldMarketPrice = Number(localAsset.marketPrice || localAsset.current_price || playerFairValue);
      const nextMarketPrice = await calculateImmediateMarketPrice(localAsset, playerFairValue);

      addToTeamBucket(teamBuckets, {
        teamId: localAsset.teamId,
        teamName,
        internalRating,
        goals: performanceInput.goals,
        goalsConceded: performanceInput.goalsConceded,
        yellowCards: performanceInput.yellowCards,
        redCards: performanceInput.redCards,
      });

      if (!dryRun) {
        await prisma.$transaction([
          prisma.playerPerformance.upsert({
            where: {
              assetId_providerFixtureId: {
                assetId: localAsset.id,
                providerFixtureId: fixtureId,
              },
            },
            create: {
              assetId: localAsset.id,
              providerPlayerId,
              providerFixtureId: fixtureId,
              teamName,
              minutes: performanceInput.minutes,
              started: Boolean(performanceInput.started),
              goals: performanceInput.goals,
              assists: performanceInput.assists,
              shotsTotal: performanceInput.shotsTotal,
              shotsOnTarget: performanceInput.shotsOnTarget,
              passes: performanceInput.passes,
              keyPasses: performanceInput.keyPasses,
              passAccuracy: performanceInput.passAccuracy,
              tackles: performanceInput.tackles,
              interceptions: performanceInput.interceptions,
              saves: performanceInput.saves,
              goalsConceded: performanceInput.goalsConceded,
              yellowCards: performanceInput.yellowCards,
              redCards: performanceInput.redCards,
              apiRating: performanceInput.apiRating,
              internalRating,
              momentumImpact: calculated.momentumImpact,
              marketImpact: calculated.marketImpact,
              rawData: apiPlayer as any,
            },
            update: {
              providerPlayerId,
              teamName,
              minutes: performanceInput.minutes,
              started: Boolean(performanceInput.started),
              goals: performanceInput.goals,
              assists: performanceInput.assists,
              shotsTotal: performanceInput.shotsTotal,
              shotsOnTarget: performanceInput.shotsOnTarget,
              passes: performanceInput.passes,
              keyPasses: performanceInput.keyPasses,
              passAccuracy: performanceInput.passAccuracy,
              tackles: performanceInput.tackles,
              interceptions: performanceInput.interceptions,
              saves: performanceInput.saves,
              goalsConceded: performanceInput.goalsConceded,
              yellowCards: performanceInput.yellowCards,
              redCards: performanceInput.redCards,
              apiRating: performanceInput.apiRating,
              internalRating,
              momentumImpact: calculated.momentumImpact,
              marketImpact: calculated.marketImpact,
              rawData: apiPlayer as any,
            },
          }),
          prisma.asset.update({
            where: { id: localAsset.id },
            data: {
              apiFootballId: providerPlayerId ?? localAsset.apiFootballId,
              lastPerformanceRating: internalRating,
              lastPerformanceSyncAt: new Date(),
              fundamental,
              momentum,
              marketDemand,
              score: playerScore,
              fairValue: playerFairValue,
              ...buildImmediatePriceUpdate(localAsset, nextMarketPrice),
            },
          }),
        ]);
      }

      results.push({
        assetId: localAsset.id,
        name: localAsset.name,
        providerPlayerId,
        providerName: apiPlayer.player?.name,
        status: dryRun ? 'matched_dry_run' : 'updated',
        internalRating,
        momentumImpact: calculated.momentumImpact,
        marketImpact: calculated.marketImpact,
        fairValueAfter: playerFairValue,
        marketPriceBefore: oldMarketPrice,
        marketPriceAfter: nextMarketPrice,
      });
    }

    const teamResults = await updateTeamsFromBuckets(teamBuckets, fixtureId, dryRun);

    return NextResponse.json({
      success: true,
      fixtureId,
      dryRun,
      force,
      externalRequestsUsed: 1,
      dailyUsageBefore: usedToday,
      dailyUsageAfterEstimate: dryRun ? usedToday : usedToday + 1,
      dailyBudget: DAILY_PROVIDER_REQUEST_BUDGET,
      dailyReserve: DAILY_PROVIDER_REQUEST_RESERVE,
      totalProviderPlayers: apiPlayers.length,
      matched: results.filter((r) => r.status === 'updated' || r.status === 'matched_dry_run').length,
      updated: results.filter((r) => r.status === 'updated').length,
      notMatched: results.filter((r) => r.status === 'not_matched').length,
      teamUpdated: teamResults.filter((r) => r.status === 'team_updated').length,
      teamMatched: teamResults.filter((r) => r.status === 'team_updated' || r.status === 'team_matched_dry_run').length,
      teamResults,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to sync player performance',
      details: error.payload || null,
    }, { status: error.status || 500 });
  }
}
