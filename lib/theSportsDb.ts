const DEFAULT_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

const API_KEY = process.env.THESPORTSDB_API_KEY || '123';
const BASE_URL = (process.env.THESPORTSDB_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

export type TheSportsDbTeam = Record<string, any>;
export type TheSportsDbPlayer = Record<string, any>;
export type TheSportsDbEvent = Record<string, any>;

function buildUrl(endpoint: string, params: Record<string, string | number | undefined | null> = {}) {
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = new URL(`${BASE_URL}/${API_KEY}/${cleanEndpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export async function theSportsDbFetch<T>(endpoint: string, params: Record<string, string | number | undefined | null> = {}): Promise<T> {
  const res = await fetch(buildUrl(endpoint, params), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 * 60 * 12 },
  });

  const text = await res.text();
  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const error: any = new Error(`TheSportsDB returned ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

export function normalizeSportsDbName(name?: string | null) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchTeams(teamName: string) {
  const payload = await theSportsDbFetch<{ teams?: TheSportsDbTeam[] | null }>('searchteams.php', { t: teamName });
  return payload.teams || [];
}

export async function searchPlayers(playerName: string) {
  const payload = await theSportsDbFetch<{ player?: TheSportsDbPlayer[] | null }>('searchplayers.php', { p: playerName });
  return payload.player || [];
}

export async function lookupTeamPlayers(teamId: string | number) {
  const payload = await theSportsDbFetch<{ player?: TheSportsDbPlayer[] | null }>('lookup_all_players.php', { id: teamId });
  return payload.player || [];
}

export async function lookupEventsByDate(date: string, sport = 'Soccer') {
  const payload = await theSportsDbFetch<{ events?: TheSportsDbEvent[] | null }>('eventsday.php', { d: date, s: sport });
  return payload.events || [];
}

export function pickTeamImage(team: TheSportsDbTeam) {
  return team.strTeamBadge || team.strBadge || team.strTeamLogo || team.strTeamFanart1 || team.strTeamBanner || null;
}

export function pickPlayerImage(player: TheSportsDbPlayer) {
  return player.strThumb || player.strCutout || player.strRender || player.strFanart1 || null;
}

export function extractTeamProfile(team: TheSportsDbTeam) {
  return {
    sportsDbId: team.idTeam || null,
    name: team.strTeam || null,
    country: team.strCountry || null,
    league: team.strLeague || null,
    stadium: team.strStadium || null,
    description: team.strDescriptionEN || null,
    badge: pickTeamImage(team),
    logo: team.strTeamLogo || null,
    banner: team.strTeamBanner || null,
    website: team.strWebsite || null,
    facebook: team.strFacebook || null,
    twitter: team.strTwitter || null,
    instagram: team.strInstagram || null,
  };
}

export function extractPlayerProfile(player: TheSportsDbPlayer) {
  return {
    sportsDbId: player.idPlayer || null,
    name: player.strPlayer || null,
    nationality: player.strNationality || null,
    birthLocation: player.strBirthLocation || null,
    dateBorn: player.dateBorn || null,
    position: player.strPosition || null,
    signing: player.strSigning || null,
    wage: player.strWage || null,
    height: player.strHeight || null,
    weight: player.strWeight || null,
    description: player.strDescriptionEN || null,
    image: pickPlayerImage(player),
    thumb: player.strThumb || null,
    cutout: player.strCutout || null,
    render: player.strRender || null,
    team: player.strTeam || null,
  };
}
