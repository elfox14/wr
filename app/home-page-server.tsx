import HomeClientSportsNextWideMap from '@/components/HomeClientSportsNextWideMap';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'HT'];
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

function validMinute(value: unknown) {
  const minute = Number(value);
  if (!Number.isFinite(minute) || minute <= 0) return null;
  return Math.max(1, Math.min(150, Math.floor(minute)));
}

function isGroupStage(match: MatchCandidate) {
  const value = String(match.groupPhase || match.stage || '').toUpperCase();
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

async function findFreshLiveCandidate(candidates: MatchCandidate[], now: Date) {
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
  });

  const latestByMatch = new Map<string, { minute: number; capturedAt: Date }>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    const minute = validMinute(snapshot.minute);
    if (minute !== null) latestByMatch.set(snapshot.matchId, { minute, capturedAt: snapshot.capturedAt });
  }

  return candidates.find((match) => {
    const localMinute = minutesFromKickoff(match, now);
    if (localMinute !== null && localMinute >= maxLiveMinutes(match)) return false;
    if (localMinute !== null && localMinute >= FINAL_LOCAL_MINUTE_FALLBACK) return false;

    const snapshot = latestByMatch.get(match.id);
    if (!snapshot) return true;

    const snapshotAge = now.getTime() - new Date(snapshot.capturedAt).getTime();
    if (snapshot.minute >= FINAL_MINUTE_FLOOR && snapshotAge >= STALE_FINAL_SNAPSHOT_MS) return false;

    return true;
  }) || null;
}

export default async function Home() {
  const now = new Date();
  const tickerStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tickerEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let playersCount = 0;
  let teamsCount = 0;
  let upcomingMatchesCount = 0;
  let upcomingMatches: unknown[] = [];
  let tickerMatches: unknown[] = [];
  let nextMarqueeMatch: any = null;

  try {
    const [
      totalPlayers,
      totalTeams,
      totalUpcomingMatches,
      upcomingMatchesRaw,
      tickerMatchesRaw,
      liveCandidatesRaw,
      nextMatchRaw
    ] = await Promise.all([
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
        take: 5,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          matchDate: { gte: tickerStart, lte: tickerEnd },
        },
        orderBy: { matchDate: 'asc' },
        take: 15,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          status: { in: LIVE_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'desc' },
        take: 4,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findFirst({
        where: {
          status: { in: SCHEDULED_STATUSES },
          matchDate: { gte: now },
        },
        orderBy: { matchDate: 'asc' },
        include: { homeTeam: true, awayTeam: true },
      }),
    ]);

    const freshLiveMatch = await findFreshLiveCandidate(liveCandidatesRaw as MatchCandidate[], now);

    playersCount = totalPlayers;
    teamsCount = totalTeams;
    upcomingMatchesCount = totalUpcomingMatches;
    upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));
    tickerMatches = JSON.parse(JSON.stringify(tickerMatchesRaw));
    nextMarqueeMatch = freshLiveMatch || nextMatchRaw ? JSON.parse(JSON.stringify(freshLiveMatch || nextMatchRaw)) : null;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    upcomingMatches = [];
    tickerMatches = [];
  }

  return (
    <HomeClientSportsNextWideMap
      upcomingMatches={upcomingMatches}
      tickerMatches={tickerMatches}
      nextMarqueeMatch={nextMarqueeMatch}
      playersCount={playersCount}
      teamsCount={teamsCount}
      upcomingMatchesCount={upcomingMatchesCount}
    />
  );
}
