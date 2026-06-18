import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pair = { home: number | null; away: number | null; sourcePath?: string };
type ProviderStats = Record<string, Pair>;
type ProviderMatch = {
  providerId: string;
  localMatchId: string | null;
  homeName: string;
  awayName: string;
  matchDate: string | null;
  status: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

type TeamAggregate = {
  id: string;
  name: string;
  code: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
};

let cachedSummary: { expiresAt: number; payload: any } | null = null;

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

const AGGREGATED_STAT_KEYS = [
  'possession',
  'xg',
  'npxg',
  'bigChances',
  'shots',
  'shotsOnTarget',
  'shotsOffTarget',
  'blockedShots',
  'shotsInsideBox',
  'shotsOutsideBox',
  'corners',
  'fouls',
  'yellowCards',
  'redCards',
  'passes',
  'accuratePasses',
  'tackles',
  'saves',
  'offsides',
  'interceptions',
  'clearances',
  'ballRecoveries',
  'attacks',
  'dangerousAttacks',
  'penalties',
  'penaltiesScored',
  'penaltiesMissed',
] as const;

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name] || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function safeNumber(value: unknown) {
  return toNumber(value) ?? 0;
}

function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}

function str(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
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

function valueNumber(value: any): number | null {
  const direct = toNumber(value);
  if (direct !== null) return direct;
  if (!value || typeof value !== 'object') return null;
  return firstNumber(value.value, value.total, value.count, value.all, value.percent, value.percentage, value.displayValue);
}

function firstNumber(...values: any[]) {
  for (const value of values) {
    const number = valueNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function pair(value: any, sourcePath: string): Pair | null {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' && ('home' in value.all || 'away' in value.all) ? value.all : value;
  const home = firstNumber(source.home, source.homeTeam, source.home_team, source.localteam, source.team_home);
  const away = firstNumber(source.away, source.awayTeam, source.away_team, source.visitorteam, source.team_away);
  if (home === null && away === null) return null;
  return { home, away, sourcePath };
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function readTeamName(value: any) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return str(value.name, value.short_name, value.display_name, value.country, value.title);
}

function normalizeProviderMatch(row: any): Omit<ProviderMatch, 'localMatchId'> | null {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || row?.localteam || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || row?.visitorteam || {};
  const statusObject = fixture?.status || row?.status || row?.match_status || {};
  const score = row?.score || row?.scores || row?.goals || fixture?.score || {};
  const result = row?.result || row?.full_time || row?.fulltime || score?.full_time || score?.fulltime || {};
  const providerId = str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id);
  if (!providerId) return null;

  return {
    providerId,
    homeName: readTeamName(home) || str(row?.homeName, row?.home_team_name) || 'Home',
    awayName: readTeamName(away) || str(row?.awayName, row?.away_team_name) || 'Away',
    matchDate: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
    status: str(statusObject?.short, statusObject?.long, statusObject?.name, row?.status, row?.matchStatus, row?.match_status),
    homeScore: firstNumber(score.home, score.home_score, result.home, result.home_score, row?.homeScore, row?.home_score),
    awayScore: firstNumber(score.away, score.away_score, result.away, result.away_score, row?.awayScore, row?.away_score),
  };
}

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function isLiveStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET', 'BREAK'].includes(value);
}

function isFinishedStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'].includes(value);
}

function isScheduledStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', 'TBD'].includes(value);
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

function providerMatchesLocal(provider: Omit<ProviderMatch, 'localMatchId'>, localMatch: any) {
  const providerHome = normalizeTeamName(provider.homeName);
  const providerAway = normalizeTeamName(provider.awayName);
  const localHome = normalizeTeamName(localMatch.homeTeam?.name || localMatch.homeTeam?.code);
  const localAway = normalizeTeamName(localMatch.awayTeam?.name || localMatch.awayTeam?.code);
  const homeMatches = providerHome && localHome && (providerHome === localHome || providerHome.includes(localHome) || localHome.includes(providerHome));
  const awayMatches = providerAway && localAway && (providerAway === localAway || providerAway.includes(localAway) || localAway.includes(providerAway));
  return Boolean(homeMatches && awayMatches && (sameDay(provider.matchDate, localMatch.matchDate) || hoursApart(provider.matchDate, localMatch.matchDate) <= 4));
}

function resolveLocalMatchId(provider: Omit<ProviderMatch, 'localMatchId'>, localMatches: any[]) {
  const byExternalId = localMatches.find((match) => String(match.externalId || '').trim() === provider.providerId);
  if (byExternalId) return byExternalId.id;
  return localMatches.find((match) => providerMatchesLocal(provider, match))?.id || null;
}

function parseProviderStats(payload: any): ProviderStats {
  const data = payload?.data || payload;
  const overview = data?.overview || {};
  const shots = data?.shots || {};
  const attack = data?.attack || data?.attacking || {};
  const passes = data?.passes || data?.passing || {};
  const defending = data?.defending || data?.defence || {};
  const goalkeeping = data?.goalkeeping || data?.keeper || {};
  const penalties = data?.penalties || {};
  const npxg = data?.np_expected_goals || data?.non_penalty_expected_goals || {};
  const stats: ProviderStats = {};

  const mappings: Array<[string, Pair | null]> = [
    ['possession', pair(first(overview.ball_possession, overview.possession, data.ball_possession, data.possession), 'overview.ball_possession')],
    ['xg', pair(first(overview.expected_goals, overview.xg, data.expected_goals, data.xg), 'overview.expected_goals')],
    ['npxg', pair(first(npxg.all, npxg, overview.non_penalty_expected_goals, overview.npxg), 'np_expected_goals')],
    ['bigChances', pair(first(overview.big_chances, attack.big_chances, data.big_chances), 'overview.big_chances')],
    ['shots', pair(first(overview.total_shots, shots.total_shots, shots.shots, data.total_shots), 'shots.total_shots')],
    ['shotsOnTarget', pair(first(overview.shots_on_target, shots.shots_on_target, data.shots_on_target), 'shots.shots_on_target')],
    ['shotsOffTarget', pair(first(overview.shots_off_target, shots.shots_off_target, data.shots_off_target), 'shots.shots_off_target')],
    ['blockedShots', pair(first(shots.blocked_shots, overview.blocked_shots, data.blocked_shots), 'shots.blocked_shots')],
    ['shotsInsideBox', pair(first(shots.shots_inside_box, overview.shots_inside_box, data.shots_inside_box), 'shots.shots_inside_box')],
    ['shotsOutsideBox', pair(first(shots.shots_outside_box, overview.shots_outside_box, data.shots_outside_box), 'shots.shots_outside_box')],
    ['corners', pair(first(overview.corner_kicks, overview.corners, attack.corners, data.corner_kicks), 'overview.corner_kicks')],
    ['fouls', pair(first(overview.fouls, data.fouls), 'overview.fouls')],
    ['yellowCards', pair(first(overview.yellow_cards, overview.yellowCards, data.yellow_cards), 'overview.yellow_cards')],
    ['redCards', pair(first(overview.red_cards, overview.redCards, data.red_cards), 'overview.red_cards')],
    ['passes', pair(first(overview.passes, passes.passes, passes.total_passes, data.passes), 'passes.total_passes')],
    ['accuratePasses', pair(first(overview.accurate_passes, passes.accurate_passes, passes.successful_passes, data.accurate_passes), 'passes.accurate_passes')],
    ['tackles', pair(first(overview.tackles, defending.tackles, data.tackles), 'defending.tackles')],
    ['saves', pair(first(overview.goalkeeper_saves, goalkeeping.saves, goalkeeping.goalkeeper_saves, data.goalkeeper_saves), 'goalkeeping.saves')],
    ['offsides', pair(first(attack.offsides, overview.offsides, data.offsides), 'attack.offsides')],
    ['interceptions', pair(first(defending.interceptions, overview.interceptions, data.interceptions), 'defending.interceptions')],
    ['clearances', pair(first(defending.clearances, overview.clearances, data.clearances), 'defending.clearances')],
    ['ballRecoveries', pair(first(defending.ball_recoveries, overview.ball_recoveries, data.ball_recoveries), 'defending.ball_recoveries')],
    ['attacks', pair(first(attack.attacks, overview.attacks, data.attacks), 'attack.attacks')],
    ['dangerousAttacks', pair(first(attack.dangerous_attacks, overview.dangerous_attacks, data.dangerous_attacks), 'attack.dangerous_attacks')],
    ['penalties', pair(first(penalties.total, penalties.penalties, overview.penalties, data.penalties_total), 'penalties.total')],
    ['penaltiesScored', pair(first(penalties.scored, penalties.converted, overview.penalties_scored, data.penalties_scored), 'penalties.scored')],
    ['penaltiesMissed', pair(first(penalties.missed, penalties.saved, overview.penalties_missed, data.penalties_missed), 'penalties.missed')],
  ];

  for (const [key, value] of mappings) if (value) stats[key] = value;
  return stats;
}

function pairTotal(pairValue?: Pair | null) {
  if (!pairValue) return 0;
  return safeNumber(pairValue.home) + safeNumber(pairValue.away);
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function getTeamAggregate(map: Map<string, TeamAggregate>, team: { name: string; code?: string }) {
  const id = normalizeTeamName(team.name || team.code || 'unknown') || team.name || 'unknown';
  const existing = map.get(id);
  if (existing) return existing;
  const created: TeamAggregate = {
    id,
    name: team.name || team.code || 'غير متوفر',
    code: team.code || '',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
  };
  map.set(id, created);
  return created;
}

function applyResult(team: TeamAggregate, goalsFor: number, goalsAgainst: number) {
  team.played += 1;
  team.goalsFor += goalsFor;
  team.goalsAgainst += goalsAgainst;
  if (goalsAgainst === 0) team.cleanSheets += 1;
  if (goalsFor > goalsAgainst) team.wins += 1;
  else if (goalsFor === goalsAgainst) team.draws += 1;
  else team.losses += 1;
}

function pickTopTeam(teams: TeamAggregate[], primary: keyof TeamAggregate, secondary: keyof TeamAggregate = 'played') {
  return [...teams]
    .filter((team) => team.played > 0)
    .sort((a, b) => Number(b[primary]) - Number(a[primary]) || Number(b[secondary]) - Number(a[secondary]) || a.name.localeCompare(b.name))[0] || null;
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function loadProviderMatches() {
  const competitionId = process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107';
  const seasonId = process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868';
  const perPage = envInt('THE_STATS_API_SUMMARY_PER_PAGE', 100, 1, 100);
  const pages = envInt('THE_STATS_API_SUMMARY_PAGES', 2, 1, 4);
  const rows: Omit<ProviderMatch, 'localMatchId'>[] = [];

  for (let page = 1; page <= pages; page += 1) {
    try {
      const payload = await theStatsApiFetch('/api/football/matches', { competition_id: competitionId, season_id: seasonId, per_page: perPage, page }, { timeoutMs: 15000 });
      rows.push(...extractArray(payload).map(normalizeProviderMatch).filter(Boolean) as Omit<ProviderMatch, 'localMatchId'>[]);
    } catch (error) {
      if (page === 1) throw error;
      break;
    }
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.providerId)) return false;
    seen.add(row.providerId);
    return true;
  });
}

async function buildSummary() {
  const config = getTheStatsApiConfigStatus();
  if (!config.enabled || !config.hasKey) {
    return {
      response: {
        ok: false,
        provider: 'THE_STATS_API',
        error: !config.enabled ? 'TheStatsAPI is disabled. Set THE_STATS_API_ENABLED=true.' : 'THE_STATS_API_KEY is missing.',
        config,
      },
      status: 412,
    };
  }

  const [localMatches, providerRows] = await Promise.all([
    prisma.match.findMany({ select: { id: true, externalId: true, matchDate: true, homeTeam: { select: { name: true, code: true } }, awayTeam: { select: { name: true, code: true } } } }),
    loadProviderMatches(),
  ]);

  const providerMatches: ProviderMatch[] = providerRows.map((row) => ({ ...row, localMatchId: resolveLocalMatchId(row, localMatches) }));
  const statsFetchLimit = envInt('THE_STATS_API_SUMMARY_MAX_STATS_MATCHES', 48, 1, 120);
  const statsCandidates = providerMatches
    .filter((match) => match.providerId && (isFinishedStatus(match.status) || isLiveStatus(match.status) || match.homeScore !== null || match.awayScore !== null))
    .sort((a, b) => String(a.matchDate || '').localeCompare(String(b.matchDate || '')))
    .slice(0, statsFetchLimit);

  const statResults = await mapLimit(statsCandidates, 4, async (match) => {
    try {
      const payload = await theStatsApiFetch(`/api/football/matches/${encodeURIComponent(match.providerId)}/stats`, {}, { timeoutMs: 15000 });
      return { match, ok: true, stats: parseProviderStats(payload), error: null };
    } catch (error: any) {
      return { match, ok: false, stats: {} as ProviderStats, error: safeTheStatsApiError(error) };
    }
  });

  const statTotals = Object.fromEntries(AGGREGATED_STAT_KEYS.map((key) => [key, 0])) as Record<(typeof AGGREGATED_STAT_KEYS)[number], number>;
  const statAvailability = Object.fromEntries(AGGREGATED_STAT_KEYS.map((key) => [key, 0])) as Record<(typeof AGGREGATED_STAT_KEYS)[number], number>;
  let possessionSampleTotal = 0;
  let possessionSampleCount = 0;

  for (const result of statResults) {
    if (!result.ok) continue;
    for (const key of AGGREGATED_STAT_KEYS) {
      const stat = result.stats[key];
      if (!stat) continue;
      statTotals[key] += pairTotal(stat);
      statAvailability[key] += 1;
      if (key === 'possession') {
        if (stat.home !== null) {
          possessionSampleTotal += stat.home;
          possessionSampleCount += 1;
        }
        if (stat.away !== null) {
          possessionSampleTotal += stat.away;
          possessionSampleCount += 1;
        }
      }
    }
  }

  let finishedMatches = 0;
  let liveMatches = 0;
  let scheduledMatches = 0;
  let totalGoals = 0;
  let liveGoals = 0;
  let biggestScore: any = null;
  const teamAggregates = new Map<string, TeamAggregate>();

  for (const match of providerMatches) {
    const finished = isFinishedStatus(match.status);
    const live = isLiveStatus(match.status);
    if (finished) finishedMatches += 1;
    if (live) liveMatches += 1;
    if (isScheduledStatus(match.status)) scheduledMatches += 1;

    const homeScore = safeNumber(match.homeScore);
    const awayScore = safeNumber(match.awayScore);
    const matchGoals = homeScore + awayScore;
    const goalDifference = Math.abs(homeScore - awayScore);

    if (finished) {
      totalGoals += matchGoals;
      const homeAgg = getTeamAggregate(teamAggregates, { name: match.homeName });
      const awayAgg = getTeamAggregate(teamAggregates, { name: match.awayName });
      applyResult(homeAgg, homeScore, awayScore);
      applyResult(awayAgg, awayScore, homeScore);

      if (matchGoals > 0 && (!biggestScore || matchGoals > biggestScore.totalGoals || (matchGoals === biggestScore.totalGoals && goalDifference > biggestScore.goalDifference))) {
        biggestScore = {
          matchId: match.localMatchId,
          providerMatchId: match.providerId,
          homeTeam: { name: match.homeName, code: '' },
          awayTeam: { name: match.awayName, code: '' },
          homeScore,
          awayScore,
          totalGoals: matchGoals,
          goalDifference,
          matchDate: match.matchDate,
        };
      }
    } else if (live) {
      liveGoals += matchGoals;
    }
  }

  const teamRows = Array.from(teamAggregates.values());
  const cleanSheets = teamRows.reduce((sum, team) => sum + team.cleanSheets, 0);
  const penaltiesScored = Math.round(statTotals.penaltiesScored);
  const penaltiesMissed = Math.round(statTotals.penaltiesMissed);
  const penaltiesTotalFromBreakdown = penaltiesScored + penaltiesMissed;
  const penaltiesTotal = Math.max(Math.round(statTotals.penalties), penaltiesTotalFromBreakdown);
  const totalPasses = Math.round(statTotals.passes);
  const accuratePasses = Math.round(statTotals.accuratePasses);
  const passAccuracyPercent = totalPasses > 0 ? round((accuratePasses / totalPasses) * 100, 1) : null;
  const statsSucceeded = statResults.filter((result) => result.ok && Object.keys(result.stats).length > 0).length;
  const latestUpdatedAt = new Date().toISOString();

  return {
    response: {
      ok: true,
      provider: 'THE_STATS_API',
      source: 'thestatsapi_server_side_summary',
      totalMatches: providerMatches.length,
      providerMatches: providerMatches.length,
      localMatches: localMatches.length,
      linkedLocalMatches: providerMatches.filter((match) => match.localMatchId).length,
      finishedMatches,
      liveMatches,
      scheduledMatches,
      totalGoals,
      liveGoals,
      averageGoalsPerFinishedMatch: finishedMatches > 0 ? round(totalGoals / finishedMatches, 2) : null,
      yellowCards: Math.round(statTotals.yellowCards),
      redCards: Math.round(statTotals.redCards),
      penalties: {
        available: penaltiesTotal > 0,
        total: penaltiesTotal,
        scored: penaltiesScored,
        missed: penaltiesMissed,
        unknown: Math.max(0, penaltiesTotal - penaltiesScored - penaltiesMissed),
        source: 'THE_STATS_API match stats',
      },
      biggestScore,
      teamLeaders: {
        topScoringTeam: pickTopTeam(teamRows, 'goalsFor', 'played'),
        mostConcedingTeam: pickTopTeam(teamRows, 'goalsAgainst', 'played'),
        bestCleanSheetTeam: pickTopTeam(teamRows, 'cleanSheets', 'played'),
      },
      cleanSheets,
      finalStats: {
        matchesWithFinalSnapshots: statsSucceeded,
        matchesWithTheStatsApiStats: statsSucceeded,
        totalShots: Math.round(statTotals.shots),
        totalShotsOnTarget: Math.round(statTotals.shotsOnTarget),
        totalShotsOffTarget: Math.round(statTotals.shotsOffTarget),
        totalCorners: Math.round(statTotals.corners),
        totalAttacks: Math.round(statTotals.attacks),
        totalDangerousAttacks: Math.round(statTotals.dangerousAttacks),
        blockedShots: Math.round(statTotals.blockedShots),
        shotsInsideBox: Math.round(statTotals.shotsInsideBox),
        shotsOutsideBox: Math.round(statTotals.shotsOutsideBox),
        totalXg: round(statTotals.xg, 2),
        totalNpxg: round(statTotals.npxg, 2),
        bigChances: Math.round(statTotals.bigChances),
        fouls: Math.round(statTotals.fouls),
        offsides: Math.round(statTotals.offsides),
        saves: Math.round(statTotals.saves),
        tackles: Math.round(statTotals.tackles),
        interceptions: Math.round(statTotals.interceptions),
        clearances: Math.round(statTotals.clearances),
        ballRecoveries: Math.round(statTotals.ballRecoveries),
        totalPasses,
        accuratePasses,
        passAccuracyPercent,
        averageShotsPerFinishedMatch: finishedMatches > 0 && statTotals.shots > 0 ? round(statTotals.shots / finishedMatches, 1) : null,
        averagePossessionSample: possessionSampleCount > 0 ? round(possessionSampleTotal / possessionSampleCount, 1) : null,
        xgPerFinishedMatch: finishedMatches > 0 && statTotals.xg > 0 ? round(statTotals.xg / finishedMatches, 2) : null,
      },
      powerStats: {
        totalXg: round(statTotals.xg, 2),
        totalNpxg: round(statTotals.npxg, 2),
        bigChances: Math.round(statTotals.bigChances),
        corners: Math.round(statTotals.corners),
        saves: Math.round(statTotals.saves),
        passAccuracyPercent,
        fouls: Math.round(statTotals.fouls),
        tackles: Math.round(statTotals.tackles),
        interceptions: Math.round(statTotals.interceptions),
        recoveries: Math.round(statTotals.ballRecoveries),
      },
      statAvailability,
      statsFetch: {
        limit: statsFetchLimit,
        requested: statsCandidates.length,
        succeeded: statsSucceeded,
        failed: statResults.filter((result) => !result.ok).length,
      },
      config: {
        enabled: config.enabled,
        verifyOnly: config.verifyOnly,
        blockOdds: config.blockOdds,
        hasKey: config.hasKey,
        hasBaseUrl: config.hasBaseUrl,
        baseUrl: config.baseUrl,
      },
      latestUpdatedAt,
    },
    status: 200,
  };
}

export async function GET() {
  try {
    const cacheMs = envInt('THE_STATS_API_SUMMARY_CACHE_MS', 300000, 60000, 1800000);
    if (cachedSummary && cachedSummary.expiresAt > Date.now()) {
      return NextResponse.json({ ...cachedSummary.payload, cache: { hit: true, ttlMs: Math.max(0, cachedSummary.expiresAt - Date.now()) } }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } });
    }

    const result = await buildSummary();
    if (result.status === 200 && result.response?.ok) {
      cachedSummary = { expiresAt: Date.now() + cacheMs, payload: result.response };
    }

    return NextResponse.json(result.response, { status: result.status, headers: { 'Cache-Control': result.status === 200 ? 'private, max-age=30, stale-while-revalidate=120' : 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, provider: 'THE_STATS_API', error: safeTheStatsApiError(error) }, { status: error?.status || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
