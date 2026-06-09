import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { calculateFairValue, calculatePlayerScore, calculateTeamScore } from '@/lib/scoring';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

type BootstrapOptions = {
  leagueId: number;
  season: number;
  dryRun: boolean;
  reset: boolean;
  includePlayers: boolean;
  includeFixtures: boolean;
  includeGroups: boolean;
  maxTeams: number;
};

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'admin@worldcup.com' || email === 'elfox14usa@gmail.com';
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
  return {
    team: {
      id: toNumber(team?.id, 0),
      name: team?.name,
      logo: team?.logo,
    },
    players,
  };
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
  const result: Record<string, number> = {};

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

  result.captainSelections = deletes[0].count;
  result.performances = deletes[1].count;
  result.priceHistory = deletes[2].count;
  result.marketNews = deletes[3].count;
  result.matches = deletes[4].count;
  result.transactions = deletes[5].count;
  result.holdings = deletes[6].count;
  result.assets = deletes[7].count;
  return result;
}

async function upsertTeam(team: any, group?: string | null) {
  const score = calculateTeamScore({
    fundamental: 65,
    popularity: 55,
    worldCupLegacy: 55,
    marketDemand: 50,
    momentum: 50,
    fifaRank: 50,
    squadQuality: 65,
  });
  const fairValue = calculateFairValue(score, 'TEAM');
  const id = `team-${team.id || toSlug(team.name)}`;

  return prisma.asset.upsert({
    where: { id },
    create: {
      id,
      type: 'TEAM',
      name: team.name,
      code: team.code || String(team.name || '').slice(0, 3).toUpperCase(),
      image: team.logo || '🏳️',
      current_price: fairValue,
      high_price: fairValue,
      low_price: fairValue,
      market_cap: `${Math.round(fairValue * 1000)}`,
      volume: '0',
      change: 0,
      group: group || null,
      continent: team.country || null,
      apiFootballId: team.id || null,
      fundamental: 65,
      popularity: 55,
      worldCupLegacy: 55,
      marketDemand: 50,
      momentum: 50,
      volatilityScore: 12,
      score,
      fairValue,
      marketPrice: fairValue,
    },
    update: {
      name: team.name,
      code: team.code || String(team.name || '').slice(0, 3).toUpperCase(),
      image: team.logo || '🏳️',
      group: group || null,
      continent: team.country || null,
      apiFootballId: team.id || null,
      score,
      fairValue,
      marketPrice: fairValue,
      current_price: fairValue,
      high_price: fairValue,
      low_price: fairValue,
    },
  });
}

async function upsertPlayer(player: any, teamAsset: any, teamProviderId: number) {
  const age = player?.age == null ? null : toNumber(player.age, 0);
  const position = player?.position || null;
  const fundamental = playerBaseScore(position, age);
  const score = calculatePlayerScore({
    fundamental,
    popularity: 50,
    worldCupLegacy: 45,
    marketDemand: 50,
    momentum: 50,
    age: age || undefined,
  });
  const fairValue = calculateFairValue(score, 'PLAYER');
  const providerPlayerId = toNumber(player?.id, 0);
  const id = `player-${providerPlayerId || `${teamProviderId}-${toSlug(player?.name)}`}`;

  return prisma.asset.upsert({
    where: { id },
    create: {
      id,
      type: 'PLAYER',
      name: player?.name || 'Unknown Player',
      code: String(player?.number || player?.name || 'PL').slice(0, 8).toUpperCase(),
      image: player?.photo || '👤',
      current_price: fairValue,
      high_price: fairValue,
      low_price: fairValue,
      market_cap: `${Math.round(fairValue * 100)}`,
      volume: '0',
      change: 0,
      position,
      age: age || null,
      teamId: teamAsset.id,
      apiFootballId: providerPlayerId || null,
      fundamental,
      popularity: 50,
      worldCupLegacy: 45,
      marketDemand: 50,
      momentum: 50,
      volatilityScore: 20,
      score,
      fairValue,
      marketPrice: fairValue,
    },
    update: {
      name: player?.name || 'Unknown Player',
      code: String(player?.number || player?.name || 'PL').slice(0, 8).toUpperCase(),
      image: player?.photo || '👤',
      position,
      age: age || null,
      teamId: teamAsset.id,
      apiFootballId: providerPlayerId || null,
      fundamental,
      score,
      fairValue,
      marketPrice: fairValue,
      current_price: fairValue,
      high_price: fairValue,
      low_price: fairValue,
    },
  });
}

async function upsertFixture(fixture: any, teamsByProviderId: Map<number, any>) {
  const fixtureId = toNumber(fixture?.fixture?.id, 0);
  const homeProviderId = toNumber(fixture?.teams?.home?.id, 0);
  const awayProviderId = toNumber(fixture?.teams?.away?.id, 0);
  const homeTeam = teamsByProviderId.get(homeProviderId);
  const awayTeam = teamsByProviderId.get(awayProviderId);

  if (!fixtureId || !homeTeam || !awayTeam || homeTeam.id === awayTeam.id) {
    return { fixtureId, status: 'skipped_unmatched_fixture', homeProviderId, awayProviderId };
  }

  const homeScore = Number.isFinite(Number(fixture?.goals?.home)) ? Number(fixture.goals.home) : 0;
  const awayScore = Number.isFinite(Number(fixture?.goals?.away)) ? Number(fixture.goals.away) : 0;
  const matchDate = fixture?.fixture?.date ? new Date(fixture.fixture.date) : new Date();
  const rawStatus = fixture?.fixture?.status?.short || fixture?.fixture?.status?.long;

  await prisma.match.upsert({
    where: { externalId: String(fixtureId) },
    create: {
      externalId: String(fixtureId),
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchDate,
      status: normalizeStatus(rawStatus),
      homeScore,
      awayScore,
      groupPhase: fixture?.league?.round || fixture?.league?.name || null,
      stage: parseStage(fixture?.league?.round),
    },
    update: {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchDate,
      status: normalizeStatus(rawStatus),
      homeScore,
      awayScore,
      groupPhase: fixture?.league?.round || fixture?.league?.name || null,
      stage: parseStage(fixture?.league?.round),
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
    resetDeleted: null,
    fetched: { teams: 0, fixtures: 0, squads: 0, players: 0, groups: 0 },
    saved: { teams: 0, players: 0, fixtures: 0 },
    skipped: [],
    errors: [],
  };

  const [teamsPayload, fixturesPayload, standingsResult] = await Promise.all([
    apiFootballFetch<{ response?: any[] }>('/teams', { league: options.leagueId, season: options.season }).catch((error) => {
      summary.errors.push({ stage: 'teams', message: error.message, details: error.payload || null });
      return { response: [] };
    }),
    options.includeFixtures
      ? apiFootballFetch<{ response?: any[] }>('/fixtures', { league: options.leagueId, season: options.season }).catch((error) => {
          summary.errors.push({ stage: 'fixtures', message: error.message, details: error.payload || null });
          return { response: [] };
        })
      : Promise.resolve({ response: [] }),
    options.includeGroups
      ? apiFootballFetch<any>('/standings', { league: options.leagueId, season: options.season }).catch((error) => {
          summary.errors.push({ stage: 'standings', message: error.message, details: error.payload || null });
          return null;
        })
      : Promise.resolve(null),
  ]);

  const fixtures = fixturesPayload.response || [];
  let teams = (teamsPayload.response || []).map(normalizeTeamItem).filter((team) => team.id && team.name);
  if (teams.length === 0 && fixtures.length > 0) teams = extractTeamsFromFixtures(fixtures).map(normalizeTeamItem);
  teams = teams.slice(0, options.maxTeams);

  const groupMap = standingsResult ? getTeamGroupMap(standingsResult) : new Map<number, string>();

  summary.fetched.teams = teams.length;
  summary.fetched.fixtures = fixtures.length;
  summary.fetched.groups = groupMap.size;

  if (options.dryRun) {
    summary.preview = {
      teams: teams.map((team) => ({ id: team.id, name: team.name, code: team.code, logo: team.logo, group: groupMap.get(team.id) || null })).slice(0, 50),
      fixtures: fixtures.map((fixture) => ({
        fixtureId: fixture?.fixture?.id,
        date: fixture?.fixture?.date,
        home: fixture?.teams?.home?.name,
        away: fixture?.teams?.away?.name,
        round: fixture?.league?.round,
      })).slice(0, 80),
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
      try {
        const squadPayload = await apiFootballFetch<{ response?: any[] }>('/players/squads', { team: team.id });
        const squads = (squadPayload.response || []).map(normalizeSquadPayload);
        summary.fetched.squads += squads.length;
        const teamAsset = teamsByProviderId.get(team.id);
        if (!teamAsset) continue;

        for (const squad of squads) {
          for (const player of squad.players || []) {
            await upsertPlayer(player, teamAsset, team.id);
            summary.saved.players += 1;
            summary.fetched.players += 1;
          }
        }
      } catch (error: any) {
        summary.errors.push({ stage: 'players/squads', teamId: team.id, teamName: team.name, message: error.message, details: error.payload || null });
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
  const options: BootstrapOptions = {
    leagueId: toNumber(searchParams.get('leagueId'), toNumber(process.env.WORLD_CUP_LEAGUE_ID, 1)),
    season: toNumber(searchParams.get('season'), toNumber(process.env.WORLD_CUP_SEASON, 2026)),
    dryRun: toBool(searchParams.get('dryRun'), true),
    reset: toBool(searchParams.get('reset'), false),
    includePlayers: toBool(searchParams.get('includePlayers'), true),
    includeFixtures: toBool(searchParams.get('includeFixtures'), true),
    includeGroups: toBool(searchParams.get('includeGroups'), true),
    maxTeams: toNumber(searchParams.get('maxTeams'), 64),
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
