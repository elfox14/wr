import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isLiveStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'IN_PLAY' || value === 'LIVE' || value === 'HT';
}

function isFinishedStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'FINISHED' || value === 'FT';
}

function isScheduledStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'SCHEDULED' || value === 'TIMED' || value === 'NOT_STARTED';
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      select: {
        id: true,
        status: true,
        homeScore: true,
        awayScore: true,
        statsSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: {
            homeYellowCards: true,
            awayYellowCards: true,
            homeRedCards: true,
            awayRedCards: true,
            capturedAt: true,
          },
        },
      },
    });

    let finishedMatches = 0;
    let liveMatches = 0;
    let scheduledMatches = 0;
    let totalGoals = 0;
    let yellowCards = 0;
    let redCards = 0;
    let matchesWithCardSnapshots = 0;
    let latestCardsUpdatedAt: string | null = null;

    for (const match of matches) {
      if (isFinishedStatus(match.status)) finishedMatches += 1;
      if (isLiveStatus(match.status)) liveMatches += 1;
      if (isScheduledStatus(match.status)) scheduledMatches += 1;
      if (isFinishedStatus(match.status) || isLiveStatus(match.status)) {
        totalGoals += safeNumber(match.homeScore) + safeNumber(match.awayScore);
      }

      const latest = match.statsSnapshots[0];
      if (latest) {
        const matchYellowCards = safeNumber(latest.homeYellowCards) + safeNumber(latest.awayYellowCards);
        const matchRedCards = safeNumber(latest.homeRedCards) + safeNumber(latest.awayRedCards);
        yellowCards += matchYellowCards;
        redCards += matchRedCards;
        if (matchYellowCards > 0 || matchRedCards > 0) matchesWithCardSnapshots += 1;
        const capturedAt = latest.capturedAt instanceof Date ? latest.capturedAt.toISOString() : String(latest.capturedAt || '');
        if (capturedAt && (!latestCardsUpdatedAt || capturedAt > latestCardsUpdatedAt)) latestCardsUpdatedAt = capturedAt;
      }
    }

    return NextResponse.json({
      ok: true,
      totalMatches: matches.length,
      finishedMatches,
      liveMatches,
      scheduledMatches,
      totalGoals,
      yellowCards,
      redCards,
      matchesWithCardSnapshots,
      latestCardsUpdatedAt,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('summary-stats endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
