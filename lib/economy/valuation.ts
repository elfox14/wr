export interface AssetValuationMetrics {
  fundamental: number;
  popularity: number;
  worldCupLegacy: number;
  marketDemand: number;
  momentum: number;
  fifaRank?: number;
  squadQuality?: number;
}

/**
 * Calculates the fair value of a PLAYER based on the 5-pillar valuation system.
 * Weights:
 * - 35% Fundamental (Current football quality)
 * - 20% Popularity (Global fan popularity)
 * - 15% World Cup Legacy (Historical achievements)
 * - 20% Market Demand (Trading activity)
 * - 10% Momentum (Recent events/performance)
 */
export function calculatePlayerScore(metrics: AssetValuationMetrics): number {
  const score = 
    (metrics.fundamental * 0.35) +
    (metrics.popularity * 0.20) +
    (metrics.worldCupLegacy * 0.15) +
    (metrics.marketDemand * 0.20) +
    (metrics.momentum * 0.10);
  
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Calculates the fair value of a TEAM based on an independent model.
 * Teams must NOT derive their value directly from player prices.
 * Weights:
 * - 40% FIFA Rank (Inverted, rank 1 = 100, rank 50 = 0)
 * - 25% Squad Quality (Fundamental quality of the roster)
 * - 20% World Cup Legacy
 * - 15% Popularity
 */
export function calculateTeamScore(metrics: AssetValuationMetrics): number {
  // Assuming fifaRank is provided. If rank 1 -> 100 points. If rank 100 -> 0 points.
  const rankScore = Math.max(100 - (metrics.fifaRank || 50), 0);
  const squadQuality = metrics.squadQuality || metrics.fundamental;

  const score = 
    (rankScore * 0.40) +
    (squadQuality * 0.25) +
    (metrics.worldCupLegacy * 0.20) +
    (metrics.popularity * 0.15);

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Converts a calculated score (0-100) into a Fair Value price in virtual credits.
 * Base conversion factor: 1 score point = 50 credits (Example mapping)
 * Can be adjusted based on platform inflation/economy balance.
 */
export function calculateFairValue(score: number, type: 'TEAM' | 'PLAYER'): number {
  // As per recommendation:
  // Players: 500 - 5000 Credits
  // Teams: 1000 - 8000 Credits
  
  if (type === 'PLAYER') {
    // Score 0 -> 500, Score 100 -> 5000
    const minPrice = 500;
    const maxPrice = 5000;
    return Math.round(minPrice + (score / 100) * (maxPrice - minPrice));
  } else {
    // Score 0 -> 1000, Score 100 -> 8000
    const minPrice = 1000;
    const maxPrice = 8000;
    return Math.round(minPrice + (score / 100) * (maxPrice - minPrice));
  }
}
