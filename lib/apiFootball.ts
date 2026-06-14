import { countProviderRequestsSince, getProviderQuotaBlock, recordProviderRequest } from '@/lib/provider-quota-guard';

type FootballParams = Record<string, string | number | boolean | undefined | null>;

type Provider = 'ISPORTS';

export class ApiFootballError extends Error {
  status?: number;
  payload?: unknown;
  keyIndex?: number;
  provider?: Provider;

  constructor(message: string, status?: number, payload?: unknown, keyIndex?: number, provider?: Provider) {
    super(message);
    this.name = 'FootballProviderError';
    this.status = status;
    this.payload = payload;
    this.keyIndex = keyIndex;
    this.provider = provider;
  }
}

function splitKeys(value?: string) {
  return value?.split(',').map((key) => key.trim()).filter(Boolean) || [];
}

function getApiKeys() {
  const keyPool = splitKeys(process.env.ISPORTS_API_KEYS);
  if (keyPool.length > 0) return keyPool;
  return [process.env.ISPORTS_API_KEY].filter(Boolean) as string[];
}

function getBaseUrl() {
  return process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com';
}

function getIsportsSoftLimit() {
  const value = Number(process.env.ISPORTS_DAILY_SOFT_LIMIT || 120);
  if (!Number.isFinite(value)) return 120;
  return Math.max(0, Math.floor(value));
}

function rollingUsageWindowStart() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function providerMatchIdFromParams(params: FootballParams = {}) {
  const value = Number(params.fixture || params.matchId || params.id || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function assertIsportsCanRequest(path: string, params: FootballParams = {}) {
  const guard = await getProviderQuotaBlock('ISPORTS');
  if (guard) {
    throw new ApiFootballError(
      'ISPORTS quota guard active',
      429,
      { reason: guard.reason, blockedUntil: guard.blockedUntil, localGuard: true },
      undefined,
      'ISPORTS',
    );
  }

  const softLimit = getIsportsSoftLimit();
  if (softLimit <= 0) return;

  const used = await countProviderRequestsSince('ISPORTS', rollingUsageWindowStart());
  if (used >= softLimit) {
    throw new ApiFootballError(
      `ISPORTS local soft daily limit reached (${used}/${softLimit}). External request skipped before provider quota is exhausted.`,
      429,
      { used, softLimit, path, providerMatchId: providerMatchIdFromParams(params), localSoftLimit: true },
      undefined,
      'ISPORTS',
    );
  }
}

async function safeRecordIsportsRequest(params: FootballParams, path: string, status: number | null, ok: boolean, reason?: string) {
  try {
    await recordProviderRequest({
      provider: 'ISPORTS',
      route: path,
      providerMatchId: providerMatchIdFromParams(params),
      status,
      ok,
      reason,
    });
  } catch (error) {
    console.warn('provider request log failed:', error);
  }
}

function mapIsportsPath(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath === '/fixtures') return '/sport/football/schedule';
  if (cleanPath === '/fixtures/players') return '/sport/football/playerstats/match';
  if (cleanPath === '/livescores') return '/sport/football/livescores';
  if (cleanPath === '/analysis') return '/sport/football/analysis';
  if (cleanPath === '/leagues') return '/sport/football/league/basic';
  if (cleanPath === '/lineups') return '/sport/football/lineups';
  if (cleanPath === '/teams') return '/sport/football/team/basic';
  if (cleanPath === '/players/squads') return '/sport/football/player/basic';
  if (cleanPath === '/standings') return '/sport/football/standing';
  return cleanPath;
}

function mapIsportsParams(path: string, params: FootballParams = {}, apiKey: string) {
  const mapped: FootballParams = { api_key: apiKey };
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if ((path === '/fixtures/players' || path === '/analysis') && key === 'fixture') {
      mapped.matchId = value;
      return;
    }
    if ((path === '/players/squads' || path === '/teams') && key === 'team') {
      mapped.teamId = value;
      return;
    }
    if ((path === '/fixtures' || path === '/teams' || path === '/standings') && key === 'league') {
      mapped.leagueID = value;
      return;
    }
    if (key === 'from') {
      mapped.date = value;
      return;
    }
    if (key === 'to' || key === 'season') return;
    mapped[key] = value;
  });
  return mapped;
}

function buildUrl(path: string, params: FootballParams = {}, apiKey?: string) {
  const cleanInputPath = path.startsWith('/') ? path : `/${path}`;
  const cleanPath = mapIsportsPath(cleanInputPath);
  const url = new URL(`${getBaseUrl()}${cleanPath}`);
  const finalParams = mapIsportsParams(cleanInputPath, params, apiKey || '');
  Object.entries(finalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function getArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.playerStats)) return payload.playerStats;
  if (Array.isArray(payload?.teams)) return payload.teams;
  if (Array.isArray(payload?.players)) return payload.players;
  if (Array.isArray(payload?.standings)) return payload.standings;
  return [];
}

function isProviderError(payload: any) {
  const code = payload?.code ?? payload?.status_code ?? payload?.status;
  if (code === undefined || code === null) return Boolean(payload?.error || payload?.errors);
  return Number(code) !== 0 && Number(code) !== 200 && String(code).toLowerCase() !== 'success';
}

function getProviderErrorPayload(payload: any) {
  return payload?.message || payload?.msg || payload?.error || payload?.errors || payload;
}

function isQuotaOrRateLimitError(status: number, payload: any) {
  if (status === 429) return true;
  const text = JSON.stringify(payload || {}).toLowerCase();
  return text.includes('rate') || text.includes('limit') || text.includes('quota') || text.includes('requests');
}

function isExcludedIsportsFixtureName(name?: string | null) {
  const value = String(name || '').toLowerCase();
  return /\b(u19|u20|u21|u23|youth|reserves|reserve)\b/.test(value) || /\(w\)|\bwomen\b|\bfemenil\b/.test(value);
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
    fixture: { id: fixtureId, date: matchTime, timestamp: item.timestamp, status: { short: item.status || item.statusCode || item.status_code || item.matchStatus || item.match_status, long: item.statusName || item.status_name || item.status || item.matchStatus } },
    league: { id: item.leagueId || item.league_id || item.competitionId || item.competition_id, name: item.leagueName || item.league_name || item.competitionName || item.competition_name || item.league?.name, country: item.country || item.countryName || item.country_name, season: item.season, round: item.round || item.roundName || item.round_name },
    teams: { home: { id: homeId, name: homeName, logo: homeLogo }, away: { id: awayId, name: awayName, logo: awayLogo } },
    goals: { home: item.homeScore ?? item.home_score ?? item.homeGoals ?? item.home_goals ?? item.score?.home, away: item.awayScore ?? item.away_score ?? item.awayGoals ?? item.away_goals ?? item.score?.away },
    score: item.score,
    raw: item,
  };
}

function normalizeIsportsTeam(item: any) {
  const teamId = item.teamId ?? item.team_id ?? item.id;
  const name = item.name ?? item.teamName ?? item.team_name;
  return { team: { id: teamId == null ? undefined : Number(teamId), name, code: item.code, country: item.country || item.countryName, logo: item.logo || item.teamLogo || item.team_logo }, raw: item };
}

function normalizeIsportsSquad(path: string, payload: any, params?: FootballParams) {
  const items = getArrayPayload(payload);
  const teamId = Number(params?.team || items?.[0]?.teamId || items?.[0]?.team_id || 0);
  const teamName = items?.[0]?.teamName || items?.[0]?.team_name;
  return { ...payload, response: [{ team: { id: teamId || undefined, name: teamName }, players: items.map((item: any) => ({ id: Number(item.playerId ?? item.player_id ?? item.id), name: item.name ?? item.playerName ?? item.player_name, age: item.age, number: item.number ?? item.shirtNumber ?? item.shirt_number, position: item.position, photo: item.photo || item.avatar || item.image })) }] };
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
  return { player: { id: playerId == null ? undefined : Number(playerId), name: playerName }, statistics: [{ team: { name: teamName, id: team.id ?? item.teamId ?? item.team_id }, games: { minutes: item.minutes ?? item.playedMinutes ?? item.played_minutes ?? games.minutes, position: item.position ?? games.position, captain: item.captain ?? games.captain, lineups: item.lineups ?? item.started ?? item.isStart ?? item.is_start ?? games.lineups, rating: item.rating ?? item.score ?? games.rating }, goals: { total: item.goals ?? item.goal ?? goals.total, assists: item.assists ?? item.assist ?? goals.assists, conceded: item.goalsConceded ?? item.goals_conceded ?? goals.conceded, saves: item.saves ?? goals.saves }, shots: { total: item.shotsTotal ?? item.shots_total ?? shots.total, on: item.shotsOnTarget ?? item.shots_on_target ?? shots.on }, passes: { total: item.passes ?? item.passesTotal ?? item.passes_total ?? passes.total, key: item.keyPasses ?? item.key_passes ?? passes.key, accuracy: item.passAccuracy ?? item.pass_accuracy ?? passes.accuracy }, tackles: { total: item.tackles ?? item.tacklesTotal ?? item.tackles_total ?? tackles.total, interceptions: item.interceptions ?? tackles.interceptions }, cards: { yellow: item.yellowCards ?? item.yellow_cards ?? cards.yellow, red: item.redCards ?? item.red_cards ?? cards.red }, raw: item }] };
}

function normalizeIsportsPayload(path: string, payload: any, params?: FootballParams) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const items = getArrayPayload(payload);
  if (cleanPath === '/fixtures' || cleanPath === '/livescores') {
    const filteredItems = items.filter((item: any) => {
      const homeName = item.homeName || item.home_name || item.homeTeamName || item.home_team_name || item.homeTeam?.name || item.home?.name;
      const awayName = item.awayName || item.away_name || item.awayTeamName || item.away_team_name || item.awayTeam?.name || item.away?.name;
      return !isExcludedIsportsFixtureName(homeName) && !isExcludedIsportsFixtureName(awayName);
    });
    return { ...payload, response: filteredItems.map(normalizeIsportsFixture), _provider: 'ISPORTS' };
  }
  if (cleanPath === '/fixtures/players') return { ...payload, response: items.map(normalizeIsportsPlayerStats), _provider: 'ISPORTS' };
  if (cleanPath === '/teams') return { ...payload, response: items.map(normalizeIsportsTeam), _provider: 'ISPORTS' };
  if (cleanPath === '/players/squads') return { ...normalizeIsportsSquad(cleanPath, payload, params), _provider: 'ISPORTS' };
  if (cleanPath === '/standings') return { ...payload, response: items, _provider: 'ISPORTS' };
  return { ...payload, response: items, _provider: 'ISPORTS' };
}

async function fetchIsports<T>(path: string, params: FootballParams = {}): Promise<T> {
  const keys = getApiKeys();
  if (keys.length === 0) throw new ApiFootballError('ISPORTS_API_KEY/ISPORTS_API_KEYS is missing', undefined, undefined, undefined, 'ISPORTS');

  await assertIsportsCanRequest(path, params);

  const errors: ApiFootballError[] = [];
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const apiKey = keys[keyIndex];
    const url = buildUrl(path, params, apiKey);
    const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' } });
    let payload: any = null;
    try { payload = await response.json(); } catch { payload = null; }

    if (!response.ok) {
      const reason = JSON.stringify(payload || {}).slice(0, 500) || `HTTP ${response.status}`;
      await safeRecordIsportsRequest(params, path, response.status, false, reason);
      const error = new ApiFootballError(`ISPORTS request failed with status ${response.status}`, response.status, payload, keyIndex, 'ISPORTS');
      errors.push(error);
      if (isQuotaOrRateLimitError(response.status, payload) && keyIndex < keys.length - 1) continue;
      throw error;
    }
    if (isProviderError(payload)) {
      const providerErrors = getProviderErrorPayload(payload);
      await safeRecordIsportsRequest(params, path, response.status, false, typeof providerErrors === 'string' ? providerErrors : JSON.stringify(providerErrors || {}));
      const error = new ApiFootballError('ISPORTS returned errors', response.status, providerErrors, keyIndex, 'ISPORTS');
      errors.push(error);
      if (isQuotaOrRateLimitError(response.status, providerErrors) && keyIndex < keys.length - 1) continue;
      throw error;
    }

    await safeRecordIsportsRequest(params, path, response.status, true);
    return normalizeIsportsPayload(path, payload, params) as T;
  }
  const lastError = errors[errors.length - 1];
  throw lastError || new ApiFootballError('ISPORTS request failed for all keys', undefined, undefined, undefined, 'ISPORTS');
}

export async function footballFetchFromProvider<T = any>(provider: Provider, path: string, params: FootballParams = {}): Promise<T> {
  if (provider !== 'ISPORTS') throw new ApiFootballError('API-Football provider has been removed. Use ISPORTS only.');
  return fetchIsports<T>(path, params);
}

export async function apiFootballFetch<T = any>(path: string, params: FootballParams = {}): Promise<T> {
  return fetchIsports<T>(path, params);
}

export function normalizeName(value?: string | null) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
