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

function minutesFromKickoff(matchDate: Date, now: Date) {
  return Math.floor((now.getTime() - matchDate.getTime()) / 60_000) + 1;
}

function decorateMatch(match: any, now: Date) {
  const matchDate = new Date(match.matchDate);
  const minute = minutesFromKickoff(matchDate, now);
  const status = String(match.status || '').toUpperCase();
  const isDbLive = status === 'IN_PLAY' || status === 'LIVE';
  const isRecentlyStarted = status === 'SCHEDULED' && minute >= 1 && minute <= 135;
  const isLiveNow = isDbLive || isRecentlyStarted;
  const isFinished = status === 'FINISHED';

  return {
    ...match,
    isLiveNow,
    isLikelyLiveByTime: isRecentlyStarted,
    displayStatus: isLiveNow ? 'IN_PLAY' : match.status,
    minute: isLiveNow ? Math.max(1, Math.min(135, minute)) : null,
    liveLabel: isLiveNow ? `الدقيقة ${Math.max(1, Math.min(135, minute))}` : (isFinished ? 'انتهت المباراة' : null),
  };
}

export async function GET() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const recentSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const [windowMatches, recentlyFinished] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] },
        matchDate: { gte: liveWindowStart, lte: upcomingUntil },
      },
      orderBy: { matchDate: 'asc' },
      take: 16,
      select: MATCH_SELECT,
    }),
    prisma.match.findMany({
      where: { status: 'FINISHED', matchDate: { gte: recentSince, lte: now } },
      orderBy: { matchDate: 'desc' },
      take: 4,
      select: MATCH_SELECT,
    }),
  ]);

  const decoratedWindow = windowMatches.map((match) => decorateMatch(match, now));
  const decoratedFinished = recentlyFinished.map((match) => decorateMatch(match, now));

  const live = decoratedWindow.filter((match) => match.isLiveNow);
  const upcoming = decoratedWindow.filter((match) => !match.isLiveNow && match.status === 'SCHEDULED' && new Date(match.matchDate).getTime() > now.getTime());
  const other = decoratedWindow.filter((match) => !live.includes(match) && !upcoming.includes(match));
  const matches = [...live, ...upcoming, ...decoratedFinished, ...other].slice(0, 8);

  return NextResponse.json({
    matches,
    meta: {
      liveCount: live.length,
      upcomingCount: upcoming.length,
      recentlyFinishedCount: decoratedFinished.length,
      recentFinishedWindowHours: 6,
      liveDetection: 'status_or_match_time_window',
      updatedEverySeconds: 15,
    },
    updatedAt: now.toISOString(),
  }, {
    headers: {
      'Cache-Control': 'private, max-age=0, no-cache, must-revalidate',
    },
  });
}
