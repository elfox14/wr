import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STAGE_CONFIGS = [
  {
    key: 'r32',
    stage: 'round_of_32',
    label: 'Round Of 32',
    envPrefix: 'FIFA_R32',
    matchNumbers: new Set(Array.from({ length: 16 }, (_, index) => 73 + index)),
    aliases: ['round of 32', 'last 32', 'r32', 'دور الـ32', 'دور ال32'],
    idToMatchNo: new Map([
      ['53452545', 73],
      ['53452541', 74],
      ['53452547', 75],
      ['53452557', 76],
      ['53452543', 77],
      ['53452561', 78],
      ['53452563', 79],
      ['53452565', 80],
      ['53452553', 81],
      ['53452555', 82],
      ['53452549', 83],
      ['53452551', 84],
      ['53452505', 85],
      ['53452569', 86],
      ['53452507', 87],
      ['53452503', 88],
    ]),
  },
  {
    key: 'r16',
    stage: 'round_of_16',
    label: 'Round Of 16',
    envPrefix: 'FIFA_R16',
    matchNumbers: new Set(Array.from({ length: 8 }, (_, index) => 89 + index)),
    aliases: ['round of 16', 'last 16', 'r16', 'دور الـ16', 'دور ال16'],
    idToMatchNo: new Map(),
  },
];

const R16_BRACKET = [
  { MatchNumber: 89, winners: [73, 75], Date: '2026-07-04T19:00:00.000Z' },
  { MatchNumber: 90, winners: [74, 77], Date: '2026-07-04T22:00:00.000Z' },
  { MatchNumber: 91, winners: [76, 78], Date: '2026-07-05T19:00:00.000Z' },
  { MatchNumber: 92, winners: [79, 80], Date: '2026-07-05T22:00:00.000Z' },
  { MatchNumber: 93, winners: [83, 84], Date: '2026-07-06T19:00:00.000Z' },
  { MatchNumber: 94, winners: [81, 82], Date: '2026-07-06T22:00:00.000Z' },
  { MatchNumber: 95, winners: [86, 88], Date: '2026-07-07T19:00:00.000Z' },
  { MatchNumber: 96, winners: [85, 87], Date: '2026-07-07T22:00:00.000Z' },
];

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function bool(name, fallback = false) {
  const value = env(name).toLowerCase();
  return value ? ['1', 'true', 'yes', 'on'].includes(value) : fallback;
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : null;
}

function norm(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normTeam(value) {
  const name = norm(value);
  if (['usa', 'united states', 'united states of america'].includes(name)) return 'usa';
  if (['korea republic', 'south korea', 'republic of korea'].includes(name)) return 'korea republic';
  if (['bosnia and herzegovina', 'bosnia herzegovina', 'bosnia h', 'bih'].includes(name)) return 'bosnia h';
  if (['cote d ivoire', 'cote divoire', 'ivory coast', 'civ'].includes(name)) return 'ivory coast';
  if (['dr congo', 'congo dr', 'democratic republic of the congo', 'cod'].includes(name)) return 'dr congo';
  if (['cape verde', 'cabo verde', 'cpv'].includes(name)) return 'cape verde';
  if (['curacao', 'curaçao'].includes(name)) return 'curacao';
  if (['ir iran', 'iran'].includes(name)) return 'iran';
  if (['south africa', 'rsa', 'zaf'].includes(name)) return 'south africa';
  if (['algeria', 'alg', 'dza'].includes(name)) return 'algeria';
  return name;
}

function fifaUrl() {
  const configured = env('FIFA_MATCHES_SOURCE_URL');
  if (configured) return configured;
  const url = new URL(env('FIFA_MATCHES_BASE_URL', 'https://api.fifa.com/api/v3/calendar/matches'));
  url.searchParams.set('language', env('FIFA_LANGUAGE', 'en'));
  url.searchParams.set('count', env('FIFA_MATCHES_COUNT', '500'));
  url.searchParams.set('idCompetition', env('FIFA_COMPETITION_ID', '17'));
  url.searchParams.set('idSeason', env('FIFA_SEASON_ID', '2026'));
  return url.toString();
}

async function getPayload() {
  const url = fifaUrl();
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`FIFA HTTP ${res.status}: ${text.slice(0, 300)}`);
  return { url, payload: JSON.parse(text) };
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && obj?.[key] !== '') return obj[key];
  }
  return undefined;
}

function desc(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return desc(value[0]);
  if (value && typeof value === 'object') return String(value.Description || value.description || value.Name || value.name || value.Value || value.value || '').trim();
  return '';
}

function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).join(' ').toLowerCase();
  return /match|fixture|home|away|team|stage|round|score|status|date/.test(keys) && /id|number|home|away|team|stage|round/.test(keys);
}

function listMatches(payload) {
  const out = [];
  const seen = new Set();
  const stack = [payload];
  while (stack.length) {
    const item = stack.pop();
    if (!item) continue;
    if (Array.isArray(item)) {
      for (const child of item) stack.push(child);
      continue;
    }
    if (typeof item !== 'object') continue;
    const id = String(pick(item, ['IdMatch', 'idMatch', 'MatchId', 'matchId', 'Id', 'id']) || '');
    if (looksLikeMatch(item)) {
      const key = id || JSON.stringify(Object.keys(item).slice(0, 12));
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }
    for (const value of Object.values(item)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return out;
}

function providerId(match) {
  return String(pick(match, ['IdMatch', 'idMatch', 'MatchId', 'matchId', 'Id', 'id']) || '').trim();
}

function stageText(match) {
  return [
    desc(pick(match, ['StageName', 'stageName', 'Stage', 'stage', 'RoundName', 'roundName', 'Round', 'round'])),
    desc(pick(match, ['GroupName', 'groupName', 'PhaseName', 'phaseName', 'CompetitionStage', 'competitionStage'])),
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchNo(match, config) {
  const officialId = providerId(match);
  if (officialId && config.idToMatchNo.has(officialId)) return config.idToMatchNo.get(officialId);
  const value = n(pick(match, ['MatchNumber', 'matchNumber', 'MatchNo', 'matchNo', 'FixtureNumber', 'fixtureNumber', 'Number', 'number']));
  return value && config.matchNumbers.has(value) ? value : null;
}

function isStageMatch(match, config) {
  if (matchNo(match, config)) return true;
  const text = stageText(match);
  return config.aliases.some((alias) => text.includes(alias));
}

function team(match, side) {
  const upper = side === 'home' ? 'Home' : 'Away';
  const lower = side;
  const obj = pick(match, [upper, lower, `${upper}Team`, `${lower}Team`, `Team${upper}`, `team${upper}`, `${upper}Contestant`, `${lower}Contestant`]) || {};
  const code = String(pick(obj, ['Abbreviation', 'abbreviation', 'TLA', 'tla', 'Code', 'code', 'CountryCode', 'countryCode']) || pick(match, [`${upper}TeamCode`, `${lower}TeamCode`, `${upper}Code`, `${lower}Code`]) || '').trim();
  const name = String(pick(obj, ['Name', 'name', 'ShortClubName', 'shortClubName', 'DisplayName', 'displayName', 'TeamName', 'teamName', 'CountryName', 'countryName']) || desc(pick(obj, ['Description', 'description'])) || pick(match, [`${upper}TeamName`, `${lower}TeamName`, `${upper}Name`, `${lower}Name`]) || '').trim();
  return { code, name };
}

function score(match, side) {
  const upper = side === 'home' ? 'Home' : 'Away';
  const lower = side;
  const s = match.Score || match.score || match.Result || match.result || {};
  const ft = s.FullTime || s.fullTime || s.fulltime || {};
  const regular = s.RegularTime || s.regularTime || {};
  const value = pick(match, [`${upper}TeamScore`, `${lower}TeamScore`, `${upper}Score`, `${lower}Score`]) ?? pick(ft, [upper, lower]) ?? pick(regular, [upper, lower]) ?? pick(s, [upper, lower, `${lower}Team`, `${upper}Team`]);
  const number = n(value);
  return number === null ? null : Math.max(0, number);
}

function penaltyScore(match, side) {
  const upper = side === 'home' ? 'Home' : 'Away';
  const lower = side;
  const p = match.PenaltyScore || match.penaltyScore || match.Penalties || match.penalties || {};
  const value = pick(p, [upper, lower, `${upper}Team`, `${lower}Team`]);
  const number = n(value);
  return number === null ? null : Math.max(0, number);
}

function status(match) {
  const raw = String(desc(pick(match, ['MatchStatusDescription', 'matchStatusDescription', 'StatusDescription', 'statusDescription'])) || pick(match, ['MatchStatus', 'matchStatus', 'Status', 'status']) || '').toLowerCase();
  if (raw.includes('finished') || raw.includes('complete') || raw.includes('full') || raw.includes('final') || raw.includes('ended') || raw.includes('12')) return 'FINISHED';
  if (raw.includes('half') || raw === 'ht') return 'HT';
  if (raw.includes('live') || raw.includes('play')) return 'IN_PLAY';
  return 'SCHEDULED';
}

function date(match) {
  const raw = pick(match, ['Date', 'date', 'UTCDate', 'utcDate', 'MatchDate', 'matchDate', 'LocalDate', 'localDate', 'StartDate', 'startDate']);
  const value = raw ? new Date(String(raw)) : null;
  return value && Number.isFinite(value.getTime()) ? value : null;
}

function fifaId(match, no, config) {
  return providerId(match) || `${config.key}-${no}`;
}

function candidates(asset) {
  const aliases = Array.isArray(asset.teamAliases) ? asset.teamAliases.map((item) => item.name) : [];
  return [asset.code, asset.name, ...aliases].map(normTeam).filter(Boolean);
}

async function teams() {
  const rows = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: { id: true, name: true, code: true, teamAliases: { select: { name: true } } } });
  return rows.map((row) => ({ ...row, candidates: candidates(row) }));
}

function findTeam(all, info) {
  const values = [info.code, info.name].map(normTeam).filter(Boolean);
  return all.find((row) => values.some((value) => row.candidates.includes(value))) || null;
}

function winner(match) {
  if (match.homeScore > match.awayScore) return match.homeTeam;
  if (match.awayScore > match.homeScore) return match.awayTeam;
  const penalties = match.externalIds?.penalties;
  if (penalties?.home > penalties?.away) return match.homeTeam;
  if (penalties?.away > penalties?.home) return match.awayTeam;
  return null;
}

async function buildDerivedR16Matches() {
  const rows = await prisma.match.findMany({
    where: {
      stage: 'round_of_32',
      syncSource: { contains: 'FIFA', mode: 'insensitive' },
      externalIds: { path: ['fifaMatchNumber'], not: null },
    },
    select: {
      id: true,
      homeScore: true,
      awayScore: true,
      status: true,
      externalIds: true,
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
    },
  });

  const byNo = new Map(rows.map((match) => [Number(match.externalIds?.fifaMatchNumber), match]));
  const derived = [];

  for (const fixture of R16_BRACKET) {
    const sourceMatches = fixture.winners.map((no) => byNo.get(no));
    const sourceWinners = sourceMatches.map((match) => (match ? winner(match) : null));
    if (!sourceWinners[0] || !sourceWinners[1]) {
      derived.push({ MatchNumber: fixture.MatchNumber, status: 'skipped_waiting_for_r32_winners', winners: fixture.winners });
      continue;
    }

    derived.push({
      IdMatch: `derived-r16-${fixture.MatchNumber}`,
      MatchNumber: fixture.MatchNumber,
      StageName: 'Round Of 16',
      Date: fixture.Date,
      StatusDescription: 'Scheduled',
      HomeTeam: { Code: sourceWinners[0].code, Name: sourceWinners[0].name },
      AwayTeam: { Code: sourceWinners[1].code, Name: sourceWinners[1].name },
      Score: { FullTime: { Home: null, Away: null } },
      DerivedFrom: fixture.winners,
    });
  }

  return derived;
}

async function upsert(match, config, allTeams, sourceUrl, dryRun) {
  if (match.status === 'skipped_waiting_for_r32_winners') return match;

  const no = matchNo(match, config);
  if (!no) return { status: 'skipped_missing_match_number', providerId: providerId(match), stage: stageText(match) };
  const homeInfo = team(match, 'home');
  const awayInfo = team(match, 'away');
  const home = findTeam(allTeams, homeInfo);
  const away = findTeam(allTeams, awayInfo);
  const matchDate = date(match);
  if (!home || !away || !matchDate) return { matchNo: no, providerId: providerId(match), status: 'skipped_missing_required_data', homeInfo, awayInfo, matchedHome: home?.id || null, matchedAway: away?.id || null, hasDate: Boolean(matchDate) };

  const id = fifaId(match, no, config);
  const externalId = `fifa-${id}`;
  const homeScore = score(match, 'home') ?? 0;
  const awayScore = score(match, 'away') ?? 0;
  const homePens = penaltyScore(match, 'home');
  const awayPens = penaltyScore(match, 'away');
  const isDerived = String(id).startsWith('derived-r16-');
  const data = {
    externalId,
    stage: config.stage,
    groupPhase: config.stage,
    status: status(match),
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore,
    awayScore,
    matchDate,
    syncSource: isDerived ? 'FIFA_DERIVED_FROM_R32' : 'FIFA',
    lastSyncedAt: new Date(),
    externalIds: {
      fifaId: id,
      fifaMatchNumber: no,
      sourceUrl,
      derivedFrom: match.DerivedFrom || null,
      penalties: homePens !== null && awayPens !== null ? { home: homePens, away: awayPens } : null,
    },
    syncState: { source: isDerived ? 'FIFA_DERIVED_FROM_R32' : 'FIFA', sourceUrl, rawStage: stageText(match), syncedAt: new Date().toISOString() },
  };

  if (dryRun) return { matchNo: no, stage: config.stage, status: 'dry_run_would_upsert', externalId, home: home.name, away: away.name, score: `${homeScore}-${awayScore}`, penalties: homePens !== null && awayPens !== null ? `${homePens}-${awayPens}` : null, mappedStatus: data.status };

  const existing = await prisma.match.findFirst({
    where: {
      OR: [
        { externalId },
        { AND: [{ stage: config.stage }, { homeTeamId: home.id }, { awayTeamId: away.id }] },
        { AND: [{ stage: config.stage }, { externalIds: { path: ['fifaMatchNumber'], equals: no } }] },
      ],
    },
    select: { id: true },
  });
  const saved = existing ? await prisma.match.update({ where: { id: existing.id }, data }) : await prisma.match.create({ data });
  return { matchNo: no, stage: config.stage, status: existing ? 'updated' : 'created', matchId: saved.id, externalId, home: home.name, away: away.name, score: `${homeScore}-${awayScore}`, penalties: homePens !== null && awayPens !== null ? `${homePens}-${awayPens}` : null, mappedStatus: data.status };
}

async function processStage(config, allMatches, allTeams, sourceUrl, dryRun) {
  const fifaMatches = allMatches.filter((match) => isStageMatch(match, config));
  const allowDerivedR16 = config.key === 'r16' && bool('FIFA_R16_ALLOW_DERIVED_FROM_R32', true);
  const usedDerivedR16 = fifaMatches.length === 0 && allowDerivedR16;
  const matches = usedDerivedR16 ? await buildDerivedR16Matches() : fifaMatches;
  const processed = [];

  for (const match of matches) {
    processed.push(await upsert(match, config, allTeams, usedDerivedR16 ? `${sourceUrl}#derived-r16-from-r32` : sourceUrl, dryRun));
  }

  return {
    stage: config.stage,
    detected: fifaMatches.length,
    usedDerivedR16,
    processed,
  };
}

async function run() {
  const dryRun = bool('FIFA_KNOCKOUT_DRY_RUN', bool('FIFA_R32_DRY_RUN', false));
  const { url, payload } = await getPayload();
  const allMatches = listMatches(payload);
  const allTeams = await teams();
  const processedStages = [];

  for (const config of STAGE_CONFIGS) {
    processedStages.push(await processStage(config, allMatches, allTeams, url, dryRun));
  }

  const summary = { ok: true, source: 'FIFA', sourceUrl: url, dryRun, detectedMatches: allMatches.length, processedStages };
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (error) => {
  console.error('[fifa-knockout-sync] fatal:', error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
