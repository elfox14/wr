import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function getTodayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  try {
    const todayStart = getTodayStart();
    const performances = await prisma.playerPerformance.findMany({
      where: {
        createdAt: { gte: todayStart },
      },
      orderBy: { internalRating: 'desc' },
      take: 50,
      include: {
        asset: {
          include: {
            team: true,
          },
        },
      },
    });

    const totalSynced = performances.length;
    const averageRating = totalSynced > 0
      ? Math.round((performances.reduce((sum, item) => sum + item.internalRating, 0) / totalSynced) * 10) / 10
      : 0;

    const topPerformers = performances.slice(0, 10);
    const positiveMomentum = performances.filter((item) => item.momentumImpact > 0).length;
    const negativeMomentum = performances.filter((item) => item.momentumImpact < 0).length;

    const fixtures = Array.from(new Set(performances.map((item) => item.providerFixtureId).filter(Boolean)));

    return NextResponse.json({
      success: true,
      date: todayStart.toISOString(),
      summary: {
        totalSynced,
        fixturesSynced: fixtures.length,
        averageRating,
        positiveMomentum,
        negativeMomentum,
      },
      performances: topPerformers.map((item) => ({
        id: item.id,
        assetId: item.assetId,
        playerName: item.asset.name,
        playerImage: item.asset.image,
        teamName: item.asset.team?.name || item.teamName,
        teamImage: item.asset.team?.image || null,
        position: item.asset.position,
        internalRating: item.internalRating,
        apiRating: item.apiRating,
        momentumImpact: item.momentumImpact,
        marketImpact: item.marketImpact,
        minutes: item.minutes,
        goals: item.goals,
        assists: item.assists,
        shotsOnTarget: item.shotsOnTarget,
        keyPasses: item.keyPasses,
        tackles: item.tackles,
        saves: item.saves,
        yellowCards: item.yellowCards,
        redCards: item.redCards,
        providerFixtureId: item.providerFixtureId,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error('Daily performance API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
