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

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY', 'HT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'FINISHED'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const STALE_FINAL_SNAPSHOT_MS = 7 * 60 * 1000;
const FINAL_MINUTE_FLOOR = 85;
const FINAL_LOCAL_MINUTE_FALLBACK = 100;

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
  return LIVE_STATUSES.includes(status) || isHalftimeStatus(status);
}

function isFinishedStatus(status: string) {
  return FINISHED_STATUSES.includes(status);
}

function isGroupStage(match: any) {
  const value = String(match.groupPhase || match.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: any) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function isStaleByTime(match: any, localMinute: number) {
  return localMinute >= maxLiveMinutes(match);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasAnyNumber(...values: unknown[]) {
  return values.some((value) => nullableNumber(value) !== null);
}

function providerMinute(value: any) {
  const raw = value?.fixture?.status?.elapsed ?? value?.fixture?.status?.minute ?? value?.minute ?? value?.elapsed;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(1, Math.min(150, Math.round(n))) : null;
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pickLiveScore(providerValue: unknown, snapshotValue: unknown, matchValue: unknown) {
  const provider = nullableNumber(providerValue);
  if (provider !== null) return provider;
  const snapshot = nullableNumber(snapshotValue);
  if (snapshot !== null) return snapshot;
  return nullableNumber(matchValue) ?? 0;
}

function snapshotAgeMs(snapshotState: any, now: Date) {
  const capturedAt = snapshotState?.capturedAt ? new Date(snapshotState.capturedAt) : null;
  if (!capturedAt || !Number.isFinite(capturedAt.getTime())) return null;
  return now.getTime() - capturedAt.getTime();
}

function isFinalSnapshotStale(snapshotState: any, now: Date) {
  const minute = nullableNumber(snapshotState?.minute);
  const age = snapshotAgeMs(snapshotState, now);
  return Boolean(minute !== null && minute >= FINAL_MINUTE_FLOOR && age !== null && age >= STALE_FINAL_SNAPSHOT_MS);
}

async function fetchLatestScoreSnapshots(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  try {
    const idList = matchIds.map(quoteSql).join(',');
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON ("matchId")
        "matchId", "minute", "homeScore", "awayScore", "capturedAt"
      FROM "MatchStatsSnapshot"
      WHERE "matchId" IN (${idList})
      ORDER BY "matchId", "capturedAt" DESC
    `);
    return new Map(rows.map((row) => [row.matchId, row]));
  } catch (error: any) {
    if (!String(error?.message || '').includes('MatchStatsSnapshot')) {
      console.warn('live-card score snapshot lookup failed:', error?.message || error);
    }
    return new Map<string, any>();
  }
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
          homeScore: nullableNumber(fixture?.goals?.home ?? fixture?.score?.fulltime?.home ?? fixture?.score?.halftime?.home),
          awayScore: nullableNumber(fixture?.goals?.away ?? fixture?.score?.fulltime?.away ?? fixture?.score?.halftime?.away),
        });
      }
    }
    return map;
  } catch (error: any) {
    console.warn('live-card provider status failed:', error?.message || error);
    return new Map<number, any>();
  }
}

function decorateMatch(match: any, now: Date, providerState?: any, snapshotState?: any) {
  const matchDate = new Date(match.matchDate);
  const localMinute = minutesFromKickoff(matchDate, now);
  const dbStatus = String(match.status || '').toUpperCase();
  const providerStatus = String(providerState?.status || '').toUpperCase();
  const effectiveStatus = providerStatus || dbStatus;
  const providerHasState = Boolean(providerStatus);
  const providerHasMinute = providerState?.minute != null;
  const snapshotMinute = nullableNumber(snapshotState?.minute);
  const staleByTime = isStaleByTime(match, localMinute);
  const staleFinalSnapshot = !providerHasState && isFinalSnapshotStale(snapshotState, now);
  const noProviderFinalFallback = !providerHasState && (dbStatus === 'IN_PLAY' || dbStatus === 'LIVE') && localMinute >= FINAL_LOCAL_MINUTE_FALLBACK;
  const isFinished = staleByTime || staleFinalSnapshot || noProviderFinalFallback || isFinishedStatus(dbStatus) || isFinishedStatus(effectiveStatus);
  const isHalfTimeFromProvider = !isFinished && isHalftimeStatus(effectiveStatus);
  const isLocalHalftimeFallback = !isFinished && !providerHasState && dbStatus === 'SCHEDULED' && localMinute >= 46 && localMinute <= 65;
  const isHalfTime = isHalfTimeFromProvider || isLocalHalftimeFallback;
  const isDbLive = !isFinished && (dbStatus === 'IN_PLAY' || dbStatus === 'LIVE' || dbStatus === 'HT');
  const isProviderLive = !isFinished && isProviderLiveStatus(providerStatus);
  const isLikelyLiveByTime = !isFinished && !providerHasState && dbStatus === 'SCHEDULED' && localMinute >= 1 && localMinute < maxLiveMinutes(match);
  const isLiveNow = !isFinished && (isDbLive || isProviderLive || isLikelyLiveByTime);
  const localSafeMinute = isLiveNow && localMinute >= 1 && localMinute < maxLiveMinutes(match) ? Math.max(1, Math.min(150, localMinute)) : null;
  const displayMinute = isHalfTime ? null : (providerHasMinute && !staleByTime ? providerState.minute : (snapshotMinute ?? localSafeMinute));
  const fallbackLabel = isLiveNow && localSafeMinute && localSafeMinute > 65 ? 'الشوط الثاني جارٍ' : null;
  const providerHasScore = hasAnyNumber(providerState?.homeScore, providerState?.awayScore);
  const snapshotHasScore = hasAnyNumber(snapshotState?.homeScore, snapshotState?.awayScore);
  const useSnapshotScore = !providerHasScore && snapshotHasScore && (isLiveNow || isFinished);
  const scoreSource = providerHasScore ? 'provider' : useSnapshotScore ? 'snapshot' : 'match';

  return {
    ...match,
    status: isFinished ? 'FINISHED' : isHalfTime ? 'HT' : (isProviderLive ? 'IN_PLAY' : match.status),
    homeScore: pickLiveScore(providerState?.homeScore, useSnapshotScore ? snapshotState?.homeScore : null, match.homeScore),
    awayScore: pickLiveScore(providerState?.awayScore, useSnapshotScore ? snapshotState?.awayScore : null, match.awayScore),
    scoreSource,
    isLiveNow,
    isHalfTime,
    isLikelyLiveByTime,
    isStaleAutoFinished: isFinished && (staleByTime || staleFinalSnapshot || noProviderFinalFallback),
    displayStatus: isFinished ? 'FINISHED' : isHalfTime ? 'HT' : (isLiveNow ? 'IN_PLAY' : match.status),
    minute: isFinished ? null : displayMinute,
    liveLabel: isFinished ? 'انتهت المباراة' : isHalfTime ? 'استراحة بين الشوطين' : (isLiveNow ? (displayMinute ? `الدقيقة ${displayMinute}` : (fallbackLabel || 'جارية الآن')) : null),
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
      where: { status: { in: ['FINISHED', 'FT', 'AET', 'PEN'] }, matchDate: { gte: recentSince, lte: now } },
      orderBy: { matchDate: 'desc' },
      take: 4,
      select: MATCH_SELECT,
    }),
    fetchAnimationLiveState(),
  ]);

  const scoreSnapshots = await fetchLatestScoreSnapshots([...windowMatches, ...recentlyFinished].map((match) => match.id));

  const decoratedWindow = windowMatches.map((match) => decorateMatch(match, now, match.animationMatchId ? providerStates.get(Number(match.animationMatchId)) : null, scoreSnapshots.get(match.id)));
  const decoratedFinished = recentlyFinished.map((match) => decorateMatch(match, now, match.animationMatchId ? providerStates.get(Number(match.animationMatchId)) : null, scoreSnapshots.get(match.id)));

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
      liveDetection: 'provider_or_fresh_snapshot_then_safe_time_window',
      groupStageMaxLiveMinutes: GROUP_STAGE_MAX_LIVE_MINUTES,
      knockoutMaxLiveMinutes: KNOCKOUT_MAX_LIVE_MINUTES,
      staleFinalSnapshotMinutes: STALE_FINAL_SNAPSHOT_MS / 60_000,
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
