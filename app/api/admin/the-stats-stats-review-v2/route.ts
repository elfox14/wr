import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StatPair = { home: number | null; away: number | null; sourceLabel?: string };
type ProviderStats = Record<string, StatPair>;
type ProviderMatchRow = { providerId: string | null; homeName: string | null; awayName: string | null; matchDate: string | null; status: string | null };

const COMPARED_STATS = [
  { key: 'possession', label: 'possession', localHome: 'homePossession', localAway: 'awayPossession', tokens: ['possession', 'ball possession', 'poss'] },
  { key: 'attacks', label: 'attacks', localHome: 'homeAttacks', localAway: 'awayAttacks', tokens: ['attack', 'attacks'] },
  { key: 'dangerousAttacks', label: 'dangerous attacks', localHome: 'homeDangerousAttacks', localAway: 'awayDangerousAttacks', tokens: ['dangerous attack', 'dangerous attacks', 'd att', 'd-att'] },
  { key: 'shots', label: 'shots', localHome: 'homeShots', localAway: 'awayShots', tokens: ['shots', 'total shots', 'shot'] },
  { key: 'shotsOnTarget', label: 'shots on target', localHome: 'homeShotsOnTarget', localAway: 'awayShotsOnTarget', tokens: ['shots on target', 'shot on target', 'on target', 'sot'] },
  { key: 'shotsOffTarget', label: 'shots off target', localHome: 'homeShotsOffTarget', localAway: 'awayShotsOffTarget', tokens: ['shots off target', 'shot off target', 'off target'] },
  { key: 'corners', label: 'corners', localHome: 'homeCorners', localAway: 'awayCorners', tokens: ['corner', 'corners', 'corner kicks'] },
  { key: 'yellowCards', label: 'yellow cards', localHome: 'homeYellowCards', localAway: 'awayYellowCards', tokens: ['yellow card', 'yellow cards'] },
  { key: 'redCards', label: 'red cards', localHome: 'homeRedCards', localAway: 'awayRedCards', tokens: ['red card', 'red cards'] },
] as const;

const EXTRA_STATS = [
  { key: 'xg', label: 'expected goals', tokens: ['xg', 'expected goals'] },
  { key: 'npxg', label: 'non-penalty xG', tokens: ['npxg', 'non penalty xg', 'non-penalty xg'] },
  { key: 'xa', label: 'expected assists', tokens: ['xa', 'expected assists'] },
  { key: 'passes', label: 'passes', tokens: ['passes', 'total passes'] },
  { key: 'accuratePasses', label: 'accurate passes', tokens: ['accurate passes', 'successful passes'] },
  { key: 'fouls', label: 'fouls', tokens: ['fouls', 'fouls committed'] },
  { key: 'offsides', label: 'offsides', tokens: ['offsides', 'offside'] },
  { key: 'saves', label: 'saves', tokens: ['saves', 'goalkeeper saves'] },
] as const;

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

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
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

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06ff\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeamName(value?: string | null) {
  const normalized = text(value);
  return TEAM_NAME_ALIASES.get(normalized) || normalized;
}

function pickFirst(...values: unknown[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return undefined;
}

function asString(...values: unknown[]) {
  const value = pickFirst(...values);
  return value === undefined ? null : String(value).trim();
}

function getPath(obj: any, path: string) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function normalizeProviderMatch(row: any): ProviderMatchRow {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  const statusObject = fixture?.status || row?.status || {};
  return {
    providerId: asString(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    homeName: asString(home?.name, row?.homeName, row?.home_team_name),
    awayName: asString(away?.name, row?.awayName, row?.away_team_name),
    matchDate: asString(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
    status: asString(statusObject?.short, statusObject?.long, row?.status, row?.matchStatus, row?.match_status),
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

function providerMatchesLocal(providerMatch: ProviderMatchRow, localMatch: any) {
  const providerHome = normalizeTeamName(providerMatch.homeName);
  const providerAway = normalizeTeamName(providerMatch.awayName);
  const localHome = normalizeTeamName(localMatch.homeTeam?.name || localMatch.homeTeam?.code);
  const localAway = normalizeTeamName(localMatch.awayTeam?.name || localMatch.awayTeam?.code);
  const homeMatches = providerHome && localHome && (providerHome === localHome || providerHome.includes(localHome) || localHome.includes(providerHome));
  const awayMatches = providerAway && localAway && (providerAway === localAway || providerAway.includes(localAway) || localAway.includes(providerAway));
  return homeMatches && awayMatches && (sameDay(providerMatch.matchDate, localMatch.matchDate) || hoursApart(providerMatch.matchDate, localMatch.matchDate) <= 4);
}

function resolveProviderMatchId(localMatch: any, providerMatches: ProviderMatchRow[]) {
  const existing = String(localMatch.externalId || '').trim();
  if (existing.startsWith('mt_')) return { resolvedProviderMatchId: existing, resolvedBy: 'local_external_id' };
  const matched = providerMatches.find((row) => providerMatchesLocal(row, localMatch));
  return { resolvedProviderMatchId: matched?.providerId || null, resolvedBy: matched ? 'provider_match_list' : null };
}

function collectObjects(value: any, output: any[] = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 7) return output;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output, depth + 1);
    return output;
  }
  output.push(value);
  for (const child of Object.values(value)) collectObjects(child, output, depth + 1);
  return output;
}

function statKeyFromLabel(rawLabel: unknown) {
  const label = text(rawLabel);
  const allStats = [...COMPARED_STATS, ...EXTRA_STATS];
  return allStats.find((spec) => spec.tokens.some((token) => label === text(token) || label.includes(text(token))))?.key || null;
}

function readHomeAway(row: any): StatPair | null {
  const home = toNumber(pickFirst(row.home, row.homeValue, row.home_value, row.homeTeam, row.localteam, getPath(row, 'values.home'), getPath(row, 'value.home'), getPath(row, 'teams.home')));
  const away = toNumber(pickFirst(row.away, row.awayValue, row.away_value, row.awayTeam, row.visitorteam, getPath(row, 'values.away'), getPath(row, 'value.away'), getPath(row, 'teams.away')));
  if (home === null && away === null) return null;
  return { home, away };
}

function normalizeProviderStats(payload: any) {
  const stats: ProviderStats = {};
  const objects = collectObjects(payload);
  for (const row of objects) {
    const label = pickFirst(row.type, row.name, row.key, row.stat, row.statName, row.statisticsType, row.label, row.title);
    const key = statKeyFromLabel(label);
    if (!key || stats[key]) continue;
    const pair = readHomeAway(row);
    if (pair) stats[key] = { ...pair, sourceLabel: String(label || key) };
  }
  for (const object of objects) {
    const record = object as Record<string, any>;
    for (const spec of [...COMPARED_STATS, ...EXTRA_STATS]) {
      if (stats[spec.key]) continue;
      const home = toNumber(pickFirst(record[`home${spec.key}`], record[`home_${spec.key}`], record.home?.[spec.key], record.homeTeam?.[spec.key], record.home_stats?.[spec.key]));
      const away = toNumber(pickFirst(record[`away${spec.key}`], record[`away_${spec.key}`], record.away?.[spec.key], record.awayTeam?.[spec.key], record.away_stats?.[spec.key]));
      if (home !== null || away !== null) stats[spec.key] = { home, away, sourceLabel: spec.label };
    }
  }
  return stats;
}

function countProviderStats(stats: ProviderStats) {
  return Object.values(stats).filter((pair) => pair && (pair.home !== null || pair.away !== null)).length;
}

function hasKeyDeep(value: any, patterns: string[], depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 7) return false;
  if (Array.isArray(value)) return value.some((item) => hasKeyDeep(item, patterns, depth + 1));
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = text(key);
    if (patterns.some((pattern) => normalizedKey.includes(text(pattern)))) return true;
    if (hasKeyDeep(child, patterns, depth + 1)) return true;
  }
  return false;
}

function localPair(snapshot: any, homeKey: string, awayKey: string): StatPair | null {
  if (!snapshot) return null;
  const home = toNumber(snapshot[homeKey]);
  const away = toNumber(snapshot[awayKey]);
  if (home === null && away === null) return null;
  return { home, away };
}

function diffPair(local: StatPair | null, provider: StatPair | undefined, tolerance: number) {
  if (!provider) return null;
  if (!local) return { status: 'provider_only', local, provider };
  const homeDiff = local.home !== null && provider.home !== null ? Math.abs(local.home - provider.home) : null;
  const awayDiff = local.away !== null && provider.away !== null ? Math.abs(local.away - provider.away) : null;
  const differs = (homeDiff !== null && homeDiff > tolerance) || (awayDiff !== null && awayDiff > tolerance);
  return { status: differs ? 'different' : 'matched', local, provider, homeDiff, awayDiff };
}

async function loadPastMatches(daysBack: number, take: number) {
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

function providerPath(template: string, providerMatchId: string) {
  return template.replace('{matchId}', encodeURIComponent(providerMatchId));
}

async function reviewOneMatch(match: any, providerMatches: ProviderMatchRow[], options: { statsPathTemplate: string; tolerance: number }) {
  const sourceProviderMatchId = String(match.externalId || '').trim() || null;
  const resolved = resolveProviderMatchId(match, providerMatches);
  const providerMatchId = resolved.resolvedProviderMatchId;
  const localSnapshot = await latestLocalSnapshot(match.id);
  const base = {
    localMatchId: match.id,
    localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
    localDate: match.matchDate,
    localStatus: match.status,
    sourceProviderMatchId,
    resolvedProviderMatchId: providerMatchId,
    resolvedBy: resolved.resolvedBy,
    localSnapshotAvailable: Boolean(localSnapshot),
  };
  if (!providerMatchId) return { ...base, ok: false, statsAvailable: false, warning: 'missing_resolved_provider_match_id', comparisons: [], providerOnly: [], missingFromProvider: [] };

  const path = providerPath(options.statsPathTemplate, providerMatchId);
  try {
    const payload = await theStatsApiFetch(path, {}, { timeoutMs: 15000 });
    const providerStats = normalizeProviderStats(payload);
    const comparisons = COMPARED_STATS.map((spec) => {
      const local = localPair(localSnapshot, spec.localHome, spec.localAway);
      const provider = providerStats[spec.key];
      const comparison = diffPair(local, provider, options.tolerance);
      return comparison ? { key: spec.key, label: spec.label, ...comparison } : null;
    }).filter(Boolean);
    const providerOnly = [...COMPARED_STATS, ...EXTRA_STATS]
      .filter((spec) => providerStats[spec.key] && !COMPARED_STATS.some((known) => known.key === spec.key && localPair(localSnapshot, known.localHome, known.localAway)))
      .map((spec) => ({ key: spec.key, label: spec.label, provider: providerStats[spec.key] }));
    const missingFromProvider = COMPARED_STATS
      .filter((spec) => localPair(localSnapshot, spec.localHome, spec.localAway) && !providerStats[spec.key])
      .map((spec) => ({ key: spec.key, label: spec.label, local: localPair(localSnapshot, spec.localHome, spec.localAway) }));
    return {
      ...base,
      ok: true,
      statsAvailable: countProviderStats(providerStats) > 0,
      providerStatsFound: countProviderStats(providerStats),
      statsPath: path,
      comparisons,
      providerOnly,
      missingFromProvider,
      extraSignals: {
        xgAvailable: Boolean(providerStats.xg || providerStats.npxg),
        xaAvailable: Boolean(providerStats.xa),
        lineupsLikelyAvailable: hasKeyDeep(payload, ['lineup', 'lineups', 'formation', 'formations', 'starting xi', 'starting lineup']),
        playerStatsLikelyAvailable: hasKeyDeep(payload, ['player stats', 'player_stats', 'players', 'player_statistics']),
      },
      sampleKeys: Object.keys(payload || {}).slice(0, 20),
    };
  } catch (error: any) {
    return { ...base, ok: false, statsAvailable: false, statsPath: path, providerError: safeTheStatsApiError(error), comparisons: [], providerOnly: [], missingFromProvider: [] };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const daysBack = clampInt(url.searchParams.get('daysBack'), 3, 1, 30);
  const take = clampInt(url.searchParams.get('take'), 3, 1, 12);
  const tolerance = clampInt(url.searchParams.get('tolerance'), 1, 0, 20);
  const statsPathTemplate = url.searchParams.get('statsPathTemplate') || '/api/football/matches/{matchId}/stats';
  const matchesPath = url.searchParams.get('matchesPath') || '/api/football/matches';
  const providerMatchesPerPage = clampInt(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100);
  const providerMatchesQuery = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: providerMatchesPerPage,
  };

  const [matches, providerMatchesPayload] = await Promise.all([
    loadPastMatches(daysBack, take),
    theStatsApiFetch(matchesPath, providerMatchesQuery, { timeoutMs: 15000 }),
  ]);
  const providerMatches = extractArray(providerMatchesPayload).map(normalizeProviderMatch).filter((row) => row.providerId);
  const review = [];
  for (const match of matches) review.push(await reviewOneMatch(match, providerMatches, { statsPathTemplate, tolerance }));

  const available = review.filter((item) => item.statsAvailable).length;
  const different = review.reduce((sum, item: any) => sum + (item.comparisons || []).filter((comparison: any) => comparison.status === 'different').length, 0);
  const providerOnly = review.reduce((sum, item: any) => sum + (item.providerOnly || []).length, 0);
  const missingFromProvider = review.reduce((sum, item: any) => sum + (item.missingFromProvider || []).length, 0);

  return NextResponse.json({
    ok: true,
    provider: 'THE_STATS_API',
    mode: 'stats_review_only_v2',
    config: getTheStatsApiConfigStatus(),
    localMatches: matches.length,
    providerMatches: providerMatches.length,
    statsAvailableMatches: available,
    differentComparisons: different,
    providerOnlyFields: providerOnly,
    localOnlyFields: missingFromProvider,
    matchesPath,
    statsPathTemplate,
    providerMatchesPerPage,
    review,
    safety: { reviewOnly: true, resolvesTheStatsApiMatchIds: true, comparesAgainstISportsSnapshots: true, noDatabaseWrites: true, maxMatchesPerRequest: 12, prohibitedOddsStillBlocked: true },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
