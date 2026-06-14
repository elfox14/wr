import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

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
    { route: '/news', freq: 'hourly', prio: 0.85 },
    { route: '/matches', freq: 'hourly', prio: 0.95 },
    { route: '/animation-live', freq: 'hourly', prio: 0.8 },
    { route: '/teams', freq: 'daily', prio: 0.75 },
    { route: '/players', freq: 'daily', prio: 0.7 },
    { route: '/groups', freq: 'always', prio: 0.85 },
  ].map((page) => ({
    url: `${baseUrl}${page.route}`,
    lastModified: new Date(),
    changeFrequency: page.freq as any,
    priority: page.prio,
  }));

  return [
    ...staticPages,
    ...matchCenterUrls,
  ];
}
