import type { MatchInsightsInput } from './match-analytics.types';

export interface MomentumSegment {
  /** Start minute of this segment (inclusive) */
  fromMinute: number;
  /** End minute of this segment (exclusive) */
  toMinute: number;
  /**
   * Momentum value: positive = home advantage, negative = away advantage.
   * Range: roughly -1.0 to +1.0
   */
  value: number;
  label: 'home' | 'away' | 'neutral';
}

const SEGMENT_SIZE = 15; // minutes per segment

/**
 * Derives match momentum in 15-minute windows.
 * Uses shots, dangerous attacks, and possession as signals.
 * Falls back to a basic possession-based derivation.
 */
export function deriveMomentum(
  insights: MatchInsightsInput
): MomentumSegment[] {
  const totalMinutes = insights.minute ?? 90;
  const segments: MomentumSegment[] = [];
  const numSegments = Math.ceil(totalMinutes / SEGMENT_SIZE);

  for (let i = 0; i < numSegments; i++) {
    const from = i * SEGMENT_SIZE;
    const to = Math.min((i + 1) * SEGMENT_SIZE, totalMinutes);

    // Try to compute from shot events in this window
    const windowShots = insights.shots?.filter(
      (s) => s.minute >= from && s.minute < to
    ) ?? [];

    let value = 0;

    if (windowShots.length > 0) {
      const homeShots = windowShots.filter(
        (s) => s.teamId === insights.homeTeam.id
      );
      const awayShots = windowShots.length - homeShots.length;
      const homeXgSum = homeShots.reduce((acc, s) => acc + (s.xg ?? 0), 0);
      const awayXgSum = windowShots
        .filter((s) => s.teamId !== insights.homeTeam.id)
        .reduce((acc, s) => acc + (s.xg ?? 0), 0);

      const totalXg = homeXgSum + awayXgSum;
      if (totalXg > 0) {
        value = (homeXgSum - awayXgSum) / totalXg;
      } else {
        value = (homeShots.length - awayShots) / Math.max(windowShots.length, 1);
      }
    } else {
      // Fallback: use possession
      const homePoss = insights.homePossession ?? 50;
      value = (homePoss - 50) / 50; // normalise to [-1, +1]
    }

    const clampedValue = Math.max(-1, Math.min(1, value));

    segments.push({
      fromMinute: from,
      toMinute: to,
      value: parseFloat(clampedValue.toFixed(3)),
      label: clampedValue > 0.1 ? 'home' : clampedValue < -0.1 ? 'away' : 'neutral',
    });
  }

  return segments;
}
