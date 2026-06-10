import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, BookOpen, Brain } from 'lucide-react';
import MarketClient from '@/components/market/MarketClientClean';
import { AIMarketHighlights } from '@/features/analysis/components/AIMarketHighlights';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'غرفة عمليات السوق الرياضي | MC PRIME Exchange',
  description: 'راقب المنتخبات واللاعبين بعد قراءة التحليل ومنهجية التسعير: السعر الحالي، القيمة العادلة، الزخم، الطلب، والمخاطرة في سوق افتراضي فقط.',
};

type VolumeRow = {
  volume: number | string | bigint | null;
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
    analysisAssets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.asset.count(),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.transaction.count({ where: { timestamp: { gte: today } } }),
    prisma.$queryRaw<VolumeRow[]>`SELECT COALESCE(SUM(quantity * price_at_time), 0) as volume FROM "Transaction" WHERE "timestamp" >= ${today}`,
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
    prisma.asset.findMany({
      orderBy: [
        { score: 'desc' },
        { marketPrice: 'desc' },
      ],
      take: 80,
    }),
  ]);

  const todayVolume = Number(volumeResult[0]?.volume || 0);
  const nextMatchDate = nextMatch ? nextMatch.matchDate.toISOString() : null;

  return (
    <>
      <section className="mx-auto max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-black/25 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Brain size={14} /> Market Intelligence</div>
            <h1 className="text-xl font-black text-white lg:text-2xl">اقرأ السوق بعد التحليل ومنهجية التسعير</h1>
            <p className="mt-1 text-xs leading-6 text-gray-400 lg:text-sm">السوق هنا تطبيق عملي للتحليل: راجع التقارير، افهم القيمة العادلة والزخم والطلب، ثم تابع الفرص الافتراضية.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/team-intelligence" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-4 py-3 text-sm font-black text-black transition hover:scale-[1.02] active:scale-[0.98]">
              مركز التحليل <ArrowRight size={16} />
            </Link>
            <Link href="/methodology" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">
              منهجية التسعير <BookOpen size={16} />
            </Link>
          </div>
        </div>
      </section>

      <AIMarketHighlights assets={analysisAssets} />
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
    </>
  );
}
