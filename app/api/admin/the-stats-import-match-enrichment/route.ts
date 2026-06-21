import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pair = { home: number | null; away: number | null };
type ProviderStat = Pair & { sourcePath: string };
type ProviderStats = Record<string, ProviderStat>;
type ProviderMatch = { providerId: string | null; homeName: string | null; awayName: string | null; matchDate: string | null };
type ProviderEvent = {
  minute: number | null;
  displayMinute: string | null;
  type: string;
  label: string;
  teamName: string | null;
  playerName: string | null;
  assistName: string | null;
  playerInName: string | null;
  playerOutName: string | null;
  detail: string;
  raw: any;
  sourcePath: string;
};

const TEAM_NAME_ALIASES = new Map([
  ['usa', 'united states'],
  ['us', 'united states'],
  ['u s a', 'united states'],
  ['united states of america', 'united states'],
  ['czechia', 'czech republic'],
  ['bosnia herzegovina', 'bosnia and herzegovina'],
  ['cote d ivoire', 'ivory coast'],
  ['côte d ivoire', 'ivory coast'],
]);

const EVENT_ENDPOINTS = ['events', 'incidents', 'timeline', 'commentary'];
const PLAYER_DETAIL_ENDPOINTS = ['players', 'player-stats', 'ratings'];

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const validSecrets = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret') || '',
    req.headers.get('x-cron-secret') || '',
    searchParams.get('adminSecret') || '',
    searchParams.get('cronSecret') || '',
    searchParams.get('key') || '',
  ];
  return candidates.some((value) => String(value).trim() && validSecrets.includes(String(value).trim()));
}

function boolParam(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function toInteger(value: any): number | null {
  const number = toNumber(value);
  return number === null ? null : Math.round(number);
}

function pair(value: any, sourcePath: string): ProviderStat | null {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' ? value.all : value;
  const home = toNumber(source.home);
  const away = toNumber(source.away);
  if (home === null && away === null) return null;
  return { home, away, sourcePath };
}

function addPairs(a?: ProviderStat | null, b?: ProviderStat | null, sourcePath = 'derived'): ProviderStat | null {
  if (!a && !b) return null;
  const home = (a?.home ?? 0) + (b?.home ?? 0);
  const away = (a?.away ?? 0) + (b?.away ?? 0);
  return { home, away, sourcePath };
}

function text(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeamName(value?: string | null) {
  const normalized = text(value);
  return TEAM_NAME_ALIASES.get(normalized) || normalized;
}

function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}

function str(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function extractEventRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data || payload?.response || payload?.result || payload;
  for (const key of ['events', 'incidents', 'timeline', 'commentary', 'data', 'items', 'results']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeProviderMatch(row: any): ProviderMatch {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    providerId: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    homeName: str(home?.name, row?.homeName, row?.home_team_name),
    awayName: str(away?.name, row?.awayName, row?.away_team_name),
    matchDate: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}

function sameDay(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / 36e5;
}

function providerMatchesLocal(provider: ProviderMatch, localMatch: any) {
  const providerHome = normalizeTeamName(provider.homeName);
  const providerAway = normalizeTeamName(provider.awayName);
  const localHome = normalizeTeamName(localMatch.homeTeam?.name || localMatch.homeTeam?.code);
  const localAway = normalizeTeamName(localMatch.awayTeam?.name || localMatch.awayTeam?.code);
  const homeMatches = providerHome && localHome && (providerHome === localHome || providerHome.includes(localHome) || localHome.includes(providerHome));
  const awayMatches = providerAway && localAway && (providerAway === localAway || providerAway.includes(localAway) || localAway.includes(providerAway));
  return Boolean(homeMatches && awayMatches && (sameDay(provider.matchDate, localMatch.matchDate) || hoursApart(provider.matchDate, localMatch.matchDate) <= 4));
}

function parseProviderStats(payload: any): ProviderStats {
  const data = payload?.data || payload;
  const overview = data?.overview || {};
  const shots = data?.shots || {};
  const attack = data?.attack || {};
  const passes = data?.passes || {};
  const defending = data?.defending || {};
  const goalkeeping = data?.goalkeeping || {};
  const npxg = data?.np_expected_goals || {};
  const stats: ProviderStats = {};
  const mappings: Array<[string, ProviderStat | null]> = [
    ['possession', pair(overview.ball_possession, 'data.overview.ball_possession')],
    ['xg', pair(overview.expected_goals, 'data.overview.expected_goals')],
    ['npxg', pair(npxg.all, 'data.np_expected_goals.all')],
    ['bigChances', pair(overview.big_chances, 'data.overview.big_chances')],
    ['shots', pair(overview.total_shots || shots.total_shots, overview.total_shots ? 'data.overview.total_shots' : 'data.shots.total_shots')],
    ['shotsOnTarget', pair(overview.shots_on_target || shots.shots_on_target, overview.shots_on_target ? 'data.overview.shots_on_target' : 'data.shots.shots_on_target')],
    ['shotsOffTarget', pair(shots.shots_off_target, 'data.shots.shots_off_target')],
    ['blockedShots', pair(shots.blocked_shots, 'data.shots.blocked_shots')],
    ['shotsInsideBox', pair(shots.shots_inside_box, 'data.shots.shots_inside_box')],
    ['shotsOutsideBox', pair(shots.shots_outside_box, 'data.shots.shots_outside_box')],
    ['corners', pair(overview.corner_kicks, 'data.overview.corner_kicks')],
    ['fouls', pair(overview.fouls, 'data.overview.fouls')],
    ['yellowCards', pair(overview.yellow_cards, 'data.overview.yellow_cards')],
    ['redCards', pair(overview.red_cards, 'data.overview.red_cards')],
    ['passes', pair(overview.passes, 'data.overview.passes')],
    ['accuratePasses', pair(overview.accurate_passes || passes.accurate_passes, overview.accurate_passes ? 'data.overview.accurate_passes' : 'data.passes.accurate_passes')],
    ['tackles', pair(overview.tackles || defending.tackles, overview.tackles ? 'data.overview.tackles' : 'data.defending.tackles')],
    ['saves', pair(overview.goalkeeper_saves || goalkeeping.saves, overview.goalkeeper_saves ? 'data.overview.goalkeeper_saves' : 'data.goalkeeping.saves')],
    ['offsides', pair(attack.offsides, 'data.attack.offsides')],
    ['interceptions', pair(defending.interceptions, 'data.defending.interceptions')],
    ['clearances', pair(defending.clearances, 'data.defending.clearances')],
    ['ballRecoveries', pair(defending.ball_recoveries, 'data.defending.ball_recoveries')],
  ];
  for (const [key, value] of mappings) if (value) stats[key] = value;
  return stats;
}

function compactPlayer(row: any) {
  const player = row?.player || row?.athlete || row?.person || row;
  const name = str(player?.name, player?.full_name, row?.name, row?.playerName, row?.display_name);
  if (!name) return null;
  return {
    id: str(player?.id, player?.player_id, row?.id, row?.player_id),
    name,
    number: first(player?.shirt_number, player?.jersey_number, player?.number, row?.shirt_number, row?.jersey_number, row?.number),
    image: str(player?.image, player?.photo, player?.image_url, row?.image, row?.photo, row?.image_url),
    position: str(player?.position, row?.position),
    rating: toNumber(first(player?.rating, row?.rating, row?.statistics?.rating, row?.stats?.rating)),
  };
}

function compactPlayers(rows: any[]) {
  return rows.map(compactPlayer).filter(Boolean);
}

function summarizeLineup(payload: any) {
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') return null;
  return {
    matchId: data.match_id || null,
    confirmed: Boolean(data.confirmed),
    home: data.home ? {
      id: data.home.id || null,
      name: data.home.name || null,
      formation: data.home.formation || null,
      startingXi: compactPlayers(data.home.starting_xi || data.home.startingXi || data.home.lineup || []),
      substitutes: compactPlayers(data.home.substitutes || data.home.bench || []),
      startingXiCount: Array.isArray(data.home.starting_xi) ? data.home.starting_xi.length : null,
      substitutesCount: Array.isArray(data.home.substitutes) ? data.home.substitutes.length : null,
    } : null,
    away: data.away ? {
      id: data.away.id || null,
      name: data.away.name || null,
      formation: data.away.formation || null,
      startingXi: compactPlayers(data.away.starting_xi || data.away.startingXi || data.away.lineup || []),
      substitutes: compactPlayers(data.away.substitutes || data.away.bench || []),
      startingXiCount: Array.isArray(data.away.starting_xi) ? data.away.starting_xi.length : null,
      substitutesCount: Array.isArray(data.away.substitutes) ? data.away.substitutes.length : null,
    } : null,
  };
}

async function resolveProviderMatchId(match: any, providerMatchesQuery: Record<string, string | number>) {
  const sourceProviderMatchId = String(match.externalId || '').trim() || null;
  if (sourceProviderMatchId?.startsWith('mt_')) return { sourceProviderMatchId, resolvedProviderMatchId: sourceProviderMatchId, resolvedBy: 'local_external_id' };
  const payload = await theStatsApiFetch('/api/football/matches', providerMatchesQuery, { timeoutMs: 15000 });
  const providerMatches = extractArray(payload).map(normalizeProviderMatch).filter((row) => row.providerId);
  const matched = providerMatches.find((candidate) => providerMatchesLocal(candidate, match));
  return { sourceProviderMatchId, resolvedProviderMatchId: matched?.providerId || null, resolvedBy: matched ? 'provider_match_list' : null, providerMatches: providerMatches.length };
}

function buildDerived(stats: ProviderStats) {
  return {
    shotsOffTargetForLocalCompare: addPairs(
      stats.shotsOffTarget,
      stats.blockedShots,
      'derived: data.shots.shots_off_target + data.shots.blocked_shots'
    ),
  };
}

async function fetchOptionalMatchPayloads(providerMatchId: string, endpoints: string[]) {
  return Promise.all(endpoints.map(async (endpoint) => {
    const path = `/api/football/matches/${encodeURIComponent(providerMatchId)}/${endpoint}`;
    try {
      const payload = await theStatsApiFetch(path, {}, { timeoutMs: 15000 });
      return { endpoint, path, ok: true, payload };
    } catch (error: any) {
      return { endpoint, path, ok: false, error: safeTheStatsApiError(error) };
    }
  }));
}

function eventMinute(row: any) {
  const rawMinute = first(row?.minute, row?.time?.minute, row?.elapsed, row?.match_minute, row?.matchMinute, row?.event_minute, row?.period_elapsed, row?.time);
  if (typeof rawMinute === 'string') {
    const stoppage = rawMinute.match(/(45|90|105)\s*\+\s*(\d+)/);
    if (stoppage) return { minute: Number(stoppage[1]) + Number(stoppage[2]), displayMinute: `${stoppage[1]}+${stoppage[2]}` };
  }
  const base = toInteger(rawMinute);
  const extra = toInteger(first(row?.extra_minute, row?.stoppage_time, row?.added_time, row?.minute_extra, row?.time?.extra, row?.extra));
  if (base !== null && extra !== null && extra > 0) return { minute: base + extra, displayMinute: `${base}+${extra}` };
  return { minute: base, displayMinute: base === null ? null : String(base) };
}

function eventTeamName(row: any) {
  return str(row?.team?.name, row?.team_name, row?.teamName, row?.club?.name, row?.side?.name, row?.participant?.name);
}

function eventPlayerName(row: any) {
  return str(row?.player?.name, row?.player_name, row?.playerName, row?.scorer?.name, row?.goal_scorer?.name, row?.athlete?.name, row?.person?.name);
}

function eventAssistName(row: any) {
  return str(row?.assist?.name, row?.assister?.name, row?.assist_player?.name, row?.assistPlayer?.name, row?.assist_name, row?.assistName);
}

function eventPlayerInName(row: any) {
  return str(row?.player_in?.name, row?.playerIn?.name, row?.player_on?.name, row?.substitution?.player_in?.name, row?.incoming_player?.name, row?.player_in_name, row?.playerInName);
}

function eventPlayerOutName(row: any) {
  return str(row?.player_out?.name, row?.playerOut?.name, row?.player_off?.name, row?.substitution?.player_out?.name, row?.outgoing_player?.name, row?.player_out_name, row?.playerOutName);
}

function normalizeEventType(row: any) {
  const raw = text(first(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail));
  if (raw.includes('own') || raw.includes('عكسي')) return { type: 'own_goal', label: 'هدف عكسي' };
  if (raw.includes('penalty missed') || raw.includes('missed penalty') || raw.includes('ركلة جزاء مهدرة')) return { type: 'penalty_missed', label: 'ركلة جزاء مهدرة' };
  if (raw.includes('penalty') || raw.includes('ركلة جزاء')) return { type: 'penalty_goal', label: 'هدف من ركلة جزاء' };
  if (raw.includes('goal') || raw.includes('هدف')) return { type: 'goal', label: 'هدف' };
  if (raw.includes('sub') || raw.includes('تبديل') || raw.includes('تغيير')) return { type: 'substitution', label: 'تبديل' };
  if (raw.includes('red') || raw.includes('حمراء')) return { type: 'red_card', label: 'بطاقة حمراء' };
  if (raw.includes('yellow') || raw.includes('card') || raw.includes('صفراء') || raw.includes('بطاقة')) return { type: 'yellow_card', label: 'بطاقة صفراء' };
  if (raw.includes('corner') || raw.includes('ركنية')) return { type: 'corner', label: 'ركنية' };
  if (raw.includes('var')) return { type: 'var', label: 'VAR' };
  if (raw.includes('injury') || raw.includes('إصابة') || raw.includes('اصابة')) return { type: 'injury', label: 'إصابة' };
  if (raw.includes('shot') || raw.includes('attempt') || raw.includes('تسديدة')) return { type: 'shot', label: 'تسديدة' };
  return { type: str(row?.type, row?.event_type, row?.incident_type) || 'note', label: str(row?.type, row?.event_type, row?.incident_type) || 'حدث' };
}

function compactProviderEvent(row: any, sourcePath: string): ProviderEvent | null {
  const minute = eventMinute(row);
  const normalized = normalizeEventType(row);
  const teamName = eventTeamName(row);
  const playerName = eventPlayerName(row);
  const assistName = eventAssistName(row);
  const playerInName = eventPlayerInName(row);
  const playerOutName = eventPlayerOutName(row);
  const existingDetail = str(row?.detail, row?.description, row?.comment, row?.text, row?.message);
  const parts = [
    teamName,
    minute.displayMinute ? `د${minute.displayMinute}'` : null,
    normalized.label,
    playerName,
    assistName ? `صناعة ${assistName}` : null,
    playerInName || playerOutName ? `دخول ${playerInName || 'غير متوفر'} / خروج ${playerOutName || 'غير متوفر'}` : null,
  ].filter(Boolean);
  const detail = existingDetail || parts.join(' - ');
  if (!detail && !normalized.label) return null;
  return {
    minute: minute.minute,
    displayMinute: minute.displayMinute,
    type: normalized.type,
    label: normalized.label,
    teamName,
    playerName,
    assistName,
    playerInName,
    playerOutName,
    detail: detail || normalized.label,
    raw: row,
    sourcePath,
  };
}

function teamIdForEvent(event: ProviderEvent, match: any) {
  const team = normalizeTeamName(event.teamName);
  const home = normalizeTeamName(match.homeTeam?.name || match.homeTeam?.code);
  const away = normalizeTeamName(match.awayTeam?.name || match.awayTeam?.code);
  if (team && home && (team === home || team.includes(home) || home.includes(team))) return match.homeTeamId;
  if (team && away && (team === away || team.includes(away) || away.includes(team))) return match.awayTeamId;
  const detail = normalizeTeamName(event.detail);
  if (home && detail.includes(home)) return match.homeTeamId;
  if (away && detail.includes(away)) return match.awayTeamId;
  return null;
}

function parseProviderEvents(payloads: any[]) {
  const events: ProviderEvent[] = [];
  for (const source of payloads.filter((item) => item.ok)) {
    for (const row of extractEventRows(source.payload)) {
      const event = compactProviderEvent(row, source.path);
      if (event) events.push(event);
    }
  }
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [event.minute, event.type, event.teamName, event.playerName, event.detail].map((value) => text(value)).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
}

function parsePlayerRatings(payloads: any[]) {
  const rows = payloads.filter((item) => item.ok).flatMap((item) => extractEventRows(item.payload).map((row) => ({ row, sourcePath: item.path })));
  const ratings = rows.map(({ row, sourcePath }) => {
    const player = compactPlayer(row);
    const rating = toNumber(first(player?.rating, row?.rating, row?.stats?.rating, row?.statistics?.rating, row?.performance?.rating));
    if (!player?.name || rating === null) return null;
    return { ...player, rating, sourcePath };
  }).filter(Boolean).sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
  return { ratings, manOfMatch: ratings[0] || null };
}

function snapshotPreview(match: any, numericProviderMatchId: number, theStatsApiMatchId: string, stats: ProviderStats, derived: any, lineup: any, providerEvents: ProviderEvent[], playerRatings: any, optionalSources: any[]) {
  const offTargetForLocal = derived.shotsOffTargetForLocalCompare;
  return {
    id: randomUUID(),
    matchId: match.id,
    provider: 'THE_STATS_API',
    providerMatchId: numericProviderMatchId,
    minute: null,
    homePossession: toInteger(stats.possession?.home),
    awayPossession: toInteger(stats.possession?.away),
    homeShots: toInteger(stats.shots?.home),
    awayShots: toInteger(stats.shots?.away),
    homeShotsOnTarget: toInteger(stats.shotsOnTarget?.home),
    awayShotsOnTarget: toInteger(stats.shotsOnTarget?.away),
    homeShotsOffTarget: toInteger(offTargetForLocal?.home ?? stats.shotsOffTarget?.home),
    awayShotsOffTarget: toInteger(offTargetForLocal?.away ?? stats.shotsOffTarget?.away),
    homeCorners: toInteger(stats.corners?.home),
    awayCorners: toInteger(stats.corners?.away),
    homeYellowCards: toInteger(stats.yellowCards?.home),
    awayYellowCards: toInteger(stats.yellowCards?.away),
    homeRedCards: toInteger(stats.redCards?.home),
    awayRedCards: toInteger(stats.redCards?.away),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    rawData: {
      theStatsApiMatchId,
      stats,
      derived,
      lineup,
      events: providerEvents,
      playerRatings,
      manOfMatch: playerRatings?.manOfMatch || null,
      importedAt: new Date().toISOString(),
      source: {
        provider: 'THE_STATS_API',
        statsPath: `/api/football/matches/${theStatsApiMatchId}/stats`,
        lineupsPath: `/api/football/matches/${theStatsApiMatchId}/lineups`,
        optionalSources: optionalSources.map((item) => ({ endpoint: item.endpoint, path: item.path, ok: item.ok, error: item.error || null })),
      },
      safety: {
        noOdds: true,
        noBetting: true,
        reviewedImport: true,
      },
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  const importEvents = boolParam(url.searchParams.get('importEvents'), true);
  const providerMatchesPerPage = clampInt(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100);
  const providerMatchesQuery = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: providerMatchesPerPage,
  };

  if (!matchId) {
    return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const resolved = await resolveProviderMatchId(match, providerMatchesQuery);
    if (!resolved.resolvedProviderMatchId) {
      return NextResponse.json({
        ok: false,
        mode: 'the_stats_import_match_enrichment',
        error: 'Could not resolve TheStatsAPI match id',
        matchId,
        localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
        resolved,
        config: getTheStatsApiConfigStatus(),
      }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const [statsPayload, lineupPayload, eventPayloads, playerPayloads] = await Promise.all([
      theStatsApiFetch(`/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/stats`, {}, { timeoutMs: 15000 }),
      theStatsApiFetch(`/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/lineups`, {}, { timeoutMs: 15000 }).catch((error) => ({ error: safeTheStatsApiError(error) })),
      fetchOptionalMatchPayloads(resolved.resolvedProviderMatchId, EVENT_ENDPOINTS),
      fetchOptionalMatchPayloads(resolved.resolvedProviderMatchId, PLAYER_DETAIL_ENDPOINTS),
    ]);

    const stats = parseProviderStats(statsPayload);
    const derived = buildDerived(stats);
    const lineup = (lineupPayload as any)?.error ? { error: (lineupPayload as any).error } : summarizeLineup(lineupPayload);
    const providerEvents = parseProviderEvents(eventPayloads);
    const playerRatings = parsePlayerRatings(playerPayloads);
    const optionalSources = [...eventPayloads, ...playerPayloads];
    if (playerRatings.manOfMatch) {
      providerEvents.push({
        minute: null,
        displayMinute: null,
        type: 'man_of_match',
        label: 'رجل المباراة',
        teamName: null,
        playerName: playerRatings.manOfMatch.name,
        assistName: null,
        playerInName: null,
        playerOutName: null,
        detail: `رجل المباراة حسب تقييم TheStatsAPI - ${playerRatings.manOfMatch.name} (${playerRatings.manOfMatch.rating})`,
        raw: playerRatings.manOfMatch,
        sourcePath: playerRatings.manOfMatch.sourcePath,
      });
    }

    const numericProviderMatchId = Number.parseInt(String(resolved.sourceProviderMatchId || match.externalId || match.animationMatchId || 0), 10) || 0;
    const data = snapshotPreview(match, numericProviderMatchId, resolved.resolvedProviderMatchId, stats, derived, lineup, providerEvents, playerRatings, optionalSources);

    let created = null;
    let importedMatchEvents = 0;
    if (!dryRun) {
      created = await prisma.matchStatsSnapshot.create({ data });
      if (importEvents && providerEvents.length) {
        await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: 'THE_STATS_API' } });
        const result = await prisma.matchEvent.createMany({
          data: providerEvents.map((event) => ({
            matchId: match.id,
            minute: event.minute,
            type: event.type,
            teamId: teamIdForEvent(event, match),
            playerName: event.playerName || event.playerInName || event.playerOutName || null,
            detail: event.detail,
            sourceName: 'THE_STATS_API',
            sourceUrl: event.sourcePath,
          })),
        });
        importedMatchEvents = result.count;
      }
    }

    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      mode: 'the_stats_import_match_enrichment',
      dryRun,
      saved: Boolean(created),
      matchId: match.id,
      localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      sourceProviderMatchId: resolved.sourceProviderMatchId,
      resolvedProviderMatchId: resolved.resolvedProviderMatchId,
      resolvedBy: resolved.resolvedBy,
      providerStatsFound: Object.keys(stats).length,
      lineupAvailable: Boolean(lineup && !(lineup as any).error),
      providerEventsFound: providerEvents.length,
      importedMatchEvents,
      manOfMatch: playerRatings.manOfMatch || null,
      optionalSources: optionalSources.map((item) => ({ endpoint: item.endpoint, ok: item.ok, error: item.error?.code || item.error?.status || null })),
      derived,
      snapshot: dryRun ? data : created,
      safety: {
        dryRunDefault: true,
        noMatchScoreUpdate: true,
        noISportsOverwrite: true,
        savesSeparateSnapshotOnly: true,
        importsEventsFromTheStatsApiOnly: true,
        prohibitedOddsStillBlocked: true,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      provider: 'THE_STATS_API',
      mode: 'the_stats_import_match_enrichment',
      error: safeTheStatsApiError(error),
      config: getTheStatsApiConfigStatus(),
    }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
