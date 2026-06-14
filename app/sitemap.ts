import { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const articles = getAllArticles();

  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/article/${article.id}`,
    lastModified: new Date(article.date),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const assets = await prisma.asset.findMany({ select: { id: true, type: true } });
  const assetUrls = assets.map((asset) => ({
    url: `${baseUrl}/asset/${asset.id}`,
    lastModified: new Date(),
    changeFrequency: asset.type === 'TEAM' ? 'daily' as const : 'weekly' as const,
    priority: asset.type === 'TEAM' ? 0.85 : 0.75,
  }));

  const matches = await prisma.match.findMany({
    select: { id: true, matchDate: true, status: true },
    orderBy: { matchDate: 'asc' },
  });
  const matchCenterUrls = matches.map((match) => {
    const status = String(match.status || '').toUpperCase();
    const isLiveOrUpcoming = status === 'SCHEDULED' || status === 'IN_PLAY' || status === 'LIVE' || status === 'HT';
    return {
      url: `${baseUrl}/match-center/${match.id}`,
      lastModified: new Date(match.matchDate),
      changeFrequency: isLiveOrUpcoming ? 'hourly' as const : 'weekly' as const,
      priority: isLiveOrUpcoming ? 0.9 : 0.7,
    };
  });

  const staticPages = [
    { route: '', freq: 'always', prio: 1 },
    { route: '/articles', freq: 'daily', prio: 0.9 },
    { route: '/news', freq: 'hourly', prio: 0.85 },
    { route: '/matches', freq: 'hourly', prio: 0.95 },
    { route: '/animation-live', freq: 'hourly', prio: 0.8 },
    { route: '/teams', freq: 'daily', prio: 0.85 },
    { route: '/players', freq: 'daily', prio: 0.75 },
    { route: '/groups', freq: 'always', prio: 0.85 },
    { route: '/methodology', freq: 'weekly', prio: 0.75 },
  ].map((page) => ({
    url: `${baseUrl}${page.route}`,
    lastModified: new Date(),
    changeFrequency: page.freq as any,
    priority: page.prio,
  }));

  return [
    ...staticPages,
    ...articleUrls,
    ...assetUrls,
    ...matchCenterUrls,
  ];
}
