import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { calculateFairValue, calculatePlayerScore, calculateTeamScore } from '@/lib/scoring';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;
type BootstrapOptions = {
  leagueId: number;
  season: number;
  dryRun: boolean;
  reset: boolean;
  includePlayers: boolean;
  includeFixtures: boolean;
  includeGroups: boolean;
  maxTeams: number;
  from: string;
  to: string;
};

const TARGET_TEAMS = 48;
const TARGET_PLAYERS = 1244;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function toBool(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toSlug(value?: string | null) {
  const clean = normalizeName(value || 'item') || 'item';
  return clean.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 80);
}

function normalizeStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY'].includes(value)) return 'IN_PLAY';
  if (['FT', 'AET', 'PEN', 'FINISHED', 'ENDED'].includes(value)) return 'FINISHED';
  return 'SCHEDULED';
}

function parseStage(round?: string | null) {
  const value = String(round || '').toLowerCase();
  if (value.includes('final') && !value.includes('semi') && !value.includes('quarter')) return 'final';
  if (value.includes('semi')) return 'semi_final';
  if (value.includes('quarter')) return 'quarter_final';
  if (value.includes('16')) return 'round_of_16';
  return 'group';
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  const diff = Math.floor((end - start) / 86400000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

function getTeamGroupMap(standingsPayload: any) {
  const map = new Map<number, string>();
  const response = Array.isArray(standingsPayload?.response) ? standingsPayload.response : [];
  for (const item of response) {
    const standings = item?.league?.standings || [];
    for (const groupRows of standings) {
      if (!Array.isArray(groupRows)) continue;
      for (const row of groupRows) {
        const teamId = toNumber(row?.team?.id, 0);
        const group = row?.group || row?.description || item?.league?.round;
        if (teamId && group) map.set(teamId, String(group));
      }
    }
  }
  return map;
}

function extractTeamsFromFixtures(fixtures: any[]) {
  const byId = new Map<number, any>();
  for (const fixture of fixtures) {
    for (const side of ['home', 'away']) {
      const team = fixture?.teams?.[side];
      const id = toNumber(team?.id, 0);
      if (!id || !team?.name) continue;
      if (!byId.has(id)) byId.set(id, team);
    }
  }
  return [...byId.values()];
}

function normalizeTeamItem(item: any) {
  const team = item?.team || item;
  return {
    id: toNumber(team?.id, 0),
    name: team?.name,
    code: team?.code || String(team?.name || '').slice(0, 3).toUpperCase(),
    country: team?.country,
    logo: team?.logo,
    raw: item,
  };
}

function normalizeSquadPayload(item: any) {
  const team = item?.team || {};
  const players = Array.isArray(item?.players) ? item.players : [];
  return { team: { id: toNumber(team?.id, 0), name: team?.name, logo: team?.logo }, players };
}

function normalizePlayersPagePayload(payload: any, team: any) {
  const response = Array.isArray(payload?.response) ? payload.response : [];
  return [{
    team: { id: team.id, name: team.name, logo: team.logo },
    players: response.map((item: any) => ({
      id: item?.player?.id,
      name: item?.player?.name,
      age: item?.player?.age,
      number: item?.statistics?.[0]?.games?.number,
      position: item?.statistics?.[0]?.games?.position,
      photo: item?.player?.photo,
    })).filter((player: any) => player.id && player.name),
  }];
}

function uniquePlayers(players: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const player of players) {
    const key = String(player?.id || normalizeName(player?.name || ''));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(player);
  }
  return result;
}

function playerBaseScore(position?: string | null, age?: number | null) {
  const pos = String(position || '').toUpperCase();
  let fundamental = 62;
  if (['G', 'GK', 'GOALKEEPER'].includes(pos)) fundamental = 61;
  if (['D', 'DEF', 'DEFENDER'].includes(pos)) fundamental = 62;
  if (['M', 'MID', 'MIDFIELDER'].includes(pos)) fundamental = 64;
  if (['F', 'FW', 'FWD', 'ATTACKER'].includes(pos)) fundamental = 66;
  if (age && age >= 24 && age <= 31) fundamental += 3;
  return Math.min(fundamental, 78);
}

async function resetTournamentData() {
  const deletes = await prisma.$transaction([
    prisma.captainSelection.deleteMany({}),
    prisma.playerPerformance.deleteMany({}),
    prisma.priceHistory.deleteMany({}),
    prisma.marketNews.deleteMany({}),
    prisma.match.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.holding.deleteMany({}),
    prisma.asset.deleteMany({}),
  ]);
  return {
    captainSelections: deletes[0].count,
    performances: deletes[1].count,
    priceHistory: deletes[2].count,
    marketNews: deletes[3].count,
    matches: deletes[4].count,
    transactions: deletes[5].count,
    holdings: deletes[6].count,
    assets: deletes[7].count,
  };
}

async function discoverWorldCupLeagues(query = 'world cup') {
  const result: any = { ok: true, query, count: 0, leagues: [], errors: [] };
  try {
    const payload = await apiFootballFetch<{ response?: any[] }>('/leagues', { search: query });
    const response = payload.response || [];
    result.leagues = response.map((item: any) => ({
      leagueId: item?.league?.id,
      name: item?.league?.name,
      type: item?.league?.type,
      logo: item?.league?.logo,
      country: item?.country?.name,
      flag: item?.country?.flag,
      seasons: (item?.seasons || [])
        .map((season: any) => ({ year: season.year, start: season.start, end: season.end, current: season.current }))
        .sort((a: any, b: any) => Number(b.year) - Number(a.year)),
    })).filter((item: any) => item.leagueId && item.name);
    result.count = result.leagues.length;
  } catch (error: any) {
    result.errors.push({ message: error.message, details: error.payload || null });
  }
  return result;
}

async function fetchFixturesForTournament(options: BootstrapOptions, summary: any) {
  const attempts: Array<{ label: string; params: Record<string, any> }> = [
    { label: 'league-season', params: { league: options.leagueId, season: options.season } },
    { label: 'league-season-range', params: { league: options.leagueId, season: options.season, from: options.from, to: options.to } },
    { label: 'league-date-start', params: { league: options.leagueId, date: options.from } },
  ];

  for (const attempt of attempts) {
    try {
      const payload = await apiFootballFetch<{ response?: any[] }>('/fixtures', attempt.params);
      const fixtures = payload.response || [];
      summary.sources.fixtures.push({ label: attempt.label, count: fixtures.length, params: attempt.params });
      if (fixtures.length > 0) return fixtures;
    } catch (error: any) {
      summary.errors.push({ stage: `fixtures:${attempt.label}`, message: error.message, details: error.payload || null });
    }
  }

  const byId = new Map<number, any>();
  const maxDays = Math.min(daysBetween(options.from, options.to), 60);
  for (let index = 0; index <= maxDays; index += 1) {
    const date = addDays(options.from, index);
    try {
      const payload = await apiFootballFetch<{ response?: any[] }>('/fixtures', { league: options.leagueId, date });
      const fixtures = payload.response || [];
      summary.sources.fixtures.push({ label: 'league-date-loop', date, count: fixtures.length });
      for (const fixture of fixtures) {
        const fixtureId = toNumber(fixture?.fixture?.id, 0);
        if (fixtureId) byId.set(fixtureId, fixture);
      }
    } catch (error: any) {
      summary.errors.push({ stage: 'fixtures:date-loop', date, message: error.message, details: error.payload || null });
    }
  }

  return [...byId.values()];
}

async function fetchTeamsForTournament(options: BootstrapOptions, fixtures: any[], summary: any) {
  const teamsById = new Map<number, any>();

  try {
    const payload = await apiFootballFetch<{ response?: any[] }>('/teams', { league: options.leagueId, season: options.season });
    const teams = (payload.response || []).map(normalizeTeamItem).filter((team) => team.id && team.name);
    summary.sources.teams.push({ label: 'teams-endpoint', count: teams.length });
    for (const team of teams) teamsById.set(team.id, team);
  } catch (error: any) {
    summary.errors.push({ stage: 'teams:endpoint', message: error.message, details: error.payload || null });
  }

  const fixtureTeams = extractTeamsFromFixtures(fixtures).map(normalizeTeamItem).filter((team) => team.id && team.name);
  summary.sources.teams.push({ label: 'fixtures-extracted', count: fixtureTeams.length });
  for (const team of fixtureTeams) {
    if (!teamsById.has(team.id)) teamsById.set(team.id, team);
  }

  return [...teamsById.values()].slice(0, options.maxTeams);
}

async function fetchSquadsForTeam(team: any, season: number, summary: any) {
  const attempts: Array<{ label: string; run: () => Promise<any[]> }> = [
    {
      label: 'players-squads',
      run: async () => {
        const payload = await apiFootballFetch<{ response?: any[] }>('/players/squads', { team: team.id });
        return (payload.response || []).map(normalizeSquadPayload);
      },
    },
    {
      label: 'players-page-1',
      run: async () => {
        const payload = await apiFootballFetch<any>('/players', { team: team.id, season, page: 1 });
        return normalizePlayersPagePayload(payload, team);
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const squads = await attempt.run();
      const players = uniquePlayers(squads.flatMap((squad: any) => squad.players || []));
      summary.sources.players.push({ teamId: team.id, teamName: team.name, label: attempt.label, players: players.length });
      if (players.length > 0) return [{ team, players }];
    } catch (error: any) {
      summary.errors.push({ stage: `players:${attempt.label}`, teamId: team.id, teamName: team.name, message: error.message, details: error.payload || null });
    }
  }

  return [];
}

async function upsertTeam(team: any, group?: string | null) {
  const score = calculateTeamScore({ fundamental: 65, popularity: 55, worldCupLegacy: 55, marketDemand: 50, momentum: 50, fifaRank: 50, squadQuality: 65 });
  const fairValue = calculateFairValue(score, 'TEAM');
  const id = `team-${team.id || toSlug(team.name)}`;
  return prisma.asset.upsert({
    where: { id },
    create: {
      id, type: 'TEAM', name: team.name, code: team.code || String(team.name || '').slice(0, 3).toUpperCase(), image: team.logo || '🏳️',
      current_price: fairValue, high_price: fairValue, low_price: fairValue, market_cap: `${Math.round(fairValue * 1000)}`, volume: '0', change: 0,
      group: group || null, continent: team.country || null, apiFootballId: team.id || null,
      fundamental: 65, popularity: 55, worldCupLegacy: 55, marketDemand: 50, momentum: 50, volatilityScore: 12, score, fairValue, marketPrice: fairValue,
    },
    update: {
      name: team.name, code: team.code || String(team.name || '').slice(0, 3).toUpperCase(), image: team.logo || '🏳️', group: group || null,
      continent: team.country || null, apiFootballId: team.id || null, score, fairValue, marketPrice: fairValue, current_price: fairValue, high_price: fairValue, low_price: fairValue,
    },
  });
}

async function upsertPlayer(player: any, teamAsset: any, teamProviderId: number) {
  const age = player?.age == null ? null : toNumber(player.age, 0);
  const position = player?.position || null;
  const fundamental = playerBaseScore(position, age);
  const score = calculatePlayerScore({ fundamental, popularity: 50, worldCupLegacy: 45, marketDemand: 50, momentum: 50, age: age || undefined });
  const fairValue = calculateFairValue(score, 'PLAYER');
  const providerPlayerId = toNumber(player?.id, 0);
  const id = `player-${providerPlayerId || `${teamProviderId}-${toSlug(player?.name)}`}`;
  return prisma.asset.upsert({
    where: { id },
    create: {
      id, type: 'PLAYER', name: player?.name || 'Unknown Player', code: String(player?.number || player?.name || 'PL').slice(0, 8).toUpperCase(), image: player?.photo || '👤',
      current_price: fairValue, high_price: fairValue, low_price: fairValue, market_cap: `${Math.round(fairValue * 100)}`, volume: '0', change: 0,
      position, age: age || null, teamId: teamAsset.id, apiFootballId: providerPlayerId || null,
      fundamental, popularity: 50, worldCupLegacy: 45, marketDemand: 50, momentum: 50, volatilityScore: 20, score, fairValue, marketPrice: fairValue,
    },
    update: {
      name: player?.name || 'Unknown Player', code: String(player?.number || player?.name || 'PL').slice(0, 8).toUpperCase(), image: player?.photo || '👤',
      position, age: age || null, teamId: teamAsset.id, apiFootballId: providerPlayerId || null, fundamental, score, fairValue, marketPrice: fairValue,
      current_price: fairValue, high_price: fairValue, low_price: fairValue,
    },
  });
}

async function upsertFixture(fixture: any, teamsByProviderId: Map<number, any>) {
  const fixtureId = toNumber(fixture?.fixture?.id, 0);
  const homeProviderId = toNumber(fixture?.teams?.home?.id, 0);
  const awayProviderId = toNumber(fixture?.teams?.away?.id, 0);
  const homeTeam = teamsByProviderId.get(homeProviderId);
  const awayTeam = teamsByProviderId.get(awayProviderId);
  if (!fixtureId || !homeTeam || !awayTeam || homeTeam.id === awayTeam.id) return { fixtureId, status: 'skipped_unmatched_fixture', homeProviderId, awayProviderId };

  const homeScore = Number.isFinite(Number(fixture?.goals?.home)) ? Number(fixture.goals.home) : 0;
  const awayScore = Number.isFinite(Number(fixture?.goals?.away)) ? Number(fixture.goals.away) : 0;
  const matchDate = fixture?.fixture?.date ? new Date(fixture.fixture.date) : new Date();
  const rawStatus = fixture?.fixture?.status?.short || fixture?.fixture?.status?.long;
  await prisma.match.upsert({
    where: { externalId: String(fixtureId) },
    create: {
      externalId: String(fixtureId), homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, matchDate, status: normalizeStatus(rawStatus), homeScore, awayScore,
      groupPhase: fixture?.league?.round || fixture?.league?.name || null, stage: parseStage(fixture?.league?.round),
    },
    update: {
      homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, matchDate, status: normalizeStatus(rawStatus), homeScore, awayScore,
      groupPhase: fixture?.league?.round || fixture?.league?.name || null, stage: parseStage(fixture?.league?.round),
    },
  });
  return { fixtureId, status: 'upserted', home: homeTeam.name, away: awayTeam.name };
}

async function bootstrap(options: BootstrapOptions) {
  const summary: any = {
    ok: true,
    dryRun: options.dryRun,
    reset: options.reset,
    leagueId: options.leagueId,
    season: options.season,
    range: { from: options.from, to: options.to },
    target: { teams: TARGET_TEAMS, players: TARGET_PLAYERS },
    resetDeleted: null,
    fetched: { teams: 0, fixtures: 0, squads: 0, players: 0, groups: 0 },
    saved: { teams: 0, players: 0, fixtures: 0 },
    sources: { teams: [], fixtures: [], players: [] },
    skipped: [],
    errors: [],
  };

  const [fixtures, standingsResult] = await Promise.all([
    options.includeFixtures ? fetchFixturesForTournament(options, summary) : Promise.resolve([]),
    options.includeGroups ? apiFootballFetch<any>('/standings', { league: options.leagueId, season: options.season }).catch((error) => {
      summary.errors.push({ stage: 'standings', message: error.message, details: error.payload || null });
      return null;
    }) : Promise.resolve(null),
  ]);

  const teams = await fetchTeamsForTournament(options, fixtures, summary);
  const groupMap = standingsResult ? getTeamGroupMap(standingsResult) : new Map<number, string>();

  summary.fetched.teams = teams.length;
  summary.fetched.fixtures = fixtures.length;
  summary.fetched.groups = groupMap.size;

  let previewSquads: any[] = [];
  if (options.includePlayers && teams.length > 0) {
    const teamsToPreview = options.dryRun ? teams.slice(0, 6) : teams;
    for (const team of teamsToPreview) {
      const squads = await fetchSquadsForTeam(team, options.season, summary);
      previewSquads.push(...squads);
      const count = uniquePlayers(squads.flatMap((squad: any) => squad.players || [])).length;
      summary.fetched.squads += squads.length;
      summary.fetched.players += count;
    }
    if (options.dryRun && teams.length > teamsToPreview.length) {
      summary.playerPreviewNote = `Dry run fetched players for ${teamsToPreview.length} sample teams only. Run save mode to fetch all ${teams.length} teams.`;
    }
  }

  if (options.dryRun) {
    summary.preview = {
      teams: teams.map((team) => ({ id: team.id, name: team.name, code: team.code, logo: team.logo, group: groupMap.get(team.id) || null })).slice(0, 60),
      fixtures: fixtures.map((fixture) => ({ fixtureId: fixture?.fixture?.id, date: fixture?.fixture?.date, home: fixture?.teams?.home?.name, away: fixture?.teams?.away?.name, round: fixture?.league?.round })).slice(0, 120),
      players: previewSquads.flatMap((squad: any) => squad.players || []).slice(0, 80).map((player: any) => ({ id: player.id, name: player.name, age: player.age, position: player.position, photo: player.photo })),
    };
    return summary;
  }

  if (options.reset) summary.resetDeleted = await resetTournamentData();

  const teamsByProviderId = new Map<number, any>();
  for (const team of teams) {
    const asset = await upsertTeam(team, groupMap.get(team.id));
    teamsByProviderId.set(team.id, asset);
    summary.saved.teams += 1;
  }

  if (options.includePlayers) {
    for (const team of teams) {
      const teamAsset = teamsByProviderId.get(team.id);
      if (!teamAsset) continue;
      const squads = await fetchSquadsForTeam(team, options.season, summary);
      const players = uniquePlayers(squads.flatMap((squad: any) => squad.players || []));
      summary.fetched.squads += squads.length;
      summary.fetched.players += players.length;
      for (const player of players) {
        await upsertPlayer(player, teamAsset, team.id);
        summary.saved.players += 1;
      }
    }
  }

  if (options.includeFixtures) {
    for (const fixture of fixtures) {
      const result = await upsertFixture(fixture, teamsByProviderId);
      if (result.status === 'upserted') summary.saved.fixtures += 1;
      else summary.skipped.push(result);
    }
  }

  return summary;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'bootstrap';
  if (action === 'discover') return NextResponse.json(await discoverWorldCupLeagues(searchParams.get('query') || 'world cup'));

  const options: BootstrapOptions = {
    leagueId: toNumber(searchParams.get('leagueId'), toNumber(process.env.WORLD_CUP_LEAGUE_ID, 1)),
    season: toNumber(searchParams.get('season'), toNumber(process.env.WORLD_CUP_SEASON, 2026)),
    dryRun: toBool(searchParams.get('dryRun'), true),
    reset: toBool(searchParams.get('reset'), false),
    includePlayers: toBool(searchParams.get('includePlayers'), true),
    includeFixtures: toBool(searchParams.get('includeFixtures'), true),
    includeGroups: toBool(searchParams.get('includeGroups'), true),
    maxTeams: toNumber(searchParams.get('maxTeams'), TARGET_TEAMS),
    from: searchParams.get('from') || process.env.WORLD_CUP_START_DATE || '2026-06-11',
    to: searchParams.get('to') || process.env.WORLD_CUP_END_DATE || '2026-06-28',
  };

  try {
    return NextResponse.json(await bootstrap(options));
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'World Cup bootstrap failed', details: error.payload || null }, { status: error.status || 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return GET(new Request(url.toString(), { headers: req.headers }));
}
