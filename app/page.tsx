import HomeClient from '@/components/HomeClient';
import { getAssets } from '@/lib/store-server';
import prisma from '@/lib/prisma';

export default async function Home() {
  const assets = await getAssets();
  
  // 1. Fetch real data for stats
  const usersCount = await prisma.user.count();
  
  // Calculate approximate trade volume
  const volumeResult: any = await prisma.$queryRaw`SELECT COALESCE(SUM(quantity * price_at_time), 0) as volume FROM "Transaction"`;
  const tradeVolume = Number(volumeResult[0]?.volume || 0);

  // Calculate executed trades
  const executedTradesResult = await prisma.transaction.count();

  // A) assetsCount
  const assetsCount = await prisma.asset.count();

  // B) playersCount
  const playersCount = await prisma.asset.count({ where: { type: "PLAYER" } });

  // C) teamsCount
  const teamsCount = await prisma.asset.count({ where: { type: "TEAM" } });

  // D) upcomingMatchesCount
  const upcomingMatchesCount = await prisma.match.count({
    where: { status: { in: ["SCHEDULED", "IN_PLAY", "LIVE"] } }
  });

  // E) recentTransactions
  const recentTransactionsRaw = await prisma.transaction.findMany({
    orderBy: { timestamp: "desc" },
    take: 5,
    include: {
      asset: true,
      user: true
    }
  });
  const recentTransactions = JSON.parse(JSON.stringify(recentTransactionsRaw));

  // F) mostTradedAssets
  const groupByAsset = await prisma.transaction.groupBy({
    by: ['assetId'],
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: 'desc'
      }
    },
    take: 5
  });
  const mostTradedAssetIds = groupByAsset.map(g => g.assetId);
  const mostTradedAssetsRaw = await prisma.asset.findMany({
    where: { id: { in: mostTradedAssetIds } }
  });
  const mostTradedAssetsSorted = mostTradedAssetIds
    .map(id => mostTradedAssetsRaw.find(a => a.id === id))
    .filter(Boolean);
  const mostTradedAssets = JSON.parse(JSON.stringify(mostTradedAssetsSorted));

  // G) topDemandAssets
  const topDemandAssetsRaw = await prisma.asset.findMany({
    orderBy: { marketDemand: "desc" },
    take: 5
  });
  const topDemandAssets = JSON.parse(JSON.stringify(topDemandAssetsRaw));

  // H) topMomentumAssets
  const topMomentumAssetsRaw = await prisma.asset.findMany({
    orderBy: { momentum: "desc" },
    take: 5
  });
  const topMomentumAssets = JSON.parse(JSON.stringify(topMomentumAssetsRaw));

  // I) undervaluedAssets
  const undervaluedAssets = assets.filter((asset: any) => {
    const marketPrice = asset.marketPrice ?? asset.current_price ?? 0;
    const fairValue = asset.fairValue ?? asset.current_price ?? 0;
    if (fairValue === 0) return false;
    const premiumDiscount = ((marketPrice - fairValue) / fairValue) * 100;
    return premiumDiscount <= -5;
  }).slice(0, 5);

  // Fetch upcoming matches (fully serialized)
  const upcomingMatchesRaw = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 5,
    include: { homeTeam: true, awayTeam: true }
  });
  const upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));

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
        assetsCount={assetsCount}
        playersCount={playersCount}
        teamsCount={teamsCount}
        upcomingMatchesCount={upcomingMatchesCount}
        recentTransactions={recentTransactions}
        mostTradedAssets={mostTradedAssets}
        topDemandAssets={topDemandAssets}
        topMomentumAssets={topMomentumAssets}
        undervaluedAssets={undervaluedAssets}
      />
    </>
  );
}
