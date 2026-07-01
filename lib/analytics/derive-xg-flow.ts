import type { MatchInsightsInput } from './match-analytics.types';

export interface XgFlowPoint {
  minute: number;
  homeXg: number;
  awayXg: number;
  /** cumulative xG for home side up to this minute */
  homeCumulative: number;
  /** cumulative xG for away side up to this minute */
  awayCumulative: number;
}

/**
 * Derives a per-minute xG flow timeline from shot events.
 * Falls back to a linear interpolation when granular shot data is unavailable.
 */
export function deriveXgFlow(
  insights: MatchInsightsInput
): XgFlowPoint[] {
  const { homeTeam, awayTeam, shots } = insights;

  // If per-shot timeline is available, build from it
  if (shots && shots.length > 0) {
    const sorted = [...shots].sort((a, b) => a.minute - b.minute);
    const points: XgFlowPoint[] = [];
    let homeCum = 0;
    let awayCum = 0;

    for (const shot of sorted) {
      const isHome = shot.teamId === homeTeam.id;
      const xgValue = shot.xg ?? 0;
      if (isHome) homeCum += xgValue;
      else awayCum += xgValue;

      points.push({
        minute: shot.minute,
        homeXg: isHome ? xgValue : 0,
        awayXg: isHome ? 0 : xgValue,
        homeCumulative: homeCum,
        awayCumulative: awayCum,
      });
    }

    return points;
  }

  // Fallback: interpolate from aggregate xG over 90 minutes
  const totalMinutes = insights.minute ?? 90;
  const homeTotal = insights.homeXg ?? 0;
  const awayTotal = insights.awayXg ?? 0;
  const steps = 10;
  const interval = Math.floor(totalMinutes / steps);

  const fallback: XgFlowPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const fraction = i / steps;
    fallback.push({
      minute: i * interval,
      homeXg: homeTotal / steps,
      awayXg: awayTotal / steps,
      homeCumulative: parseFloat((homeTotal * fraction).toFixed(2)),
      awayCumulative: parseFloat((awayTotal * fraction).toFixed(2)),
    });
  }

  return fallback;
}
