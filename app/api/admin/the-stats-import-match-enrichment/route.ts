import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pair = { home: number | null; away: number | null };
type ProviderStat = Pair & { sourcePath: string };
type ProviderStats = Record<string, ProviderStat>;
type ProviderMatch = { providerId: string | null; homeName: string | null; awayName: string | null; matchDate: string | null };

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

function addPairs(a?: ProviderStat | null, b?: ProviderStat | null, sourcePath = 'derived'): ProviderStat | null {
  if (!a && !b) return null;
  const home = (a?.home ?? 0) + (b?.home ?? 0);
  const away = (a?.away ?? 0) + (b?.away ?? 0);
  return { home, away, sourcePath };
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

function hashToInt(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash || 1);
}

function providerMatchIdAsInt(sourceExternalId: string | null, resolvedProviderMatchId: string) {
  const numeric = Number(sourceExternalId || '');
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return hashToInt(resolvedProviderMatchId) % 2147483647;
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

async function resolveProviderMatch(match: any) {
  const sourceProviderMatchId = String(match.externalId || '').trim() || null;
  if (sourceProviderMatchId?.startsWith('mt_')) return { sourceProviderMatchId, resolvedProviderMatchId: sourceProviderMatchId, resolvedBy: 'local_external_id' };

  const providerMatchesPayload = await theStatsApiFetch('/api/football/matches', {
    competition_id: process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: 100,
  }, { timeoutMs: 15000 });
  const providerMatches = extractArray(providerMatchesPayload).map(normalizeProviderMatch).filter((row) => row.providerId);
  const resolved = providerMatches.find((row) => providerMatchesLocal(row, match));
  return { sourceProviderMatchId, resolvedProviderMatchId: resolved?.providerId || null, resolvedBy: resolved ? 'provider_match_list' : null };
}

async function buildSnapshotPayload(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match) return { ok: false as const, status: 404, body: { ok: false, error: 'match_not_found' } };

  const resolved = await resolveProviderMatch(match);
  if (!resolved.resolvedProviderMatchId) return { ok: false as const, status: 422, body: { ok: false, error: 'provider_match_not_resolved', ...resolved } };

  const statsPath = `/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/stats`;
  const lineupsPath = `/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/lineups`;
  const statsPayload = await theStatsApiFetch(statsPath, {}, { timeoutMs: 15000 });
  let lineupsPayload = null;
  let lineupError = null;
  try {
    lineupsPayload = await theStatsApiFetch(lineupsPath, {}, { timeoutMs: 15000 });
  } catch (error: any) {
    lineupError = safeTheStatsApiError(error);
  }

  const stats = parseProviderStats(statsPayload);
  const derived = {
    shotsOffTargetForLocalCompare: addPairs(
      stats.shotsOffTarget,
      stats.blockedShots,
      'derived: data.shots.shots_off_target + data.shots.blocked_shots'
    ),
  };
  const lineup = summarizeLineup(lineupsPayload);
  const rawData = {
    theStatsApi: {
      provider: 'THE_STATS_API',
      mode: 'match_enrichment_import',
      sourceProviderMatchId: resolved.sourceProviderMatchId,
      resolvedProviderMatchId: resolved.resolvedProviderMatchId,
      resolvedBy: resolved.resolvedBy,
      statsPath,
      lineupsPath,
      stats,
      derived,
      lineup,
      lineupError,
      importedAt: new Date().toISOString(),
      safety: {
        noOdds: true,
        reviewedImport: true,
      },
    },
    stats,
    derived,
    lineup,
  };

  return {
    ok: true as const,
    match,
    resolved,
    stats,
    derived,
    lineup,
    lineupError,
    rawData,
    providerMatchIdInt: providerMatchIdAsInt(resolved.sourceProviderMatchId, resolved.resolvedProviderMatchId),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  if (!matchId) return NextResponse.json({ ok: false, error: 'missing_matchId' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  try {
    const built = await buildSnapshotPayload(matchId);
    if (!built.ok) return NextResponse.json(built.body, { status: built.status, headers: { 'Cache-Control': 'no-store' } });

    const summary = {
      sourceProviderMatchId: built.resolved.sourceProviderMatchId,
      resolvedProviderMatchId: built.resolved.resolvedProviderMatchId,
      resolvedBy: built.resolved.resolvedBy,
      statsFound: Object.keys(built.stats).length,
      derivedFields: Object.keys(built.derived).filter((key) => built.derived[key as keyof typeof built.derived]),
      lineupAvailable: Boolean(built.lineup),
      providerMatchIdInt: built.providerMatchIdInt,
    };

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        provider: 'THE_STATS_API',
        mode: 'match_enrichment_import_preview',
        config: getTheStatsApiConfigStatus(),
        matchId,
        summary,
        safety: { noDatabaseWrites: true, noOdds: true },
      }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    const snapshot = await prisma.matchStatsSnapshot.create({
      data: {
        id: `thestats_${matchId}_${Date.now()}`,
        matchId,
        provider: 'THE_STATS_API',
        providerMatchId: built.providerMatchIdInt,
        minute: null,
        homePossession: built.stats.possession?.home ?? null,
        awayPossession: built.stats.possession?.away ?? null,
        homeShots: built.stats.shots?.home ?? null,
        awayShots: built.stats.shots?.away ?? null,
        homeShotsOnTarget: built.stats.shotsOnTarget?.home ?? null,
        awayShotsOnTarget: built.stats.shotsOnTarget?.away ?? null,
        homeShotsOffTarget: built.derived.shotsOffTargetForLocalCompare?.home ?? built.stats.shotsOffTarget?.home ?? null,
        awayShotsOffTarget: built.derived.shotsOffTargetForLocalCompare?.away ?? built.stats.shotsOffTarget?.away ?? null,
        homeCorners: built.stats.corners?.home ?? null,
        awayCorners: built.stats.corners?.away ?? null,
        homeYellowCards: built.stats.yellowCards?.home ?? null,
        awayYellowCards: built.stats.yellowCards?.away ?? null,
        homeRedCards: built.stats.redCards?.home ?? null,
        awayRedCards: built.stats.redCards?.away ?? null,
        homeScore: built.match.homeScore,
        awayScore: built.match.awayScore,
        rawData: built.rawData,
      },
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      provider: 'THE_STATS_API',
      mode: 'match_enrichment_import_saved',
      matchId,
      snapshotId: snapshot.id,
      summary,
      safety: { noMatchScoreWrites: true, noISportsOverwrite: true, noOdds: true },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
