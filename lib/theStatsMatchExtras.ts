import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { theStatsApiFetch } from '@/lib/theStatsApi';

function str(...values: any[]): string | null {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]' && !/^null|undefined|-$/i.test(text)) return text;
      continue;
    }
    if (value && typeof value === 'object') {
      const text: string | null = str(value.name, value.fullName, value.full_name, value.title, value.label, value.display_name, value.displayName);
      if (text) return text;
    }
  }
  return null;
}
function n(value: any) { if (value === null || value === undefined || value === '') return null; const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value); return Number.isFinite(number) ? number : null; }
function key(value: any) { return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim().replace('czechia', 'czech republic').replace('usa', 'united states').replace('u s a', 'united states').replace('united states of america', 'united states').replace('turkiye', 'turkey').replace('türkiye', 'turkey'); }
function words(value: any) { return key(value).split(' ').filter((w) => w.length > 1); }
function similarity(a: any, b: any) { const aa = key(a); const bb = key(b); if (!aa || !bb) return 0; if (aa === bb) return 100; if (aa.includes(bb) || bb.includes(aa)) return 88; const aw = new Set(words(aa)); const bw = new Set(words(bb)); if (!aw.size || !bw.size) return 0; const hit = Array.from(aw).filter((w) => bw.has(w)).length; return Math.round((hit / Math.max(aw.size, bw.size)) * 75); }
function teamScore(providerName: any, localTeam: any) { return Math.max(similarity(providerName, localTeam?.name), similarity(providerName, localTeam?.code)); }
function hoursApart(a?: string | Date | null, b?: string | Date | null) { const aa = a ? new Date(a).getTime() : NaN; const bb = b ? new Date(b).getTime() : NaN; if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999; return Math.abs(aa - bb) / 36e5; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function dataOf(payload: any) { return payload?.data || payload?.response || payload?.result || payload || {}; }
function extractList(payload: any) { if (Array.isArray(payload)) return payload; for (const field of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[field])) return payload[field]; if (Array.isArray(payload?.data?.matches)) return payload.data.matches; return []; }
function listFrom(payload: any, fields: string[]) { if (Array.isArray(payload)) return payload; const data = dataOf(payload); if (Array.isArray(data)) return data; for (const field of fields) if (Array.isArray(data?.[field])) return data[field]; for (const field of fields) if (Array.isArray(payload?.[field])) return payload[field]; return []; }
function providerMatch(row: any) { const fixture = row?.fixture || row?.match || row; const teams = row?.teams || row?.participants || {}; const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {}; const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {}; return { id: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id), home: str(home?.name, row?.homeName, row?.home_team_name, home), away: str(away?.name, row?.awayName, row?.away_team_name, away), date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff, row?.start_time), raw: row }; }
function candidateScore(candidate: any, match: any) { const directHome = teamScore(candidate.home, match.homeTeam); const directAway = teamScore(candidate.away, match.awayTeam); const swappedHome = teamScore(candidate.home, match.awayTeam); const swappedAway = teamScore(candidate.away, match.homeTeam); const direct = (directHome + directAway) / 2; const swapped = (swappedHome + swappedAway) / 2; const reversed = swapped > direct; const team = Math.max(direct, swapped); const hours = hoursApart(candidate.date, match.matchDate); const time = hours <= 4 ? 25 : hours <= 12 ? 15 : hours <= 30 ? 8 : candidate.date ? -15 : 0; return { ...candidate, score: Math.round(team + time), teamScore: Math.round(team), timeHours: hours === 999 ? null : Number(hours.toFixed(2)), reversed }; }
function normalizeProviderId(value: any) { const raw = str(value); if (!raw) return null; const id = raw.startsWith('mt_') ? raw : `mt_${raw.replace(/^mt_/i, '').replace(/\D/g, '')}`; return id && id !== 'mt_' && id !== 'mt_12345' ? id : null; }
function isPageOutOfRange(error: any) { const code = String(error?.payload?.error?.code || error?.code || '').toUpperCase(); const message = String(error?.payload?.error?.message || error?.message || '').toLowerCase(); return code === 'PAGE_OUT_OF_RANGE' || message.includes('out of range'); }
function safeError(error: any) { return { name: error?.name || 'TheStatsApiError', message: String(error?.message || error), status: Number(error?.status || error?.payload?.error?.status_code || 0) || null, code: error?.code || error?.payload?.error?.code || null, payload: error?.payload || null }; }

export function defaultTheStatsQuery(params: URLSearchParams) {
  const out: Record<string, string | number> = { competition_id: params.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107', season_id: params.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868', per_page: Number(params.get('providerMatchesPerPage') || 100) };
  for (const keyName of ['date_from', 'date_to', 'status', 'stage', 'group', 'utc_offset']) { const value = params.get(keyName); if (value) out[keyName] = value; }
  return out;
}

async function fetchProviderMatches(query: Record<string, string | number>) {
  const seen = new Set<string>(); const rows: any[] = []; const perPage = Math.max(50, Math.min(100, Number(query.per_page || 100) || 100)); const base = { ...query, per_page: perPage };
  for (const page of [1, 2, 3]) {
    let payload: any;
    try { payload = await theStatsApiFetch('/api/football/matches', { ...base, page }, { timeoutMs: 15000 }); }
    catch (error: any) { if (page > 1 && isPageOutOfRange(error)) break; throw error; }
    const list = extractList(payload).map(providerMatch).filter((row: any) => row.id);
    for (const row of list) { if (seen.has(row.id)) continue; seen.add(row.id); rows.push(row); }
    if (list.length < perPage) break;
    await sleep(350);
  }
  return rows;
}

async function existingProviderId(matchId: string) {
  const snapshots = await prisma.matchStatsSnapshot.findMany({ where: { matchId, provider: { startsWith: 'THE_STATS_API' } }, orderBy: { capturedAt: 'desc' }, take: 20, select: { providerMatchId: true, rawData: true } }).catch(() => []);
  for (const snapshot of snapshots) {
    const raw = snapshot?.rawData as any;
    const candidates = [raw?.resolvedProviderMatchId, raw?.providerMatchId, raw?.matchId, raw?.source?.providerMatchId, raw?.source?.matchId, raw?.theStatsApi?.matchId, raw?.normalized?.matchInfo?.providerMatchId, snapshot?.providerMatchId ? `mt_${snapshot.providerMatchId}` : null];
    for (const candidate of candidates) { const id = normalizeProviderId(candidate); if (id) return id; }
  }
  return null;
}

export async function resolveTheStatsProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_') && external !== 'mt_12345') return { id: external, by: 'local_external_id' };
  const cached = await existingProviderId(match.id);
  if (cached) return { id: cached, by: 'cached_the_stats_snapshot' };
  const list = await fetchProviderMatches(query);
  const candidates = list.map((row) => candidateScore(row, match)).sort((a, b) => b.score - a.score).slice(0, 8);
  const found = candidates.find((row) => row.score >= 82 && row.teamScore >= 70 && (row.timeHours === null || row.timeHours <= 30));
  return { id: found?.id || null, by: found ? (found.reversed ? 'provider_match_list_fuzzy_reversed' : 'provider_match_list_fuzzy') : null, searched: list.length, confidence: found?.score || 0, candidates: candidates.map(({ raw, ...row }) => row) };
}

function pair(value: any) { const all = value?.all || value || {}; const home = n(all.home ?? all.home_team ?? all.homeTeam ?? all.home_team_value); const away = n(all.away ?? all.away_team ?? all.awayTeam ?? all.away_team_value); return home === null && away === null ? null : { home, away }; }
function compactStats(payload: any) {
  const data = dataOf(payload); const overview = data.overview || data.stats || {}; const shots = data.shots || {}; const attack = data.attack || {}; const defending = data.defending || {}; const out: Record<string, any> = {};
  const entries: Record<string, any> = { possession: overview.ball_possession || overview.possession, xg: overview.expected_goals || data.expected_goals, npxg: data.np_expected_goals || data.non_penalty_expected_goals, bigChances: overview.big_chances, shots: overview.total_shots || shots.total_shots, shotsOnTarget: overview.shots_on_target || shots.shots_on_target, shotsOffTarget: overview.shots_off_target || shots.shots_off_target, blockedShots: shots.blocked_shots, shotsInsideBox: shots.shots_inside_box, shotsOutsideBox: shots.shots_outside_box, corners: overview.corner_kicks || overview.corners, fouls: overview.fouls, offsides: overview.offsides || attack.offsides, yellowCards: overview.yellow_cards, redCards: overview.red_cards, passes: overview.passes, accuratePasses: overview.accurate_passes, tackles: overview.tackles, saves: overview.goalkeeper_saves, interceptions: defending.interceptions, clearances: defending.clearances, ballRecoveries: defending.ball_recoveries };
  for (const [keyName, value] of Object.entries(entries)) { const parsed = pair(value); if (parsed) out[keyName] = parsed; }
  return { meta: { source: 'match-stats' }, stats: out };
}
function compactMatchInfo(matchInfoPayload: any, statsPayload: any) { const data = dataOf(matchInfoPayload); const stats = dataOf(statsPayload); const venue = data?.venue || data?.fixture?.venue || data?.match?.venue || {}; const referee = data?.referee || data?.fixture?.referee || data?.match?.referee || {}; return { status: str(data?.status, stats?.status), venue: str(venue?.name, venue), city: str(venue?.city, data?.city), referee: str(referee?.name, referee), finalScore: data?.score?.final_score || data?.score || null, xgAvailable: Boolean(data?.xg_available || stats?.overview?.expected_goals) }; }
function compactEvent(row: any) { const team = row?.team || {}; const player = row?.player || row?.athlete || row?.scorer || {}; return { type: str(row?.type, row?.event_type, row?.incident_type, row?.name) || 'event', minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute), teamId: str(team?.id, row?.team_id, row?.teamId), teamName: str(team?.name, row?.team_name, row?.teamName), playerId: str(player?.id, row?.player_id, row?.playerId), playerName: str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name), detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message) };
}
function compactShot(row: any) { const player = row?.player || row?.athlete || row?.shooter || {}; const team = row?.team || {}; const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type); return { minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed), playerName: str(player?.name, row?.player_name, row?.playerName), teamName: str(team?.name, row?.team_name, row?.teamName), x: n(row?.x ?? row?.pitchX ?? row?.location?.x), y: n(row?.y ?? row?.pitchY ?? row?.location?.y), xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals), npxg: n(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg), outcome, isOnTarget: /on target|saved|goal/i.test(String(outcome || '')), isGoal: /goal|scored/i.test(String(outcome || row?.type || '')) };
}
function compactPlayerStat(row: any) { const player = row?.player || row?.athlete || row; const team = row?.team || {}; const stats = row?.stats || row?.statistics || row; const passing = row?.passing || stats?.passing || {}; const shooting = row?.shooting || stats?.shooting || {}; const defending = row?.defending || stats?.defending || {}; const goalkeeping = row?.goalkeeping || stats?.goalkeeping || {}; return { playerId: str(player?.id, row?.player_id, row?.playerId, row?.id), playerName: str(player?.name, row?.player_name, row?.playerName, row?.name), teamId: str(team?.id, row?.team_id, row?.teamId), teamName: str(team?.name, row?.team_name, row?.teamName), position: str(player?.position, row?.position), rating: n(stats?.rating ?? row?.rating), minutes: n(stats?.minutes ?? stats?.minutes_played ?? row?.minutes), goals: n(shooting?.goals ?? stats?.goals ?? row?.goals), assists: n(passing?.assists ?? stats?.assists ?? row?.assists), shots: n(shooting?.total_shots ?? stats?.shots ?? row?.shots), shotsOnTarget: n(shooting?.shots_on_target ?? stats?.shots_on_target ?? row?.shots_on_target), passes: n(passing?.total_passes ?? stats?.passes ?? row?.passes), accuratePasses: n(passing?.accurate_passes ?? stats?.accurate_passes ?? row?.accurate_passes), keyPasses: n(passing?.key_passes ?? stats?.key_passes ?? row?.key_passes), tackles: n(defending?.tackles ?? stats?.tackles ?? row?.tackles), interceptions: n(defending?.interceptions ?? stats?.interceptions ?? row?.interceptions), clearances: n(defending?.clearances ?? stats?.clearances ?? row?.clearances), saves: n(goalkeeping?.saves ?? stats?.saves ?? row?.saves) };
}
async function fetchEndpoint(keyName: string, path: string, timeoutMs: number) { try { return { key: keyName, path, ok: true, payload: await theStatsApiFetch(path, {}, { timeoutMs }) }; } catch (error: any) { return { key: keyName, path, ok: false, error: safeError(error) }; } }

export async function collectTheStatsMatchExtras(match: any, options: { dryRun?: boolean; save?: boolean; includeRaw?: boolean; timeoutMs?: number; query?: Record<string, string | number>; endpointMode?: 'essential' | 'full' | string; delayMs?: number } = {}) {
  const dryRun = Boolean(options.dryRun);
  const save = options.save !== false;
  const includeRaw = Boolean(options.includeRaw);
  const timeoutMs = Math.max(3000, Math.min(60000, Number(options.timeoutMs || 15000)));
  const delayMs = Math.max(0, Math.min(5000, Number(options.delayMs || 350)));
  const resolved = await resolveTheStatsProviderId(match, options.query || {});
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve provider match id', resolved };
  const id = encodeURIComponent(String(resolved.id));
  const mode = options.endpointMode === 'full' || options.endpointMode === 'all' ? 'full' : 'essential';
  const endpoints = [
    ['matchInfo', `/api/football/matches/${id}`],
    ['stats', `/api/football/matches/${id}/stats`],
    ['lineups', `/api/football/matches/${id}/lineups`],
    ...(mode === 'full' ? [['timeline', `/api/football/matches/${id}/timeline`], ['shotmap', `/api/football/matches/${id}/shotmap`], ['playerStats', `/api/football/matches/${id}/player-stats`]] : []),
  ];
  const results: any[] = [];
  for (const [keyName, path] of endpoints) { results.push(await fetchEndpoint(String(keyName), String(path), timeoutMs)); if (delayMs > 0) await sleep(delayMs); }
  const byKey: Record<string, any> = Object.fromEntries(results.map((item) => [item.key, item]));
  const stats = byKey.stats?.ok ? compactStats(byKey.stats.payload) : { meta: {}, stats: {} };
  const events = byKey.timeline?.ok ? listFrom(byKey.timeline.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']).map(compactEvent) : [];
  const shotmap = byKey.shotmap?.ok ? listFrom(byKey.shotmap.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']).map(compactShot) : [];
  const playerStats = byKey.playerStats?.ok ? listFrom(byKey.playerStats.payload, ['data', 'players', 'player_stats', 'items', 'results']).map(compactPlayerStat) : [];
  const normalized = { matchInfo: compactMatchInfo(byKey.matchInfo?.payload, byKey.stats?.payload), liveStats: stats, lineups: byKey.lineups?.ok ? dataOf(byKey.lineups.payload) : null, eventsDetailed: { all: events }, shotmap, playerStats };
  const endpointSummaries = results.map((item) => ({ key: item.key, path: item.path, ok: item.ok, error: item.ok ? null : item.error, keySummary: item.ok ? null : item.error?.message || null }));
  let snapshotId: string | null = null;
  const useful = Object.keys(stats.stats || {}).length > 0 || events.length > 0 || shotmap.length > 0 || playerStats.length > 0 || Boolean(normalized.lineups) || Boolean(normalized.matchInfo?.venue || normalized.matchInfo?.referee);
  if (!dryRun && save && useful) {
    const rawData: Record<string, any> = { provider: 'THE_STATS_API', mode: 'match_extras_legacy_collect', endpointMode: mode, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, importedAt: new Date().toISOString(), endpoints: endpointSummaries, normalized };
    if (includeRaw) rawData.raw = Object.fromEntries(results.filter((item) => item.ok).map((item) => [item.key, item.payload]));
    const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: 'THE_STATS_API_EXTRAS', providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0, rawData }, select: { id: true } });
    snapshotId = snapshot.id;
  }
  const rateLimited = results.some((item) => Number(item.error?.status) === 429);
  return { ok: useful, matchId: match.id, endpointMode: mode, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, rateLimited, endpointsOk: results.filter((item) => item.ok).map((item) => item.key), endpointsFailed: results.filter((item) => !item.ok).map((item) => ({ key: item.key, status: item.error?.status, code: item.error?.code, message: item.error?.message })), counts: { stats: Object.keys(stats.stats || {}).length, detailedEvents: events.length, shots: shotmap.length, playerStats: playerStats.length, lineups: normalized.lineups ? 1 : 0 }, matchInfo: normalized.matchInfo, saved: Boolean(snapshotId), snapshotId, debug: { endpointSummaries, normalizedPreview: normalized, endpoints: includeRaw ? Object.fromEntries(results.map((item) => [item.key, item])) : undefined } };
}
