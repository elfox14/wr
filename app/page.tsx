import HomeClientSportsNext from '@/components/HomeClientSportsNext';
import { getAssets } from '@/lib/store-server';
import { getAllArticles } from '@/lib/articles';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let assets: Awaited<ReturnType<typeof getAssets>> = [];
  let assetsCount = 0;
  let playersCount = 0;
  let teamsCount = 0;
  let upcomingMatchesCount = 0;
  let upcomingMatches: unknown[] = [];

  try {
    assets = await getAssets();
  } catch {
    assets = [];
  }

  const academyArticles = (() => {
    try {
      return getAllArticles().slice(0, 4).map((article) => ({
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        category: article.category,
        readingTime: article.readingTime,
        level: article.level,
        imageUrl: article.imageUrl,
        date: article.date,
      }));
    } catch {
      return [];
    }
  })();

  try {
    const [totalAssets, totalPlayers, totalTeams, totalUpcomingMatches, upcomingMatchesRaw] = await Promise.all([
      prisma.asset.count(),
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

    assetsCount = totalAssets;
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
        initialAssets={assets}
        upcomingMatches={upcomingMatches}
        assetsCount={assetsCount}
        playersCount={playersCount}
        teamsCount={teamsCount}
        upcomingMatchesCount={upcomingMatchesCount}
        academyArticles={academyArticles}
      />
    </>
  );
}
