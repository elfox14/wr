import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIFA_WORLD_CUP_COMPETITION_ID = '17';
const FIFA_WORLD_CUP_2026_SEASON_ID = '285023';
const FIFA_WORLD_CUP_2026_MATCH_COUNT = 104;

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
    aliases: ['round of 16', 'round_of_16', 'last 16', 'last_16', 'r16', 'دور الـ16', 'دور ال16'],
    idToMatchNo: new Map(),
  },
  {
    key: 'qf',
    stage: 'quarter_finals',
    label: 'Quarter Finals',
    envPrefix: 'FIFA_QF',
    matchNumbers: new Set(Array.from({ length: 4 }, (_, index) => 97 + index)),
    aliases: ['quarter finals', 'quarter final', 'quarter_finals', 'quarter_final', 'quarter-finals', 'quarter-final', 'quarterfinals', 'quarterfinal', 'qf', 'ربع النهائي'],
    idToMatchNo: new Map(),
  },
  {
    key: 'sf',
    stage: 'semi_finals',
    label: 'Semi Finals',
    envPrefix: 'FIFA_SF',
    matchNumbers: new Set(Array.from({ length: 2 }, (_, index) => 101 + index)),
    aliases: ['semi finals', 'semi final', 'semi_finals', 'semi_final', 'semi-finals', 'semi-final', 'semifinals', 'semifinal', 'sf', 'نصف النهائي'],
    idToMatchNo: new Map(),
  },
];

const DERIVED_BRACKETS = {
  r16: {
    sourceStage: 'round_of_32',
    sourceLabel: 'R32',
    allowEnv: 'FIFA_R16_ALLOW_DERIVED_FROM_R32',
    fixtures: [
      { MatchNumber: 89, winners: [73, 75] },
      { MatchNumber: 90, winners: [74, 77] },
      { MatchNumber: 91, winners: [76, 78] },
      { MatchNumber: 92, winners: [79, 80] },
      { MatchNumber: 93, winners: [83, 84] },
      { MatchNumber: 94, winners: [81, 82] },
      { MatchNumber: 95, winners: [86, 88] },
      { MatchNumber: 96, winners: [85, 87] },
    ],
  },
  qf: {
    sourceStage: 'round_of_16',
    sourceLabel: 'R16',
    allowEnv: 'FIFA_QF_ALLOW_DERIVED_FROM_R16',
    fixtures: [
      { MatchNumber: 97, winners: [89, 90] },
      { MatchNumber: 98, winners: [93, 94] },
      { MatchNumber: 99, winners: [91, 92] },
      { MatchNumber: 100, winners: [95, 96] },
    ],
  },
  sf: {
    sourceStage: 'quarter_finals',
    sourceLabel: 'QF',
    allowEnv: 'FIFA_SF_ALLOW_DERIVED_FROM_QF',
    fixtures: [
      { MatchNumber: 101, winners: [97, 98] },
      { MatchNumber: 102, winners: [99, 100] },
    ],
  },
};

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

function fifaSeasonId() {
  const configured = env('FIFA_SEASON_ID');
  // Older deployments used the calendar year, but FIFA requires its internal edition id.
  if (!configured || configured === '2026') return FIFA_WORLD_CUP_2026_SEASON_ID;
  return configured;
}

function fifaUrl() {
  const configured = env('FIFA_MATCHES_SOURCE_URL');
  if (configured) {
    const url = new URL(configured);
    for (const key of ['idSeason', 'IdSeason']) {
      if (url.searchParams.get(key) === '2026') url.searchParams.set(key, FIFA_WORLD_CUP_2026_SEASON_ID);
    }
    return url.toString();
  }

  const url = new URL(env('FIFA_MATCHES_BASE_URL', 'https://api.fifa.com/api/v3/calendar/matches'));
  url.searchParams.set('language', env('FIFA_LANGUAGE', 'en'));
  url.searchParams.set('count', env('FIFA_MATCHES_COUNT', '500'));
  url.searchParams.set('idCompetition', env('FIFA_COMPETITION_ID', FIFA_WORLD_CUP_COMPETITION_ID));
  url.searchParams.set('idSeason', fifaSeasonId());
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

function matchQuality(match) {
  const home = team(match, 'home');
  const away = team(match, 'away');
  return (providerId(match) ? 8 : 0) + (date(match) ? 4 : 0) + (home.code || home.name ? 2 : 0) + (away.code || away.name ? 2 : 0);
}

function assignMissingMatchNumbers(matches, config) {
  const byNumber = new Map();
  const unnumbered = [];

  for (const match of matches) {
    const no = matchNo(match, config);
    if (!no) {
      unnumbered.push(match);
      continue;
    }
    const current = byNumber.get(no);
    if (!current || matchQuality(match) > matchQuality(current)) byNumber.set(no, match);
  }

  const available = [...config.matchNumbers].filter((no) => !byNumber.has(no)).sort((a, b) => a - b);
  unnumbered
    .sort((a, b) => {
      const dateA = date(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dateB = date(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dateA - dateB || providerId(a).localeCompare(providerId(b));
    })
    .slice(0, available.length)
    .forEach((match, index) => {
      const no = available[index];
      byNumber.set(no, { ...match, MatchNumber: no });
    });

  return [...byNumber.entries()].sort(([a], [b]) => a - b).map(([, match]) => match);
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
  const direct = pick(match, [
    `${upper}TeamPenaltyScore`,
    `${lower}TeamPenaltyScore`,
    `${upper}PenaltyScore`,
    `${lower}PenaltyScore`,
  ]);
  const value = direct ?? pick(p, [upper, lower, `${upper}Team`, `${lower}Team`]);
  const number = n(value);
  return number === null ? null : Math.max(0, number);
}

function status(match) {
  const value = pick(match, ['MatchStatus', 'matchStatus', 'Status', 'status']);
  const numeric = typeof value === 'number' || /^\d+$/.test(String(value || '').trim()) ? Number(value) : null;

  // FIFA calendar enum: 0 = completed, 1 = scheduled. Text statuses remain supported
  // for compatible feeds and live-state variants.
  if (numeric === 0) return 'FINISHED';
  if (numeric === 1) return 'SCHEDULED';

  const raw = String(desc(pick(match, ['MatchStatusDescription', 'matchStatusDescription', 'StatusDescription', 'statusDescription'])) || value || '').toLowerCase();
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
  const finished = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
  if (!finished.includes(String(match.status || '').trim().toUpperCase())) return null;
  if (match.homeScore > match.awayScore) return match.homeTeam;
  if (match.awayScore > match.homeScore) return match.awayTeam;
  const penalties = match.externalIds?.penalties;
  if (penalties?.home > penalties?.away) return match.homeTeam;
  if (penalties?.away > penalties?.home) return match.awayTeam;
  return null;
}

async function buildDerivedStageMatches(config, officialMatches, allTeams) {
  const bracket = DERIVED_BRACKETS[config.key];
  if (!bracket) return { matches: officialMatches, diagnostics: [], usedDerived: false };

  const rows = await prisma.match.findMany({
    where: {
      stage: bracket.sourceStage,
      syncSource: { contains: 'FIFA', mode: 'insensitive' },
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

  const bySourceNo = new Map(rows.map((match) => [Number(match.externalIds?.fifaMatchNumber), match]));
  const officialByNo = new Map(officialMatches.map((match) => [matchNo(match, config), match]).filter(([no]) => no));
  const synthesized = [];
  const diagnostics = [];
  let usedDerived = false;

  for (const fixture of bracket.fixtures) {
    const sourceMatches = fixture.winners.map((no) => bySourceNo.get(no));
    const sourceWinners = sourceMatches.map((match) => (match ? winner(match) : null));
    if (!sourceWinners[0] || !sourceWinners[1]) {
      diagnostics.push({
        matchNo: fixture.MatchNumber,
        status: `skipped_waiting_for_${bracket.sourceLabel.toLowerCase()}_official_winners`,
        winners: fixture.winners,
      });
      continue;
    }

    const official = officialByNo.get(fixture.MatchNumber) || null;
    const matchDate = official ? date(official) : null;
    if (!official || !matchDate || !Number.isFinite(matchDate.getTime())) {
      diagnostics.push({
        matchNo: fixture.MatchNumber,
        status: 'skipped_missing_official_fixture',
        winners: fixture.winners,
      });
      continue;
    }

    const officialHome = official ? findTeam(allTeams, team(official, 'home')) : null;
    const officialAway = official ? findTeam(allTeams, team(official, 'away')) : null;
    const derivedHome = sourceWinners[0];
    const derivedAway = sourceWinners[1];
    if (!official || !officialHome || !officialAway) usedDerived = true;

    synthesized.push({
      ...(official || {
        IdMatch: `derived-${config.key}-${fixture.MatchNumber}`,
        StatusDescription: 'Scheduled',
        Score: { FullTime: { Home: null, Away: null } },
      }),
      MatchNumber: fixture.MatchNumber,
      StageName: config.label,
      Date: matchDate.toISOString(),
      HomeTeam: { Code: (officialHome || derivedHome).code, Name: (officialHome || derivedHome).name },
      AwayTeam: { Code: (officialAway || derivedAway).code, Name: (officialAway || derivedAway).name },
      DerivedFrom: fixture.winners,
    });
  }

  const synthesizedByNo = new Map(synthesized.map((match) => [match.MatchNumber, match]));
  const merged = officialMatches.map((match) => synthesizedByNo.get(matchNo(match, config)) || match);
  for (const match of synthesized) {
    if (!officialByNo.has(match.MatchNumber)) merged.push(match);
  }

  return { matches: assignMissingMatchNumbers(merged, config), diagnostics, usedDerived };
}

async function upsert(match, config, allTeams, sourceUrl, dryRun) {
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
  const isDerived = String(id).startsWith('derived-');
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
    syncSource: isDerived ? `FIFA_DERIVED_FROM_${String(DERIVED_BRACKETS[config.key]?.sourceLabel || 'OFFICIAL_RESULT').toUpperCase()}` : 'FIFA',
    lastSyncedAt: new Date(),
    externalIds: {
      fifaId: id,
      fifaMatchNumber: no,
      sourceUrl,
      derivedFrom: match.DerivedFrom || null,
      penalties: homePens !== null && awayPens !== null ? { home: homePens, away: awayPens } : null,
    },
    syncState: { source: isDerived ? `FIFA_DERIVED_FROM_${String(DERIVED_BRACKETS[config.key]?.sourceLabel || 'OFFICIAL_RESULT').toUpperCase()}` : 'FIFA', sourceUrl, rawStage: stageText(match), syncedAt: new Date().toISOString() },
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
  const detectedMatches = assignMissingMatchNumbers(allMatches.filter((match) => isStageMatch(match, config)), config);
  const bracket = DERIVED_BRACKETS[config.key];
  const allowDerived = Boolean(bracket) && bool(bracket.allowEnv, false);
  const prepared = allowDerived
    ? await buildDerivedStageMatches(config, detectedMatches, allTeams)
    : { matches: detectedMatches, diagnostics: [], usedDerived: false };
  const processed = [...prepared.diagnostics];

  for (const match of prepared.matches) {
    processed.push(await upsert(match, config, allTeams, sourceUrl, dryRun));
  }

  return {
    stage: config.stage,
    expected: config.matchNumbers.size,
    detected: detectedMatches.length,
    usedDerived: prepared.usedDerived,
    processed,
  };
}

async function coverage() {
  const rows = await prisma.match.findMany({
    where: {
      stage: { in: STAGE_CONFIGS.map((config) => config.stage) },
      syncSource: { contains: 'FIFA', mode: 'insensitive' },
    },
    select: { id: true, stage: true, externalIds: true },
  });

  return STAGE_CONFIGS.map((config) => {
    const stageRows = rows.filter((match) => match.stage === config.stage);
    const numbered = new Set(
      stageRows
        .map((match) => Number(match.externalIds?.fifaMatchNumber))
        .filter((no) => config.matchNumbers.has(no)),
    );
    const persisted = numbered.size || stageRows.length;
    return {
      stage: config.stage,
      expected: config.matchNumbers.size,
      persisted,
      complete: persisted >= config.matchNumbers.size,
    };
  });
}

async function run() {
  const dryRun = bool('FIFA_KNOCKOUT_DRY_RUN', bool('FIFA_R32_DRY_RUN', false));
  const { url, payload } = await getPayload();
  const payloadMatches = Array.isArray(payload?.Results) ? payload.Results : listMatches(payload);
  const competitionId = env('FIFA_COMPETITION_ID', FIFA_WORLD_CUP_COMPETITION_ID);
  const seasonId = fifaSeasonId();
  const allMatches = payloadMatches.filter((match) => {
    const matchCompetition = String(pick(match, ['IdCompetition', 'idCompetition', 'CompetitionId', 'competitionId']) || '').trim();
    const matchSeason = String(pick(match, ['IdSeason', 'idSeason', 'SeasonId', 'seasonId']) || '').trim();
    return (!matchCompetition || matchCompetition === competitionId) && (!matchSeason || matchSeason === seasonId);
  });
  const detectedByStage = STAGE_CONFIGS.map((config) => ({
    stage: config.stage,
    expected: config.matchNumbers.size,
    detected: assignMissingMatchNumbers(allMatches.filter((match) => isStageMatch(match, config)), config).length,
  }));
  const detectedKnockoutMatches = detectedByStage.reduce((sum, stage) => sum + stage.detected, 0);

  if (detectedKnockoutMatches === 0) {
    throw new Error(
      `FIFA_EMPTY_KNOCKOUT_PAYLOAD: no R32/R16/QF/SF matches for competition ${competitionId}, season ${seasonId}. Refusing to derive or persist fixtures from an empty official feed.`,
    );
  }

  const allTeams = await teams();
  const processedStages = [];

  for (const config of STAGE_CONFIGS) {
    processedStages.push(await processStage(config, allMatches, allTeams, url, dryRun));
  }

  const stageCoverage = await coverage();
  const summary = {
    ok: true,
    source: 'FIFA',
    sourceUrl: url,
    dryRun,
    detectedMatches: allMatches.length,
    sourceDiagnostics: {
      competitionId,
      seasonId,
      expectedTournamentMatches: FIFA_WORLD_CUP_2026_MATCH_COUNT,
      payloadMatches: payloadMatches.length,
      knockoutMatchesDetected: detectedKnockoutMatches,
      stageDetection: detectedByStage,
    },
    requestedStagesComplete: stageCoverage.every((stage) => stage.complete),
    stageCoverage,
    processedStages,
  };
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (error) => {
  console.error('[fifa-knockout-sync] fatal:', error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
