import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { getFootballLivescores } from '@/lib/isportsApi';
import { bestNameMatch } from '@/lib/isportsMapping';
import { blendTeamFundamental, calculateTeamMatchPerformanceRating } from '@/lib/teamPerformance';
import { calculateAssetScore, calculateFairValue } from '@/lib/scoring';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mapStatus(status: number) {
  if (status === -1) return 'FINISHED';
  if (status > 0) return 'IN_PLAY';
  if (status === 0) return 'SCHEDULED';
  return 'UNKNOWN';
}

async function findTeam(name?: string | null) {
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
  return bestNameMatch(name || '', teams.map((team) => ({ ...team, name: team.name }))) || null;
}

async function updateTeamFromMatch(team: any, match: any, side: 'home' | 'away', dryRun: boolean) {
  const isHome = side === 'home';
  const goalsFor = Number(isHome ? match.homeScore : match.awayScore) || 0;
  const goalsAgainst = Number(isHome ? match.awayScore : match.homeScore) || 0;
  const yellowCards = Number(isHome ? match.homeYellow : match.awayYellow) || 0;
  const redCards = Number(isHome ? match.homeRed : match.awayRed) || 0;
  const corners = Number(isHome ? match.homeCorner : match.awayCorner) || 0;
  const rank = Number(isHome ? match.homeRank : match.awayRank);

  const baseAverage = rank && Number.isFinite(rank) ? clamp(75 - rank * 0.45, 35, 82) : 55;
  const cornerBonus = Math.min(5, corners * 0.4);
  const averagePlayerRating = clamp(baseAverage + cornerBonus + goalsFor * 2 - goalsAgainst * 1.5, 25, 90);

  const calculated = calculateTeamMatchPerformanceRating({
    averagePlayerRating,
    playerCount: 11,
    goalsFor,
    goalsAgainst,
    yellowCards,
    redCards,
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
  const oldFairValue = Number(team.fairValue || team.current_price || fairValue);
  const changePercent = oldFairValue > 0 ? ((fairValue - oldFairValue) / oldFairValue) * 100 : 0;

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
      },
    });

    const localeGroupKey = `${team.id}:isports_team_result:${match.matchId}`;
    const existingNews = await prisma.marketNews.findFirst({ where: { localeGroupKey } });
    if (!existingNews) {
      await prisma.marketNews.create({
        data: {
          assetId: team.id,
          eventType: 'isports_team_result',
          severity: Math.abs(changePercent) >= 8 ? 'high' : 'normal',
          localeGroupKey,
          priceBefore: oldFairValue,
          priceAfter: fairValue,
          changePercent,
          titleAr: `تحديث نتيجة ${team.name}`,
          bodyAr: `تم تحديث تقييم المنتخب من iSports بعد مباراة ${match.homeName} ضد ${match.awayName}. النتيجة: ${match.homeScore}-${match.awayScore}.`,
          titleEn: `${team.name} result update`,
          bodyEn: `Team valuation updated from iSports after ${match.homeName} vs ${match.awayName}. Score: ${match.homeScore}-${match.awayScore}.`,
          context: {
            provider: 'ISPORTS',
            matchId: match.matchId,
            leagueName: match.leagueName,
            homeName: match.homeName,
            awayName: match.awayName,
            goalsFor,
            goalsAgainst,
            yellowCards,
            redCards,
            corners,
            teamRating: calculated.teamRating,
            momentumImpact: calculated.momentumImpact,
            marketImpact: calculated.marketImpact,
          } as any,
        },
      });
    }
  }

  return {
    assetId: team.id,
    name: team.name,
    side,
    goalsFor,
    goalsAgainst,
    yellowCards,
    redCards,
    corners,
    teamRating: calculated.teamRating,
    momentumImpact: calculated.momentumImpact,
    marketImpact: calculated.marketImpact,
    fairValueBefore: oldFairValue,
    fairValueAfter: fairValue,
    changePercent: Math.round(changePercent * 10) / 10,
    status: dryRun ? 'matched_dry_run' : 'updated',
  };
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.authorized) return admin.error;

  const body = await req.json().catch(() => ({}));
  const matchId = Number(body.matchId);
  const dryRun = body.dryRun === true;
  const force = body.force === true;

  if (!matchId || Number.isNaN(matchId)) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
  }

  try {
    const payload: any = await getFootballLivescores({});
    const matches = Array.isArray(payload?.data) ? payload.data : [];
    const match = matches.find((item: any) => Number(item.matchId) === matchId);

    if (!match) {
      return NextResponse.json({ success: false, error: 'Match not found in current livescores feed', matchId }, { status: 404 });
    }

    if (!force && mapStatus(Number(match.status)) === 'SCHEDULED') {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Match is still scheduled. Use force=true to sync anyway.',
        match,
      });
    }

    const homeTeam = await findTeam(match.homeName);
    const awayTeam = await findTeam(match.awayName);
    const results: any[] = [];

    if (homeTeam) results.push(await updateTeamFromMatch(homeTeam, match, 'home', dryRun));
    else results.push({ side: 'home', providerName: match.homeName, status: 'team_not_matched' });

    if (awayTeam) results.push(await updateTeamFromMatch(awayTeam, match, 'away', dryRun));
    else results.push({ side: 'away', providerName: match.awayName, status: 'team_not_matched' });

    return NextResponse.json({
      success: true,
      dryRun,
      matchId,
      match: {
        matchId: match.matchId,
        leagueName: match.leagueName,
        matchTime: match.matchTime,
        status: mapStatus(Number(match.status)),
        homeName: match.homeName,
        awayName: match.awayName,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
      matched: results.filter((item) => item.status !== 'team_not_matched').length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to sync iSports team result',
      primary: error.primary || null,
      fallback: error.fallback || null,
    }, { status: 500 });
  }
}
