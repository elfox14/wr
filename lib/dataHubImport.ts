import prisma from '@/lib/prisma';
import { extractDataHubArray, getDataHubTeam, getDataHubTeams, getDataHubSummary, getDataHubReadiness, getDataHubSources, unwrapDataHubData } from '@/lib/mcPrimeDataHub';

const OFFICIAL_PLAYER_SOURCE_POLICY = 'APPROVED_SQUAD_SOURCES_ONLY';
const EXTERNAL_PLAYER_IMPORT_NOTICE = 'Data Hub and generic API-Football squads are ignored for players. football-data.org may be used later only through a separate approved fallback or verification workflow when official squad data is missing or needs review.';

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

function positiveInt(...values: any[]) {
  const parsed = asInt(...values);
  return parsed && parsed > 0 ? parsed : null;
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
  return positiveInt(team?.apiFootballId, team?.api_football_id, team?.api_team_id, team?.api_id, apiProfile?.api_team_id, apiProfile?.api_id, row?.api_team_id, row?.api_id);
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

function getIgnoredSquadCount(row: any) {
  const { data } = getEnvelope(row);
  const squad = data?.squad || row?.squad || data?.players || row?.players || [];
  return Array.isArray(squad) ? squad.length : 0;
}

function getIgnoredPlayerStatsCount(row: any) {
  const { data } = getEnvelope(row);
  const stats = data?.player_statistics || data?.playerStatistics || row?.player_statistics || row?.playerStatistics || [];
  return Array.isArray(stats) ? stats.length : 0;
}

function extractRecentFixtures(row: any) {
  const { data } = getEnvelope(row);
  const fixtures = data?.recent_fixtures || data?.recentFixtures || row?.recent_fixtures || row?.recentFixtures || [];
  return Array.isArray(fixtures) ? fixtures : [];
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

  const recentFixtures = extractRecentFixtures(sourceRow);
  const ignoredSquadCount = getIgnoredSquadCount(sourceRow);
  const ignoredPlayerStatsCount = getIgnoredPlayerStatsCount(sourceRow);

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
        ignoredSquadCount,
        ignoredPlayerStatsCount,
        externalPlayerImportDisabled: true,
        officialPlayerSourcePolicy: OFFICIAL_PLAYER_SOURCE_POLICY,
        playerImportNotice: EXTERNAL_PLAYER_IMPORT_NOTICE,
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
    playersImported: 0,
    playerStatsImported: 0,
    externalPlayerImportDisabled: true,
    ignoredSquadCount,
    ignoredPlayerStatsCount,
    recentFixtures: recentFixtures.length,
  };
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
    externalPlayerImportDisabled: true,
    officialPlayerSourcePolicy: OFFICIAL_PLAYER_SOURCE_POLICY,
    playerImportNotice: EXTERNAL_PLAYER_IMPORT_NOTICE,
    teams,
    totals: {
      teamsImported: teams.length,
      playersImported: 0,
      playerStatsImported: 0,
      ignoredSquadCount: teams.reduce((sum, team) => sum + team.ignoredSquadCount, 0),
      ignoredPlayerStatsCount: teams.reduce((sum, team) => sum + team.ignoredPlayerStatsCount, 0),
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
    externalPlayerImportDisabled: true,
    officialPlayerSourcePolicy: OFFICIAL_PLAYER_SOURCE_POLICY,
    playerImportNotice: EXTERNAL_PLAYER_IMPORT_NOTICE,
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
