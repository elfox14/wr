import { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  
  // Get all static articles
  const articles = getAllArticles();
  
  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/article/${article.id}`,
    lastModified: new Date(article.date),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Fetch all assets
  const assets = await prisma.asset.findMany({ select: { id: true } });
  const assetUrls = assets.map((asset) => ({
    url: `${baseUrl}/asset/${asset.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Static pages
  const staticPages = [
    { route: '', freq: 'always', prio: 1 },
    { route: '/articles', freq: 'daily', prio: 0.9 },
    { route: '/market', freq: 'always', prio: 0.9 },
    { route: '/groups', freq: 'always', prio: 0.8 },
    { route: '/leaderboard', freq: 'hourly', prio: 0.7 },
    { route: '/matches', freq: 'daily', prio: 0.8 },
    { route: '/leagues', freq: 'daily', prio: 0.8 },
    { route: '/rewards', freq: 'daily', prio: 0.8 },
    { route: '/news', freq: 'hourly', prio: 0.8 },
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
  ];
}
