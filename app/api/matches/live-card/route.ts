import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { footballFetchFromProvider } from '@/lib/apiFootball';

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

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function minutesFromKickoff(matchDate: Date, now: Date) {
  return Math.floor((now.getTime() - matchDate.getTime()) / 60_000) + 1;
}

function rawStatus(value: any) {
  return String(value?.fixture?.status?.short || value?.fixture?.status?.long || value?.status || '').toUpperCase();
}

function isHalftimeStatus(status: string) {
  return ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'].includes(status);
}

function isProviderLiveStatus(status: string) {
  return ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY'].includes(status) || isHalftimeStatus(status);
}

function providerMinute(value: any) {
  const raw = value?.fixture?.status?.elapsed ?? value?.fixture?.status?.minute ?? value?.minute ?? value?.elapsed;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(1, Math.min(135, Math.round(n))) : null;
}

async function fetchAnimationLiveState() {
  try {
    const data: any = await footballFetchFromProvider('ISPORTS', '/livescores', { date: dateKey(), live: 'all' });
    const fixtures = Array.isArray(data?.response) ? data.response : Array.isArray(data) ? data : [];
    const map = new Map<number, any>();
    for (const fixture of fixtures) {
      const id = Number(fixture?.fixture?.id);
      if (Number.isFinite(id)) {
        map.set(id, {
          status: rawStatus(fixture),
          minute: providerMinute(fixture),
          homeScore: Number.isFinite(Number(fixture?.goals?.home)) ? Number(fixture.goals.home) : null,
          awayScore: Number.isFinite(Number(fixture?.goals?.away)) ? Number(fixture.goals.away) : null,
        });
      }
    }
    return map;
  } catch (error: any) {
    console.warn('live-card provider status failed:', error?.message || error);
    return new Map<number, any>();
  }
}

function decorateMatch(match: any, now: Date, providerState?: any) {
  const matchDate = new Date(match.matchDate);
  const localMinute = minutesFromKickoff(matchDate, now);
  const dbStatus = String(match.status || '').toUpperCase();
  const providerStatus = String(providerState?.status || '').toUpperCase();
  const effectiveStatus = providerStatus || dbStatus;
  const providerHasState = Boolean(providerStatus);
  const providerHasMinute = providerState?.minute != null;
  const isHalfTimeFromProvider = isHalftimeStatus(effectiveStatus);
  const isLocalHalftimeFallback = !providerHasState && dbStatus === 'SCHEDULED' && localMinute >= 46 && localMinute <= 65;
  const isHalfTime = isHalfTimeFromProvider || isLocalHalftimeFallback;
  const isDbLive = dbStatus === 'IN_PLAY' || dbStatus === 'LIVE' || dbStatus === 'HT';
  const isProviderLive = isProviderLiveStatus(providerStatus);
  const isLikelyLiveByTime = !providerHasState && dbStatus === 'SCHEDULED' && localMinute >= 1 && localMinute <= 135;
  const isLiveNow = isDbLive || isProviderLive || isLikelyLiveByTime;
  const isFinished = dbStatus === 'FINISHED' || ['FT', 'AET', 'PEN', 'FINISHED'].includes(effectiveStatus);
  const localFirstHalfMinute = isLikelyLiveByTime && localMinute <= 45 ? Math.max(1, localMinute) : null;
  const displayMinute = isHalfTime ? null : (providerHasMinute ? providerState.minute : localFirstHalfMinute);
  const fallbackLabel = isLikelyLiveByTime && localMinute > 65 ? 'جارية الآن' : null;

  return {
    ...match,
    status: isHalfTime ? 'HT' : (isProviderLive ? 'IN_PLAY' : match.status),
    homeScore: providerState?.homeScore ?? match.homeScore,
    awayScore: providerState?.awayScore ?? match.awayScore,
    isLiveNow,
    isHalfTime,
    isLikelyLiveByTime,
    displayStatus: isHalfTime ? 'HT' : (isLiveNow ? 'IN_PLAY' : match.status),
    minute: displayMinute,
    liveLabel: isHalfTime ? 'استراحة بين الشوطين' : (isLiveNow ? (displayMinute ? `الدقيقة ${displayMinute}` : (fallbackLabel || 'جارية الآن')) : (isFinished ? 'انتهت المباراة' : null)),
  };
}

function uniqueById(matches: any[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const id = String(match?.id || match?.animationMatchId || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function GET() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const recentSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const [windowMatches, recentlyFinished, providerStates] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
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
    fetchAnimationLiveState(),
  ]);

  const decoratedWindow = windowMatches.map((match) => decorateMatch(match, now, match.animationMatchId ? providerStates.get(Number(match.animationMatchId)) : null));
  const decoratedFinished = recentlyFinished.map((match) => decorateMatch(match, now, match.animationMatchId ? providerStates.get(Number(match.animationMatchId)) : null));

  const live = decoratedWindow.filter((match) => match.isLiveNow);
  const upcoming = decoratedWindow.filter((match) => !match.isLiveNow && match.status === 'SCHEDULED' && new Date(match.matchDate).getTime() > now.getTime());
  const other = decoratedWindow.filter((match) => !live.includes(match) && !upcoming.includes(match));

  const primaryLive = live[0] ? [live[0]] : [];
  const nextAfterLive = upcoming.filter((match) => !primaryLive.some((liveMatch) => liveMatch.id === match.id))[0];
  const fallbackSecond = [...decoratedFinished, ...other].filter((match) => !primaryLive.some((liveMatch) => liveMatch.id === match.id))[0];
  const matches = uniqueById([...primaryLive, ...(nextAfterLive ? [nextAfterLive] : []), ...(primaryLive.length === 0 ? upcoming.slice(0, 2) : []), ...(nextAfterLive ? [] : fallbackSecond ? [fallbackSecond] : [])]).slice(0, 2);

  return NextResponse.json({
    matches,
    meta: {
      liveCount: live.length,
      upcomingCount: upcoming.length,
      recentlyFinishedCount: decoratedFinished.length,
      recentFinishedWindowHours: 6,
      liveDetection: 'animation_provider_status_then_safe_time_window',
      selectionMode: 'one_live_plus_one_next',
      updatedEverySeconds: 15,
    },
    updatedAt: now.toISOString(),
  }, {
    headers: {
      'Cache-Control': 'private, max-age=0, no-cache, must-revalidate',
    },
  });
}
