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

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY'];
const SECOND_HALF_STATUSES = ['2H'];
const FIRST_HALF_STATUSES = ['1H'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'FINISHED', 'FULL_TIME', 'ENDED'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const FRESH_LIVE_SNAPSHOT_MS = 4 * 60 * 1000;
const STALE_FINAL_SNAPSHOT_MS = 7 * 60 * 1000;
const FINAL_MINUTE_FLOOR = 85;
const FINAL_LOCAL_MINUTE_FALLBACK = 100;

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value?: string | null) {
  return String(value || '').toUpperCase();
}

function minutesFromKickoff(matchDate: Date, now: Date) {
  const time = new Date(matchDate).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.floor((now.getTime() - time) / 60_000) + 1;
}

function rawStatus(value: any) {
  return String(value?.fixture?.status?.short || value?.fixture?.status?.long || value?.providerStatus || value?.status || '').toUpperCase();
}

function isHalftimeStatus(status: string) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(status));
}

function isProviderLiveStatus(status: string) {
  return LIVE_STATUSES.includes(normalizeStatus(status));
}

function isScheduledStatus(status: string) {
  return SCHEDULED_STATUSES.includes(normalizeStatus(status));
}

function isFinishedStatus(status: string) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

function isSecondHalfStatus(status: string) {
  return SECOND_HALF_STATUSES.includes(normalizeStatus(status));
}

function isFirstHalfStatus(status: string) {
  return FIRST_HALF_STATUSES.includes(normalizeStatus(status));
}

function isGroupStage(match: any) {
  const value = String(match.groupPhase || match.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: any) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
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

function isFreshLiveSnapshot(snapshotState: any, now: Date) {
  const minute = nullableNumber(snapshotState?.minute);
  const age = snapshotAgeMs(snapshotState, now);
  return Boolean(minute !== null && age !== null && age <= FRESH_LIVE_SNAPSHOT_MS && !isFinalSnapshotStale(snapshotState, now));
}

function liveMinuteForStatus(status: string, providerState: any, snapshotState: any, freshSnapshot: boolean) {
  const normalized = normalizeStatus(status);
  const provider = nullableNumber(providerState?.minute);
  const snapshot = freshSnapshot ? nullableNumber(snapshotState?.minute) : null;
  const rawMinute = provider ?? snapshot;
  if (isHalftimeStatus(normalized) || isFinishedStatus(normalized)) return null;
  if (isSecondHalfStatus(normalized)) return rawMinute === null || rawMinute < 45 ? 45 : rawMinute;
  return rawMinute;
}

function liveMinuteLabel(minute: number | null, status: string) {
  if (minute === null) return null;
  const normalized = normalizeStatus(status);
  if (isFirstHalfStatus(normalized) && minute > 45 && minute < 60) return `45+${minute - 45}`;
  if (isSecondHalfStatus(normalized) && minute < 45) return '45';
  if (minute > 90 && minute < 120) return `90+${minute - 90}`;
  return String(minute);
}

async function fetchLatestScoreSnapshots(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  try {
    const rows = await prisma.matchStatsSnapshot.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, minute: true, homeScore: true, awayScore: true, capturedAt: true, rawData: true },
      orderBy: { capturedAt: 'desc' },
    });
    const latestByMatch = new Map<string, any>();
    for (const row of rows) {
      if (!latestByMatch.has(row.matchId)) latestByMatch.set(row.matchId, row);
    }
    return latestByMatch;
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
  const dbStatus = normalizeStatus(match.status);
  const providerStatus = normalizeStatus(providerState?.status || rawStatus(snapshotState?.rawData));
  const effectiveStatus = providerStatus || dbStatus;
  const providerHasState = Boolean(providerStatus);
  const freshSnapshot = isFreshLiveSnapshot(snapshotState, now);
  const dbLiveStatus = dbStatus === 'IN_PLAY' || dbStatus === 'LIVE';
  const canAutoFinishByElapsedTime = providerHasState || dbLiveStatus || freshSnapshot;
  const staleByTime = canAutoFinishByElapsedTime && localMinute >= maxLiveMinutes(match);
  const staleFinalSnapshot = !providerHasState && isFinalSnapshotStale(snapshotState, now);
  const noProviderFinalFallback = !providerHasState && dbLiveStatus && localMinute >= FINAL_LOCAL_MINUTE_FALLBACK;
  const isFinished = staleByTime || staleFinalSnapshot || noProviderFinalFallback || isFinishedStatus(dbStatus) || isFinishedStatus(effectiveStatus);
  const isHalfTime = !isFinished && isHalftimeStatus(effectiveStatus);
  const isProviderLive = !isFinished && isProviderLiveStatus(providerStatus);
  const isDbLive = !isFinished && !isHalfTime && dbLiveStatus && (providerHasState || freshSnapshot || localMinute < FINAL_LOCAL_MINUTE_FALLBACK);
  const isLikelyLiveByFreshSnapshot = !isFinished && !isHalfTime && !providerHasState && isScheduledStatus(dbStatus) && freshSnapshot && localMinute >= 1 && localMinute < maxLiveMinutes(match);
  const isLiveNow = !isFinished && !isHalfTime && (isDbLive || isProviderLive || isLikelyLiveByFreshSnapshot);
  const providerHasScore = hasAnyNumber(providerState?.homeScore, providerState?.awayScore);
  const snapshotHasScore = hasAnyNumber(snapshotState?.homeScore, snapshotState?.awayScore);
  const useSnapshotScore = !providerHasScore && snapshotHasScore && (isLiveNow || isHalfTime || isFinished);
  const scoreSource = providerHasScore ? 'provider' : useSnapshotScore ? 'snapshot' : 'match';
  const minute = isLiveNow ? liveMinuteForStatus(effectiveStatus, providerState, snapshotState, freshSnapshot) : null;
  const minuteLabel = liveMinuteLabel(minute, effectiveStatus);

  return {
    ...match,
    status: isFinished ? 'FINISHED' : isHalfTime ? 'HT' : (isLiveNow ? (isSecondHalfStatus(effectiveStatus) ? '2H' : 'IN_PLAY') : match.status),
    homeScore: pickLiveScore(providerState?.homeScore, useSnapshotScore ? snapshotState?.homeScore : null, match.homeScore),
    awayScore: pickLiveScore(providerState?.awayScore, useSnapshotScore ? snapshotState?.awayScore : null, match.awayScore),
    scoreSource,
    isLiveNow,
    isHalfTime,
    isLikelyLiveByTime: isLikelyLiveByFreshSnapshot,
    isStaleAutoFinished: isFinished && (staleByTime || staleFinalSnapshot || noProviderFinalFallback),
    displayStatus: isFinished ? 'FINISHED' : isHalfTime ? 'HT' : (isLiveNow ? (isSecondHalfStatus(effectiveStatus) ? '2H' : 'IN_PLAY') : match.status),
    minute,
    liveLabel: isFinished ? 'انتهت' : isHalfTime ? 'استراحة' : (isLiveNow ? (minuteLabel ? `الدقيقة ${minuteLabel}` : 'جارية الآن') : null),
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
        status: { in: ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', 'IN_PLAY', 'LIVE', 'HT'] },
        matchDate: { gte: liveWindowStart, lte: upcomingUntil },
      },
      orderBy: { matchDate: 'asc' },
      take: 20,
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

  const live = decoratedWindow.filter((match) => match.isLiveNow || match.isHalfTime);
  const waitingForStart = decoratedWindow.filter((match) => !match.isLiveNow && !match.isHalfTime && SCHEDULED_STATUSES.includes(String(match.status || '').toUpperCase()) && new Date(match.matchDate).getTime() <= now.getTime());
  const upcoming = decoratedWindow.filter((match) => !match.isLiveNow && !match.isHalfTime && SCHEDULED_STATUSES.includes(String(match.status || '').toUpperCase()) && new Date(match.matchDate).getTime() > now.getTime());
  const other = decoratedWindow.filter((match) => !live.includes(match) && !waitingForStart.includes(match) && !upcoming.includes(match));

  const primary = live[0] || waitingForStart[0] || upcoming[0] || decoratedFinished[0] || other[0];
  const nextTwo = upcoming.filter((match) => !primary || match.id !== primary.id).slice(0, 2);
  const filler = [...decoratedFinished, ...other].filter((match) => !primary || match.id !== primary.id).filter((match) => !nextTwo.some((next) => next.id === match.id));
  const matches = uniqueById([...(primary ? [primary] : []), ...nextTwo, ...filler]).slice(0, 3);

  return NextResponse.json({ ok: true, updatedAt: now.toISOString(), matches }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
