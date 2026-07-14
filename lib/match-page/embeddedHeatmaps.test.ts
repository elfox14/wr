import { describe, expect, it } from 'vitest';
import { extractEmbeddedProviderHeatmaps } from './embeddedHeatmaps';

describe('embedded provider heatmaps', () => {
  it('reads a heatmap nested in player statistics', () => {
    const result = extractEmbeddedProviderHeatmaps({
      data: {
        players: [{
          player: { id: 'p1', name: 'Player One' },
          team: { id: 'home' },
          statistics: {
            heatmap: { points: [{ x: 22, y: 64, count: 2 }, { x: 101, y: 20 }] },
          },
        }],
      },
    }, 'playerStats');

    expect(result).toEqual([expect.objectContaining({
      playerId: 'p1',
      playerName: 'Player One',
      teamId: 'home',
      source: 'PROVIDER_HEATMAP',
      sourceEndpoint: 'playerStats',
      points: [{ x: 22, y: 64, count: 2 }],
    })]);
  });

  it('reads lineup heatmaps and normalizes zero-to-one coordinates', () => {
    const result = extractEmbeddedProviderHeatmaps({
      data: {
        home: {
          starting_xi: [{
            player_id: 'p2',
            name: 'Player Two',
            heat_map: [{ x: 0.4, y: 0.75 }, { x: -1, y: 0.2 }],
          }],
        },
      },
    }, 'lineups');

    expect(result[0]).toEqual(expect.objectContaining({
      playerId: 'p2',
      side: 'home',
      points: [{ x: 40, y: 75, count: undefined }],
    }));
  });

  it('does not manufacture a map when no coordinate array exists', () => {
    expect(extractEmbeddedProviderHeatmaps({
      data: { home: { starting_xi: [{ player_id: 'p3', name: 'No Map', touches: 52 }] } },
    }, 'lineups')).toEqual([]);
  });
});
