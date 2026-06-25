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

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'FINISHED', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];
const CACHE_TTL_MS = 10_000;

type CacheEntry = { createdAt: number; payload: any };
let liveCardCache: CacheEntry | null = null;

function normalizeStatus(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isFinishedStatus(status?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

function isHalfTimeStatus(status?: string | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(status));
}

function isLiveStatus(status?: string | null) {
  return LIVE_STATUSES.includes(normalizeStatus(status));
}

function isScheduledStatus(status?: string | null) {
  return SCHEDULED_STATUSES.includes(normalizeStatus(status));
}

function snapshotProviderStatus(rawData: unknown) {
  const raw = rawData as any;
  return raw?.providerStatus || raw?.status || raw?.fixture?.status?.short || raw?.fixture?.status?.long || raw?.flashMeta?.matchState || null;
}

async function latestScoreSnapshots(matchIds: string[]) {
  const ids = Array.from(new Set(matchIds.filter(Boolean)));
  if (!ids.length) return new Map<string, any>();

  try {
    const snapshots = await prisma.matchStatsSnapshot.findMany({
      where: { matchId: { in: ids } },
      orderBy: { capturedAt: 'desc' },
      take: Math.max(40, ids.length * 4),
      select: {
        matchId: true,
        provider: true,
        minute: true,
        homeScore: true,
        awayScore: true,
        capturedAt: true,
        rawData: true,
      },
    });

    const latest = new Map<string, any>();
    for (const snapshot of snapshots) {
      if (!latest.has(snapshot.matchId)) latest.set(snapshot.matchId, snapshot);
    }
    return latest;
  } catch (error: any) {
    if (!String(error?.message || '').includes('MatchStatsSnapshot')) {
      console.warn('live-card score snapshot lookup failed:', error?.message || error);
    }
    return new Map<string, any>();
  }
}

function pickScore(snapshotValue: unknown, matchValue: unknown) {
  return nullableNumber(snapshotValue) ?? nullableNumber(matchValue) ?? 0;
}

function decorateMatch(match: any, snapshot?: any) {
  const dbStatus = normalizeStatus(match.status);
  const providerStatus = normalizeStatus(snapshotProviderStatus(snapshot?.rawData));
  const effectiveStatus = providerStatus || dbStatus;
  const finished = isFinishedStatus(dbStatus) || isFinishedStatus(effectiveStatus);
  const halfTime = !finished && isHalfTimeStatus(effectiveStatus);
  const live = !finished && !halfTime && (isLiveStatus(dbStatus) || isLiveStatus(effectiveStatus));
  const useSnapshotScore = Boolean(snapshot && (finished || live || halfTime));
  const displayStatus = finished ? 'FINISHED' : halfTime ? 'HT' : live ? (effectiveStatus || 'LIVE') : match.status;

  return {
    ...match,
    status: displayStatus,
    displayStatus,
    homeScore: pickScore(useSnapshotScore ? snapshot?.homeScore : null, match.homeScore),
    awayScore: pickScore(useSnapshotScore ? snapshot?.awayScore : null, match.awayScore),
    scoreSource: useSnapshotScore ? 'database_snapshot' : 'database_match',
    dataSource: 'database',
    isLiveNow: live,
    isHalfTime: halfTime,
    isLikelyLiveByTime: false,
    isStaleAutoFinished: false,
    minute: live ? nullableNumber(snapshot?.minute) : null,
    snapshotCapturedAt: snapshot?.capturedAt || null,
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

function json(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function GET() {
  try {
    const cacheNow = Date.now();
    if (liveCardCache && cacheNow - liveCardCache.createdAt < CACHE_TTL_MS) {
      return json({ ...liveCardCache.payload, fromCache: true });
    }

    const now = new Date();
    const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const recentSince = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const [windowMatches, recentlyFinished] = await Promise.all([
      prisma.match.findMany({
        where: {
          status: { in: [...SCHEDULED_STATUSES, ...LIVE_STATUSES, ...HALF_TIME_STATUSES] },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'asc' },
        take: 20,
        select: MATCH_SELECT,
      }),
      prisma.match.findMany({
        where: { status: { in: FINISHED_STATUSES }, matchDate: { gte: recentSince, lte: now } },
        orderBy: { matchDate: 'desc' },
        take: 6,
        select: MATCH_SELECT,
      }),
    ]);

    const scoreSnapshots = await latestScoreSnapshots([...windowMatches, ...recentlyFinished].map((match) => match.id));
    const decoratedWindow = windowMatches.map((match) => decorateMatch(match, scoreSnapshots.get(match.id)));
    const decoratedFinished = recentlyFinished.map((match) => decorateMatch(match, scoreSnapshots.get(match.id)));

    const live = decoratedWindow.filter((match) => match.isLiveNow || match.isHalfTime);
    const waitingForStart = decoratedWindow.filter((match) => !match.isLiveNow && !match.isHalfTime && isScheduledStatus(match.status) && new Date(match.matchDate).getTime() <= now.getTime());
    const upcoming = decoratedWindow.filter((match) => !match.isLiveNow && !match.isHalfTime && isScheduledStatus(match.status) && new Date(match.matchDate).getTime() > now.getTime());
    const other = decoratedWindow.filter((match) => !live.includes(match) && !waitingForStart.includes(match) && !upcoming.includes(match));

    const primary = live[0] || waitingForStart[0] || decoratedFinished[0] || upcoming[0] || other[0];
    const nextTwo = upcoming.filter((match) => !primary || match.id !== primary.id).slice(0, 2);
    const filler = [...decoratedFinished, ...other].filter((match) => !primary || match.id !== primary.id).filter((match) => !nextTwo.some((next) => next.id === match.id));
    const matches = uniqueById([...(primary ? [primary] : []), ...nextTwo, ...filler]).slice(0, 3);

    const payload = { ok: true, dataSource: 'database', updatedAt: now.toISOString(), matches };
    liveCardCache = { createdAt: cacheNow, payload };
    return json(payload);
  } catch (error: any) {
    console.error('Error in live-card GET api:', error);
    return json({ ok: false, error: error?.message || 'Internal Server Error', matches: [] }, 500);
  }
}
