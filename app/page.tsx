import HomeClient from '@/components/HomeClient';
import { getAssets } from '@/lib/store-server';
import prisma from '@/lib/prisma';

export default async function Home() {
  const assets = await getAssets();
  
  // Fetch real data for stats
  const usersCount = await prisma.user.count();
  
  // Calculate approximate trade volume (or just count transactions for now, but let's do a raw sum)
  const volumeResult: any = await prisma.$queryRaw`SELECT COALESCE(SUM(quantity * price_at_time), 0) as volume FROM "Transaction"`;
  const tradeVolume = Number(volumeResult[0]?.volume || 0);

  // Fetch upcoming matches
  const upcomingMatches = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 3,
    include: { homeTeam: true, awayTeam: true }
  });

  // Calculate executed trades
  const executedTradesResult = await prisma.transaction.count();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "MC PRIME Exchange",
    "url": baseUrl,
    "description": "منصة تداول رياضي افتراضية. تداول أسهم منتخبات ولاعبي كأس العالم افتراضياً، ونافس على صدارة السوق."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient 
        initialAssets={assets} 
        usersCount={usersCount}
        tradeVolume={tradeVolume}
        executedTrades={executedTradesResult}
        upcomingMatches={upcomingMatches}
      />
    </>
  );
}
