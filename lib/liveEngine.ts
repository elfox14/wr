// lib/liveEngine.ts

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | string;

export type MatchEvent = 
  | 'GOAL' 
  | 'ASSIST' 
  | 'RED_CARD' 
  | 'YELLOW_CARD' 
  | 'PENALTY_MISS' 
  | 'PENALTY_SAVE' 
  | 'OWN_GOAL' 
  | 'CLEAN_SHEET'
  | 'BIG_CHANCE_MISSED'
  | 'GOAL_LINE_CLEARANCE';

/**
 * Calculates the percentage price spike based on an event and player position.
 * Returns a float representing the multiplier (e.g., 1.10 for +10%, 0.85 for -15%).
 */
export function calculateSpike(event: MatchEvent, position: Position): number {
  switch (event) {
    case 'GOAL':
      if (position === 'GK') return 1.50; // Goalie scoring is legendary (+50%)
      if (position === 'DEF') return 1.20; // +20%
      if (position === 'MID') return 1.15; // +15%
      return 1.10; // FWD: +10%

    case 'ASSIST':
      if (position === 'DEF') return 1.10; // +10%
      return 1.05; // Others: +5%

    case 'PENALTY_SAVE':
      if (position === 'GK') return 1.15; // +15%
      return 1.0;

    case 'GOAL_LINE_CLEARANCE':
      if (position === 'DEF') return 1.10; // +10%
      return 1.0;

    case 'CLEAN_SHEET':
      if (position === 'GK') return 1.05; // +5%
      if (position === 'DEF') return 1.05; // +5%
      return 1.0;

    case 'RED_CARD':
      return 0.85; // Universal -15%

    case 'OWN_GOAL':
      return 0.90; // Universal -10%

    case 'PENALTY_MISS':
      if (position === 'FWD') return 0.85; // -15%
      return 0.90; // Others -10%

    case 'BIG_CHANCE_MISSED':
      if (position === 'FWD') return 0.95; // -5%
      return 1.0;

    case 'YELLOW_CARD':
      return 0.98; // -2%

    default:
      return 1.0;
  }
}

/**
 * Translates a rating change (e.g. from 6.0 to 7.5) into a percentage multiplier.
 * Every 0.1 rating increase = 1% price increase.
 * E.g., 6.0 -> 7.5 is +1.5 points = +15%.
 */
export function calculateRatingChange(oldRating: number, newRating: number): number {
  const diff = newRating - oldRating;
  // diff = 1.5 -> 15% increase -> multiplier = 1.15
  const percentChange = diff * 0.10; // 1.5 * 0.10 = 0.15
  return 1 + percentChange; 
}

/**
 * Enforces the Daily Volatility Limit (Circuit Breaker).
 * - Blue Chips (riskIndex 0.0): Max ±10%
 * - High Risk (riskIndex 1.0): Max ±25%
 * Interpolates based on riskIndex.
 * 
 * @param startOfDayPrice The price of the asset at the start of the match/day.
 * @param calculatedNewPrice The requested new price after spikes and AMM FOMO.
 * @param riskIndex 0.0 to 1.0
 * @returns The actual allowed new price.
 */
export function applyVolatilityCap(startOfDayPrice: number, calculatedNewPrice: number, riskIndex: number = 0.5): number {
  if (startOfDayPrice <= 0) return calculatedNewPrice;

  // Max Limit = 10% + (riskIndex * 15%)
  // So risk=0 -> 0.10, risk=1 -> 0.25
  const maxLimitPercent = 0.10 + (riskIndex * 0.15);

  const maxPrice = Math.round(startOfDayPrice * (1 + maxLimitPercent));
  const minPrice = Math.round(startOfDayPrice * (1 - maxLimitPercent));

  if (calculatedNewPrice > maxPrice) return maxPrice;
  if (calculatedNewPrice < minPrice) return Math.max(1, minPrice); // Never drop below 1 coin

  return Math.round(calculatedNewPrice);
}
