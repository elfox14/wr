import prisma from '@/lib/prisma';
import { extractDataHubArray, getDataHubTeam, getDataHubTeams, getDataHubSummary, getDataHubReadiness, getDataHubSources, unwrapDataHubData } from '@/lib/mcPrimeDataHub';

function first<T = any>(...values: any[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value as T;
  }
  return null;
}

function asString(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function asInt(...values: any[]) {
  const value = first(...values);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function asFloat(...values: any[]) {
  const value = first(...values);
  if (value === null) return null;
  const parsed = Number(String(value).replace('%', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanCode(value: string | null, fallback: string) {
  const raw = (value || fallback || 'TEAM').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.slice(0, 10) || 'TEAM';
}

function stableId(prefix: string, ...parts: any[]) {
  const raw = parts.filter(Boolean).map(String).join('-') || prefix;
  const ascii = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
  const suffix = ascii || Buffer.from(raw).toString('hex').slice(0, 24);
  return `${prefix}-${suffix}`;
}

function normalizeScopeText(value: any) {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean).join('، ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getEnvelope(row: any) {
  const data = unwrapDataHubData(row);
  const team = data?.team || row?.team || data || row || {};
  const apiProfile = data?.api_profile || data?.apiProfile || row?.api_profile || row?.apiProfile || team?.api_profile || team?.apiProfile || {};
  const manualProfile = data?.manual_profile || data?.manualProfile || row?.manual_profile || row?.manualProfile || team?.manual_profile || team?.manualProfile || {};
  const sourceSummary = data?.source_summary || row?.source_summary || {};
  return { data, team, apiProfile, manualProfile, sourceSummary };
}

function getHubTeamIdentifier(row: any) {
  const { team, apiProfile } = getEnvelope(row);
  return first(team?.id, team?.team_id, row?.id, row?.team_id, apiProfile?.team_id, apiProfile?.api_team_id, team?.api_team_id);
}

function getApiTeamId(row: any) {
  const { team, apiProfile } = getEnvelope(row);
  return asInt(team?.apiFootballId, team?.api_football_id, team?.api_team_id, team?.api_id, apiProfile?.api_team_id, apiProfile?.api_id, row?.api_team_id, row?.api_id);
}

function getTeamName(row: any) {
  const { team, apiProfile, manualProfile } = getEnvelope(row);
  return asString(manualProfile?.name_ar, manualProfile?.official_name, team?.name_ar, team?.name, team?.team_name, apiProfile?.api_team_name, apiProfile?.name, row?.name) || 'منتخب غير مسمى';
}

function getTeamCode(row: any, name: string) {
  const { team, manualProfile } = getEnvelope(row);
  return cleanCode(asString(team?.code, team?.fifa_code, team?.fifaCode, manualProfile?.fifa_code, manualProfile?.country_iso3, row?.code), name);
}

function getTeamImage(row: any) {
  const { team, apiProfile, manualProfile } = getEnvelope(row);
  return asString(apiProfile?.api_logo, apiProfile?.logo, team?.image, team?.logo, manualProfile?.logo_url, row?.image, row?.logo) || '';
}

function getTeamGroup(row: any) {
  const { team, manualProfile } = getEnvelope(row);
  return asString(team?.group, team?.group_name, manualProfile?.group, row?.group);
}

function getTeamContinent(row: any) {
  const { team, manualProfile } = getEnvelope(row);
  return asString(team?.continent, team?.confederation, manualProfile?.confederation, manualProfile?.continent, row?.continent);
}

function getTeamNotice(row: any) {
  const { data } = getEnvelope(row);
  const notices = data?.data_notices || data?.dataNotices || row?.data_notices || row?.dataNotices || [];
  if (Array.isArray(notices)) return notices.filter(Boolean).join(' | ');
  return normalizeScopeText(notices);
}

function extractSquad(row: any) {
  const { data } = getEnvelope(row);
  const squad = data?.squad || row?.squad || data?.players || row?.players || [];
  return Array.isArray(squad) ? squad : [];
}

function extractPlayerStatistics(row: any) {
  const { data } = getEnvelope(row);
  const stats = data?.player_statistics || data?.playerStatistics || row?.player_statistics || row?.playerStatistics || [];
  return Array.isArray(stats) ? stats : [];
}

function extractRecentFixtures(row: any) {
  const { data } = getEnvelope(row);
  const fixtures = data?.recent_fixtures || data?.recentFixtures || row?.recent_fixtures || row?.recentFixtures || [];
  return Array.isArray(fixtures) ? fixtures : [];
}

function playerApiId(player: any) {
  return asInt(player?.api_player_id, player?.player_id, player?.id, player?.api_id, player?.player?.id);
}

function playerName(player: any) {
  return asString(player?.player_name, player?.name, player?.player?.name) || 'لاعب غير مسمى';
}

function playerPhoto(player: any) {
  return asString(player?.player_photo, player?.photo, player?.image, player?.player?.photo) || '';
}

function playerPosition(player: any) {
  return asString(player?.player_position, player?.position, player?.games?.position, player?.statistics?.[0]?.games?.position);
}

function playerAge(player: any) {
  return asInt(player?.player_age, player?.age, player?.player?.age);
}

function getPlayerStat(statsRows: any[], apiPlayerId: number | null, name: string) {
  return statsRows.find((item) => {
    const candidateId = asInt(item?.api_player_id, item?.player_id, item?.id, item?.player?.id);
    const candidateName = asString(item?.player_name, item?.name, item?.player?.name);
    return (apiPlayerId && candidateId === apiPlayerId) || (!!candidateName && candidateName.toLowerCase() === name.toLowerCase());
  });
}

function buildReportBody(row: any) {
  const { manualProfile } = getEnvelope(row);
  const parts = [
    normalizeScopeText(manualProfile?.short_overview_ar || manualProfile?.overview_ar || manualProfile?.summary),
    normalizeScopeText(manualProfile?.style_notes_ar || manualProfile?.style_notes),
    getTeamNotice(row),
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n') : null;
}

async function findExistingTeam(row: any, code: string, apiTeamId: number | null, name: string) {
  const or: any[] = [];
  if (apiTeamId) or.push({ apiFootballId: apiTeamId });
  if (code) or.push({ code });
  if (name) or.push({ name });
  if (!or.length) return null;
  return prisma.asset.findFirst({ where: { type: 'TEAM', OR: or } });
}

export async function importDataHubTeam(row: any, options: { full?: boolean } = {}) {
  let sourceRow = row;
  if (options.full) {
    const identifier = getHubTeamIdentifier(row) || getApiTeamId(row);
    if (identifier) {
      const fullPayload = await getDataHubTeam(identifier, true);
      if (fullPayload?.ok !== false) sourceRow = fullPayload;
    }
  }

  const { data, apiProfile, manualProfile, sourceSummary } = getEnvelope(sourceRow);
  const name = getTeamName(sourceRow);
  const code = getTeamCode(sourceRow, name);
  const apiTeamId = getApiTeamId(sourceRow);
  const image = getTeamImage(sourceRow);
  const group = getTeamGroup(sourceRow);
  const continent = getTeamContinent(sourceRow);
  const existing = await findExistingTeam(sourceRow, code, apiTeamId, name);

  const updateData: any = {
    name,
    code,
    image,
    ...(group ? { group } : {}),
    ...(continent ? { continent } : {}),
    ...(apiTeamId ? { apiFootballId: apiTeamId } : {}),
    ...(asString(manualProfile?.coach) ? { coach: asString(manualProfile?.coach) } : {}),
    ...(asInt(manualProfile?.fifa_rank, data?.team?.fifa_rank) ? { fifaRank: asInt(manualProfile?.fifa_rank, data?.team?.fifa_rank) } : {}),
    ...(asInt(manualProfile?.world_cup_appearances, manualProfile?.participations) ? { participations: asInt(manualProfile?.world_cup_appearances, manualProfile?.participations) } : {}),
  };

  const team = existing
    ? await prisma.asset.update({ where: { id: existing.id }, data: updateData })
    : await prisma.asset.create({
      data: {
        id: stableId('team', code, apiTeamId, name),
        type: 'TEAM',
        name,
        code,
        image,
        current_price: 1000,
        high_price: 1000,
        low_price: 1000,
        market_cap: '0',
        volume: '0',
        change: 0,
        group,
        continent,
        fifaRank: asInt(manualProfile?.fifa_rank, data?.team?.fifa_rank),
        coach: asString(manualProfile?.coach),
        participations: asInt(manualProfile?.world_cup_appearances, manualProfile?.participations),
        apiFootballId: apiTeamId,
        score: 50,
        popularity: 50,
        fundamental: 50,
        worldCupLegacy: 50,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 10,
        fairValue: 1000,
        marketPrice: 1000,
      },
    });

  const squad = extractSquad(sourceRow);
  const playerStats = extractPlayerStatistics(sourceRow);
  const players = await importSquad(team.id, squad, playerStats);

  const recentFixtures = extractRecentFixtures(sourceRow);
  await prisma.teamIntelligenceReport.deleteMany({
    where: { teamId: team.id, provider: 'MC_PRIME_DATA_HUB', reportType: 'DATA_HUB_PROFILE' },
  });
  await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title: `Data Hub Profile — ${team.name}`,
      summary: getTeamNotice(sourceRow) || 'بيانات عامة من MC PRIME Data Hub، وليست بيانات رسمية خاصة بكأس العالم 2026.',
      body: buildReportBody(sourceRow),
      reportType: 'DATA_HUB_PROFILE',
      language: 'ar',
      sourceName: 'MC PRIME World Cup Data Hub',
      sourceUrl: process.env.MC_PRIME_DATA_HUB_URL || 'https://mcprim.com/worldcup/api.php',
      sourceCategory: 'data_hub',
      confidence: asString(sourceSummary?.confidence, data?.team?.confidence, row?.confidence) || 'C',
      provider: 'MC_PRIME_DATA_HUB',
      metrics: {
        apiProfile,
        manualProfile,
        sourceSummary,
        dataNotices: data?.data_notices || data?.dataNotices || [],
        recentFixtures,
        importedAt: new Date().toISOString(),
        scope: 'API_FOOTBALL_GENERAL_NOT_WORLD_CUP_2026',
      },
      tacticalTags: ['Data Hub', 'General Profile'],
      strengths: [],
      weaknesses: [],
      lastCheckedAt: new Date(),
    },
  });

  return {
    id: team.id,
    name: team.name,
    code: team.code,
    apiFootballId: team.apiFootballId,
    playersImported: players.imported,
    playerStatsImported: players.statsImported,
    recentFixtures: recentFixtures.length,
  };
}

async function importSquad(teamId: string, squad: any[], playerStats: any[]) {
  let imported = 0;
  let statsImported = 0;

  for (const player of squad) {
    const apiPlayerId = playerApiId(player);
    const name = playerName(player);
    const stat = getPlayerStat(playerStats, apiPlayerId, name) || {};
    const id = apiPlayerId ? `api-football-player-${apiPlayerId}` : stableId('dh-player', teamId, name);
    const code = cleanCode(asString(player?.code, player?.player_code), `${name.slice(0, 3)}${apiPlayerId || imported}`);

    const asset = await prisma.asset.upsert({
      where: { id },
      update: {
        type: 'PLAYER',
        name,
        code,
        image: playerPhoto(player),
        position: playerPosition(player),
        age: playerAge(player),
        teamId,
        ...(apiPlayerId ? { apiFootballId: apiPlayerId } : {}),
      },
      create: {
        id,
        type: 'PLAYER',
        name,
        code,
        image: playerPhoto(player),
        current_price: 100,
        high_price: 100,
        low_price: 100,
        market_cap: '0',
        volume: '0',
        change: 0,
        position: playerPosition(player),
        age: playerAge(player),
        teamId,
        apiFootballId: apiPlayerId,
        playerTier: 0.5,
        roleImportance: 0.5,
        score: 50,
        popularity: 50,
        fundamental: 50,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 10,
        fairValue: 100,
        marketPrice: 100,
      },
    });

    imported += 1;

    if (stat && Object.keys(stat).length > 0) {
      const season = asInt(stat?.season, stat?.league?.season) || null;
      if (apiPlayerId || season) {
        await prisma.playerPerformance.deleteMany({
          where: {
            assetId: asset.id,
            provider: 'MC_PRIME_DATA_HUB',
            ...(apiPlayerId ? { providerPlayerId: apiPlayerId } : {}),
            ...(season ? { season } : {}),
          },
        });
      }
      await prisma.playerPerformance.create({
        data: {
          assetId: asset.id,
          provider: 'MC_PRIME_DATA_HUB',
          providerPlayerId: apiPlayerId,
          season,
          competition: asString(stat?.league_name, stat?.league?.name) || 'API Football General',
          teamName: asString(stat?.team_name, stat?.team?.name),
          minutes: asInt(stat?.minutes, stat?.games?.minutes) || 0,
          started: Boolean(asInt(stat?.lineups, stat?.games?.lineups)),
          goals: asInt(stat?.goals, stat?.goals_total, stat?.goals?.total) || 0,
          assists: asInt(stat?.assists, stat?.goals?.assists) || 0,
          shotsTotal: asInt(stat?.shots_total, stat?.shots?.total) || 0,
          shotsOnTarget: asInt(stat?.shots_on, stat?.shots_on_target, stat?.shots?.on) || 0,
          passes: asInt(stat?.passes_total, stat?.passes?.total) || 0,
          keyPasses: asInt(stat?.key_passes, stat?.passes?.key) || 0,
          passAccuracy: asFloat(stat?.pass_accuracy, stat?.passes?.accuracy) || 0,
          tackles: asInt(stat?.tackles_total, stat?.tackles?.total) || 0,
          interceptions: asInt(stat?.interceptions, stat?.tackles?.interceptions) || 0,
          yellowCards: asInt(stat?.yellow_cards, stat?.cards?.yellow) || 0,
          redCards: asInt(stat?.red_cards, stat?.cards?.red) || 0,
          apiRating: asFloat(stat?.rating, stat?.games?.rating),
          rawData: stat,
        },
      });
      statsImported += 1;
    }
  }

  return { imported, statsImported };
}

export async function importDataHubTeams(options: { limit?: number; full?: boolean } = {}) {
  const payload = await getDataHubTeams({ includePlaceholders: true, includeApiProfile: true, includeManual: true });
  if (payload?.ok === false) throw new Error(payload.error || 'Failed to fetch Data Hub teams');
  const rows = extractDataHubArray(payload, 'teams');
  const limit = Math.min(Math.max(Number(options.limit || rows.length), 1), 100);
  const selected = rows.slice(0, limit);
  const teams = [];

  for (const row of selected) {
    teams.push(await importDataHubTeam(row, { full: Boolean(options.full) }));
  }

  return {
    ok: true,
    requested: selected.length,
    available: rows.length,
    full: Boolean(options.full),
    teams,
    totals: {
      teamsImported: teams.length,
      playersImported: teams.reduce((sum, team) => sum + team.playersImported, 0),
      playerStatsImported: teams.reduce((sum, team) => sum + team.playerStatsImported, 0),
    },
  };
}

export async function importSingleDataHubTeam(teamId: string | number) {
  const payload = await getDataHubTeam(teamId, true);
  if (payload?.ok === false) throw new Error(payload.error || 'Failed to fetch Data Hub team');
  return importDataHubTeam(payload, { full: false });
}

export async function getDataHubStatus() {
  const [summary, readiness, sources, database] = await Promise.all([
    getDataHubSummary(),
    getDataHubReadiness().catch((error) => ({ ok: false, error: error.message })),
    getDataHubSources().catch((error) => ({ ok: false, error: error.message })),
    Promise.all([
      prisma.asset.count({ where: { type: 'TEAM' } }),
      prisma.asset.count({ where: { type: 'PLAYER' } }),
      prisma.teamIntelligenceReport.count({ where: { provider: 'MC_PRIME_DATA_HUB' } }),
      prisma.playerPerformance.count({ where: { provider: 'MC_PRIME_DATA_HUB' } }),
    ]),
  ]);

  return {
    ok: summary?.ok !== false,
    dataHub: summary,
    readiness,
    sources,
    database: {
      teams: database[0],
      players: database[1],
      dataHubReports: database[2],
      dataHubPerformances: database[3],
    },
  };
}
