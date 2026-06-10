import { AlertTriangle, Brain, ShieldCheck, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import type { Holding, UserStats } from '@/lib/store';
import { buildPortfolioAIInsights, type PortfolioRiskLevel } from '../lib/portfolio-insights';

function formatCoins(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString()}¢`;
}

function riskTone(riskLevel: PortfolioRiskLevel) {
  if (riskLevel === 'LOW') return 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300';
  if (riskLevel === 'MEDIUM') return 'border-yellow-400/20 bg-yellow-400/[0.06] text-yellow-300';
  return 'border-red-400/20 bg-red-400/[0.06] text-red-300';
}

export function AIPortfolioInsights({ holdings, userStats }: { holdings: Holding[]; userStats: UserStats | null }) {
  const insights = buildPortfolioAIInsights(holdings, userStats);

  return (
    <section className="mb-8 rounded-[1.7rem] border border-[#0FF0FC]/15 bg-[#101217] p-4 shadow-card lg:rounded-3xl lg:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
            <Brain size={14} /> AI Portfolio Insights
          </div>
          <h2 className="text-2xl font-black text-white">قراءة ذكية للمحفظة</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">
            تحليل افتراضي مبني على توزيع الأصول، الأداء، السيولة، والمخاطر داخل منصة كأس العالم.
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-black ${riskTone(insights.riskLevel)}`}>
          المخاطرة: {insights.riskLabelAr}
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><ShieldCheck size={15} /> قوة المحفظة</div>
          <div className="text-3xl font-black text-white tabular-nums">{Math.round(insights.portfolioScore)}/100</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><WalletCards size={15} /> السيولة</div>
          <div className="text-3xl font-black text-accent tabular-nums">{insights.balanceSharePercent.toFixed(1)}%</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><TrendingUp size={15} /> المنتخبات</div>
          <div className="text-3xl font-black text-primary tabular-nums">{insights.teamAllocationPercent.toFixed(1)}%</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><TrendingDown size={15} /> اللاعبون</div>
          <div className="text-3xl font-black text-purple-300 tabular-nums">{insights.playerAllocationPercent.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="mb-3 text-sm font-black text-white">أهم الإشارات</h3>
          <div className="space-y-2">
            {insights.insights.map((item) => (
              <div key={item} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-gray-300">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="mb-3 text-sm font-black text-white">تنبيهات التوزيع</h3>
          {insights.allocationWarnings.length ? (
            <div className="space-y-2">
              {insights.allocationWarnings.map((warning) => (
                <div key={warning} className="flex gap-2 rounded-xl border border-yellow-400/15 bg-yellow-400/[0.055] px-3 py-2 text-sm leading-6 text-yellow-100">
                  <AlertTriangle className="mt-1 shrink-0 text-yellow-300" size={15} />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-3 text-sm text-emerald-100">
              لا توجد تنبيهات توزيع كبيرة حاليًا.
            </div>
          )}
        </div>
      </div>

      {(insights.bestHolding || insights.worstHolding) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {insights.bestHolding && (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] p-4">
              <div className="mb-1 text-xs font-black text-emerald-300">أفضل أصل</div>
              <div className="text-lg font-black text-white">{insights.bestHolding.assetName}</div>
              <div className="mt-1 text-sm text-emerald-200">{insights.bestHolding.effectivePnlPercent.toFixed(1)}% · {formatCoins(insights.bestHolding.effectiveValue)}</div>
            </div>
          )}
          {insights.worstHolding && (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.055] p-4">
              <div className="mb-1 text-xs font-black text-red-300">أكثر أصل ضغطًا</div>
              <div className="text-lg font-black text-white">{insights.worstHolding.assetName}</div>
              <div className="mt-1 text-sm text-red-100">{insights.worstHolding.effectivePnlPercent.toFixed(1)}% · {formatCoins(insights.worstHolding.effectiveValue)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
