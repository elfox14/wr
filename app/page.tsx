import Link from 'next/link';
import { ArrowRight, BookOpen, Brain, Sparkles, TrendingUp } from 'lucide-react';
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

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[1.7rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.06] p-4 shadow-[0_18px_55px_rgba(15,240,252,0.08)] lg:p-5">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(15,240,252,0.18),transparent_36%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-black/25 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Sparkles size={14} /> مسار البداية الصحيح</div>
              <h2 className="text-xl font-black text-white lg:text-2xl">ابدأ بالتحليل، افهم التسعير، ثم راقب السوق</h2>
              <p className="mt-1 max-w-3xl text-xs leading-6 text-gray-400 lg:text-sm">المستخدم الجديد يحتاج رحلة واضحة: تقرير فني موثوق، منهجية سعر مفهومة، ثم قرار افتراضي داخل السوق.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/team-intelligence" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-4 py-3 text-sm font-black text-black transition hover:scale-[1.02] hover:bg-[#70f7ff] active:scale-[0.98]">
                <Brain size={16} /> مركز التحليل
              </Link>
              <Link href="/methodology" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">
                <BookOpen size={16} /> المنهجية
              </Link>
              <Link href="/market" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15">
                <TrendingUp size={16} /> السوق <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

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
