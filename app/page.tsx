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

  // Fetch top 3 users by profit
  const topUsersData = await prisma.user.findMany({
    where: { total_profit: { gt: 0 } },
    orderBy: { total_profit: 'desc' },
    take: 3,
    select: { name: true, total_profit: true }
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "WorldCup Exchange",
    "url": baseUrl,
    "description": "أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. حلل الأداء، استثمر في النجوم، ونافس على صدارة السوق العالمي."
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
        topUsersData={topUsersData}
      />
    </>
  );
}
