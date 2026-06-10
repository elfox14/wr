import { Brain, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { analyzeFootballAsset, type FootballAnalysisAssetInput } from '../lib/analysis-adapter';
import { analyzeValueFit, formatVirtualCoins } from '../lib/value-fit';

type MarketAnalysisBadgeProps = {
  asset: FootballAnalysisAssetInput;
  compact?: boolean;
};

function iconForSignal(signal: string) {
  if (signal === 'UNDERVALUED') return <TrendingUp size={13} />;
  if (signal === 'OVERVALUED') return <TrendingDown size={13} />;
  if (signal === 'TECH_SUPPORTED') return <Brain size={13} />;
  return <WalletCards size={13} />;
}

function hintForSignal(signal: ReturnType<typeof analyzeValueFit>, technicalScore: number) {
  if (signal.signal === 'UNDERVALUED') return `أقل من القيمة ${Math.abs(signal.gapPercent).toFixed(1)}%`;
  if (signal.signal === 'OVERVALUED') return `أعلى من القيمة ${signal.gapPercent.toFixed(1)}%`;
  if (signal.signal === 'TECH_SUPPORTED') return `Score ${technicalScore}`;
  return signal.fairValue ? `${formatVirtualCoins(signal.marketPrice)} / ${formatVirtualCoins(signal.fairValue)}` : `Score ${technicalScore}`;
}

export function MarketAnalysisBadge({ asset, compact = false }: MarketAnalysisBadgeProps) {
  if (!asset) return null;

  const analysis = analyzeFootballAsset(asset);
  const signal = analyzeValueFit(asset, analysis.weightedScore);
  const icon = iconForSignal(signal.signal);
  const hint = hintForSignal(signal, analysis.weightedScore);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black ${signal.tone}`}>
        {icon}
        {analysis.weightedScore}
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border p-3 ${signal.tone}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black">{icon} {signal.shortLabel}</span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-black text-white">{analysis.weightedScore}</span>
      </div>
      <p className="text-[10px] font-bold opacity-80">{hint}</p>
    </div>
  );
}
