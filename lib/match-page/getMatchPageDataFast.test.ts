import { describe, expect, it } from 'vitest';
import { approvedPostMatchContent, buildVerifiedMomentum, normalizePlayerStat } from './getMatchPageDataFast';

const home = { id: 'home', name: 'Home', code: 'HOM' } as any;
const away = { id: 'away', name: 'Away', code: 'AWY' } as any;

describe('verified match player normalization', () => {
  it('does not mark an unused substitute as played when participation is missing', () => {
    const player = normalizePlayerStat({ playerId: 'p1', playerName: 'Bench Player', teamId: 'home' }, home, away);
    expect(player?.started).toBeNull();
    expect(player?.played).toBeNull();
  });

  it('keeps starters and maps the complete available stat fields', () => {
    const player = normalizePlayerStat({
      playerId: 'p2',
      playerName: 'Starter',
      teamId: 'home',
      started: true,
      minutes: 90,
      expected_goals: 0.72,
      expected_assists: 0.31,
      blocked_shots: 2,
      accurate_crosses: 3,
      accurate_long_balls: 5,
      duels_won: 7,
      possession_lost: 9,
    }, home, away);

    expect(player?.played).toBe(true);
    expect(player?.expectedGoals).toBe(0.72);
    expect(player?.expectedAssists).toBe(0.31);
    expect(player?.blockedShots).toBe(2);
    expect(player?.accurateCrosses).toBe(3);
    expect(player?.accurateLongBalls).toBe(5);
    expect(player?.duelWon).toBe(7);
    expect(player?.possessionLost).toBe(9);
  });
});

describe('verified match momentum', () => {
  it('does not create momentum from insufficient shot data', () => {
    const momentum = buildVerifiedMomentum({}, [{ minute: 12, teamId: 'home', xg: 0.1 }] as any, home, away);
    expect(momentum).toEqual([]);
  });

  it('derives labelled momentum only from verified timed shots', () => {
    const momentum = buildVerifiedMomentum({}, [
      { minute: 12, teamId: 'home', xg: 0.4, isOnTarget: true },
      { minute: 18, teamId: 'away', xg: 0.2, isGoal: true },
    ] as any, home, away);

    expect(momentum.length).toBeGreaterThan(2);
    expect(momentum.every((point) => point.source === 'DERIVED_FROM_VERIFIED_SHOTS')).toBe(true);
    expect(momentum.reduce((sum, point) => sum + point.sampleSize, 0)).toBe(2);
  });

  it('prefers a provider momentum series when present', () => {
    const momentum = buildVerifiedMomentum({ momentum: [
      { minute: 5, home: 4, away: 2 },
      { minute: 10, home: 1, away: 5 },
    ] }, [], home, away);

    expect(momentum).toEqual([
      { minute: 5, home: 4, away: 2, source: 'PROVIDER', sampleSize: 1 },
      { minute: 10, home: 1, away: 5, source: 'PROVIDER', sampleSize: 1 },
    ]);
  });
});


describe('approved post-match coverage', () => {
  const article = {
    id: 'article-1',
    title: 'تحليل المباراة',
    excerpt: 'قراءة فنية موثقة',
    slug: 'match-analysis-1',
    publishedAt: new Date('2026-07-14T10:00:00Z'),
  };

  it('hides an infographic draft while keeping a published article visible', () => {
    const coverage = approvedPostMatchContent('match-1', {
      version: 2,
      status: 'DRAFT_READY',
      source: { snapshotId: 'snapshot-1' },
    }, [article]);

    expect(coverage.article?.slug).toBe('match-analysis-1');
    expect(coverage.infographic).toBeNull();
  });

  it('exposes only an approved infographic bound to a source snapshot', () => {
    const coverage = approvedPostMatchContent('match-1', {
      version: 2,
      status: 'APPROVED',
      approvedAt: '2026-07-14T11:00:00Z',
      source: { snapshotId: 'snapshot-1' },
    }, []);

    expect(coverage.article).toBeNull();
    expect(coverage.infographic).toEqual({
      href: '/match-center/match-1/infographic',
      approvedAt: '2026-07-14T11:00:00.000Z',
      sourceSnapshotId: 'snapshot-1',
    });
  });

  it('rejects legacy or source-less infographic payloads', () => {
    expect(approvedPostMatchContent('match-1', { status: 'APPROVED', approvedAt: '2026-07-14T11:00:00Z' }, []).infographic).toBeNull();
    expect(approvedPostMatchContent('match-1', { version: 2, status: 'APPROVED', approvedAt: '2026-07-14T11:00:00Z' }, []).infographic).toBeNull();
  });
});
