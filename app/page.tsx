import HomeClientSportsNext from '@/components/HomeClientSportsNext';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));
  } catch {
    upcomingMatches = [];
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'World Cup Exchange | MC PRIME',
    url: baseUrl,
    description: 'Live World Cup matches, verified news, football analysis, and a virtual fan exchange layer.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <HomeClientSportsNext
        upcomingMatches={upcomingMatches}
        playersCount={playersCount}
        teamsCount={teamsCount}
        upcomingMatchesCount={upcomingMatchesCount}
      />
    </>
  );
}
