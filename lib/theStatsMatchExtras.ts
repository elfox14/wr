import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

function str(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return String(value).trim();
  return null;
}

function n(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function key(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('czechia', 'czech republic')
    .replace('usa', 'united states');
}

function teamMatch(providerName: any, localTeam: any) {
  const p = key(providerName);
  const l = key(localTeam?.name || localTeam?.code);
  return Boolean(p && l && (p === l || p.includes(l) || l.includes(p)));
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999;
  return Math.abs(aa - bb) / 36e5;
}

function extractList(payload: any) {
  if (Array.isArray(payload)) return payload;
  for (const field of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[field])) return payload[field];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  return [];
}

function payloadData(payload: any) {
  return payload?.data || payload?.response || payload?.result || payload;
}

function listFrom(payload: any, fields: string[]) {
  if (Array.isArray(payload)) return payload;
  const data = payloadData(payload);
  for (const field of fields) if (Array.isArray(data?.[field])) return data[field];
  for (const field of fields) if (Array.isArray(payload?.[field])) return payload[field];
  return [];
}

function providerMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: str(home?.name, row?.homeName, row?.home_team_name),
    away: str(away?.name, row?.awayName, row?.away_team_name),
    date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}

export async function resolveTheStatsProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_')) return { id: external, by: 'local_external_id' };
  const list = extractList(await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 })).map(providerMatch).filter((row) => row.id);
  const found = list.find((row) => teamMatch(row.home, match.homeTeam) && teamMatch(row.away, match.awayTeam) && hoursApart(row.date, match.matchDate) <= 4);
  return { id: found?.id || null, by: found ? 'provider_match_list' : null, searched: list.length };
}

function compactShot(row: any, sourcePath: string) {
  const player = row?.player || row?.athlete || row?.shooter || row?.scorer || {};
  const team = row?.team || row?.side || {};
  const minute = n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute);
  const x = n(row?.x ?? row?.pitchX ?? row?.location?.x ?? row?.coordinates?.x ?? row?.position?.x ?? row?.shot?.x);
  const y = n(row?.y ?? row?.pitchY ?? row?.location?.y ?? row?.coordinates?.y ?? row?.position?.y ?? row?.shot?.y);
  const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type);
  return { minute, playerName: str(player?.name, row?.player_name, row?.playerName, row?.shooter_name), teamName: str(team?.name, row?.team_name, row?.teamName), x, y, xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals ?? row?.shot?.xg), npxg: n(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg ?? row?.shot?.npxg), outcome, bodyPart: str(row?.body_part, row?.bodyPart, row?.shot?.body_part, row?.shot?.bodyPart), isOnTarget: /on target|saved|goal/i.test(String(outcome || '')) || Boolean(row?.on_target ?? row?.is_on_target), isGoal: /goal|scored/i.test(String(outcome || row?.type || '')), isPenalty: /penalty/i.test(String(row?.type || row?.situation || row?.playPattern || '')) || Boolean(row?.is_penalty), sourcePath };
}

function compactEvent(row: any, sourcePath: string) {
  const rawType = key(str(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail));
  const minute = n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute ?? row?.time);
  const team = row?.team || {};
  const player = row?.player || row?.athlete || row?.scorer || {};
  const playerIn = row?.player_in || row?.playerIn || row?.sub_in || row?.subIn || row?.in || row?.incoming || {};
  const playerOut = row?.player_out || row?.playerOut || row?.sub_out || row?.subOut || row?.out || row?.outgoing || {};
  return { type: str(row?.type, row?.event_type, row?.incident_type, row?.name) || rawType || 'event', normalizedType: rawType, minute, teamName: str(team?.name, row?.team_name, row?.teamName), playerName: str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name), playerIn: str(playerIn?.name, row?.player_in_name, row?.playerInName, row?.in_name), playerOut: str(playerOut?.name, row?.player_out_name, row?.playerOutName, row?.out_name), reason: str(row?.reason, row?.card_reason, row?.description, row?.comment, row?.text), outcome: str(row?.outcome, row?.result, row?.decision), detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message), sourcePath };
}

function compactPlayerStat(row: any, sourcePath: string) {
  const player = row?.player || row?.athlete || row?.person || row;
  const team = row?.team || {};
  const stats = row?.stats || row?.statistics || row;
  return { id: str(player?.id, row?.player_id, row?.id), name: str(player?.name, player?.full_name, row?.name, row?.playerName, row?.display_name), teamName: str(team?.name, row?.team_name, row?.teamName), position: str(player?.position, row?.position), rating: n(stats?.rating ?? row?.rating), minutes: n(stats?.minutes ?? stats?.minutes_played ?? row?.minutes), shots: n(stats?.shots ?? stats?.total_shots), shotsOnTarget: n(stats?.shots_on_target ?? stats?.shotsOnTarget), goals: n(stats?.goals), assists: n(stats?.assists), passes: n(stats?.passes ?? stats?.total_passes), keyPasses: n(stats?.key_passes ?? stats?.keyPasses), crosses: n(stats?.crosses), tackles: n(stats?.tackles), interceptions: n(stats?.interceptions), clearances: n(stats?.clearances), blocks: n(stats?.blocks), duels: n(stats?.duels ?? stats?.duels_total), foulsCommitted: n(stats?.fouls_committed ?? stats?.foulsCommitted), foulsWon: n(stats?.fouls_won ?? stats?.foulsWon), saves: n(stats?.saves ?? stats?.goalkeeper_saves), goalsPrevented: n(stats?.goals_prevented ?? stats?.goalsPrevented ?? stats?.psxg_minus_goals), savesInsideBox: n(stats?.saves_inside_box ?? stats?.savesInsideBox), sourcePath };
}

function eventBuckets(events: any[]) {
  return { substitutions: events.filter((event) => event.normalizedType.includes('sub')), cards: events.filter((event) => event.normalizedType.includes('card') || event.normalizedType.includes('yellow') || event.normalizedType.includes('red')), penalties: events.filter((event) => event.normalizedType.includes('penalty')), var: events.filter((event) => event.normalizedType.includes('var')) };
}

function matchInfoFromPayloads(payloads: Record<string, any>) {
  const matchPayload = payloadData(payloads.matchInfo?.payload || payloads.summary?.payload || payloads.liveStats?.payload || {});
  const fixture = matchPayload?.fixture || matchPayload?.match || matchPayload?.game || matchPayload;
  const venue = fixture?.venue || fixture?.stadium || fixture?.ground || matchPayload?.venue || matchPayload?.stadium || {};
  const referee = fixture?.referee || matchPayload?.referee || matchPayload?.officials?.referee || matchPayload?.officials?.[0];
  const weather = fixture?.weather || matchPayload?.weather || null;
  return { venue: str(venue?.name, venue?.stadium, venue, fixture?.venue_name, matchPayload?.venue_name), city: str(venue?.city, fixture?.city, matchPayload?.city), country: str(venue?.country, fixture?.country, matchPayload?.country), referee: str(referee?.name, referee, fixture?.referee_name, matchPayload?.referee_name), attendance: n(fixture?.attendance ?? matchPayload?.attendance), weather, finalScore: { home: n(fixture?.home_goals ?? matchPayload?.home_goals ?? matchPayload?.meta?.home_goals), away: n(fixture?.away_goals ?? matchPayload?.away_goals ?? matchPayload?.meta?.away_goals) }, manOfTheMatch: str(matchPayload?.man_of_the_match?.name, matchPayload?.manOfTheMatch?.name, matchPayload?.motm?.name, matchPayload?.player_of_the_match?.name) };
}

function compactStandings(payload: any) {
  const rows = listFrom(payload, ['standings', 'table', 'rows', 'items', 'data']);
  return rows.map((row: any) => ({ rank: n(row?.rank ?? row?.position), teamName: str(row?.team?.name, row?.team_name, row?.name), played: n(row?.played ?? row?.matches_played), won: n(row?.won ?? row?.wins), drawn: n(row?.drawn ?? row?.draws), lost: n(row?.lost ?? row?.losses), goalsFor: n(row?.goals_for ?? row?.goalsFor ?? row?.gf), goalsAgainst: n(row?.goals_against ?? row?.goalsAgainst ?? row?.ga), goalDifference: n(row?.goal_difference ?? row?.goalDifference ?? row?.gd), points: n(row?.points ?? row?.pts) }));
}

function keySummary(value: any, depth = 0): any {
  if (!value || depth > 3) return null;
  if (Array.isArray(value)) return { type: 'array', length: value.length, sample: value.slice(0, 3).map((item) => keySummary(item, depth + 1)) };
  if (typeof value !== 'object') return typeof value;
  const keys = Object.keys(value).slice(0, 80);
  const out: Record<string, any> = { type: 'object', keys };
  for (const k of keys.slice(0, 20)) out[k] = keySummary(value[k], depth + 1);
  return out;
}

const ENDPOINTS = [
  { key: 'matchInfo', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}` },
  { key: 'summary', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/summary` },
  { key: 'timeline', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/timeline` },
  { key: 'incidents', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/incidents` },
  { key: 'liveStats', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/live-stats` },
  { key: 'statistics', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/statistics` },
  { key: 'lineups', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/lineups` },
  { key: 'shotmap', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/shotmap` },
  { key: 'shots', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/shots` },
  { key: 'playerStats', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/player-stats` },
  { key: 'playerStatistics', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/players/statistics` },
  { key: 'players', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/players` },
  { key: 'standings', path: (id: string) => `/api/football/matches/${encodeURIComponent(id)}/standings` },
];

async function fetchEndpoint(endpoint: any, providerId: string, timeoutMs: number) {
  const path = endpoint.path(providerId);
  try { const payload = await theStatsApiFetch(path, {}, { timeoutMs }); return { key: endpoint.key, path, ok: true, payload, keySummary: keySummary(payload) }; }
  catch (error: any) { return { key: endpoint.key, path, ok: false, error: safeTheStatsApiError(error), keySummary: null }; }
}

function normalizeExtras(endpointResults: Record<string, any>) {
  const timeline = listFrom(endpointResults.timeline?.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']);
  const incidents = listFrom(endpointResults.incidents?.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']);
  const events = [...timeline, ...incidents].map((row) => compactEvent(row, endpointResults.incidents?.ok ? 'incidents/timeline' : 'timeline'));
  const shotRows = [...listFrom(endpointResults.shotmap?.payload, ['shotmap', 'shots', 'events', 'items', 'results']), ...listFrom(endpointResults.shots?.payload, ['shots', 'shotmap', 'events', 'items', 'results'])];
  const shotmap = shotRows.map((row) => compactShot(row, 'shotmap/shots'));
  const playerRows = [...listFrom(endpointResults.playerStats?.payload, ['players', 'player_stats', 'statistics', 'items', 'results']), ...listFrom(endpointResults.playerStatistics?.payload, ['players', 'player_stats', 'statistics', 'items', 'results']), ...listFrom(endpointResults.players?.payload, ['players', 'items', 'results'])];
  const playerStats = playerRows.map((row) => compactPlayerStat(row, 'player-stats'));
  return { matchInfo: matchInfoFromPayloads(endpointResults), shotmap, eventsDetailed: { all: events, ...eventBuckets(events) }, playerStats, goalkeeperStats: playerStats.filter((player) => player.saves !== null || player.goalsPrevented !== null || player.savesInsideBox !== null), standings: compactStandings(endpointResults.standings?.payload) };
}

export async function collectTheStatsMatchExtras(match: any, options: { dryRun: boolean; save: boolean; timeoutMs: number; includeRaw: boolean; query: Record<string, string | number> }) {
  const resolved = await resolveTheStatsProviderId(match, options.query);
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve TheStats provider match id', resolved };
  const results = await Promise.all(ENDPOINTS.map((endpoint) => fetchEndpoint(endpoint, String(resolved.id), options.timeoutMs)));
  const endpointResults: Record<string, any> = Object.fromEntries(results.map((result) => [result.key, result]));
  const normalized = normalizeExtras(endpointResults);
  let snapshotId: string | null = null;
  if (!options.dryRun && options.save) {
    const rawData: Record<string, any> = { provider: 'THE_STATS_API', mode: 'match_extras', resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, importedAt: new Date().toISOString(), endpoints: results.map((result) => ({ key: result.key, path: result.path, ok: result.ok, error: result.ok ? null : result.error, keySummary: result.keySummary })), normalized };
    if (options.includeRaw) rawData.raw = Object.fromEntries(results.filter((r) => r.ok).map((r) => [r.key, r.payload]));
    const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: 'THE_STATS_API_EXTRAS', providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0, rawData }, select: { id: true } });
    snapshotId = snapshot.id;
  }
  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, endpointsOk: results.filter((result) => result.ok).map((result) => result.key), endpointsFailed: results.filter((result) => !result.ok).map((result) => ({ key: result.key, status: result.error?.status, code: result.error?.code, message: result.error?.message })), counts: { shots: normalized.shotmap.length, detailedEvents: normalized.eventsDetailed.all.length, substitutions: normalized.eventsDetailed.substitutions.length, cards: normalized.eventsDetailed.cards.length, penalties: normalized.eventsDetailed.penalties.length, var: normalized.eventsDetailed.var.length, playerStats: normalized.playerStats.length, goalkeeperStats: normalized.goalkeeperStats.length, standings: normalized.standings.length }, matchInfo: normalized.matchInfo, saved: Boolean(snapshotId), snapshotId, debug: options.includeRaw ? { endpoints: endpointResults, normalized } : { endpointSummaries: results.map((r) => ({ key: r.key, path: r.path, ok: r.ok, error: r.ok ? null : r.error, keySummary: r.keySummary })), normalizedPreview: normalized } };
}

export function defaultTheStatsQuery(params: URLSearchParams) {
  return { competition_id: params.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107', season_id: params.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868', per_page: Math.max(1, Math.min(100, Number(params.get('providerMatchesPerPage') || 100) || 100)) };
}
