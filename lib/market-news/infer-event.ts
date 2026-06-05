// lib/market-news/infer-event.ts

/**
 * Infer the most appropriate event type based on match context.
 * Returns null if the change is too small to warrant a news item.
 */
export function inferEventType(params: {
  changePercent: number;
  qualified?: boolean;
  eliminated?: boolean;
  upsetWin?: boolean;
  consecutiveGains?: number;
  consecutiveLosses?: number;
}): string | null {
  // Structural events take priority
  if (params.qualified) return 'qualification';
  if (params.eliminated) return 'elimination';
  if (params.upsetWin) return 'upset_win';

  // Streak events
  if (params.consecutiveGains && params.consecutiveGains >= 3) return 'strong_rally';
  if (params.consecutiveLosses && params.consecutiveLosses >= 3) return 'sharp_selloff';

  // Price-based events (only if change >= 2% in either direction)
  if (params.changePercent >= 2) return 'price_spike';
  if (params.changePercent <= -2) return 'price_drop';

  return null;
}
