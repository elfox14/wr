import prisma from '@/lib/prisma';
import { calculateFairValue, calculatePlayerScore } from '@/lib/scoring';
import { getDataHubTeam, getDataHubTeams, unwrapDataHubData } from '@/lib/mcPrimeDataHub';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';

export type OfficialSquadPlayerInput = {
  name?: string | null;
  fullName?: string | null;
  playerName?: string | null;
  player_name?: string | null;
  code?: string | null;
  position?: string | null;
  player_position?: string | null;
  age?: number | string | null;
  player_age?: number | string | null;
  club?: string | null;
  player_club?: string | null;
  image?: string | null;
  photo?: string | null;
  avatar?: string | null;
  thumb?: string | null;
  player_photo?: string | null;
  player_image?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  shirtNumber?: number | string | null;
  number?: number | string | null;
  shirt_number?: number | string | null;
  player_number?: number | string | null;
  externalId?: number | string | null;
  apiFootballId?: number | string | null;
  api_football_id?: number | string | null;
  api_player_id?: number | string | null;
  player_id?: number | string | null;
  player?: Record<string, any> | null;
  raw_json?: string | null;
  [key: string]: any;
};

export type OfficialSquadTeamInput = {
  teamId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  teamApiId?: number | string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  replaceExisting?: boolean;
  allowUnverified?: boolean;
  requireImages?: boolean;
  players?: OfficialSquadPlayerInput[];
};

type NormalizedPlayer = {
  name: string;
  code: string;
  position: string | null;
  age: number | null;
  club: string | null;
  image: string;
  shirtNumber: number | null;
  externalId: string | null;
  apiFootballId: number | null;
};

const PLAYER_SOURCE_POLICY = 'APPROVED_SQUAD_SOURCES_ONLY';

function first<T = any>(...values: any[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value as T;
  }
  return null;
}

function asString(...values: any[]) {
  const value = first(...values);
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function asInt(...values: any[]) {
  const value = first(...values);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function asBool(value: any, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeText(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

function slug(value: any, fallback = 'player') {
  const text = String(value || fallback)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
  return text || Buffer.from(String(value || fallback)).toString('hex').slice(0, 24);
}

function cleanCode(value: any, fallback: string) {
  const raw = String(value || fallback || 'PLAYER').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.slice(0, 10) || 'PLAYER';
}

function safeJson(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function envelope(payload: any) {
  const data = unwrapDataHubData(payload) || {};
  const team = data?.team || payload?.team || data || payload || {};
  const apiProfile = data?.api_profile || data?.apiProfile || payload?.api_profile || payload?.apiProfile || team?.api_profile || team?.apiProfile || {};
  const manualProfile = data?.manual_profile || data?.manualProfile || payload?.manual_profile || payload?.manualProfile || team?.manual_profile || team?.manualProfile || {};
  const sourceSummary = data?.source_summary || data?.sourceSummary || payload?.source_summary || payload?.sourceSummary || {};
  return { data, team, apiProfile, manualProfile, sourceSummary };
}

function dataHubTeamApiId(payload: any) {
  const { team, apiProfile } = envelope(payload);
  return asInt(team?.apiFootballId, team?.api_football_id, team?.api_team_id, team?.api_id, apiProfile?.api_team_id, apiProfile?.api_id, payload?.api_team_id, payload?.api_id);
}

function dataHubTeamId(row: any) {
  const { team, apiProfile } = envelope(row);
  return first(team?.id, team?.team_id, row?.id, row?.team_id, apiProfile?.team_id, apiProfile?.api_team_id, dataHubTeamApiId(row));
}

function dataHubTeamName(payload: any) {
  const { team, apiProfile, manualProfile } = envelope(payload);
  return asString(manualProfile?.name_ar, manualProfile?.official_name, team?.name_ar, team?.name, team?.team_name, apiProfile?.api_team_name, apiProfile?.name, payload?.name);
}

function dataHubTeamCode(payload: any) {
  const { team, manualProfile } = envelope(payload);
  return asString(team?.code, team?.fifa_code, team?.fifaCode, manualProfile?.fifa_code, manualProfile?.country_iso3, payload?.code);
}

function sourceName(input: OfficialSquadTeamInput, payload?: any) {
  if (input.sourceName) return input.sourceName;
  const { data, sourceSummary } = envelope(payload || {});
  return asString(sourceSummary?.sourceName, sourceSummary?.source_name, data?.sourceName, data?.source_name, sourceSummary?.team_source, data?.source) || 'Official World Cup Squad';
}

function sourceUrl(input: OfficialSquadTeamInput, payload?: any) {
  if (input.sourceUrl) return input.sourceUrl;
  const { data, manualProfile, sourceSummary } = envelope(payload || {});
  return asString(
    manualProfile?.official_squad_url,
    manualProfile?.players_source_url,
    manualProfile?.source_url,
    sourceSummary?.sourceUrl,
    sourceSummary?.source_url,
    data?.sourceUrl,
    data?.source_url,
  );
}

async function findTeam(input: OfficialSquadTeamInput) {
  const teamId = asString(input.teamId);
  if (teamId) {
    const team = await prisma.asset.findFirst({ where: { id: teamId, type: 'TEAM' } });
    if (team) return team;
  }

  const teamApiId = asInt(input.teamApiId);
  if (teamApiId) {
    const team = await prisma.asset.findFirst({ where: { type: 'TEAM', apiFootballId: teamApiId } });
    if (team) return team;
  }

  const code = asString(input.teamCode)?.toUpperCase();
  if (code) {
    const team = await prisma.asset.findFirst({ where: { type: 'TEAM', code } });
    if (team) return team;
  }

  const name = normalizeText(input.teamName);
  if (name) {
    const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
    const team = teams.find((candidate) => normalizeText(candidate.name) === name || normalizeText(candidate.code) === name);
    if (team) return team;
  }

  return null;
}

function playerRecord(player: OfficialSquadPlayerInput) {
  const raw = typeof player?.raw_json === 'string' ? safeJson(player.raw_json) : null;
  return player?.player || raw || player;
}

function playerImage(player: OfficialSquadPlayerInput) {
  const record = playerRecord(player);
  const image = asString(
    player.image,
    player.photo,
    player.avatar,
    player.thumb,
    player.player_photo,
    player.player_image,
    player.image_url,
    player.photo_url,
    record?.image,
    record?.photo,
    record?.avatar,
    record?.thumb,
    record?.player_photo,
    record?.player_image,
    record?.image_url,
    record?.photo_url,
    record?.strThumb,
    record?.strCutout,
    record?.strRender,
  ) || '';
  return hasUsablePlayerImage(image) ? image : '';
}

function ageFromDate(value?: string | null) {
  if (!value) return null;
  const born = new Date(value);
  if (Number.isNaN(born.getTime())) return null;
  const asOf = new Date('2026-06-11T00:00:00Z');
  let age = asOf.getUTCFullYear() - born.getUTCFullYear();
  const birthdayPassed = asOf.getUTCMonth() > born.getUTCMonth() || (asOf.getUTCMonth() === born.getUTCMonth() && asOf.getUTCDate() >= born.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age > 0 && age < 60 ? age : null;
}

function normalizePlayer(player: OfficialSquadPlayerInput, index: number): NormalizedPlayer | null {
  const record = playerRecord(player);
  const name = asString(player.name, player.fullName, player.playerName, player.player_name, record?.name, record?.full_name, record?.fullName, record?.player_name, record?.playerName, record?.strPlayer);
  if (!name) return null;

  const shirtNumber = asInt(player.shirtNumber, player.number, player.shirt_number, player.player_number, record?.shirtNumber, record?.shirt_number, record?.number, record?.player_number);
  const age = asInt(player.age, player.player_age, record?.age, record?.player_age) || ageFromDate(asString(record?.birthDate, record?.birth_date, record?.dateBorn, player?.birthDate, player?.birth_date));
  const position = asString(player.position, player.player_position, record?.position, record?.pos, record?.strPosition, record?.player_position);
  const club = asString(player.club, player.player_club, record?.club, record?.team, record?.current_club, record?.currentClub, record?.strTeam, record?.player_club, record?.club_name);
  const image = playerImage(player);
  const externalId = asString(player.externalId, record?.externalId, player.id, record?.id, player.player_id, record?.player_id, player.api_player_id, record?.api_player_id);
  const apiFootballId = asInt(player.apiFootballId, player.api_football_id, player.api_player_id, player.player_id, record?.apiFootballId, record?.api_football_id, record?.api_player_id, record?.id, record?.player_id);
  const code = cleanCode(player.code, `${name.slice(0, 3)}${shirtNumber || index + 1}`);

  return { name, code, position, age, club, image, shirtNumber, externalId, apiFootballId };
}

function playerBaseScore(position?: string | null, age?: number | null) {
  const pos = String(position || '').toUpperCase();
  let fundamental = 62;
  if (['G', 'GK', 'GOALKEEPER'].includes(pos)) fundamental = 61;
  if (['D', 'DEF', 'DEFENDER'].includes(pos)) fundamental = 62;
  if (['M', 'MID', 'MIDFIELDER'].includes(pos)) fundamental = 64;
  if (['F', 'FW', 'FWD', 'ATTACKER', 'FORWARD'].includes(pos)) fundamental = 66;
  if (age && age >= 24 && age <= 31) fundamental += 3;
  return Math.min(fundamental, 78);
}

async function findExistingPlayer(teamId: string, player: NormalizedPlayer) {
  const or: any[] = [{ id: `official-player-${teamId}-${slug(player.name)}` }, { teamId, name: player.name }];
  if (player.apiFootballId) or.push({ apiFootballId: player.apiFootballId });
  return prisma.asset.findFirst({ where: { type: 'PLAYER', OR: or } });
}

function playerValuation(player: NormalizedPlayer) {
  const fundamental = playerBaseScore(player.position, player.age);
  const score = calculatePlayerScore({ fundamental, popularity: 50, worldCupLegacy: 45, marketDemand: 50, momentum: 50, age: player.age || undefined });
  const fairValue = calculateFairValue(score, 'PLAYER');
  return { fundamental, score, fairValue };
}

export async function importOfficialSquad(input: OfficialSquadTeamInput) {
  const team = await findTeam(input);
  if (!team) {
    return { ok: false, error: 'team_not_found', teamId: input.teamId || null, teamCode: input.teamCode || null, teamName: input.teamName || null, teamApiId: input.teamApiId || null };
  }

  const players = Array.isArray(input.players) ? input.players : [];
  const normalizedPlayers = players.map((player, index) => normalizePlayer(player, index)).filter((player): player is NormalizedPlayer => Boolean(player));
  const imported: any[] = [];
  const skippedRows = players.length - normalizedPlayers.length;
  let skippedForImages = 0;

  for (const player of normalizedPlayers) {
    if (input.requireImages && !player.image) {
      skippedForImages += 1;
      continue;
    }

    const existing = await findExistingPlayer(team.id, player);
    const { fundamental, score, fairValue } = playerValuation(player);
    const data = {
      type: 'PLAYER',
      name: player.name,
      code: player.code,
      image: player.image || existing?.image || '👤',
      position: player.position,
      age: player.age,
      club: player.club,
      teamId: team.id,
      isAvailable: true,
      ...(player.apiFootballId ? { apiFootballId: player.apiFootballId } : {}),
      current_price: fairValue,
      high_price: fairValue,
      low_price: fairValue,
      market_cap: `${Math.round(fairValue * 100)}`,
      volume: '0',
      change: 0,
      playerTier: 0.5,
      roleImportance: 0.5,
      score,
      popularity: 50,
      fundamental,
      marketDemand: 50,
      momentum: 50,
      volatilityScore: 20,
      fairValue,
      marketPrice: fairValue,
    };

    const asset = existing
      ? await prisma.asset.update({ where: { id: existing.id }, data })
      : await prisma.asset.create({ data: { id: `official-player-${team.id}-${slug(player.name)}`, ...data } });

    imported.push({ id: asset.id, name: asset.name, code: asset.code, position: asset.position, age: asset.age, club: asset.club, image: asset.image, shirtNumber: player.shirtNumber, externalId: player.externalId, apiFootballId: player.apiFootballId });
  }

  if (input.replaceExisting) {
    const importedIds = imported.map((player) => player.id);
    await prisma.asset.updateMany({ where: { type: 'PLAYER', teamId: team.id, id: { notIn: importedIds.length ? importedIds : ['__none__'] } }, data: { isAvailable: false } });
  }

  const finalSourceName = sourceName(input);
  const finalSourceUrl = sourceUrl(input);

  await prisma.teamIntelligenceReport.deleteMany({ where: { teamId: team.id, provider: 'MC_PRIME_OFFICIAL_SQUAD', reportType: 'OFFICIAL_SQUAD' } });
  await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title: `Official Squad — ${team.name}`,
      summary: `تم استيراد ${imported.length} لاعبًا من قائمة معتمدة منفصلة عن Data Hub العام.`,
      body: imported.map((player) => `- ${player.name}${player.position ? ` — ${player.position}` : ''}${player.club ? ` — ${player.club}` : ''}`).join('\n'),
      reportType: 'OFFICIAL_SQUAD',
      language: 'ar',
      sourceName: finalSourceName,
      sourceUrl: finalSourceUrl,
      sourceCategory: input.allowUnverified ? 'trusted_data_hub_squad' : 'official_squad',
      confidence: input.allowUnverified ? 'B' : 'A',
      provider: 'MC_PRIME_OFFICIAL_SQUAD',
      metrics: {
        importedCount: imported.length,
        skippedCount: skippedRows + skippedForImages,
        skippedRows,
        skippedForImages,
        withImages: imported.filter((player) => hasUsablePlayerImage(player.image)).length,
        replaceExisting: Boolean(input.replaceExisting),
        importedAt: new Date().toISOString(),
        players: imported,
        sourcePolicy: PLAYER_SOURCE_POLICY,
        allowUnverified: Boolean(input.allowUnverified),
      },
      tacticalTags: ['Official Squad'],
      strengths: [],
      weaknesses: [],
      lastCheckedAt: new Date(),
    },
  });

  return {
    ok: true,
    team: { id: team.id, name: team.name, code: team.code },
    sourceName: finalSourceName,
    sourceUrl: finalSourceUrl,
    imported: imported.length,
    skipped: skippedRows + skippedForImages,
    skippedRows,
    skippedForImages,
    withImages: imported.filter((player) => hasUsablePlayerImage(player.image)).length,
    replaceExisting: Boolean(input.replaceExisting),
    players: imported,
  };
}

function extractCandidateArray(value: any): OfficialSquadPlayerInput[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.players)) return value.players;
  if (Array.isArray(value?.squad)) return value.squad;
  if (Array.isArray(value?.roster)) return value.roster;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function extractDataHubPlayers(payload: any) {
  const { data, team } = envelope(payload);
  const rows = [
    data?.official_squad,
    data?.officialSquad,
    data?.final_squad,
    data?.finalSquad,
    data?.squad,
    data?.players,
    data?.roster,
    team?.official_squad,
    team?.officialSquad,
    team?.final_squad,
    team?.squad,
    team?.players,
    payload?.official_squad,
    payload?.officialSquad,
    payload?.squad,
    payload?.players,
    payload?.roster,
  ].flatMap(extractCandidateArray);

  const seen = new Set<string>();
  return rows.filter((row, index) => {
    const player = normalizePlayer(row, index);
    if (!player) return false;
    const key = String(player.apiFootballId || normalizeText(player.name));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceText(payload: any) {
  const { data, manualProfile, sourceSummary } = envelope(payload);
  return JSON.stringify({ sourceSummary, dataNotices: data?.data_notices || data?.dataNotices, sources: data?.sources || data?.source || data?.source_url || data?.sourceUrl, manualSources: manualProfile?.sources || manualProfile?.source_url || manualProfile?.official_squad_url || manualProfile?.players_source_url }).toLowerCase();
}

function isOfficialDataHubSquad(payload: any) {
  const { data, team, manualProfile, sourceSummary } = envelope(payload);
  const explicit = first(data?.official_squad_confirmed, data?.officialSquadConfirmed, data?.is_official_squad, data?.isOfficialSquad, data?.approved_squad, data?.approvedSquad, team?.official_squad_confirmed, team?.is_official_squad, sourceSummary?.official_squad_confirmed, sourceSummary?.is_official_squad, sourceSummary?.approved_for_players, sourceSummary?.approvedForPlayers, manualProfile?.official_squad_confirmed, manualProfile?.is_official_squad);
  if (explicit === true || explicit === 1 || String(explicit).toLowerCase() === 'true') return true;
  const text = sourceText(payload);
  const hasOfficialSignal = /(fifa|official|association|federation|fa\b|final squad|squad list|confirmed squad|قائمة رسمية|الاتحاد|فيفا)/i.test(text);
  const onlyGenericProviders = /(api-football|api_football|isports|fbref|thesportsdb)/i.test(text) && !/(fifa|official|association|federation|قائمة رسمية|الاتحاد|فيفا)/i.test(text);
  return hasOfficialSignal && !onlyGenericProviders;
}

async function getDataHubPayloads(payload: any) {
  const limit = Math.min(Math.max(asInt(payload?.limit) || 48, 1), 100);
  const explicitTeamId = asString(payload?.teamId, payload?.team_id, payload?.dataHubTeamId, payload?.data_hub_team_id);
  if (explicitTeamId) {
    const fullPayload = await getDataHubTeam(explicitTeamId, true);
    if (fullPayload?.ok === false) throw new Error(fullPayload.error || 'Failed to fetch Data Hub team');
    return [fullPayload];
  }

  const teamsPayload = await getDataHubTeams({ includePlaceholders: true, includeApiProfile: true, includeManual: true });
  if (teamsPayload?.ok === false) throw new Error(teamsPayload.error || 'Failed to fetch Data Hub teams');
  const data = unwrapDataHubData(teamsPayload);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.teams) ? data.teams : Array.isArray((teamsPayload as any)?.teams) ? (teamsPayload as any).teams : [];
  const selected = rows.slice(0, limit);
  const payloads = [];

  for (const row of selected) {
    const identifier = dataHubTeamId(row);
    if (!identifier) {
      payloads.push(row);
      continue;
    }
    const fullPayload = await getDataHubTeam(identifier, true);
    payloads.push(fullPayload?.ok === false ? row : fullPayload);
  }

  return payloads;
}

async function importFromDataHub(payload: any) {
  const allowUnverified = asBool(payload?.allowUnverified ?? payload?.allow_unverified, false);
  const requireImages = asBool(payload?.requireImages ?? payload?.require_images, false);
  const replaceExisting = asBool(payload?.replaceExisting ?? payload?.replace_existing, false);
  const payloads = await getDataHubPayloads(payload);
  const results = [];

  for (const teamPayload of payloads) {
    const players = extractDataHubPlayers(teamPayload);
    const official = isOfficialDataHubSquad(teamPayload);
    const input: OfficialSquadTeamInput = {
      teamCode: dataHubTeamCode(teamPayload),
      teamName: dataHubTeamName(teamPayload),
      teamApiId: dataHubTeamApiId(teamPayload),
      sourceName: sourceName({}, teamPayload),
      sourceUrl: sourceUrl({}, teamPayload),
      replaceExisting,
      allowUnverified,
      requireImages,
      players,
    };

    if (!official && !allowUnverified) {
      results.push({ ok: false, error: 'unverified_datahub_squad', teamCode: input.teamCode || null, teamName: input.teamName || null, availablePlayers: players.length, imported: 0, skipped: players.length, notice: 'القائمة موجودة في Data Hub لكنها غير معلّمة كمصدر رسمي. استخدم allowUnverified=true فقط بعد مراجعة المصدر يدويًا.' });
      continue;
    }

    const result = await importOfficialSquad(input);
    results.push({ ...result, dataHubOfficial: official, sourceMode: official ? 'official_or_approved' : 'trusted_data_hub_override', availablePlayers: players.length });
  }

  return {
    ok: results.every((result: any) => result.ok !== false),
    policy: PLAYER_SOURCE_POLICY,
    source: 'MC_PRIME_DATA_HUB',
    allowUnverified,
    requireImages,
    teamsProcessed: results.length,
    playersImported: results.reduce((sum: number, result: any) => sum + (result.imported || 0), 0),
    withImages: results.reduce((sum: number, result: any) => sum + (result.withImages || 0), 0),
    results,
  };
}

export async function importOfficialSquads(payload: any) {
  if (asBool(payload?.fromDataHub ?? payload?.from_data_hub, false) || asString(payload?.source) === 'datahub') {
    return importFromDataHub(payload);
  }

  const teams: OfficialSquadTeamInput[] = Array.isArray(payload?.teams)
    ? payload.teams
    : [{
      teamId: payload?.teamId,
      teamCode: payload?.teamCode,
      teamName: payload?.teamName,
      teamApiId: payload?.teamApiId,
      sourceName: payload?.sourceName,
      sourceUrl: payload?.sourceUrl,
      replaceExisting: payload?.replaceExisting,
      requireImages: payload?.requireImages,
      allowUnverified: payload?.allowUnverified,
      players: payload?.players,
    }];

  const results = [];
  for (const teamInput of teams) {
    results.push(await importOfficialSquad(teamInput));
  }

  return {
    ok: results.every((result) => result.ok !== false),
    policy: PLAYER_SOURCE_POLICY,
    teamsProcessed: results.length,
    playersImported: results.reduce((sum, result: any) => sum + (result.imported || 0), 0),
    withImages: results.reduce((sum, result: any) => sum + (result.withImages || 0), 0),
    results,
  };
}
