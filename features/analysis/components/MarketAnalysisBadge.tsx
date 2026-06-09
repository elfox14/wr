import { Brain, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { analyzeFootballAsset } from '../lib/analysis-adapter';

type MarketAnalysisBadgeProps = {
  asset: any;
  compact?: boolean;
};

function formatCoins(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString()}¢`;
}

function getValueSignal(asset: any, technicalScore: number) {
  const marketPrice = Number(asset?.marketPrice ?? asset?.current_price ?? 0);
  const fairValue = Number(asset?.fairValue ?? marketPrice || 0);
  const gap = fairValue > 0 ? ((marketPrice - fairValue) / fairValue) * 100 : 0;

  if (gap <= -8 && technicalScore >= 65) {
    return {
      label: 'فرصة فنية',
      icon: <TrendingUp size={13} />,
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      hint: `أقل من القيمة ${Math.abs(gap).toFixed(1)}%`,
    };
  }

  if (gap >= 12 && technicalScore < 72) {
    return {
      label: 'مبالغ فنيًا',
      icon: <TrendingDown size={13} />,
      className: 'border-red-400/25 bg-red-400/10 text-red-300',
      hint: `أعلى من القيمة ${gap.toFixed(1)}%`,
    };
  }

  if (technicalScore >= 78) {
    return {
      label: 'مدعوم فنيًا',
      icon: <Brain size={13} />,
      className: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]',
      hint: `Score ${technicalScore}`,
    };
  }

  return {
    label: 'متوازن',
    icon: <WalletCards size={13} />,
    className: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]',
    hint: fairValue ? `${formatCoins(marketPrice)} / ${formatCoins(fairValue)}` : `Score ${technicalScore}`,
  };
}

export function MarketAnalysisBadge({ asset, compact = false }: MarketAnalysisBadgeProps) {
  if (!asset) return null;

  const analysis = analyzeFootballAsset(asset);
  const signal = getValueSignal(asset, analysis.weightedScore);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black ${signal.className}`}>
        {signal.icon}
        {analysis.weightedScore}
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border p-3 ${signal.className}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black">{signal.icon} {signal.label}</span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-black text-white">{analysis.weightedScore}</span>
      </div>
      <p className="text-[10px] font-bold opacity-80">{signal.hint}</p>
    </div>
  );
}
