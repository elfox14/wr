import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [
      matches,
      snapshots,
      theStatsSnapshots,
      playerPerformanceRows,
      goalRows,
      assistRows,
      saveRows,
      eventGoals,
      latestSnapshots,
      topScorers,
      topAssists,
      topSaves,
    ] = await Promise.all([
      prisma.match.count(),
      prisma.matchStatsSnapshot.count(),
      prisma.matchStatsSnapshot.count({ where: { provider: { startsWith: 'THE_STATS_API' } } }),
      prisma.playerPerformance.count(),
      prisma.playerPerformance.count({ where: { goals: { gt: 0 } } }),
      prisma.playerPerformance.count({ where: { assists: { gt: 0 } } }),
      prisma.playerPerformance.count({ where: { saves: { gt: 0 } } }),
      prisma.matchEvent.count({ where: { type: 'goal' } }),
      prisma.matchStatsSnapshot.findMany({
        orderBy: { capturedAt: 'desc' },
        take: 8,
        select: { matchId: true, provider: true, capturedAt: true, providerMatchId: true },
      }),
      prisma.playerPerformance.findMany({
        where: { goals: { gt: 0 } },
        orderBy: [{ goals: 'desc' }, { shotsOnTarget: 'desc' }],
        take: 8,
        select: { goals: true, assists: true, shotsTotal: true, saves: true, asset: { select: { name: true, team: { select: { name: true, code: true } } } } },
      }),
      prisma.playerPerformance.findMany({
        where: { assists: { gt: 0 } },
        orderBy: [{ assists: 'desc' }, { keyPasses: 'desc' }],
        take: 8,
        select: { goals: true, assists: true, keyPasses: true, asset: { select: { name: true, team: { select: { name: true, code: true } } } } },
      }),
      prisma.playerPerformance.findMany({
        where: { saves: { gt: 0 } },
        orderBy: [{ saves: 'desc' }],
        take: 8,
        select: { saves: true, asset: { select: { name: true, team: { select: { name: true, code: true } } } } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      mode: 'statistics_health_v1',
      counts: {
        matches,
        snapshots,
        theStatsSnapshots,
        playerPerformanceRows,
        playerRowsWithGoals: goalRows,
        playerRowsWithAssists: assistRows,
        playerRowsWithSaves: saveRows,
        matchEventGoals: eventGoals,
      },
      latestSnapshots,
      samples: {
        topScorers: topScorers.map((row) => ({ player: row.asset.name, team: row.asset.team?.name || null, goals: row.goals, assists: row.assists, shots: row.shotsTotal, saves: row.saves })),
        topAssists: topAssists.map((row) => ({ player: row.asset.name, team: row.asset.team?.name || null, goals: row.goals, assists: row.assists, keyPasses: row.keyPasses })),
        topSaves: topSaves.map((row) => ({ player: row.asset.name, team: row.asset.team?.name || null, saves: row.saves })),
      },
      generatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('statistics health error', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'statistics_health_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
