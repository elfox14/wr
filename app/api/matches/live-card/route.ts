import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TEAM_SELECT = { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true, change: true };
const MATCH_SELECT = {
  id: true,
  externalId: true,
  animationMatchId: true,
  status: true,
  matchDate: true,
  homeScore: true,
  awayScore: true,
  groupPhase: true,
  stage: true,
  homeTeam: { select: TEAM_SELECT },
  awayTeam: { select: TEAM_SELECT },
};

export async function GET() {
  const now = new Date();
  const recentSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const [liveOrUpcoming, recentlyFinished] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
      orderBy: { matchDate: 'asc' },
      take: 8,
      select: MATCH_SELECT,
    }),
    prisma.match.findMany({
      where: { status: 'FINISHED', matchDate: { gte: recentSince, lte: now } },
      orderBy: { matchDate: 'desc' },
      take: 4,
      select: MATCH_SELECT,
    }),
  ]);

  const live = liveOrUpcoming.filter((match) => match.status === 'IN_PLAY' || match.status === 'LIVE');
  const upcoming = liveOrUpcoming.filter((match) => match.status === 'SCHEDULED');
  const matches = [...live, ...upcoming, ...recentlyFinished].slice(0, 8);

  return NextResponse.json({
    matches,
    meta: {
      liveCount: live.length,
      upcomingCount: upcoming.length,
      recentlyFinishedCount: recentlyFinished.length,
      recentFinishedWindowHours: 6,
    },
    updatedAt: now.toISOString(),
  }, {
    headers: {
      'Cache-Control': 'private, max-age=0, no-cache, must-revalidate',
    },
  });
}
