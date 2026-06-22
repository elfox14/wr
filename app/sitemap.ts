import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export const revalidate = 3600;

function logSitemapDataError(scope: string, error: unknown) {
  if (process.env.SITEMAP_DEBUG !== 'true') return;
  console.warn(`Sitemap ${scope} URLs skipped because database data is unavailable.`, error);
}

function shouldIncludeDynamicSitemapUrls() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.SITEMAP_INCLUDE_DYNAMIC || '').toLowerCase());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const staticPages = [
    { route: '', freq: 'always', prio: 1 },
    { route: '/news', freq: 'hourly', prio: 0.85 },
    { route: '/matches', freq: 'hourly', prio: 0.95 },
    { route: '/animation-live', freq: 'hourly', prio: 0.8 },
    { route: '/teams', freq: 'daily', prio: 0.75 },
    { route: '/players', freq: 'daily', prio: 0.7 },
    { route: '/groups', freq: 'always', prio: 0.85 },
    { route: '/about', freq: 'monthly', prio: 0.6 },
    { route: '/privacy', freq: 'monthly', prio: 0.6 },
    { route: '/privacy-policy', freq: 'monthly', prio: 0.5 },
    { route: '/contact', freq: 'monthly', prio: 0.6 },
    { route: '/terms', freq: 'monthly', prio: 0.5 },
  ].map((page) => ({
    url: `${baseUrl}${page.route}`,
    lastModified: new Date(),
    changeFrequency: page.freq as any,
    priority: page.prio,
  }));

  if (!shouldIncludeDynamicSitemapUrls()) return staticPages;

  let matchCenterUrls: MetadataRoute.Sitemap = [];
  try {
    const matches = await prisma.match.findMany({
      select: { id: true, matchDate: true, status: true },
      orderBy: { matchDate: 'asc' },
    });
    matchCenterUrls = matches.map((match) => {
      const status = String(match.status || '').toUpperCase();
      const isLiveOrUpcoming = status === 'SCHEDULED' || status === 'IN_PLAY' || status === 'LIVE' || status === 'HT';
      return {
        url: `${baseUrl}/match-center/${match.id}`,
        lastModified: new Date(match.matchDate),
        changeFrequency: isLiveOrUpcoming ? 'hourly' as const : 'weekly' as const,
        priority: isLiveOrUpcoming ? 0.9 : 0.7,
      };
    });
  } catch (err) {
    logSitemapDataError('match', err);
  }

  let newsUrls: MetadataRoute.Sitemap = [];
  try {
    const newsItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "publishedAt", "updatedAt" FROM "PressNews"
      WHERE "status" = 'published'
      ORDER BY "publishedAt" DESC
    `);

    newsUrls = newsItems.map((item) => ({
      url: `${baseUrl}/news/${item.id}`,
      lastModified: new Date(item.updatedAt || item.publishedAt || new Date()),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch (err) {
    logSitemapDataError('news', err);
  }

  return [
    ...staticPages,
    ...matchCenterUrls,
    ...newsUrls,
  ];
}
