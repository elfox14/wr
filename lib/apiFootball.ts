type ApiFootballParams = Record<string, string | number | boolean | undefined | null>;

type Provider = 'ISPORTS' | 'API_FOOTBALL';

export class ApiFootballError extends Error {
  status?: number;
  payload?: unknown;
  keyIndex?: number;

  constructor(message: string, status?: number, payload?: unknown, keyIndex?: number) {
    super(message);
    this.name = 'ApiFootballError';
    this.status = status;
    this.payload = payload;
    this.keyIndex = keyIndex;
  }
}

function getProvider(): Provider {
  if (process.env.ISPORTS_API_KEY || process.env.ISPORTS_API_KEYS) return 'ISPORTS';
  return 'API_FOOTBALL';
}

function getBaseUrl(provider: Provider) {
  if (provider === 'ISPORTS') return process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com';
  return process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
}

function splitKeys(value?: string) {
  return value
    ?.split(',')
    .map((key) => key.trim())
    .filter(Boolean) || [];
}

function getApiKeys(provider: Provider) {
  if (provider === 'ISPORTS') {
    const keyPool = splitKeys(process.env.ISPORTS_API_KEYS);
    if (keyPool.length > 0) return keyPool;
    return [process.env.ISPORTS_API_KEY].filter(Boolean) as string[];
  }

  const keyPool = splitKeys(process.env.API_FOOTBALL_KEYS);
  if (keyPool.length > 0) return keyPool;
  return [process.env.API_FOOTBALL_KEY].filter(Boolean) as string[];
}

function mapIsportsPath(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (cleanPath === '/fixtures') return '/sport/football/schedule';
  if (cleanPath === '/fixtures/players') return '/sport/football/playerstats/match';
  if (cleanPath === '/livescores') return '/sport/football/livescores';
  if (cleanPath === '/analysis') return '/sport/football/analysis';
  if (cleanPath === '/leagues') return '/sport/football/league/basic';
  if (cleanPath === '/lineups') return '/sport/football/lineups';

  return cleanPath;
}

function mapIsportsParams(path: string, params: ApiFootballParams = {}, apiKey: string) {
  const mapped: ApiFootballParams = { api_key: apiKey };
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (path === '/fixtures/players' && key === 'fixture') {
      mapped.matchId = value;
      return;
    }

    if (path === '/analysis' && key === 'fixture') {
      mapped.matchId = value;
      return;
    }

    mapped[key] = value;
  });
  return mapped;
}

function buildUrl(provider: Provider, path: string, params: ApiFootballParams = {}, apiKey?: string) {
  const cleanPath = provider === 'ISPORTS'
    ? mapIsportsPath(path)
    : (path.startsWith('/') ? path : `/${path}`);

  const url = new URL(`${getBaseUrl(provider)}${cleanPath}`);
  const finalParams = provider === 'ISPORTS'
    ? mapIsportsParams(path.startsWith('/') ? path : `/${path}`, params, apiKey || '')
    : params;

  Object.entries(finalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function hasProviderErrors(payload: any, provider: Provider) {
  if (provider === 'ISPORTS') {
    const code = payload?.code ?? payload?.status_code ?? payload?.status;
    if (code === undefined || code === null) return Boolean(payload?.error || payload?.errors);
    return Number(code) !== 0 && Number(code) !== 200 && String(code).toLowerCase() !== 'success';
  }

  if (!payload?.errors) return false;
  if (Array.isArray(payload.errors)) return payload.errors.length > 0;
  if (typeof payload.errors === 'object') return Object.keys(payload.errors).length > 0;
  return Boolean(payload.errors);
}

function getProviderErrorPayload(payload: any, provider: Provider) {
  if (provider === 'ISPORTS') {
    return payload?.message || payload?.msg || payload?.error || payload?.errors || payload;
  }
  return payload?.errors;
}

function isQuotaOrRateLimitError(status: number, payload: any) {
  if (status === 429) return true;
  const text = JSON.stringify(payload || {}).toLowerCase();
  return text.includes('rate') || text.includes('limit') || text.includes('quota') || text.includes('requests');
}

function getArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.playerStats)) return payload.playerStats;
  return [];
}

function normalizeIsportsFixture(item: any) {
  const fixtureId = Number(item.matchId ?? item.match_id ?? item.id ?? item.fixtureId ?? item.fixture_id);
  const homeName = item.homeName || item.home_name || item.homeTeamName || item.home_team_name || item.homeTeam?.name || item.home?.name;
  const awayName = item.awayName || item.away_name || item.awayTeamName || item.away_team_name || item.awayTeam?.name || item.away?.name;
  const homeId = item.homeId || item.home_id || item.homeTeamId || item.home_team_id || item.homeTeam?.id || item.home?.id;
  const awayId = item.awayId || item.away_id || item.awayTeamId || item.away_team_id || item.awayTeam?.id || item.away?.id;
  const homeLogo = item.homeLogo || item.home_logo || item.homeTeam?.logo || item.home?.logo;
  const awayLogo = item.awayLogo || item.away_logo || item.awayTeam?.logo || item.away?.logo;
  const matchTime = item.matchTime || item.match_time || item.date || item.time || item.kickoffTime || item.startTime;

  return {
    fixture: {
      id: fixtureId,
      date: matchTime,
      timestamp: item.timestamp,
      status: {
        short: item.status || item.statusCode || item.status_code || item.matchStatus || item.match_status,
        long: item.statusName || item.status_name || item.status || item.matchStatus,
      },
    },
    league: {
      id: item.leagueId || item.league_id || item.competitionId || item.competition_id,
      name: item.leagueName || item.league_name || item.competitionName || item.competition_name || item.league?.name,
      country: item.country || item.countryName || item.country_name,
      season: item.season,
      round: item.round || item.roundName || item.round_name,
    },
    teams: {
      home: { id: homeId, name: homeName, logo: homeLogo },
      away: { id: awayId, name: awayName, logo: awayLogo },
    },
    goals: {
      home: item.homeScore ?? item.home_score ?? item.homeGoals ?? item.home_goals ?? item.score?.home,
      away: item.awayScore ?? item.away_score ?? item.awayGoals ?? item.away_goals ?? item.score?.away,
    },
    score: item.score,
    raw: item,
  };
}

function toNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeIsportsPlayerStats(item: any) {
  const player = item.player || item.playerInfo || {};
  const team = item.team || {};
  const games = item.games || item.match || {};
  const goals = item.goals || {};
  const shots = item.shots || {};
  const passes = item.passes || {};
  const tackles = item.tackles || item.defense || {};
  const cards = item.cards || {};

  const playerId = player.id ?? item.playerId ?? item.player_id ?? item.id;
  const playerName = player.name ?? item.playerName ?? item.player_name ?? item.name;
  const teamName = team.name ?? item.teamName ?? item.team_name;

  return {
    player: {
      id: playerId == null ? undefined : Number(playerId),
      name: playerName,
    },
    statistics: [{
      team: { name: teamName, id: team.id ?? item.teamId ?? item.team_id },
      games: {
        minutes: item.minutes ?? item.playedMinutes ?? item.played_minutes ?? games.minutes,
        position: item.position ?? games.position,
        captain: item.captain ?? games.captain,
        lineups: item.lineups ?? item.started ?? item.isStart ?? item.is_start ?? games.lineups,
        rating: item.rating ?? item.score ?? games.rating,
      },
      goals: {
        total: item.goals ?? item.goal ?? goals.total,
        assists: item.assists ?? item.assist ?? goals.assists,
        conceded: item.goalsConceded ?? item.goals_conceded ?? goals.conceded,
        saves: item.saves ?? goals.saves,
      },
      shots: {
        total: item.shotsTotal ?? item.shots_total ?? shots.total,
        on: item.shotsOnTarget ?? item.shots_on_target ?? shots.on,
      },
      passes: {
        total: item.passes ?? item.passesTotal ?? item.passes_total ?? passes.total,
        key: item.keyPasses ?? item.key_passes ?? passes.key,
        accuracy: item.passAccuracy ?? item.pass_accuracy ?? passes.accuracy,
      },
      tackles: {
        total: item.tackles ?? item.tacklesTotal ?? item.tackles_total ?? tackles.total,
        interceptions: item.interceptions ?? tackles.interceptions,
      },
      cards: {
        yellow: item.yellowCards ?? item.yellow_cards ?? cards.yellow,
        red: item.redCards ?? item.red_cards ?? cards.red,
      },
      raw: item,
    }],
  };
}

function normalizeIsportsPayload(path: string, payload: any) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const items = getArrayPayload(payload);

  if (cleanPath === '/fixtures') {
    return { ...payload, response: items.map(normalizeIsportsFixture) };
  }

  if (cleanPath === '/fixtures/players') {
    return { ...payload, response: items.map(normalizeIsportsPlayerStats) };
  }

  return { ...payload, response: items };
}

export async function apiFootballFetch<T = any>(path: string, params: ApiFootballParams = {}): Promise<T> {
  const provider = getProvider();
  const keys = getApiKeys(provider);

  if (keys.length === 0) {
    throw new ApiFootballError(provider === 'ISPORTS'
      ? 'ISPORTS_API_KEY or ISPORTS_API_KEYS is missing'
      : 'API_FOOTBALL_KEY or API_FOOTBALL_KEYS is missing');
  }

  const errors: ApiFootballError[] = [];

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const apiKey = keys[keyIndex];
    const url = buildUrl(provider, path, params, apiKey);

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: provider === 'API_FOOTBALL'
        ? { 'x-apisports-key': apiKey, 'accept': 'application/json' }
        : { 'accept': 'application/json' },
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new ApiFootballError(`${provider} request failed with status ${response.status}`, response.status, payload, keyIndex);
      errors.push(error);
      if (isQuotaOrRateLimitError(response.status, payload) && keyIndex < keys.length - 1) continue;
      throw error;
    }

    if (hasProviderErrors(payload, provider)) {
      const providerErrors = getProviderErrorPayload(payload, provider);
      const error = new ApiFootballError(`${provider} returned errors`, response.status, providerErrors, keyIndex);
      errors.push(error);
      if (isQuotaOrRateLimitError(response.status, providerErrors) && keyIndex < keys.length - 1) continue;
      throw error;
    }

    const finalPayload = provider === 'ISPORTS' ? normalizeIsportsPayload(path, payload) : payload;
    return finalPayload as T;
  }

  const lastError = errors[errors.length - 1];
  throw lastError || new ApiFootballError(`${provider} request failed for all keys`);
}

export function normalizeName(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
