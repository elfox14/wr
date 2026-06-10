import { Asset } from '@prisma/client';

export interface AssetValuationMetrics {
  fundamental?: number;
  popularity?: number;
  worldCupLegacy?: number;
  marketDemand?: number;
  momentum?: number;
  fifaRank?: number;
  squadQuality?: number;
  age?: number;
  playerTier?: number;
  roleImportance?: number;
  participations?: number;
  harmony?: number;
  injuries?: number;
}

export interface MarketPriceInputs {
  fairValue: number;
  marketDemand?: number;
  momentum?: number;
  popularity?: number;
  volatilityScore?: number;
  ownersCount?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampScore(value: number): number {
  return clamp(Math.round(value), 0, 100);
}

/**
 * Accept both 0..1 ratios and 0..100 scores.
 * This protects seed/import code from silently underpricing assets when it sends 0.72 instead of 72.
 */
function normalizeScore(value: number | null | undefined, fallback = 50): number {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  const normalized = value <= 1 ? value * 100 : value;
  return clamp(normalized, 0, 100);
}

function normalizeRatio(value: number | null | undefined, fallback = 0.5): number {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return clamp(value <= 1 ? value : value / 100, 0, 1);
}

function fifaRankToScore(rank?: number): number {
  const safeRank = Math.max(1, rank || 50);
  // Softer than the previous curve so rank is important but not everything.
  return clamp(100 - ((safeRank - 1) * 1.1), 0, 100);
}

function participationsToLegacy(participations?: number): number {
  if (participations === undefined || participations === null) return 50;
  return clamp(participations * 5, 0, 100);
}

export function calculatePlayerScore(metrics: AssetValuationMetrics): number {
  const playerTierScore = normalizeScore(metrics.playerTier, 50);
  const fundamental = normalizeScore(metrics.fundamental, playerTierScore);
  const popularity = normalizeScore(metrics.popularity, 50);
  const worldCupLegacy = normalizeScore(metrics.worldCupLegacy, 50);
  const marketDemand = normalizeScore(metrics.marketDemand, 50);
  const momentum = normalizeScore(metrics.momentum, 50);
  const roleImportance = normalizeScore(metrics.roleImportance, playerTierScore);

  let score =
    (fundamental * 0.40) +
    (popularity * 0.15) +
    (worldCupLegacy * 0.10) +
    (marketDemand * 0.15) +
    (momentum * 0.10) +
    (roleImportance * 0.10);

  if (metrics.age) {
    if (metrics.age < 21) score -= 4;
    else if (metrics.age >= 21 && metrics.age <= 23) score += 1;
    else if (metrics.age >= 24 && metrics.age <= 29) score += 5;
    else if (metrics.age >= 30 && metrics.age <= 33) score += 2;
    else if (metrics.age >= 34 && metrics.age <= 36) score -= 4;
    else if (metrics.age >= 37 && metrics.age <= 39) score -= 8;
    else if (metrics.age >= 40) score -= 14;
  }

  const injuryPenalty = normalizeScore(metrics.injuries, 0) * 0.20;
  score -= injuryPenalty;

  return clampScore(score);
}

export function calculateTeamScore(metrics: AssetValuationMetrics): number {
  const fifaRankScore = fifaRankToScore(metrics.fifaRank);
  const squadQuality = normalizeScore(metrics.squadQuality, metrics.fundamental ?? 50);
  const worldCupLegacy = normalizeScore(metrics.worldCupLegacy, participationsToLegacy(metrics.participations));
  const popularity = normalizeScore(metrics.popularity, 50);
  const marketDemand = normalizeScore(metrics.marketDemand, 50);
  const momentum = normalizeScore(metrics.momentum, 50);
  const harmonyScore = normalizeScore(metrics.harmony, 85);
  const injuryPenalty = normalizeScore(metrics.injuries, 0) * 0.20;

  const score =
    (fifaRankScore * 0.25) +
    (squadQuality * 0.30) +
    (momentum * 0.20) +
    (worldCupLegacy * 0.10) +
    (((popularity * 0.55) + (marketDemand * 0.45)) * 0.10) +
    (harmonyScore * 0.05) -
    injuryPenalty;

  return clampScore(score);
}

export function calculateFairValue(score: number, type: 'TEAM' | 'PLAYER'): number {
  const safeScore = clamp(score, 0, 100) / 100;

  if (type === 'PLAYER') {
    return Math.round(250 + Math.pow(safeScore, 3) * 5000);
  }

  return Math.round(500 + Math.pow(safeScore, 3) * 8000);
}

/**
 * Fair value is the football/analytical value.
 * Market price is the tradable price after demand, momentum and popularity premiums/discounts.
 */
export function calculateMarketPrice(inputs: MarketPriceInputs): number {
  const fairValue = Math.max(1, inputs.fairValue);
  const demand = normalizeScore(inputs.marketDemand, 50);
  const momentum = normalizeScore(inputs.momentum, 50);
  const popularity = normalizeScore(inputs.popularity, 50);
  const volatility = normalizeScore(inputs.volatilityScore, 50);
  const owners = inputs.ownersCount ?? 0;

  const demandPremium = (demand - 50) * 0.004;      // -20% .. +20%
  const momentumPremium = (momentum - 50) * 0.003;  // -15% .. +15%
  const popularityPremium = (popularity - 50) * 0.002; // -10% .. +10%
  const liquidityPremium = clamp(Math.log10(Math.max(owners, 1)) * 0.015, 0, 0.06);
  const volatilityDiscount = volatility > 70 ? -0.04 : volatility < 30 ? 0.02 : 0;

  const multiplier = clamp(
    1 + demandPremium + momentumPremium + popularityPremium + liquidityPremium + volatilityDiscount,
    0.70,
    1.35,
  );

  return Math.max(1, Math.round(fairValue * multiplier));
}

export function getPlayerRatingLabel(rating: number): string {
  if (rating >= 90) return 'World-class';
  if (rating >= 85) return 'Top starter';
  if (rating >= 80) return 'Key player';
  if (rating >= 70) return 'Squad/rotation';
  return 'Reserve';
}

export function getTeamTierLabel(score: number): string {
  if (score >= 90) return 'الأسهم الذهبية (Tier A)';
  if (score >= 80) return 'أسهم قيادية (Tier B)';
  if (score >= 70) return 'أسهم النمو (Tier C)';
  if (score >= 60) return 'أسهم الفرص (Tier D)';
  return 'أسهم المخاطرة (Tier E)';
}

export function calculateAssetScore(asset: Partial<Asset>, players?: Partial<Asset>[]): number {
  const isTeam = asset.type === 'TEAM';
  const playerTierScore = normalizeScore(asset.playerTier, 50);

  const metrics: AssetValuationMetrics = {
    fundamental: normalizeScore(asset.fundamental, isTeam ? 50 : playerTierScore),
    popularity: normalizeScore(asset.popularity, 50),
    worldCupLegacy: normalizeScore(asset.worldCupLegacy, participationsToLegacy(asset.participations ?? undefined)),
    marketDemand: normalizeScore(asset.marketDemand, 50),
    momentum: normalizeScore(asset.momentum, 50),
    age: asset.age || undefined,
    fifaRank: asset.fifaRank || 50,
    playerTier: asset.playerTier ?? undefined,
    roleImportance: asset.roleImportance ?? asset.playerTier ?? undefined,
    participations: asset.participations ?? undefined,
    harmony: asset.harmony ?? undefined,
    injuries: asset.injuries ?? undefined,
  };

  if (isTeam && players) {
    const sorted = [...players].sort((a, b) => ((b.score || 50) - (a.score || 50)));
    const top11 = sorted.slice(0, 11);
    metrics.squadQuality = top11.reduce((sum, p) => sum + normalizeScore(p.score, 50), 0) / (top11.length || 1);
    return calculateTeamScore(metrics);
  }

  return calculatePlayerScore(metrics);
}
