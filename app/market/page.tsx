import { Metadata } from 'next';
import MarketClient from '@/components/MarketClient';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'مركز قيادة السوق | MC PRIME Exchange',
  description: 'استكشف المنتخبات واللاعبين، وقارن بين الأسعار العادلة والزخم والطلب في سوق MC PRIME Exchange.',
};

export default async function MarketPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    usersCount,
    assetsCount,
    teamsCount,
    playersCount,
    todayTradesCount,
    volumeResult,
    nextMatch,
    recentNews,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.asset.count(),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.transaction.count({ where: { timestamp: { gte: today } } }),
    prisma.$queryRaw`SELECT COALESCE(SUM(quantity * price_at_time), 0) as volume FROM "Transaction" WHERE "timestamp" >= ${today}`,
    prisma.match.findFirst({
      where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
      orderBy: { matchDate: 'asc' },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.marketNews.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 6,
      include: { asset: true },
    }),
  ]);

  const todayVolume = Number((volumeResult as any)[0]?.volume || 0);
  const nextMatchDate = nextMatch ? nextMatch.matchDate.toISOString() : null;

  return (
    <MarketClient
      usersCount={usersCount}
      todayVolume={todayVolume}
      todayTradesCount={todayTradesCount}
      assetsCount={assetsCount}
      teamsCount={teamsCount}
      playersCount={playersCount}
      nextMatchDate={nextMatchDate}
      nextMatch={nextMatch}
      recentNews={recentNews}
    />
  );
}
