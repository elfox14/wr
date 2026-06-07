import { Metadata } from 'next';
import MarketClient from '@/components/MarketClient';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'سوق كأس العالم | WorldCup Exchange',
  description: 'استكشف المنتخبات واللاعبين، وقارن بين أسعارهم وحركتهم في سوق تداول المونديال.',
};

export default async function MarketPage() {
  const usersCount = await prisma.user.count();

  // Get today's start date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Volume for today
  const volumeResult: any = await prisma.$queryRaw`
    SELECT COALESCE(SUM(quantity * price_at_time), 0) as volume 
    FROM "Transaction" 
    WHERE "timestamp" >= ${today}
  `;
  const todayVolume = Number(volumeResult[0]?.volume || 0);

  // Next scheduled match
  const nextMatch = await prisma.match.findFirst({
    where: { status: 'SCHEDULED' },
    orderBy: { matchDate: 'asc' },
    select: { matchDate: true }
  });

  const nextMatchDate = nextMatch ? nextMatch.matchDate.toISOString() : null;

  return (
    <MarketClient 
      usersCount={usersCount} 
      todayVolume={todayVolume} 
      nextMatchDate={nextMatchDate} 
    />
  );
}
