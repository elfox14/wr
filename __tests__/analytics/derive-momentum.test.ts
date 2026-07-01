import { deriveMomentum } from '@/lib/analytics/derive-momentum';
import type { MatchInsightsInput } from '@/lib/analytics/match-analytics.types';

describe('deriveMomentum', () => {
  const baseInput: MatchInsightsInput = {
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    stats: [],
    momentum: [],
    xgFlow: [],
    events: [],
    shots: [],
    minute: 90,
  };

  it('اختبار 1: عند possession=70 للمضيف → segments تكون label=home', () => {
    const input = { ...baseInput, homePossession: 70 };
    const segments = deriveMomentum(input);
    expect(segments.length).toBeGreaterThan(0);
    segments.forEach(seg => {
      expect(seg.label).toBe('home');
      expect(seg.value).toBeGreaterThan(0);
    });
  });

  it('اختبار 2: القيم دائماً بين -1 و+1', () => {
    const input = {
      ...baseInput,
      shots: [
        { id: '1', minute: 10, team: 'home', x: 0, y: 0, xg: 2.0, outcome: 'onTarget', insideBox: true },
        { id: '2', minute: 12, team: 'away', x: 0, y: 0, xg: 5.0, outcome: 'goal', insideBox: true },
      ] as any[],
    };
    const segments = deriveMomentum(input);
    segments.forEach(seg => {
      expect(seg.value).toBeGreaterThanOrEqual(-1);
      expect(seg.value).toBeLessThanOrEqual(1);
    });
  });

  it('اختبار 3: عدد الـ segments = Math.ceil(minute/15)', () => {
    const input1 = { ...baseInput, minute: 45 };
    expect(deriveMomentum(input1)).toHaveLength(3); // 45 / 15 = 3

    const input2 = { ...baseInput, minute: 90 };
    expect(deriveMomentum(input2)).toHaveLength(6); // 90 / 15 = 6

    const input3 = { ...baseInput, minute: 95 };
    expect(deriveMomentum(input3)).toHaveLength(7); // Math.ceil(95 / 15) = 7
  });
});
