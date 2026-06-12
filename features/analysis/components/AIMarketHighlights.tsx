import Link from 'next/link';
import { Brain, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { MarketAnalysisBadge } from './MarketAnalysisBadge';
import { analyzeFootballAsset, type FootballAnalysisAssetInput } from '../lib/analysis-adapter';
import { buildAIAnalystGroups, type NormalizedAIAnalystAsset } from '../lib/ai-analyst-ranking';
import { formatVirtualCoins, getFairValue, getMarketPrice, getValueGapPercent } from '../lib/value-fit';

function MiniAssetRow({ asset, danger = false }: { asset: NormalizedAIAnalystAsset; danger?: boolean }) {
  const analysis = analyzeFootballAsset(asset);
  const current = getMarketPrice(asset);
  const fairValue = getFairValue(asset);
  const valueGap = getValueGapPercent(asset);
  const assetType = asset.type === 'TEAM' ? 'TEAM' : 'PLAYER';

  return (
    <Link href={`/asset/${asset.id}`} className="group block w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 transition active:scale-[0.98] hover:border-[#0FF0FC]/35 hover:bg-white/[0.04]">
      <div className="flex min-w-0 items-center gap-3">
        <AssetImage image={asset.image || ''} type={assetType} name={asset.name || 'Asset'} width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover sm:h-11 sm:w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-black text-white group-hover:text-[#0FF0FC]">{asset.name}</h3>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black ${danger ? 'bg-red-400/10 text-red-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
              {valueGap > 0 ? '+' : ''}{valueGap.toFixed(1)}%
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{formatVirtualCoins(current)} / عادلة {formatVirtualCoins(fairValue)} · Tech {analysis.weightedScore}</p>
        </div>
        <ArrowRight size={15} className="shrink-0 text-gray-500 transition group-hover:text-[#0FF0FC]" />
      </div>
      <div className="mt-2 max-w-full overflow-hidden">
        <MarketAnalysisBadge asset={asset} compact />
      </div>
    </Link>
  );
}

export function AIMarketHighlights({ assets = [] }: { assets?: FootballAnalysisAssetInput[] }) {
  const { opportunities, warnings } = buildAIAnalystGroups(assets, 4);

  if (!opportunities.length && !warnings.length) return null;

  return (
    <section className="mx-auto mb-6 w-full max-w-[1500px] overflow-hidden px-3 sm:px-6 lg:px-8">
      <div className="w-full max-w-full overflow-hidden rounded-[1.35rem] border border-[#0FF0FC]/15 bg-[#101217] p-4 shadow-card sm:rounded-[1.7rem] lg:rounded-3xl lg:p-6">
        <div className="mb-5 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-[11px] font-black text-[#0FF0FC] sm:text-xs"><Brain size={14} className="shrink-0" /> Market Intelligence Lens</div>
            <h2 className="text-xl font-black leading-tight text-white lg:text-2xl">فرص وتحذيرات قبل فتح السوق</h2>
            <p className="mt-1 text-xs leading-6 text-gray-400 lg:text-sm">قراءة سريعة تجمع بين السعر الحالي، القيمة العادلة، ودرجة التحليل الفني حتى ترى السبب قبل الدخول في تفاصيل الأصل.</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-300"><TrendingUp size={17} className="shrink-0" /> فرص فنية محتملة</div>
            <div className="space-y-2">
              {opportunities.length ? opportunities.map((asset) => <MiniAssetRow key={asset.id} asset={asset} />) : <p className="p-3 text-xs text-gray-500">لا توجد فرص فنية واضحة الآن.</p>}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-red-400/15 bg-red-400/5 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-red-300"><TrendingDown size={17} className="shrink-0" /> أصول تحتاج حذرًا</div>
            <div className="space-y-2">
              {warnings.length ? warnings.map((asset) => <MiniAssetRow key={asset.id} asset={asset} danger />) : <p className="p-3 text-xs text-gray-500">لا توجد مبالغة فنية واضحة الآن.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
