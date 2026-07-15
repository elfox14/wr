import { hasUsablePlayerImage } from '@/lib/playerDedupe';

export type StatisticsPlayerRow = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  teamId: string | null;
  teamName: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  ratingTotal: number;
  ratingCount: number;
};

export type StatisticsEventPlayer = {
  name: string;
  teamId?: string | null;
  teamName?: string | null;
};

const AGGREGATE_FIELDS = [
  'minutes',
  'goals',
  'assists',
  'shots',
  'shotsOnTarget',
  'keyPasses',
  'tackles',
  'interceptions',
  'saves',
  'goalsConceded',
  'yellowCards',
  'redCards',
] as const satisfies ReadonlyArray<keyof StatisticsPlayerRow>;

function stripAccents(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeStatisticsPlayerText(value?: string | null) {
  return stripAccents(String(value || ''))
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usableTeamName(value?: string | null) {
  const normalized = normalizeStatisticsPlayerText(value);
  return normalized && normalized !== '—' && normalized !== '-' ? normalized : '';
}

function sameKnownTeam(a: StatisticsEventPlayer, b: StatisticsEventPlayer) {
  if (a.teamId && b.teamId) return a.teamId === b.teamId;
  const aTeam = usableTeamName(a.teamName);
  const bTeam = usableTeamName(b.teamName);
  if (aTeam && bTeam) return aTeam === bTeam;
  return true;
}

function samePlayerIdentity(a: StatisticsEventPlayer, b: StatisticsEventPlayer) {
  const aName = normalizeStatisticsPlayerText(a.name);
  const bName = normalizeStatisticsPlayerText(b.name);
  return Boolean(aName && bName && aName === bName && sameKnownTeam(a, b));
}

export function findStatisticsPlayer(
  players: Map<string, StatisticsPlayerRow>,
  identity: StatisticsEventPlayer,
) {
  const normalizedName = normalizeStatisticsPlayerText(identity.name);
  if (!normalizedName) return null;

  const candidates = [...players.values()].filter(
    (player) => normalizeStatisticsPlayerText(player.name) === normalizedName,
  );
  if (!candidates.length) return null;

  if (identity.teamId) {
    const exactTeam = candidates.find((player) => player.teamId === identity.teamId);
    if (exactTeam) return exactTeam;
  }

  const normalizedTeam = usableTeamName(identity.teamName);
  if (normalizedTeam) {
    const exactTeamName = candidates.find(
      (player) => usableTeamName(player.teamName) === normalizedTeam,
    );
    if (exactTeamName) return exactTeamName;
  }

  return candidates.length === 1 ? candidates[0] : null;
}

export function ensureStatisticsEventPlayer(
  players: Map<string, StatisticsPlayerRow>,
  identity: StatisticsEventPlayer,
) {
  const existing = findStatisticsPlayer(players, identity);
  if (existing) return existing;

  const normalizedName = normalizeStatisticsPlayerText(identity.name) || 'unknown-player';
  const teamKey = identity.teamId || usableTeamName(identity.teamName) || 'unknown-team';
  const id = `event:${teamKey}:${normalizedName}`;
  const created: StatisticsPlayerRow = {
    id,
    name: identity.name,
    code: null,
    image: null,
    teamId: identity.teamId || null,
    teamName: identity.teamName || '—',
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    keyPasses: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 0,
    redCards: 0,
    ratingTotal: 0,
    ratingCount: 0,
  };
  players.set(id, created);
  return created;
}

function mergeStatisticsPlayerRows(a: StatisticsPlayerRow, b: StatisticsPlayerRow) {
  const aHasImage = hasUsablePlayerImage(a.image);
  const bHasImage = hasUsablePlayerImage(b.image);
  const preferred = bHasImage && !aHasImage ? b : a;
  const fallback = preferred === a ? b : a;
  const ratingSource = b.ratingCount > a.ratingCount ? b : a;

  const merged: StatisticsPlayerRow = {
    ...fallback,
    ...preferred,
    id: preferred.id || fallback.id,
    name: preferred.name || fallback.name,
    code: preferred.code || fallback.code,
    image: hasUsablePlayerImage(preferred.image)
      ? preferred.image
      : hasUsablePlayerImage(fallback.image)
        ? fallback.image
        : null,
    teamId: preferred.teamId || fallback.teamId,
    teamName: usableTeamName(preferred.teamName) ? preferred.teamName : fallback.teamName,
    ratingTotal: ratingSource.ratingTotal,
    ratingCount: ratingSource.ratingCount,
  };

  for (const field of AGGREGATE_FIELDS) {
    merged[field] = Math.max(Number(a[field] || 0), Number(b[field] || 0));
  }

  return merged;
}

export function dedupeStatisticsPlayers(players: StatisticsPlayerRow[]) {
  const result: StatisticsPlayerRow[] = [];

  for (const player of players) {
    const existingIndex = result.findIndex((candidate) => samePlayerIdentity(candidate, player));
    if (existingIndex === -1) result.push(player);
    else result[existingIndex] = mergeStatisticsPlayerRows(result[existingIndex], player);
  }

  return result;
}
