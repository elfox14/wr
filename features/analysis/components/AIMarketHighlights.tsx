import Link from 'next/link';
import { Brain, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { MarketAnalysisBadge } from './MarketAnalysisBadge';
import { analyzeFootballAsset } from '../lib/analysis-adapter';

function price(asset: any) {
  return Number(asset?.marketPrice ?? asset?.current_price ?? 0);
}

function fair(asset: any) {
  return Number(asset?.fairValue ?? asset?.current_price ?? price(asset));
}

function gap(asset: any) {
  const fairValue = fair(asset);
  if (!fairValue) return 0;
  return ((price(asset) - fairValue) / fairValue) * 100;
}

function formatPrice(value: number) {
  return `${Math.round(value || 0).toLocaleString()}¢`;
}

function sortByTechnicalOpportunity(a: any, b: any) {
  const analysisA = analyzeFootballAsset(a);
  const analysisB = analyzeFootballAsset(b);
  const aScore = analysisA.weightedScore + Math.max(0, -gap(a)) * 1.6;
  const bScore = analysisB.weightedScore + Math.max(0, -gap(b)) * 1.6;
  return bScore - aScore;
}

function sortByTechnicalOverprice(a: any, b: any) {
  const analysisA = analyzeFootballAsset(a);
  const analysisB = analyzeFootballAsset(b);
  const aScore = Math.max(0, gap(a)) * 2 + Math.max(0, 72 - analysisA.weightedScore);
  const bScore = Math.max(0, gap(b)) * 2 + Math.max(0, 72 - analysisB.weightedScore);
  return bScore - aScore;
}

function MiniAssetRow({ asset, danger = false }: { asset: any; danger?: boolean }) {
  const analysis = analyzeFootballAsset(asset);
  const current = price(asset);
  const fairValue = fair(asset);
  const valueGap = gap(asset);

  return (
    <Link href={`/asset/${asset.id}`} className="group block rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <AssetImage image={asset.image || ''} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={40} height={40} className="h-11 w-11 rounded-xl border border-white/10 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-black text-white group-hover:text-[#0FF0FC]">{asset.name}</h3>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${danger ? 'bg-red-400/10 text-red-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
              {valueGap > 0 ? '+' : ''}{valueGap.toFixed(1)}%
            </span>
          </div>
          <p className="text-[11px] text-gray-500">{formatPrice(current)} / عادلة {formatPrice(fairValue)} · Tech {analysis.weightedScore}</p>
        </div>
        <ArrowRight size={15} className="text-gray-500 transition group-hover:text-[#0FF0FC]" />
      </div>
      <div className="mt-2">
        <MarketAnalysisBadge asset={asset} compact />
      </div>
    </Link>
  );
}

export function AIMarketHighlights({ assets = [] }: { assets?: any[] }) {
  const normalized = assets.map((asset) => ({
    ...asset,
    marketPrice: Number(asset.marketPrice ?? asset.current_price ?? 0),
    fairValue: Number(asset.fairValue ?? asset.current_price ?? asset.marketPrice ?? 0),
  }));

  const opportunities = [...normalized]
    .filter((asset) => gap(asset) <= -5 || analyzeFootballAsset(asset).weightedScore >= 75)
    .sort(sortByTechnicalOpportunity)
    .slice(0, 4);

  const overpriced = [...normalized]
    .filter((asset) => gap(asset) >= 8)
    .sort(sortByTechnicalOverprice)
    .slice(0, 4);

  if (!opportunities.length && !overpriced.length) return null;

  return (
    <section className="mx-auto mb-6 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="rounded-[1.7rem] border border-[#0FF0FC]/15 bg-[#101217] p-4 shadow-card lg:rounded-3xl lg:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Brain size={14} /> AI Market Lens</div>
            <h2 className="text-xl font-black text-white lg:text-2xl">فرص وتحذيرات فنية داخل السوق</h2>
            <p className="mt-1 text-xs leading-6 text-gray-400 lg:text-sm">قراءة تجمع السعر العادل مع التحليل الفني، حتى تظهر الفرص قبل فتح صفحة الأصل.</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-300"><TrendingUp size={17} /> فرص فنية محتملة</div>
            <div className="space-y-2">
              {opportunities.length ? opportunities.map((asset) => <MiniAssetRow key={asset.id} asset={asset} />) : <p className="p-3 text-xs text-gray-500">لا توجد فرص فنية واضحة الآن.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-red-400/15 bg-red-400/5 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-red-300"><TrendingDown size={17} /> أصول تحتاج حذرًا</div>
            <div className="space-y-2">
              {overpriced.length ? overpriced.map((asset) => <MiniAssetRow key={asset.id} asset={asset} danger />) : <p className="p-3 text-xs text-gray-500">لا توجد مبالغة فنية واضحة الآن.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
