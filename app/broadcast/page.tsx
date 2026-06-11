import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { getAllArticles } from '@/lib/articles';
import { BroadcastClient } from '@/components/BroadcastClient';

export const metadata: Metadata = {
  title: 'شاشة البث | MC PRIME Exchange',
  description: 'شاشة بث أنيميشن جاهزة للاستخدام في OBS أو الفيديوهات لمنصة بورصة المونديال.',
};

export default async function BroadcastPage() {
  const [liveMatchRaw, nextMatchRaw, teamsCount, playersCount, assetsCount, matchesCount] = await Promise.all([
    prisma.match.findFirst({
      where: { status: { in: ['IN_PLAY', 'LIVE'] } },
      orderBy: { matchDate: 'asc' },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.match.findFirst({
      where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
      orderBy: { matchDate: 'asc' },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.asset.count(),
    prisma.match.count(),
  ]);

  const selectedMatchRaw = liveMatchRaw || nextMatchRaw;
  const nextMatch = selectedMatchRaw ? JSON.parse(JSON.stringify(selectedMatchRaw)) : null;
  const articles = getAllArticles().slice(0, 3).map((article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    readingTime: article.readingTime,
  }));

  return (
    <BroadcastClient
      nextMatch={nextMatch}
      stats={{
        teamsCount: teamsCount || 48,
        playersCount: playersCount || 1249,
        assetsCount: assetsCount || 1297,
        matchesCount: matchesCount || 72,
      }}
      articles={articles}
    />
  );
}
