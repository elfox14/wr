import HomeClientSportsNextWideMap from '@/components/HomeClientSportsNextWideMap';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      nextMatchRaw
    ] = await Promise.all([
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
      prisma.match.findMany({
        where: {
          matchDate: { gte: tickerStart, lte: tickerEnd },
        },
        orderBy: { matchDate: 'asc' },
        take: 15,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findFirst({
        where: {
          status: { in: ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'] },
          matchDate: { gte: now },
        },
        orderBy: { matchDate: 'asc' },
        include: { homeTeam: true, awayTeam: true },
      }),
    ]);

    playersCount = totalPlayers;
    teamsCount = totalTeams;
    upcomingMatchesCount = totalUpcomingMatches;
    upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));
    tickerMatches = JSON.parse(JSON.stringify(tickerMatchesRaw));
    nextMarqueeMatch = nextMatchRaw ? JSON.parse(JSON.stringify(nextMatchRaw)) : null;
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
