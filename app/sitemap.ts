import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    console.error('Sitemap match generation skipped because database is unavailable:', err);
  }

  let newsUrls: MetadataRoute.Sitemap = [];
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PressNews" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
        "sourceName" TEXT NOT NULL,
        "sourceUrl" TEXT,
        "sourceType" TEXT NOT NULL DEFAULT 'newsletter',
        "language" TEXT NOT NULL DEFAULT 'ar',
        "status" TEXT NOT NULL DEFAULT 'published',
        "importance" INTEGER NOT NULL DEFAULT 50,
        "tags" JSONB,
        "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
    console.error('Sitemap news generation error:', err);
  }

  let articleUrls: MetadataRoute.Sitemap = [];
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MatchArticle" (
        "id" TEXT PRIMARY KEY,
        "matchId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "slug" TEXT NOT NULL UNIQUE,
        "metaTitle" TEXT NOT NULL,
        "metaDescription" TEXT NOT NULL,
        "excerpt" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "sections" JSONB,
        "statsSummary" JSONB,
        "status" TEXT NOT NULL DEFAULT 'DRAFT_READY',
        "language" TEXT NOT NULL DEFAULT 'ar',
        "seoScore" INTEGER NOT NULL DEFAULT 0,
        "sourceSnapshotId" TEXT,
        "heroImageUrl" TEXT,
        "infographicImageUrl" TEXT,
        "publishedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const articles = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "slug", "publishedAt", "updatedAt" FROM "MatchArticle"
      WHERE "status" = 'PUBLISHED'
      ORDER BY "publishedAt" DESC NULLS LAST, "updatedAt" DESC
    `);

    articleUrls = articles.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt || article.publishedAt || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.82,
    }));
  } catch (err) {
    console.error('Sitemap article generation error:', err);
  }

  return [
    ...staticPages,
    ...matchCenterUrls,
    ...newsUrls,
    ...articleUrls,
  ];
}
