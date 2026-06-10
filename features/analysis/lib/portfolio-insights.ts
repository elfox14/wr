import type { Holding, UserStats } from '@/lib/store';

export type PortfolioRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type PortfolioInsightHolding = Holding & {
  assetName: string;
  assetType: string;
  effectiveValue: number;
  effectivePnl: number;
  effectivePnlPercent: number;
  riskScore: number;
};

export type PortfolioAIInsights = {
  portfolioScore: number;
  riskLevel: PortfolioRiskLevel;
  riskLabelAr: string;
  balanceSharePercent: number;
  assetSharePercent: number;
  teamAllocationPercent: number;
  playerAllocationPercent: number;
  holdingsCount: number;
  bestHolding: PortfolioInsightHolding | null;
  worstHolding: PortfolioInsightHolding | null;
  allocationWarnings: string[];
  insights: string[];
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHolding(holding: Holding): PortfolioInsightHolding {
  const quantity = toNumber(holding.quantity, 0);
  const currentValue = toNumber(holding.currentValue, toNumber(holding.asset?.current_price, 0) * quantity);
  const pnl = toNumber(holding.pnl, toNumber(holding.profitLoss, 0));
  const pnlPercent = toNumber(holding.pnlPercent, toNumber(holding.profitLossPercent, 0));
  const volatility = toNumber(holding.volatilityScore, toNumber(holding.asset?.volatilityScore, 50));
  const momentum = toNumber(holding.momentum, toNumber(holding.asset?.momentum, 50));
  const marketDemand = toNumber(holding.marketDemand, toNumber(holding.asset?.marketDemand, 50));
  const riskScore = clamp((volatility * 0.55) + ((100 - momentum) * 0.25) + ((100 - marketDemand) * 0.2));

  return {
    ...holding,
    assetName: holding.asset?.name || 'أصل غير معروف',
    assetType: holding.asset?.type || 'UNKNOWN',
    effectiveValue: currentValue,
    effectivePnl: pnl,
    effectivePnlPercent: pnlPercent,
    riskScore,
  };
}

function riskLabel(riskLevel: PortfolioRiskLevel) {
  if (riskLevel === 'LOW') return 'منخفضة';
  if (riskLevel === 'MEDIUM') return 'متوسطة';
  return 'مرتفعة';
}

export function buildPortfolioAIInsights(holdings: Holding[], userStats: UserStats | null): PortfolioAIInsights {
  const normalizedHoldings = holdings.map(normalizeHolding);
  const balance = toNumber(userStats?.balance, 0);
  const holdingsValue = toNumber(userStats?.total_holdings_value, normalizedHoldings.reduce((sum, holding) => sum + holding.effectiveValue, 0));
  const netWorth = toNumber(userStats?.net_worth, balance + holdingsValue);
  const totalProfit = toNumber(userStats?.total_profit, normalizedHoldings.reduce((sum, holding) => sum + holding.effectivePnl, 0));
  const holdingsCount = normalizedHoldings.length;

  const teamValue = normalizedHoldings
    .filter((holding) => holding.assetType === 'TEAM')
    .reduce((sum, holding) => sum + holding.effectiveValue, 0);
  const playerValue = normalizedHoldings
    .filter((holding) => holding.assetType === 'PLAYER')
    .reduce((sum, holding) => sum + holding.effectiveValue, 0);

  const teamAllocationPercent = holdingsValue > 0 ? (teamValue / holdingsValue) * 100 : 0;
  const playerAllocationPercent = holdingsValue > 0 ? (playerValue / holdingsValue) * 100 : 0;
  const balanceSharePercent = netWorth > 0 ? (balance / netWorth) * 100 : 0;
  const assetSharePercent = netWorth > 0 ? (holdingsValue / netWorth) * 100 : 0;

  const weightedRisk = holdingsValue > 0
    ? normalizedHoldings.reduce((sum, holding) => sum + (holding.riskScore * (holding.effectiveValue / holdingsValue)), 0)
    : 35;

  const concentrationPenalty = Math.max(teamAllocationPercent, playerAllocationPercent) > 80 ? 12 : Math.max(teamAllocationPercent, playerAllocationPercent) > 65 ? 6 : 0;
  const liquidityBonus = balanceSharePercent >= 12 && balanceSharePercent <= 35 ? 8 : balanceSharePercent < 5 ? -8 : 0;
  const pnlScore = clamp(50 + (holdingsValue > 0 ? (totalProfit / holdingsValue) * 100 : 0), 0, 100);
  const diversificationScore = holdingsCount >= 8 ? 85 : holdingsCount >= 5 ? 70 : holdingsCount >= 3 ? 55 : holdingsCount > 0 ? 35 : 15;

  const portfolioScore = clamp(
    (pnlScore * 0.3) +
    (diversificationScore * 0.25) +
    ((100 - weightedRisk) * 0.25) +
    ((100 - concentrationPenalty) * 0.12) +
    (50 + liquidityBonus) * 0.08,
  );

  const adjustedRisk = clamp(weightedRisk + concentrationPenalty - Math.max(liquidityBonus, 0));
  const riskLevel: PortfolioRiskLevel = adjustedRisk >= 68 ? 'HIGH' : adjustedRisk >= 42 ? 'MEDIUM' : 'LOW';

  const bestHolding = normalizedHoldings.length
    ? [...normalizedHoldings].sort((a, b) => b.effectivePnlPercent - a.effectivePnlPercent)[0]
    : null;
  const worstHolding = normalizedHoldings.length
    ? [...normalizedHoldings].sort((a, b) => a.effectivePnlPercent - b.effectivePnlPercent)[0]
    : null;

  const allocationWarnings: string[] = [];
  if (teamAllocationPercent >= 80) allocationWarnings.push('المحفظة تميل بقوة للمنتخبات؛ راقب تنويع اللاعبين.');
  if (playerAllocationPercent >= 80) allocationWarnings.push('المحفظة تميل بقوة للاعبين؛ راقب تنويع المنتخبات.');
  if (balanceSharePercent < 5 && netWorth > 0) allocationWarnings.push('الرصيد المتاح منخفض جدًا مقارنة بحجم المحفظة.');
  if (holdingsCount > 0 && holdingsCount < 3) allocationWarnings.push('عدد الأصول قليل؛ التنويع ما زال محدودًا.');

  const insights: string[] = [];
  if (!holdingsCount) {
    insights.push('ابدأ ببناء محفظة صغيرة ومتوازنة قبل التوسع في الأصول عالية التقلب.');
  } else {
    insights.push(`قوة المحفظة الحالية ${Math.round(portfolioScore)}/100 مع مخاطرة ${riskLabel(riskLevel)}.`);
    if (bestHolding) insights.push(`أفضل مساهم حاليًا: ${bestHolding.assetName} بنسبة ${bestHolding.effectivePnlPercent.toFixed(1)}%.`);
    if (worstHolding && worstHolding.effectivePnlPercent < 0) insights.push(`أكبر ضغط على الأداء: ${worstHolding.assetName} بنسبة ${worstHolding.effectivePnlPercent.toFixed(1)}%.`);
    if (allocationWarnings.length === 0) insights.push('توزيع المحفظة يبدو متوازنًا بين السيولة والأصول الحالية.');
  }

  return {
    portfolioScore,
    riskLevel,
    riskLabelAr: riskLabel(riskLevel),
    balanceSharePercent,
    assetSharePercent,
    teamAllocationPercent,
    playerAllocationPercent,
    holdingsCount,
    bestHolding,
    worstHolding,
    allocationWarnings,
    insights,
  };
}
