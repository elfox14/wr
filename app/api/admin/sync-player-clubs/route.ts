import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { normalizeName } from '@/lib/apiFootball';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;
type FootballParams = Record<string, string | number | boolean | undefined | null>;

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

function splitKeys(value?: string) {
  return value?.split(',').map((key) => key.trim()).filter(Boolean) || [];
}

function getApiKeys() {
  const keyPool = splitKeys(process.env.ISPORTS_API_KEYS);
  if (keyPool.length > 0) return keyPool;
  return [process.env.ISPORTS_API_KEY].filter(Boolean) as string[];
}

function getBaseUrl() {
  return process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com';
}

function toBool(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.players)) return payload.players;
  if (Array.isArray(payload?.playerList)) return payload.playerList;
  return [];
}

function buildUrl(path: string, params: FootballParams = {}, apiKey: string) {
  const url = new URL(`${getBaseUrl()}${path}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchIsportsRaw(path: string, params: FootballParams = {}) {
  const keys = getApiKeys();
  if (!keys.length) throw new Error('ISPORTS_API_KEY/ISPORTS_API_KEYS is missing');

  let lastError: Error | null = null;
  for (const key of keys) {
    try {
      const response = await fetch(buildUrl(path, params, key), { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`ISPORTS HTTP ${response.status}: ${JSON.stringify(payload || {}).slice(0, 240)}`);
      return payload;
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error('ISPORTS request failed');
}

function playerProviderId(item: any) {
  return toNumber(item?.playerId ?? item?.player_id ?? item?.id ?? item?.player?.id, 0);
}

function playerName(item: any) {
  return item?.name ?? item?.playerName ?? item?.player_name ?? item?.player?.name ?? '';
}

function cleanClub(value: unknown, teamName?: string | null) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (teamName && normalizeName(text) === normalizeName(teamName)) return null;
  return text;
}

function extractClub(item: any, teamName?: string | null) {
  const candidates = [
    item?.club,
    item?.clubName,
    item?.club_name,
    item?.currentClub,
    item?.current_club,
    item?.clubTeam,
    item?.club_team,
    item?.clubTeamName,
    item?.club_team_name,
    item?.teamClub,
    item?.team_club,
    item?.player?.club,
    item?.player?.clubName,
    item?.player?.club_name,
  ];

  for (const candidate of candidates) {
    const club = cleanClub(candidate, teamName);
    if (club) return club;
  }

  return null;
}

async function syncPlayerClubs(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const dryRun = toBool(searchParams.get('dryRun'), false);
  const onlyTeamId = searchParams.get('teamId');
  const limitTeams = toNumber(searchParams.get('limitTeams'), 80);

  const where: any = { type: 'TEAM', apiFootballId: { not: null } };
  if (onlyTeamId) where.id = onlyTeamId;

  const teams = await prisma.asset.findMany({
    where,
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
    take: limitTeams,
    select: {
      id: true,
      name: true,
      apiFootballId: true,
      players: {
        where: { type: 'PLAYER' },
        select: { id: true, name: true, apiFootballId: true, club: true },
      },
    },
  });

  const summary: any = {
    ok: true,
    dryRun,
    teams: teams.length,
    checkedPlayers: 0,
    providerPlayers: 0,
    clubsFound: 0,
    updatedPlayers: 0,
    skippedNoClub: 0,
    unmatchedProviderPlayers: 0,
    errors: [],
    samples: [],
  };

  for (const team of teams) {
    try {
      const payload = await fetchIsportsRaw('/sport/football/player/basic', { teamId: team.apiFootballId });
      const items = getArrayPayload(payload);
      summary.providerPlayers += items.length;

      const byProviderId = new Map(team.players.filter((player) => player.apiFootballId).map((player) => [String(player.apiFootballId), player]));
      const byName = new Map(team.players.map((player) => [normalizeName(player.name), player]));

      for (const item of items) {
        const club = extractClub(item, team.name);
        const providerId = playerProviderId(item);
        const name = playerName(item);
        summary.checkedPlayers += 1;

        if (!club) {
          summary.skippedNoClub += 1;
          continue;
        }

        summary.clubsFound += 1;
        const player = byProviderId.get(String(providerId)) || byName.get(normalizeName(name));
        if (!player) {
          summary.unmatchedProviderPlayers += 1;
          continue;
        }

        if (!dryRun && player.club !== club) {
          await prisma.asset.update({ where: { id: player.id }, data: { club } });
        }
        summary.updatedPlayers += player.club === club ? 0 : 1;

        if (summary.samples.length < 20) {
          summary.samples.push({ team: team.name, player: player.name, previousClub: player.club, club, dryRun });
        }
      }
    } catch (error: any) {
      summary.errors.push({ team: team.name, teamId: team.id, message: error.message || 'sync failed' });
    }
  }

  return NextResponse.json(summary);
}

export async function GET(req: Request) {
  return syncPlayerClubs(req);
}

export async function POST(req: Request) {
  return syncPlayerClubs(req);
}
