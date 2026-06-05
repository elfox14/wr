import { Asset } from '@prisma/client';

/**
 * Recalculate team price based on recent match stats.
 * Similar to the logic suggested:
 * Win: +3%
 * Draw: +1%
 * Loss: -2%
 * Goal Difference: +0.5% per goal difference
 */
export function calculateNewPrice(asset: Asset, stats: { won: number, drawn: number, lost: number, goalsFor: number, goalsAgainst: number }, isEliminated: boolean = false): number {
  const basePrice = asset.current_price;

  let deltaPercent = 0.0;
  deltaPercent += stats.won * 3.0;
  deltaPercent += stats.drawn * 1.0;
  deltaPercent -= stats.lost * 2.0;

  const goalDiff = stats.goalsFor - stats.goalsAgainst;
  deltaPercent += goalDiff * 0.5;

  if (isEliminated) {
    deltaPercent -= 15.0; // 15% penalty for elimination
  }

  // Max cap the change between -50% and +50% per calculation cycle to prevent insane crashes
  deltaPercent = Math.max(-50.0, Math.min(50.0, deltaPercent));

  const newPrice = basePrice * (1 + deltaPercent / 100);
  return Math.max(1, Math.round(newPrice)); // Prevent dropping below 1
}
