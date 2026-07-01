import { deriveXgFlow } from '@/lib/analytics/derive-xg-flow';
import type { MatchInsightsInput } from '@/lib/analytics/match-analytics.types';

describe('deriveXgFlow', () => {
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

  it('اختبار 1: fallback عند غياب shots يُعيد 10 نقاط', () => {
    const input = { ...baseInput, homeXg: 1.5, awayXg: 0.8 };
    const flow = deriveXgFlow(input);
    expect(flow).toHaveLength(10);
    expect(flow[9].homeCumulative).toBeCloseTo(1.5, 1);
    expect(flow[9].awayCumulative).toBeCloseTo(0.8, 1);
  });

  it('اختبار 2: عند وجود shots يُرتّبها بالدقيقة ويحسب cumulative صحيح', () => {
    const input = {
      ...baseInput,
      shots: [
        { id: '2', minute: 20, team: 'home', x: 0, y: 0, xg: 0.3, outcome: 'onTarget', insideBox: true },
        { id: '1', minute: 10, team: 'home', x: 0, y: 0, xg: 0.5, outcome: 'goal', insideBox: true },
        { id: '3', minute: 15, team: 'away', x: 0, y: 0, xg: 0.2, outcome: 'miss', insideBox: false } as any,
      ],
    };
    const flow = deriveXgFlow(input);
    expect(flow).toHaveLength(3);
    
    // Ordered by minute
    expect(flow[0].minute).toBe(10);
    expect(flow[1].minute).toBe(15);
    expect(flow[2].minute).toBe(20);

    // Cumulative check
    expect(flow[0].homeCumulative).toBeCloseTo(0.5);
    expect(flow[1].homeCumulative).toBeCloseTo(0.5);
    expect(flow[2].homeCumulative).toBeCloseTo(0.8);

    expect(flow[0].awayCumulative).toBeCloseTo(0);
    expect(flow[1].awayCumulative).toBeCloseTo(0.2);
    expect(flow[2].awayCumulative).toBeCloseTo(0.2);
  });

  it('اختبار 3: homeCumulative وawayCumulative لا تتناقص أبداً', () => {
    const input = {
      ...baseInput,
      shots: [
        { id: '1', minute: 10, team: 'home', x: 0, y: 0, xg: 0.1, outcome: 'onTarget', insideBox: true },
        { id: '2', minute: 25, team: 'away', x: 0, y: 0, xg: 0.3, outcome: 'onTarget', insideBox: true },
        { id: '3', minute: 40, team: 'home', x: 0, y: 0, xg: 0.4, outcome: 'onTarget', insideBox: true },
        { id: '4', minute: 70, team: 'away', x: 0, y: 0, xg: 0.05, outcome: 'onTarget', insideBox: true },
      ] as any[],
    };
    const flow = deriveXgFlow(input);
    for (let i = 1; i < flow.length; i++) {
      expect(flow[i].homeCumulative).toBeGreaterThanOrEqual(flow[i - 1].homeCumulative);
      expect(flow[i].awayCumulative).toBeGreaterThanOrEqual(flow[i - 1].awayCumulative);
    }
  });
});
