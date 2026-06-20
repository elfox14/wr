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
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim().replace('czechia', 'czech republic').replace('usa', 'united states');
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
  if (Array.isArray(data)) return data;
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
  const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type);
  return {
    id: str(row?.id),
    playerId: str(player?.id, row?.player_id, row?.playerId),
    teamId: str(team?.id, row?.team_id, row?.teamId),
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.shooter_name),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    x: n(row?.x ?? row?.pitchX ?? row?.location?.x ?? row?.coordinates?.x ?? row?.position?.x ?? row?.shot?.x),
    y: n(row?.y ?? row?.pitchY ?? row?.location?.y ?? row?.coordinates?.y ?? row?.position?.y ?? row?.shot?.y),
    xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals ?? row?.shot?.xg),
    npxg: n(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg ?? row?.np_expected_goals ?? row?.shot?.npxg),
    outcome,
    situation: str(row?.situation, row?.play_pattern, row?.playPattern),
    bodyPart: str(row?.body_part, row?.bodyPart, row?.shot?.body_part, row?.shot?.bodyPart),
    goalType: str(row?.goal_type, row?.goalType),
    goalMouthLocation: str(row?.goal_mouth_location, row?.goalMouthLocation),
    goalMouthCoordinates: row?.goal_mouth_coordinates || row?.goalMouthCoordinates || null,
    blockCoordinates: row?.block_coordinates || row?.blockCoordinates || null,
    goalkeeper: row?.goalkeeper || null,
    isBlocked: Boolean(row?.is_blocked_shot ?? row?.isBlockedShot),
    isOnTarget: /on target|saved|save|goal/i.test(String(outcome || '')) || Boolean(row?.on_target ?? row?.is_on_target ?? row?.isOnTarget),
    isGoal: /goal|scored/i.test(String(outcome || row?.type || '')) || Boolean(row?.is_goal ?? row?.isGoal),
    isHeaded: Boolean(row?.is_headed ?? row?.isHeaded),
    isOutsideBox: Boolean(row?.is_outside_box ?? row?.isOutsideBox),
    isPenalty: /penalty/i.test(String(row?.type || row?.situation || row?.playPattern || '')) || Boolean(row?.is_penalty ?? row?.isPenalty),
    sourcePath,
  };
}

function compactEvent(row: any, sourcePath: string) {
  const rawType = key(str(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail));
  const minute = n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute ?? row?.time);
  const team = row?.team || {};
  const player = row?.player || row?.athlete || row?.scorer || {};
  const playerIn = row?.player_in || row?.playerIn || row?.sub_in || row?.subIn || row?.in || row?.incoming || {};
  const playerOut = row?.player_out || row?.playerOut || row?.sub_out || row?.subOut || row?.out || row?.outgoing || {};
  const type = str(row?.type, row?.event_type, row?.incident_type, row?.name) || rawType || 'event';
  const playerName = str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name);
  const teamName = str(team?.name, row?.team_name, row?.teamName);
  return { type, normalizedType: rawType, sequence: n(row?.sequence), period: str(row?.period), minute, extraTime: n(row?.extra_time ?? row?.extraTime), teamId: str(team?.id, row?.team_id, row?.teamId), teamName, playerId: str(player?.id, row?.player_id, row?.playerId), playerName, playerIn: str(playerIn?.name, row?.player_in_name, row?.playerInName, row?.in_name), playerOut: str(playerOut?.name, row?.player_out_name, row?.playerOutName, row?.out_name), reason: str(row?.reason, row?.card_reason, row?.description, row?.comment, row?.text), outcome: str(row?.outcome, row?.result, row?.decision), detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message, playerName ? `${type} - ${playerName}${teamName ? ` (${teamName})` : ''}` : teamName ? `${type} - ${teamName}` : type), sourcePath };
}

function compactPlayerStat(row: any, sourcePath: string) {
  const player = row?.player || row?.athlete || row?.person || row;
  const team = row?.team || {};
  const stats = row?.stats || row?.statistics || row;
  const passing = row?.passing || stats?.passing || {};
  const shooting = row?.shooting || stats?.shooting || {};
  const duels = row?.duels || stats?.duels || {};
  const defending = row?.defending || stats?.defending || {};
  const goalkeeping = row?.goalkeeping || stats?.goalkeeping || {};
  const general = row?.general || stats?.general || {};
  const playerName = str(player?.name, player?.full_name, row?.player_name, row?.playerName, row?.name, row?.display_name);
  return {
    id: str(player?.id, row?.player_id, row?.playerId, row?.id),
    playerId: str(player?.id, row?.player_id, row?.playerId, row?.id),
    name: playerName,
    playerName,
    teamId: str(team?.id, row?.team_id, row?.teamId),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    position: str(player?.position, row?.position),
    rating: n(stats?.rating ?? row?.rating),
    started: Boolean(row?.started),
    played: Boolean(row?.played ?? true),
    minutes: n(stats?.minutes ?? stats?.minutes_played ?? row?.minutes_played ?? row?.minutes),
    goals: n(shooting?.goals ?? stats?.goals ?? row?.goals),
    assists: n(passing?.assists ?? stats?.assists ?? row?.assists),
    shots: n(shooting?.total_shots ?? stats?.shots ?? stats?.total_shots ?? row?.shots),
    shotsOnTarget: n(shooting?.shots_on_target ?? stats?.shots_on_target ?? stats?.shotsOnTarget ?? row?.shots_on_target),
    shotsOffTarget: n(shooting?.shots_off_target ?? stats?.shots_off_target ?? row?.shots_off_target),
    blockedShots: n(shooting?.blocked_shots ?? stats?.blocked_shots ?? row?.blocked_shots),
    xg: n(shooting?.expected_goals ?? stats?.expected_goals ?? stats?.xg ?? row?.expected_goals),
    xa: n(shooting?.expected_assists ?? passing?.expected_assists ?? stats?.expected_assists ?? row?.expected_assists),
    npxg: n(shooting?.np_expected_goals ?? stats?.np_expected_goals ?? stats?.npxg ?? row?.np_expected_goals),
    passes: n(passing?.total_passes ?? stats?.passes ?? stats?.total_passes ?? row?.passes),
    accuratePasses: n(passing?.accurate_passes ?? stats?.accurate_passes ?? row?.accurate_passes),
    keyPasses: n(passing?.key_passes ?? stats?.key_passes ?? stats?.keyPasses ?? row?.key_passes),
    crosses: n(passing?.total_crosses ?? stats?.crosses ?? row?.crosses),
    accurateCrosses: n(passing?.accurate_crosses ?? row?.accurate_crosses),
    longBalls: n(passing?.total_long_balls ?? row?.total_long_balls),
    tackles: n(defending?.tackles ?? stats?.tackles ?? row?.tackles),
    interceptions: n(defending?.interceptions ?? stats?.interceptions ?? row?.interceptions),
    clearances: n(defending?.clearances ?? stats?.clearances ?? row?.clearances),
    blocks: n(defending?.blocks ?? stats?.blocks ?? row?.blocks),
    duelsWon: n(duels?.duel_won ?? stats?.duels_won ?? row?.duel_won),
    duelsLost: n(duels?.duel_lost ?? row?.duel_lost),
    aerialWon: n(duels?.aerial_won ?? row?.aerial_won),
    foulsCommitted: n(general?.fouls ?? stats?.fouls_committed ?? stats?.foulsCommitted ?? row?.fouls_committed),
    foulsWon: n(general?.was_fouled ?? stats?.fouls_won ?? stats?.foulsWon ?? row?.fouls_won),
    touches: n(general?.touches ?? row?.touches),
    possessionLost: n(general?.possession_lost ?? row?.possession_lost),
    yellowCards: n(general?.yellow_cards ?? row?.yellow_cards),
    redCards: n(general?.red_cards ?? row?.red_cards),
    saves: n(goalkeeping?.saves ?? stats?.saves ?? stats?.goalkeeper_saves ?? row?.saves),
    goalsPrevented: n(goalkeeping?.goals_prevented ?? stats?.goals_prevented ?? stats?.goalsPrevented ?? stats?.psxg_minus_goals ?? row?.goals_prevented),
    savesInsideBox: n(goalkeeping?.saves_inside_box ?? stats?.saves_inside_box ?? stats?.savesInsideBox ?? row?.saves_inside_box),
    sourcePath,
  };
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
  const shotmap = payloads.shotmap?.payload || {};
  return { venue: str(venue?.name, venue?.stadium, venue, fixture?.venue_name, matchPayload?.venue_name), city: str(venue?.city, fixture?.city, matchPayload?.city), country: str(venue?.country, fixture?.country, matchPayload?.country), referee: str(referee?.name, referee, fixture?.referee_name, matchPayload?.referee_name), attendance: n(fixture?.attendance ?? matchPayload?.attendance), weather, finalScore: { home: n(fixture?.home_goals ?? matchPayload?.home_goals ?? matchPayload?.score?.home ?? matchPayload?.meta?.home_goals), away: n(fixture?.away_goals ?? matchPayload?.away_goals ?? matchPayload?.score?.away ?? matchPayload?.meta?.away_goals) }, npxgSummary: shotmap?.np_xg_summary || null, shotmapFinal: shotmap?.meta?.is_final ?? null, manOfTheMatch: str(matchPayload?.man_of_the_match?.name, matchPayload?.manOfTheMatch?.name, matchPayload?.motm?.name, matchPayload?.player_of_the_match?.name) };
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
  const shotRows = [...listFrom(endpointResults.shotmap?.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']), ...listFrom(endpointResults.shots?.payload, ['data', 'shots', 'shotmap', 'events', 'items', 'results'])];
  const shotmap = shotRows.map((row) => compactShot(row, 'shotmap/shots'));
  const playerRows = [...listFrom(endpointResults.playerStats?.payload, ['data', 'players', 'player_stats', 'statistics', 'items', 'results']), ...listFrom(endpointResults.playerStatistics?.payload, ['data', 'players', 'player_stats', 'statistics', 'items', 'results']), ...listFrom(endpointResults.players?.payload, ['data', 'players', 'items', 'results'])];
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
