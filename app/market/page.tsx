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
    <div className="market-page w-full max-w-full overflow-x-hidden">
      <section className="mx-auto w-full max-w-[1500px] overflow-hidden px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="mb-5 flex w-full max-w-full flex-col gap-3 overflow-hidden rounded-[1.35rem] border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-4 sm:rounded-[1.5rem] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-black/25 px-3 py-1 text-[11px] font-black text-[#0FF0FC] sm:text-xs">
              <Brain size={14} className="shrink-0" /> Market Intelligence
            </div>
            <h1 className="max-w-full text-balance text-xl font-black leading-tight text-white sm:text-2xl">اقرأ السوق بعد التحليل ومنهجية التسعير</h1>
            <p className="mt-2 max-w-full text-xs leading-6 text-gray-400 sm:text-sm">السوق هنا تطبيق عملي للتحليل: راجع التقارير، افهم القيمة العادلة والزخم والطلب، ثم تابع الفرص الافتراضية.</p>
          </div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 lg:flex lg:flex-wrap">
            <Link href="/team-intelligence" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-4 py-3 text-sm font-black text-black transition active:scale-[0.98] hover:scale-[1.02]">
              مركز التحليل <ArrowRight size={16} />
            </Link>
            <Link href="/methodology" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] transition active:scale-[0.98] hover:bg-[#FFD700]/15">
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
    </div>
  );
}
