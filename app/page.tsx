import HomeClientSportsNext from '@/components/HomeClientSportsNext';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];

function normalizeStatus(value?: string | null) {
  return String(value || '').toUpperCase();
}

function isGroupStage(match: any) {
  const value = String(match?.groupPhase || match?.group || match?.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: any) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function minutesFromKickoff(match: any, now: Date) {
  const matchTime = new Date(match?.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now.getTime() - matchTime) / 60_000) + 1;
}

function decorateInitialMatch(match: any, now: Date) {
  const status = normalizeStatus(match?.status);
  if (FINISHED_STATUSES.includes(status)) return match;
  if (!SCHEDULED_STATUSES.includes(status)) return match;

  const minute = minutesFromKickoff(match, now);
  if (minute === null || minute < 1) return match;
  if (minute >= maxLiveMinutes(match)) {
    return {
      ...match,
      status: 'FINISHED',
      displayStatus: 'FINISHED',
      isLiveNow: false,
      isLikelyLiveByTime: false,
      isStaleAutoFinished: true,
    };
  }

  const safeMinute = Math.max(1, Math.min(130, minute));
  return {
    ...match,
    displayStatus: 'IN_PLAY',
    isLiveNow: true,
    isLikelyLiveByTime: true,
    minute: safeMinute,
    liveLabel: `الدقيقة ${safeMinute}`,
  };
}

export default async function Home() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let playersCount = 0;
  let teamsCount = 0;
  let upcomingMatchesCount = 0;
  let upcomingMatches: unknown[] = [];

  try {
    const [totalPlayers, totalTeams, totalUpcomingMatches, upcomingMatchesRaw] = await Promise.all([
      prisma.asset.count({ where: { type: 'PLAYER' } }),
      prisma.asset.count({ where: { type: 'TEAM' } }),
      prisma.match.count({
        where: {
          status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'asc' },
        take: 5,
        include: { homeTeam: true, awayTeam: true },
      }),
    ]);

    playersCount = totalPlayers;
    teamsCount = totalTeams;
    upcomingMatchesCount = totalUpcomingMatches;
    upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw.map((match) => decorateInitialMatch(match, now))));
  } catch {
    upcomingMatches = [];
  }

  return (
    <HomeClientSportsNext
      upcomingMatches={upcomingMatches}
      playersCount={playersCount}
      teamsCount={teamsCount}
      upcomingMatchesCount={upcomingMatchesCount}
    />
  );
}
