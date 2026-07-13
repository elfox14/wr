export type EmbeddedHeatmapEndpoint = 'playerStats' | 'lineups';

export type EmbeddedProviderHeatmap = {
  playerId: string | null;
  playerName: string | null;
  teamId: string | null;
  teamName: string | null;
  side?: 'home' | 'away';
  source: 'PROVIDER_HEATMAP';
  sourceEndpoint: EmbeddedHeatmapEndpoint;
  points: Array<{ x: number; y: number; count?: number }>;
};

const HEATMAP_FIELDS = ['heatmap', 'heat_map', 'player_heatmap', 'playerHeatmap', 'touch_map', 'touchMap', 'positions', 'coordinates'];

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const candidate = String(value).trim();
    if (candidate) return candidate;
  }
  return null;
}

function number(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinate(value: unknown) {
  const parsed = number(value);
  if (parsed === null) return null;
  if (parsed >= 0 && parsed <= 1) return Number((parsed * 100).toFixed(3));
  if (parsed >= 0 && parsed <= 100) return Number(parsed.toFixed(3));
  return null;
}

function pointArray(value: any) {
  const roots = [value, value?.data, value?.points, value?.coordinates, value?.positions, value?.items].filter(Boolean);
  for (const root of roots) {
    if (!Array.isArray(root)) continue;
    const points = root.map((item: any) => ({
      x: coordinate(item?.x ?? item?.pitchX ?? item?.pitch_x ?? item?.location?.x ?? item?.coordinates?.x),
      y: coordinate(item?.y ?? item?.pitchY ?? item?.pitch_y ?? item?.location?.y ?? item?.coordinates?.y),
      count: number(item?.count ?? item?.value ?? item?.weight) ?? undefined,
    })).filter((point: any) => point.x !== null && point.y !== null);
    if (points.length) return points as Array<{ x: number; y: number; count?: number }>;
  }
  return [];
}

function identity(row: any) {
  const player = row?.player || row?.athlete || row;
  const team = row?.team || {};
  return {
    playerId: text(player?.id, row?.player_id, row?.playerId),
    playerName: text(player?.name, row?.player_name, row?.playerName, row?.name),
    teamId: text(team?.id, row?.team_id, row?.teamId),
    teamName: text(team?.name, row?.team_name, row?.teamName),
  };
}

export function extractEmbeddedProviderHeatmaps(payload: any, sourceEndpoint: EmbeddedHeatmapEndpoint) {
  const heatmaps: EmbeddedProviderHeatmap[] = [];
  const seenObjects = new WeakSet<object>();
  const seenPlayers = new Set<string>();

  function visit(value: any, context: { side?: 'home' | 'away'; playerId?: string | null; playerName?: string | null; teamId?: string | null; teamName?: string | null } = {}, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 10) return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);

    if (Array.isArray(value)) {
      for (const item of value.slice(0, 2000)) visit(item, context, depth + 1);
      return;
    }

    const current = identity(value);
    const player = {
      playerId: current.playerId || context.playerId || null,
      playerName: current.playerName || context.playerName || null,
      teamId: current.teamId || context.teamId || null,
      teamName: current.teamName || context.teamName || null,
    };
    for (const field of HEATMAP_FIELDS) {
      if (!(field in value)) continue;
      const points = pointArray(value[field]);
      if (!points.length || (!player.playerId && !player.playerName)) continue;
      const playerKey = player.playerId ? `id:${player.playerId}` : `name:${String(player.playerName).toLowerCase()}`;
      if (seenPlayers.has(playerKey)) continue;
      seenPlayers.add(playerKey);
      heatmaps.push({ ...player, side: context.side, source: 'PROVIDER_HEATMAP', sourceEndpoint, points });
    }

    for (const [field, child] of Object.entries(value)) {
      if (HEATMAP_FIELDS.includes(field)) continue;
      const side = /^(home|home_team|homeTeam)$/i.test(field)
        ? 'home'
        : /^(away|away_team|awayTeam)$/i.test(field)
          ? 'away'
          : context.side;
      visit(child, { ...player, side }, depth + 1);
    }
  }

  visit(payload);
  return heatmaps;
}
