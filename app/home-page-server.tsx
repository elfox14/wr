import { unstable_cache } from 'next/cache';
import HomeClientSportsLiveFocus from '@/components/HomeClientSportsLiveFocus';
import prisma from '@/lib/prisma';

export const revalidate = 60;

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'HT'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const ACTIVE_HOME_STATUSES = [...SCHEDULED_STATUSES, ...LIVE_STATUSES];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const STALE_FINAL_SNAPSHOT_MS = 7 * 60 * 1000;
const FINAL_MINUTE_FLOOR = 85;
const FINAL_LOCAL_MINUTE_FALLBACK = 100;

type MatchCandidate = {
  id: string;
  matchDate: Date;
  status?: string | null;
  groupPhase?: string | null;
  stage?: string | null;
};

const teamSelect = {
  id: true,
  name: true,
  code: true,
  image: true,
  group: true,
} as const;

function validMinute(value: unknown) {
  const minute = Number(value);
  if (!Number.isFinite(minute) || minute <= 0) return null;
  return Math.max(1, Math.min(150, Math.floor(minute)));
}

function normalizeStatus(value?: string | null) {
  return String(value || []).toUpperCase();
}

function isHalfTimeStatus(value?: string | null) {
  return ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'].includes(normalizeStatus(value));
}

function isSecondHalfStatus(value?: string | null) {
  const status = normalizeStatus(value);
  return status === '2H' || status === 'ET';
}

function isGroupStage(match: MatchCandidate) {
  const value = String(match.groupPhase || match.stage || []).toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: MatchCandidate) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function minutesFromKickoff(match: MatchCandidate, now: Date) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now.getTime() - matchTime) / 60_000) + 1;
}

function decorateLiveCandidateWithSnapshot<T extends MatchCandidate>(match: T, snapshot?: { minute: number; capturedAt: Date }) {
  const status = normalizeStatus(match.status);

  if (isHalfTimeStatus(status)) {
    return {
      ...match,
      status: 'HT',
      displayStatus: 'HT',
      isLiveNow: false,
      isHalfTime: true,
      isLikelyLiveByTime: false,
      minute: null,
      liveLabel: 'استراحة',
    };
  }

  const snapshotMinute = validMinute(snapshot?.minute);
  const minute = isSecondHalfStatus(status)
    ? snapshotMinute && snapshotMinute >= 46 ? snapshotMinute : 46
    : snapshotMinute;

  return {
    ...match,
    status: isSecondHalfStatus(status) ? '2H' : 'IN_PLAY',
    displayStatus: isSecondHalfStatus(status) ? '2H' : 'IN_PLAY',
    isLiveNow: true,
    isHalfTime: false,
    isLikelyLiveByTime: false,
    minute,
    liveLabel: minute ? `الدقيقة ${minute}` : 'جارية الآن',
  };
}

async function findFreshLiveCandidate<T extends MatchCandidate>(candidates: T[], now: Date) {
  if (!candidates.length) return null;

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      matchId: { in: candidates.map((match) => match.id) },
      minute: { not: null },
    },
    select: {
      matchId: true,
      minute: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: 'desc' },
    take: Math.max(12, candidates.length * 3),
  });

  const latestByMatch = new Map<string, { minute: number; capturedAt: Date }>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    const minute = validMinute(snapshot.minute);
    if (minute !== null) latestByMatch.set(snapshot.matchId, { minute, capturedAt: snapshot.capturedAt });
  }

  const candidate = candidates.find((match) => {
    if (isHalfTimeStatus(match.status)) return true;
    const localMinute = minutesFromKickoff(match, now);
    if (localMinute !== null && localMinute >= maxLiveMinutes(match)) return false;
    if (localMinute !== null && localMinute >= FINAL_LOCAL_MINUTE_FALLBACK) return false;
    const snapshot = latestByMatch.get(match.id);
    if (!snapshot) return true;
    const snapshotAge = now.getTime() - new Date(snapshot.capturedAt).getTime();
    if (snapshot.minute >= FINAL_MINUTE_FLOOR && snapshotAge >= STALE_FINAL_SNAPSHOT_MS) return false;
    return true;
  });

  return candidate ? decorateLiveCandidateWithSnapshot(candidate, latestByMatch.get(candidate.id)) : null;
}

const getHomeData = unstable_cache(
  async () => {
    const now = new Date();
    const tickerStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const tickerEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);
    const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [totalPlayers, totalTeams, totalUpcomingMatches, upcomingMatchesRaw, tickerMatchesRaw, liveCandidatesRaw, nextMatchRaw] = await Promise.all([
      prisma.asset.count({ where: { type: 'PLAYER' } }),
      prisma.asset.count({ where: { type: 'TEAM' } }),
      prisma.match.count({
        where: {
          status: { in: ACTIVE_HOME_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { in: ACTIVE_HOME_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'asc' },
        take: 4,
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      prisma.match.findMany({
        where: { matchDate: { gte: tickerStart, lte: tickerEnd } },
        orderBy: { matchDate: 'asc' },
        take: 8,
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { in: LIVE_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'desc' },
        take: 3,
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      prisma.match.findFirst({
        where: {
          status: { in: SCHEDULED_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'asc' },
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
    ]);

    const freshLiveMatch = await findFreshLiveCandidate(liveCandidatesRaw, now);
    return {
      playersCount: totalPlayers,
      teamsCount: totalTeams,
      upcomingMatchesCount: totalUpcomingMatches,
      upcomingMatches: JSON.parse(JSON.stringify(upcomingMatchesRaw)),
      tickerMatches: JSON.parse(JSON.stringify(tickerMatchesRaw)),
      nextMarqueeMatch: freshLiveMatch || nextMatchRaw ? JSON.parse(JSON.stringify(freshLiveMatch || nextMatchRaw)) : null,
    };
  },
  ['home-dashboard-v4'],
  { revalidate: 60 },
);

export default async function Home() {
  let data = {
    playersCount: 0,
    teamsCount: 0,
    upcomingMatchesCount: 0,
    upcomingMatches: [] as unknown[],
    tickerMatches: [] as unknown[],
    nextMarqueeMatch: null as any,
  };

  try {
    data = await getHomeData();
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }

  return (
    <HomeClientSportsLiveFocus
      upcomingMatches={data.upcomingMatches}
      tickerMatches={data.tickerMatches}
      nextMarqueeMatch={data.nextMarqueeMatch}
      playersCount={data.playersCount}
      teamsCount={data.teamsCount}
      upcomingMatchesCount={data.upcomingMatchesCount}
    />
  );
}
