import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pair = { home: number | null; away: number | null };
type ProviderMatch = { providerId: string | null; homeName: string | null; awayName: string | null; matchDate: string | null };

type ProviderStat = Pair & { sourcePath: string };
type ProviderStats = Record<string, ProviderStat>;

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

const LOCAL_COMPARE_FIELDS = [
  { key: 'possession', label: 'possession', home: 'homePossession', away: 'awayPossession' },
  { key: 'shots', label: 'shots', home: 'homeShots', away: 'awayShots' },
  { key: 'shotsOnTarget', label: 'shots on target', home: 'homeShotsOnTarget', away: 'awayShotsOnTarget' },
  { key: 'shotsOffTarget', label: 'shots off target', home: 'homeShotsOffTarget', away: 'awayShotsOffTarget' },
  { key: 'corners', label: 'corners', home: 'homeCorners', away: 'awayCorners' },
  { key: 'yellowCards', label: 'yellow cards', home: 'homeYellowCards', away: 'awayYellowCards' },
  { key: 'redCards', label: 'red cards', home: 'homeRedCards', away: 'awayRedCards' },
] as const;

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const validSecrets = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get('x-admin-secret') || '', req.headers.get('x-cron-secret') || '', searchParams.get('adminSecret') || '', searchParams.get('cronSecret') || '', searchParams.get('key') || ''];
  return candidates.some((value) => String(value).trim() && validSecrets.includes(String(value).trim()));
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function boolParam(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function pair(value: any, sourcePath: string): ProviderStat | null {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' ? value.all : value;
  const home = toNumber(source.home);
  const away = toNumber(source.away);
  if (home === null && away === null) return null;
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

function resolveProviderMatchId(localMatch: any, providerMatches: ProviderMatch[]) {
  const source = String(localMatch.externalId || '').trim() || null;
  if (source?.startsWith('mt_') && source !== 'mt_12345') {
    const digits = source.replace(/\D/g, '');
    if (digits.length >= 8) {
      return { sourceProviderMatchId: source, resolvedProviderMatchId: source, resolvedBy: 'local_external_id' };
    }
  }
  const matched = providerMatches.find((candidate) => providerMatchesLocal(candidate, localMatch));
  return { sourceProviderMatchId: source, resolvedProviderMatchId: matched?.providerId || null, resolvedBy: matched ? 'provider_match_list' : null };
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

function localPair(snapshot: any, homeKey: string, awayKey: string): Pair | null {
  if (!snapshot) return null;
  const home = toNumber(snapshot[homeKey]);
  const away = toNumber(snapshot[awayKey]);
  if (home === null && away === null) return null;
  return { home, away };
}

function comparePair(local: Pair | null, provider: ProviderStat | undefined, tolerance: number) {
  if (!provider) return null;
  if (!local) return { status: 'provider_only', local, provider };
  const homeDiff = local.home !== null && provider.home !== null ? Math.abs(local.home - provider.home) : null;
  const awayDiff = local.away !== null && provider.away !== null ? Math.abs(local.away - provider.away) : null;
  const differs = (homeDiff !== null && homeDiff > tolerance) || (awayDiff !== null && awayDiff > tolerance);
  return { status: differs ? 'different' : 'matched', local, provider, homeDiff, awayDiff };
}

function summarizeLineup(payload: any) {
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') return null;
  return {
    confirmed: Boolean(data.confirmed),
    home: data.home ? {
      id: data.home.id || null,
      name: data.home.name || null,
      formation: data.home.formation || null,
      startingXiCount: Array.isArray(data.home.starting_xi) ? data.home.starting_xi.length : null,
      substitutesCount: Array.isArray(data.home.substitutes) ? data.home.substitutes.length : null,
    } : null,
    away: data.away ? {
      id: data.away.id || null,
      name: data.away.name || null,
      formation: data.away.formation || null,
      startingXiCount: Array.isArray(data.away.starting_xi) ? data.away.starting_xi.length : null,
      substitutesCount: Array.isArray(data.away.substitutes) ? data.away.substitutes.length : null,
    } : null,
  };
}

async function loadMatches(daysBack: number, take: number) {
  return prisma.match.findMany({
    where: { matchDate: { gte: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000), lte: new Date() } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take,
  });
}

async function latestLocalSnapshot(matchId: string) {
  return prisma.matchStatsSnapshot.findFirst({ where: { matchId }, orderBy: { capturedAt: 'desc' } });
}

async function reviewOne(match: any, providerMatches: ProviderMatch[], options: { tolerance: number; includeLineups: boolean }) {
  const resolved = resolveProviderMatchId(match, providerMatches);
  const localSnapshot = await latestLocalSnapshot(match.id);
  const base = {
    localMatchId: match.id,
    localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
    localDate: match.matchDate,
    sourceProviderMatchId: resolved.sourceProviderMatchId,
    resolvedProviderMatchId: resolved.resolvedProviderMatchId,
    resolvedBy: resolved.resolvedBy,
    localSnapshotAvailable: Boolean(localSnapshot),
  };

  if (!resolved.resolvedProviderMatchId) return { ...base, ok: false, warning: 'missing_resolved_provider_match_id' };

  const statsPath = `/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/stats`;
  try {
    const statsPayload = await theStatsApiFetch(statsPath, {}, { timeoutMs: 15000 });
    const providerStats = parseProviderStats(statsPayload);
    const comparisons = LOCAL_COMPARE_FIELDS.map((field) => {
      const comparison = comparePair(localPair(localSnapshot, field.home, field.away), providerStats[field.key], options.tolerance);
      return comparison ? { key: field.key, label: field.label, ...comparison } : null;
    }).filter(Boolean);
    const localComparedKeys = new Set(LOCAL_COMPARE_FIELDS.map((field) => field.key));
    const providerOnly = Object.entries(providerStats)
      .filter(([key]) => !localComparedKeys.has(key as any) || !LOCAL_COMPARE_FIELDS.some((field) => field.key === key && localPair(localSnapshot, field.home, field.away)))
      .map(([key, value]) => ({ key, provider: value }));
    const missingFromProvider = LOCAL_COMPARE_FIELDS
      .filter((field) => localPair(localSnapshot, field.home, field.away) && !providerStats[field.key])
      .map((field) => ({ key: field.key, label: field.label, local: localPair(localSnapshot, field.home, field.away) }));

    let lineup = null;
    let lineupError = null;
    if (options.includeLineups) {
      try {
        lineup = summarizeLineup(await theStatsApiFetch(`/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/lineups`, {}, { timeoutMs: 15000 }));
      } catch (error: any) {
        lineupError = safeTheStatsApiError(error);
      }
    }

    return {
      ...base,
      ok: true,
      statsAvailable: Object.keys(providerStats).length > 0,
      providerStatsFound: Object.keys(providerStats).length,
      statsPath,
      providerStats,
      comparisons,
      providerOnly,
      missingFromProvider,
      lineup,
      lineupError,
      extraSignals: {
        xgAvailable: Boolean(providerStats.xg || providerStats.npxg),
        npxgAvailable: Boolean(providerStats.npxg),
        lineupsAvailable: Boolean(lineup),
      },
    };
  } catch (error: any) {
    return { ...base, ok: false, statsAvailable: false, statsPath, providerError: safeTheStatsApiError(error), comparisons: [], providerOnly: [], missingFromProvider: [] };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const daysBack = clampInt(url.searchParams.get('daysBack'), 3, 1, 30);
  const take = clampInt(url.searchParams.get('take'), 1, 1, 6);
  const tolerance = clampInt(url.searchParams.get('tolerance'), 1, 0, 20);
  const includeLineups = boolParam(url.searchParams.get('includeLineups'), true);
  const providerMatchesPerPage = clampInt(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100);
  const providerMatchesQuery = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: providerMatchesPerPage,
  };

  const [matches, providerMatchesPayload] = await Promise.all([
    loadMatches(daysBack, take),
    theStatsApiFetch('/api/football/matches', providerMatchesQuery, { timeoutMs: 15000 }),
  ]);
  const providerMatches = extractArray(providerMatchesPayload).map(normalizeProviderMatch).filter((row) => row.providerId);
  const review = [];
  for (const match of matches) review.push(await reviewOne(match, providerMatches, { tolerance, includeLineups }));

  const statsAvailableMatches = review.filter((item: any) => item.statsAvailable).length;
  const differentComparisons = review.reduce((sum, item: any) => sum + (item.comparisons || []).filter((comparison: any) => comparison.status === 'different').length, 0);
  const providerOnlyFields = review.reduce((sum, item: any) => sum + (item.providerOnly || []).length, 0);
  const localOnlyFields = review.reduce((sum, item: any) => sum + (item.missingFromProvider || []).length, 0);
  const lineupsAvailableMatches = review.filter((item: any) => item.lineup).length;

  return NextResponse.json({
    ok: true,
    provider: 'THE_STATS_API',
    mode: 'stats_review_only_v3',
    config: getTheStatsApiConfigStatus(),
    localMatches: matches.length,
    providerMatches: providerMatches.length,
    statsAvailableMatches,
    lineupsAvailableMatches,
    differentComparisons,
    providerOnlyFields,
    localOnlyFields,
    providerMatchesPerPage,
    review,
    safety: {
      reviewOnly: true,
      noDatabaseWrites: true,
      parsedNestedAllValues: true,
      parsedKnownStatsShape: true,
      includesLineupSummaryOnly: includeLineups,
      maxMatchesPerRequest: 6,
      prohibitedOddsStillBlocked: true,
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
