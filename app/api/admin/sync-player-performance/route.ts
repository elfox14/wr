import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { blendRecentFundamental, calculatePlayerPerformanceRating } from '@/lib/playerPerformance';

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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any) as AdminSession;

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const fixtureId = Number(body.fixtureId);
  const dryRun = body.dryRun === true;
  const limit = Math.min(100, Math.max(1, Number(body.limit || 50)));

  if (!fixtureId || Number.isNaN(fixtureId)) {
    return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
  }

  try {
    const payload = await apiFootballFetch<{ response?: ApiFootballPlayerStats[] }>('/fixtures/players', {
      fixture: fixtureId,
    });

    const apiPlayers = (payload.response || []).slice(0, limit);
    const results: any[] = [];

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
      });
    }

    return NextResponse.json({
      success: true,
      fixtureId,
      dryRun,
      totalProviderPlayers: apiPlayers.length,
      matched: results.filter((r) => r.status === 'updated' || r.status === 'matched_dry_run').length,
      updated: results.filter((r) => r.status === 'updated').length,
      notMatched: results.filter((r) => r.status === 'not_matched').length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to sync player performance',
      details: error.payload || null,
    }, { status: error.status || 500 });
  }
}
