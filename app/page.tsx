import HomeClient from '@/components/HomeClient';
import { getAssets } from '@/lib/store-server';
import { getAllArticles } from '@/lib/articles';
import prisma from '@/lib/prisma';

export default async function Home() {
  const assets = await getAssets();
  const academyArticles = getAllArticles().slice(0, 4).map((article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    readingTime: article.readingTime,
    level: article.level,
    imageUrl: article.imageUrl,
    date: article.date,
  }));

  const assetsCount = await prisma.asset.count();
  const playersCount = await prisma.asset.count({ where: { type: 'PLAYER' } });
  const teamsCount = await prisma.asset.count({ where: { type: 'TEAM' } });
  const upcomingMatchesCount = await prisma.match.count({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
  });

  const upcomingMatchesRaw = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 5,
    include: { homeTeam: true, awayTeam: true },
  });
  const upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'بورصة المونديال | MC PRIME',
    url: baseUrl,
    description: 'كل ما يحدث في كأس العالم: متابعة مباشرة، أخبار موثقة، تحليل كروي، وبورصة افتراضية للتفاعل الجماهيري.',
  };

  const homeClientProps = {
    initialAssets: assets,
    upcomingMatches,
    assetsCount,
    playersCount,
    teamsCount,
    upcomingMatchesCount,
    academyArticles,
  } as any;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <HomeClient {...homeClientProps} />
    </>
  );
}
