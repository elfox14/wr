import { Asset } from '@prisma/client';

export interface AssetValuationMetrics {
  fundamental: number;
  popularity: number;
  worldCupLegacy: number;
  marketDemand: number;
  momentum: number;
  fifaRank?: number;
  squadQuality?: number;
  age?: number;
}

function clampScore(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function calculatePlayerScore(metrics: AssetValuationMetrics): number {
  let score =
    (metrics.fundamental * 0.35) +
    (metrics.popularity * 0.20) +
    (metrics.worldCupLegacy * 0.15) +
    (metrics.marketDemand * 0.20) +
    (metrics.momentum * 0.10);

  if (metrics.age) {
    if (metrics.age < 21) score -= 8;
    else if (metrics.age >= 21 && metrics.age <= 23) score -= 3;
    else if (metrics.age >= 24 && metrics.age <= 29) score += 5;
    else if (metrics.age >= 30 && metrics.age <= 33) score += 2;
    else if (metrics.age >= 34 && metrics.age <= 36) score -= 3;
    else if (metrics.age >= 37 && metrics.age <= 39) score -= 8;
    else if (metrics.age >= 40) score -= 14;
  }

  return clampScore(score);
}

export function calculateTeamScore(metrics: AssetValuationMetrics): number {
  const fifaRank = metrics.fifaRank || 50;
  const fifaRankScore = Math.max(100 - ((fifaRank - 1) * 1.5), 0);
  const squadQuality = metrics.squadQuality || metrics.fundamental;

  const score =
    (fifaRankScore * 0.40) +
    (squadQuality * 0.25) +
    (metrics.worldCupLegacy * 0.15) +
    (metrics.marketDemand * 0.10) +
    (metrics.momentum * 0.10);

  return clampScore(score);
}

export function calculateFairValue(score: number, type: 'TEAM' | 'PLAYER'): number {
  if (type === 'PLAYER') {
    return Math.round(250 + Math.pow(score / 100, 3) * 5000);
  }

  return Math.round(500 + Math.pow(score / 100, 3) * 8000);
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
  const metrics: AssetValuationMetrics = {
    fundamental: asset.fundamental || 50,
    popularity: asset.popularity || 50,
    worldCupLegacy: asset.worldCupLegacy || 50,
    marketDemand: asset.marketDemand || 50,
    momentum: asset.momentum || 50,
    age: asset.age || undefined,
    fifaRank: asset.fifaRank || 50,
  };

  if (asset.type === 'TEAM' && players) {
    const sorted = [...players].sort((a, b) => ((b.score || 50) - (a.score || 50)));
    const top11 = sorted.slice(0, 11);
    metrics.squadQuality = top11.reduce((sum, p) => sum + (p.score || 50), 0) / (top11.length || 1);
    return calculateTeamScore(metrics);
  }

  return calculatePlayerScore(metrics);
}
