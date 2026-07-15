import { describe, expect, it } from 'vitest';
import {
  dedupeStatisticsPlayers,
  ensureStatisticsEventPlayer,
  type StatisticsPlayerRow,
} from './statisticsPlayerDedupe';

function player(overrides: Partial<StatisticsPlayerRow> = {}): StatisticsPlayerRow {
  return {
    id: 'player-1',
    name: 'Kylian Mbappé',
    code: null,
    image: 'https://cdn.example.com/players/mbappe.png',
    teamId: 'france',
    teamName: 'فرنسا',
    minutes: 500,
    goals: 8,
    assists: 1,
    shots: 20,
    shotsOnTarget: 12,
    keyPasses: 8,
    tackles: 1,
    interceptions: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 0,
    redCards: 0,
    ratingTotal: 42,
    ratingCount: 6,
    ...overrides,
  };
}

describe('statistics player deduplication', () => {
  it('matches an accent-free event name to the real player row', () => {
    const realPlayer = player();
    const players = new Map([[realPlayer.id, realPlayer]]);

    const matched = ensureStatisticsEventPlayer(players, {
      name: 'Kylian Mbappe',
      teamId: 'france',
      teamName: 'France',
    });

    expect(matched.id).toBe('player-1');
    expect(players).toHaveLength(1);
  });

  it('keeps one pictured row and never adds duplicate totals together', () => {
    const rows = dedupeStatisticsPlayers([
      player(),
      player({
        id: 'event:france:kylian mbappe',
        name: 'Kylian Mbappe',
        image: null,
        minutes: 0,
        goals: 8,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        ratingTotal: 0,
        ratingCount: 0,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('player-1');
    expect(rows[0].image).toContain('/players/');
    expect(rows[0].goals).toBe(8);
  });

  it('does not merge identical names from different teams', () => {
    const rows = dedupeStatisticsPlayers([
      player({ id: 'team-a-player', teamId: 'team-a', teamName: 'Team A' }),
      player({ id: 'team-b-player', teamId: 'team-b', teamName: 'Team B' }),
    ]);

    expect(rows).toHaveLength(2);
  });
});
