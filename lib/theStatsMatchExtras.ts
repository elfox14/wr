import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { theStatsApiFetch } from '@/lib/theStatsApi';

export type TheStatsExtrasEndpointMode = 'essential' | 'full' | 'events' | 'shots' | 'players' | 'lineups' | 'info' | 'stats' | string;

type EndpointTuple = [string, string];

function str(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]' && !/^null|undefined|-$/i.test(text)) return text;
    }
    if (value && typeof value === 'object') {
      const text = str(value.name, value.fullName, value.full_name, value.title, value.label, value.display_name, value.displayName);
      if (text) return text;
    }
  }
  return null;
}

function n(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: any) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return null;
}

function key(value: any) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('czechia', 'czech republic')
    .replace('usa', 'united states')
    .replace('u s a', 'united states')
    .replace('united states of america', 'united states')
    .replace('turkiye', 'turkey')
    .replace('türkiye', 'turkey')
    .replace('korea republic', 'south korea')
    .replace('republic of korea', 'south korea')
    .replace('cote d ivoire', 'ivory coast')
    .replace('cape verde islands', 'cape verde');
}

function words(value: any) { return key(value).split(' ').filter((w) => w.length > 1); }
function similarity(a: any, b: any) {
  const aa = key(a); const bb = key(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 88;
  const aw = new Set(words(aa)); const bw = new Set(words(bb));
  if (!aw.size || !bw.size) return 0;
  const hit = Array.from(aw).filter((w) => bw.has(w)).length;
  return Math.round((hit / Math.max(aw.size, bw.size)) * 75);
}
function teamScore(providerName: any, localTeam: any) { return Math.max(similarity(providerName, localTeam?.name), similarity(providerName, localTeam?.code)); }
function hoursApart(a?: string | Date | null, b?: string | Date | null) { const aa = a ? new Date(a).getTime() : NaN; const bb = b ? new Date(b).getTime() : NaN; if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999; return Math.abs(aa - bb) / 36e5; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function dataOf(payload: any) { return payload?.data || payload?.response || payload?.result || payload || {}; }
function extractList(payload: any) { if (Array.isArray(payload)) return payload; for (const field of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[field])) return payload[field]; if (Array.isArray(payload?.data?.matches)) return payload.data.matches; return []; }
function listFrom(payload: any, fields: string[]) { if (Array.isArray(payload)) return payload; const data = dataOf(payload); if (Array.isArray(data)) return data; for (const field of fields) if (Array.isArray(data?.[field])) return data[field]; for (const field of fields) if (Array.isArray(payload?.[field])) return payload[field]; return []; }
function safeError(error: any) { return { name: error?.name || 'TheStatsApiError', message: String(error?.message || error), status: Number(error?.status || error?.payload?.error?.status_code || 0) || null, code: error?.code || error?.payload?.error?.code || null, payload: error?.payload || null }; }
function normalizeProviderId(value: any) { const raw = str(value); if (!raw) return null; const digits = raw.replace(/^mt_/i, '').replace(/\D/g, ''); if (digits.length <= 6) return null; const id = `mt_${digits}`; return id !== 'mt_' && id !== 'mt_12345' ? id : null; }

export function defaultTheStatsQuery(params: URLSearchParams) {
  const out: Record<string, string | number> = {
    competition_id: params.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: params.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: Number(params.get('providerMatchesPerPage') || process.env.THE_STATS_PROVIDER_MATCHES_PER_PAGE || 25),
  };
  for (const keyName of ['date_from', 'date_to', 'status', 'stage', 'group', 'utc_offset']) {
    const value = params.get(keyName);
    if (value) out[keyName] = value;
  }
  return out;
}

function providerMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return { id: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id), home: str(home?.name, row?.homeName, row?.home_team_name, home), away: str(away?.name, row?.awayName, row?.away_team_name, away), date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff, row?.start_time), raw: row };
}
function candidateScore(candidate: any, match: any) {
  const directHome = teamScore(candidate.home, match.homeTeam);
  const directAway = teamScore(candidate.away, match.awayTeam);
  const swappedHome = teamScore(candidate.home, match.awayTeam);
  const swappedAway = teamScore(candidate.away, match.homeTeam);
  const direct = (directHome + directAway) / 2;
  const swapped = (swappedHome + swappedAway) / 2;
  const reversed = swapped > direct;
  const team = Math.max(direct, swapped);
  const hours = hoursApart(candidate.date, match.matchDate);
  const time = hours <= 4 ? 25 : hours <= 12 ? 15 : hours <= 30 ? 8 : candidate.date ? -15 : 0;
  return { ...candidate, score: Math.round(team + time), teamScore: Math.round(team), timeHours: hours === 999 ? null : Number(hours.toFixed(2)), reversed };
}

async function fetchProviderMatches(query: Record<string, string | number>) {
  const perPage = Math.max(10, Math.min(50, Number(query.per_page || 25) || 25));
  const payload = await theStatsApiFetch('/api/football/matches', { ...query, per_page: perPage, page: 1 }, { timeoutMs: 10000 });
  return extractList(payload).map(providerMatch).filter((row) => row.id);
}

async function existingProviderId(matchId: string) {
  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: { matchId, provider: { startsWith: 'THE_STATS_API' } },
    orderBy: { capturedAt: 'desc' },
    take: 20,
    select: { providerMatchId: true, rawData: true },
  }).catch(() => []);
  for (const snapshot of snapshots) {
    const raw = snapshot?.rawData as any;
    const candidates = [raw?.resolvedProviderMatchId, raw?.providerMatchId, raw?.matchId, raw?.source?.providerMatchId, raw?.normalized?.matchInfo?.providerMatchId, snapshot?.providerMatchId ? `mt_${snapshot.providerMatchId}` : null];
    for (const candidate of candidates) {
      const id = normalizeProviderId(candidate);
      if (id) return id;
    }
  }
  return null;
}

export async function resolveTheStatsProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_') && external !== 'mt_12345') return { id: external, by: 'local_external_id' };
  const cached = await existingProviderId(match.id);
  if (cached) return { id: cached, by: 'cached_the_stats_snapshot' };

  const matchDateVal = match.matchDate ? new Date(match.matchDate) : null;
  const params = new URLSearchParams();
  params.set('competition_id', String(query.competition_id || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107'));
  params.set('season_id', String(query.season_id || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868'));
  params.set('providerMatchesPerPage', String(query.per_page || 25));
  if (query.status) params.set('status', String(query.status));
  if (query.stage) params.set('stage', String(query.stage));
  if (query.group) params.set('group', String(query.group));
  if (query.utc_offset) params.set('utc_offset', String(query.utc_offset));
  if (query.date_from) params.set('date_from', String(query.date_from));
  else if (matchDateVal && !isNaN(matchDateVal.getTime())) params.set('date_from', new Date(matchDateVal.getTime() - 24 * 3600 * 1000).toISOString().split('T')[0]);
  if (query.date_to) params.set('date_to', String(query.date_to));
  else if (matchDateVal && !isNaN(matchDateVal.getTime())) params.set('date_to', new Date(matchDateVal.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0]);

  const list = await fetchProviderMatches(defaultTheStatsQuery(params));
  const candidates = list.map((row) => candidateScore(row, match)).sort((a, b) => b.score - a.score).slice(0, 8);
  const found = candidates.find((row) => row.score >= 82 && row.teamScore >= 70 && (row.timeHours === null || row.timeHours <= 30));
  return { id: found?.id || null, by: found ? (found.reversed ? 'provider_match_list_fuzzy_reversed' : 'provider_match_list_fuzzy') : null, searched: list.length, confidence: found?.score || 0, candidates: candidates.map(({ raw, ...row }) => row) };
}

function pairValue(value: any) { const all = value?.all || value || {}; const home = n(all.home ?? all.home_team ?? all.homeTeam ?? all.home_team_value); const away = n(all.away ?? all.away_team ?? all.awayTeam ?? all.away_team_value); return home === null && away === null ? null : { home, away }; }
function compactStats(payload: any) {
  const data = dataOf(payload); const overview = data.overview || data.stats || {}; const shots = data.shots || {}; const attack = data.attack || {}; const defending = data.defending || {}; const goalkeeping = data.goalkeeping || {}; const passes = data.passes || {}; const out: Record<string, any> = {};
  const entries: Record<string, any> = { possession: overview.ball_possession || overview.possession, xg: overview.expected_goals || data.expected_goals, npxg: data.np_expected_goals || data.non_penalty_expected_goals, bigChances: overview.big_chances, shots: overview.total_shots || shots.total_shots, shotsOnTarget: overview.shots_on_target || shots.shots_on_target, shotsOffTarget: overview.shots_off_target || shots.shots_off_target, corners: overview.corner_kicks || overview.corners, fouls: overview.fouls, offsides: overview.offsides || attack.offsides, yellowCards: overview.yellow_cards, redCards: overview.red_cards, passes: overview.passes || passes.total_passes, accuratePasses: overview.accurate_passes || passes.accurate_passes, tackles: overview.tackles, saves: overview.goalkeeper_saves || goalkeeping.saves, interceptions: defending.interceptions };
  for (const [keyName, value] of Object.entries(entries)) { const parsed = pairValue(value); if (parsed) out[keyName] = parsed; }
  return { meta: {}, stats: out };
}
function compactMatchInfo(matchInfoPayload: any, statsPayload: any) { const data = dataOf(matchInfoPayload); const stats = dataOf(statsPayload); const venue = data?.venue || data?.fixture?.venue || data?.match?.venue || {}; const referee = data?.referee || data?.fixture?.referee || data?.match?.referee || {}; return { status: str(data?.status, stats?.status), venue: str(venue?.name, venue), city: str(venue?.city, data?.city), referee: str(referee?.name, referee), finalScore: data?.score?.final_score || data?.score || null, xgAvailable: Boolean(data?.xg_available || stats?.overview?.expected_goals) }; }
function compactEvent(row: any) { const team = row?.team || {}; const player = row?.player || row?.athlete || row?.scorer || {}; return { type: str(row?.type, row?.event_type, row?.incident_type, row?.name) || 'event', minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute), teamId: str(team?.id, row?.team_id, row?.teamId), teamName: str(team?.name, row?.team_name, row?.teamName), playerId: str(player?.id, row?.player_id, row?.playerId), playerName: str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name), detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message) }; }
function compactShot(row: any) { const player = row?.player || row?.athlete || row?.shooter || {}; const team = row?.team || {}; const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type); return { id: str(row?.id), minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed), playerName: str(player?.name, row?.player_name, row?.playerName), teamName: str(team?.name, row?.team_name, row?.teamName), xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals), outcome, isOnTarget: bool(row?.is_on_target) ?? /on target|saved|goal/i.test(String(outcome || '')), isGoal: bool(row?.is_goal) ?? /goal|scored/i.test(String(outcome || row?.type || '')) } }
function compactPlayerStat(row: any) { const player = row?.player || row?.athlete || row; const team = row?.team || {}; const stats = row?.stats || row?.statistics || row; const passing = row?.passing || stats?.passing || {}; const shooting = row?.shooting || stats?.shooting || {}; const defending = row?.defending || stats?.defending || {}; const goalkeeping = row?.goalkeeping || stats?.goalkeeping || {}; return { playerId: str(player?.id, row?.player_id, row?.playerId, row?.id), playerName: str(player?.name, row?.player_name, row?.playerName, row?.name), teamName: str(team?.name, row?.team_name, row?.teamName), position: str(player?.position, row?.position), rating: n(stats?.rating ?? row?.rating), minutes: n(stats?.minutes ?? stats?.minutes_played ?? row?.minutes), goals: n(shooting?.goals ?? stats?.goals ?? row?.goals), assists: n(passing?.assists ?? stats?.assists ?? row?.assists), shots: n(shooting?.total_shots ?? stats?.shots ?? row?.shots), shotsOnTarget: n(shooting?.shots_on_target ?? stats?.shots_on_target ?? row?.shots_on_target), keyPasses: n(passing?.key_passes ?? stats?.key_passes ?? row?.key_passes), tackles: n(defending?.tackles ?? stats?.tackles ?? row?.tackles), interceptions: n(defending?.interceptions ?? stats?.interceptions ?? row?.interceptions), saves: n(goalkeeping?.saves ?? stats?.saves ?? row?.saves) }; }

function endpointsForMode(modeRaw: TheStatsExtrasEndpointMode, id: string): { mode: string; endpoints: EndpointTuple[] } {
  const mode = String(modeRaw || 'essential').trim().toLowerCase();
  if (mode === 'full' || mode === 'all') return { mode: 'full', endpoints: [['stats', `/api/football/matches/${id}/stats`], ['matchInfo', `/api/football/matches/${id}`], ['lineups', `/api/football/matches/${id}/lineups`], ['timeline', `/api/football/matches/${id}/timeline`], ['shotmap', `/api/football/matches/${id}/shotmap`], ['playerStats', `/api/football/matches/${id}/player-stats`]] };
  if (['events', 'timeline'].includes(mode)) return { mode: 'events', endpoints: [['timeline', `/api/football/matches/${id}/timeline`]] };
  if (['players', 'player-stats', 'playerStats'].map((v) => v.toLowerCase()).includes(mode)) return { mode: 'players', endpoints: [['playerStats', `/api/football/matches/${id}/player-stats`]] };
  if (['shots', 'shotmap'].includes(mode)) return { mode: 'shots', endpoints: [['shotmap', `/api/football/matches/${id}/shotmap`]] };
  if (mode === 'lineups') return { mode: 'lineups', endpoints: [['lineups', `/api/football/matches/${id}/lineups`]] };
  if (mode === 'info') return { mode: 'info', endpoints: [['matchInfo', `/api/football/matches/${id}`]] };
  return { mode: 'essential', endpoints: [['stats', `/api/football/matches/${id}/stats`]] };
}

async function fetchEndpoint(keyName: string, path: string, timeoutMs: number) {
  const attempts = Math.max(1, Math.min(3, Number(process.env.THE_STATS_API_RETRY_ATTEMPTS || 1)));
  const retryDelayMs = Math.max(1000, Math.min(10000, Number(process.env.THE_STATS_API_RETRY_DELAY_MS || 2500)));
  for (let i = 0; i < attempts; i += 1) {
    try {
      const payload = await theStatsApiFetch(path, {}, { timeoutMs });
      return { key: keyName, path, ok: true, payload };
    } catch (error: any) {
      const err = safeError(error);
      const is429 = Number(err.status) === 429 || String(err.message || '').includes('429') || String(err.code || '').includes('429');
      if (is429 && i < attempts - 1) await sleep(retryDelayMs);
      else return { key: keyName, path, ok: false, error: err };
    }
  }
  return { key: keyName, path, ok: false, error: { name: 'TheStatsApiError', message: 'Max retry attempts reached', status: 429, code: 'rate_limited', payload: null } };
}

export async function collectTheStatsMatchExtras(match: any, options: { dryRun?: boolean; save?: boolean; includeRaw?: boolean; timeoutMs?: number; query?: Record<string, string | number>; endpointMode?: TheStatsExtrasEndpointMode; delayMs?: number } = {}) {
  const dryRun = Boolean(options.dryRun);
  const save = options.save !== false;
  const includeRaw = Boolean(options.includeRaw);
  const timeoutMs = Math.max(3000, Math.min(60000, Number(options.timeoutMs || 12000)));
  const delayMs = Math.max(0, Math.min(15000, Number(options.delayMs || 1200)));
  const resolved = await resolveTheStatsProviderId(match, options.query || {});
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve provider match id', resolved, debug: { resolved } };
  const id = encodeURIComponent(String(resolved.id));
  const { mode, endpoints } = endpointsForMode(options.endpointMode || 'essential', id);

  const results: any[] = [];
  for (const [keyName, path] of endpoints) {
    const result = await fetchEndpoint(keyName, path, timeoutMs);
    results.push(result);
    if (!result.ok && Number(result.error?.status) === 429) break;
    if (delayMs > 0) await sleep(delayMs);
  }

  const byKey: Record<string, any> = Object.fromEntries(results.map((item) => [item.key, item]));
  const stats = byKey.stats?.ok ? compactStats(byKey.stats.payload) : { meta: {}, stats: {} };
  const events = byKey.timeline?.ok ? listFrom(byKey.timeline.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']).map(compactEvent) : [];
  const shotmap = byKey.shotmap?.ok ? listFrom(byKey.shotmap.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']).map(compactShot) : [];
  const playerStats = byKey.playerStats?.ok ? listFrom(byKey.playerStats.payload, ['data', 'players', 'player_stats', 'items', 'results']).map(compactPlayerStat) : [];
  const normalized = { matchInfo: compactMatchInfo(byKey.matchInfo?.payload, byKey.stats?.payload), liveStats: stats, lineups: byKey.lineups?.ok ? dataOf(byKey.lineups.payload) : null, eventsDetailed: { all: events }, shotmap, playerStats };
  const endpointSummaries = results.map((item) => ({ key: item.key, path: item.path, ok: item.ok, error: item.ok ? null : item.error, keySummary: item.ok ? null : item.error?.message || null }));
  const useful = Object.keys(stats.stats || {}).length > 0 || events.length > 0 || shotmap.length > 0 || playerStats.length > 0 || Boolean(normalized.lineups) || Boolean(normalized.matchInfo?.venue || normalized.matchInfo?.referee);

  let snapshotId: string | null = null;
  if (!dryRun && save && useful) {
    const rawData: Record<string, any> = { provider: 'THE_STATS_API', mode: 'match_extras_rate_safe_collect', endpointMode: mode, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, importedAt: new Date().toISOString(), endpoints: endpointSummaries, normalized };
    if (includeRaw) rawData.raw = Object.fromEntries(results.filter((item) => item.ok).map((item) => [item.key, item.payload]));
    const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: 'THE_STATS_API_EXTRAS', providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0, rawData }, select: { id: true } });
    snapshotId = snapshot.id;
  }

  const rateLimited = results.some((item) => Number(item.error?.status) === 429);
  return { ok: useful, matchId: match.id, endpointMode: mode, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, rateLimited, endpointsOk: results.filter((item) => item.ok).map((item) => item.key), endpointsFailed: results.filter((item) => !item.ok).map((item) => ({ key: item.key, status: item.error?.status, code: item.error?.code, message: item.error?.message })), counts: { stats: Object.keys(stats.stats || {}).length, detailedEvents: events.length, shots: shotmap.length, playerStats: playerStats.length, lineups: normalized.lineups ? 1 : 0 }, matchInfo: normalized.matchInfo, saved: Boolean(snapshotId), snapshotId, debug: { resolved, endpointSummaries, normalizedPreview: normalized, endpoints: includeRaw ? Object.fromEntries(results.map((item) => [item.key, item])) : undefined } };
}
