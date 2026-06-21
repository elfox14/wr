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
const SECOND_HALF_STATUSES = ['2H'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'FINISHED', 'FULL_TIME', 'ENDED'];
const FRESH_LIVE_SNAPSHOT_MS = 8 * 60 * 1000;

function normalizeStatus(value?: string | null) {
  return String(value || '').toUpperCase();
}

function rawStatus(value: any) {
  return String(value?.fixture?.status?.short || value?.fixture?.status?.long || value?.providerStatus || value?.status || '').toUpperCase();
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function statusFromISportsState(value: unknown, minute: number | null) {
  const state = String(value ?? '').trim().toUpperCase();
  if (state === '-1' || state === '4' || state === 'FT' || state === 'FINISHED' || state === 'ENDED' || state === 'COMPLETED') return 'FINISHED';
  if (state === '2' || state === 'HT' || state.includes('HALF')) return 'HT';
  if (state === '3' || state === '2H' || state.includes('SECOND')) return '2H';
  if (state === '1' || state === '1H' || state.includes('FIRST')) return '1H';
  if (state === '5' || state === 'P' || state === 'PEN') return 'PEN';
  if (minute !== null && minute >= 120) return 'FINISHED';
  return '';
}

function statusFromSnapshot(snapshotState: any) {
  const rawData = snapshotState?.rawData || {};
  const flashMeta = rawData?.flashMeta || {};
  const minute = nullableNumber(snapshotState?.minute ?? flashMeta?.scheduleMinute);
  return rawStatus(rawData) || statusFromISportsState(flashMeta?.matchState, minute);
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

function hasAnyNumber(...values: unknown[]) {
  return values.some((value) => nullableNumber(value) !== null);
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

function isFreshLiveSnapshot(snapshotState: any, now: Date) {
  const minute = nullableNumber(snapshotState?.minute);
  const age = snapshotAgeMs(snapshotState, now);
  return Boolean(minute !== null && age !== null && age <= FRESH_LIVE_SNAPSHOT_MS);
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

function phaseStatus(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === '2H') return '2H';
  if (normalized === '1H') return '1H';
  if (normalized === 'ET') return 'ET';
  if (normalized === 'P' || normalized === 'PEN') return 'PEN';
  return 'IN_PLAY';
}

async function fetchLatestScoreSnapshots(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  try {
    const rows = await prisma.matchStatsSnapshot.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, provider: true, minute: true, homeScore: true, awayScore: true, capturedAt: true, rawData: true },
      orderBy: { capturedAt: 'desc' },
    });
    const latestByMatch = new Map<string, any>();
    const preferredByMatch = new Map<string, any>();
    for (const row of rows) {
      if (!latestByMatch.has(row.matchId)) latestByMatch.set(row.matchId, row);
      const provider = String(row.provider || '').toUpperCase();
      if (!preferredByMatch.has(row.matchId) && (provider.includes('THE_STATS_API_LIVE') || provider.includes('ISPORTS_FLASH') || row.rawData?.flashMeta?.matchState)) preferredByMatch.set(row.matchId, row);
    }
    for (const [matchId, row] of preferredByMatch) latestByMatch.set(matchId, row);
    return latestByMatch;
  } catch (error: any) {
    if (!String(error?.message || '').includes('MatchStatsSnapshot')) {
      console.warn('live-card score snapshot lookup failed:', error?.message || error);
    }
    return new Map<string, any>();
  }
}

function decorateMatch(match: any, now: Date, providerState?: any, snapshotState?: any) {
  const dbStatus = normalizeStatus(match.status);
  const providerStatus = normalizeStatus(providerState?.status || statusFromSnapshot(snapshotState));
  const effectiveStatus = providerStatus || dbStatus;
  const freshSnapshot = isFreshLiveSnapshot(snapshotState, now);
  const dbLiveStatus = dbStatus === 'IN_PLAY' || dbStatus === 'LIVE' || dbStatus === '1H' || dbStatus === '2H';
  const isFinished = isFinishedStatus(dbStatus) || isFinishedStatus(effectiveStatus);
  const isHalfTime = !isFinished && isHalftimeStatus(effectiveStatus);
  const isProviderLive = !isFinished && isProviderLiveStatus(effectiveStatus);
  const isDbLive = !isFinished && !isHalfTime && dbLiveStatus;
  const isLikelyLiveByFreshSnapshot = !isFinished && !isHalfTime && !providerStatus && isScheduledStatus(dbStatus) && freshSnapshot;
  const isLiveNow = !isFinished && !isHalfTime && (isProviderLive || isDbLive || isLikelyLiveByFreshSnapshot);
  const providerHasScore = hasAnyNumber(providerState?.homeScore, providerState?.awayScore);
  const snapshotHasScore = hasAnyNumber(snapshotState?.homeScore, snapshotState?.awayScore);
  const useSnapshotScore = !providerHasScore && snapshotHasScore && (isLiveNow || isHalfTime || isFinished);
  const scoreSource = providerHasScore ? 'provider' : useSnapshotScore ? 'database_snapshot' : 'database_match';
  const minute = isLiveNow ? liveMinuteForStatus(effectiveStatus, providerState, snapshotState, freshSnapshot) : null;
  const currentLiveStatus = isLiveNow ? phaseStatus(effectiveStatus) : match.status;

  return {
    ...match,
    status: isFinished ? 'FINISHED' : isHalfTime ? 'HT' : currentLiveStatus,
    homeScore: pickLiveScore(providerState?.homeScore, useSnapshotScore ? snapshotState?.homeScore : null, match.homeScore),
    awayScore: pickLiveScore(providerState?.awayScore, useSnapshotScore ? snapshotState?.awayScore : null, match.awayScore),
    scoreSource,
    dataSource: 'database',
    isLiveNow,
    isHalfTime,
    isLikelyLiveByTime: isLikelyLiveByFreshSnapshot,
    isStaleAutoFinished: false,
    displayStatus: isFinished ? 'FINISHED' : isHalfTime ? 'HT' : currentLiveStatus,
    minute,
    snapshotCapturedAt: snapshotState?.capturedAt || null,
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

  const [windowMatches, recentlyFinished] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: { in: ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', 'IN_PLAY', 'LIVE', 'HT', '1H', '2H'] },
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
  ]);

  const scoreSnapshots = await fetchLatestScoreSnapshots([...windowMatches, ...recentlyFinished].map((match) => match.id));
  const decoratedWindow = windowMatches.map((match) => decorateMatch(match, now, null, scoreSnapshots.get(match.id)));
  const decoratedFinished = recentlyFinished.map((match) => decorateMatch(match, now, null, scoreSnapshots.get(match.id)));

  const live = decoratedWindow.filter((match) => match.isLiveNow || match.isHalfTime);
  const waitingForStart = decoratedWindow.filter((match) => !match.isLiveNow && !match.isHalfTime && SCHEDULED_STATUSES.includes(String(match.status || '').toUpperCase()) && new Date(match.matchDate).getTime() <= now.getTime());
  const upcoming = decoratedWindow.filter((match) => !match.isLiveNow && !match.isHalfTime && SCHEDULED_STATUSES.includes(String(match.status || '').toUpperCase()) && new Date(match.matchDate).getTime() > now.getTime());
  const other = decoratedWindow.filter((match) => !live.includes(match) && !waitingForStart.includes(match) && !upcoming.includes(match));

  const primary = live[0] || waitingForStart[0] || upcoming[0] || decoratedFinished[0] || other[0];
  const nextTwo = upcoming.filter((match) => !primary || match.id !== primary.id).slice(0, 2);
  const filler = [...decoratedFinished, ...other].filter((match) => !primary || match.id !== primary.id).filter((match) => !nextTwo.some((next) => next.id === match.id));
  const matches = uniqueById([...(primary ? [primary] : []), ...nextTwo, ...filler]).slice(0, 3);

  return NextResponse.json({ ok: true, dataSource: 'database', updatedAt: now.toISOString(), matches }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
