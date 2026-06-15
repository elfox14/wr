import HomeClientSportsNextFixed from '@/components/HomeClientSportsNextFixed';
import { getAssets } from '@/lib/store-server';
import { getAllArticles } from '@/lib/articles';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
    where: {
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
      matchDate: { gte: liveWindowStart, lte: upcomingUntil },
    },
  });

  const upcomingMatchesRaw = await prisma.match.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
      matchDate: { gte: liveWindowStart, lte: upcomingUntil },
    },
    orderBy: { matchDate: 'asc' },
    take: 5,
    include: { homeTeam: true, awayTeam: true },
  });
  const upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'World Cup Exchange | MC PRIME',
    url: baseUrl,
    description: 'Live World Cup matches, verified news, football analysis, and a virtual fan exchange layer.',
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

      <style
        dangerouslySetInnerHTML={{
          __html: `
            main > section:nth-of-type(3) > div.relative.grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }

            main > section:nth-of-type(3) > div.relative.grid > div:nth-child(2) {
              display: none !important;
            }

            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/players"] {
              display: none !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) .inline-flex.items-center.gap-2.rounded-full {
              font-size: 0 !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) .inline-flex.items-center.gap-2.rounded-full::after {
              content: 'STATISTICS CENTER';
              font-size: 10px !important;
              letter-spacing: 0.16em;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) h1 {
              font-size: 0 !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) h1::after {
              content: 'الإحصائيات';
              font-size: clamp(1.6rem, 4vw, 2.8rem) !important;
              line-height: 1.15;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) p:first-of-type {
              font-size: 0 !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) p:first-of-type::after {
              content: 'ملخص رقمي مباشر للبطولة: إجمالي المباريات، المنتخبات، الدول المستضيفة، وأقرب مباريات مركز المباريات في بطاقة واحدة بدل الهيرو.';
              font-size: 0.875rem !important;
              line-height: 1.9;
            }
          `,
        }}
      />

      <HomeClientSportsNextFixed {...homeClientProps} />
    </>
  );
}
