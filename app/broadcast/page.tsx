import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { getAllArticles } from '@/lib/articles';
import { BroadcastClient } from '@/components/BroadcastClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'شاشة البث | MC PRIME World Cup',
  description: 'شاشة بث أنيميشن جاهزة للاستخدام في OBS أو الفيديوهات لمنصة MC PRIME World Cup.',
};

export default async function BroadcastPage() {
  let nextMatch = null;
  let teamsCount = 48;
  let playersCount = 1249;
  let matchesCount = 72;

  try {
    const [nextScheduledMatchRaw, fallbackMatchRaw, teamsTotal, playersTotal, matchesTotal] = await Promise.all([
      prisma.match.findFirst({ where: { status: 'SCHEDULED' }, orderBy: { matchDate: 'asc' }, include: { homeTeam: true, awayTeam: true } }),
      prisma.match.findFirst({ where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } }, orderBy: { matchDate: 'asc' }, include: { homeTeam: true, awayTeam: true } }),
      prisma.asset.count({ where: { type: 'TEAM' } }),
      prisma.asset.count({ where: { type: 'PLAYER' } }),
      prisma.match.count(),
    ]);

    const selectedMatchRaw = nextScheduledMatchRaw || fallbackMatchRaw;
    nextMatch = selectedMatchRaw ? JSON.parse(JSON.stringify(selectedMatchRaw)) : null;
    teamsCount = teamsTotal || teamsCount;
    playersCount = 1248;
    matchesCount = matchesTotal || matchesCount;
  } catch (error) {
    console.error('Broadcast page data unavailable:', error);
  }

  const articles = getAllArticles().slice(0, 3).map((article) => ({ id: article.id, title: article.title, excerpt: article.excerpt, category: article.category, readingTime: article.readingTime }));

  return <BroadcastClient nextMatch={nextMatch} stats={{ teamsCount, playersCount, assetsCount: 0, matchesCount }} articles={articles} />;
}
