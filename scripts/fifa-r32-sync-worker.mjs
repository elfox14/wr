import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const R32 = new Set(Array.from({ length: 16 }, (_, index) => 73 + index));
const FIFA_R32_ID_TO_NO = new Map([
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
]);

const OFFICIAL_R32_FALLBACK = [
  { IdMatch: '53452545', MatchNumber: 73, StageName: 'Round Of 32', Date: '2026-06-28T19:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'RSA', Name: 'South Africa' }, AwayTeam: { Code: 'CAN', Name: 'Canada' }, Score: { FullTime: { Home: 0, Away: 1 } } },
  { IdMatch: '53452541', MatchNumber: 74, StageName: 'Round Of 32', Date: '2026-06-29T20:30:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'GER', Name: 'Germany' }, AwayTeam: { Code: 'PAR', Name: 'Paraguay' }, Score: { FullTime: { Home: 1, Away: 1 } }, PenaltyScore: { Home: 3, Away: 4 } },
  { IdMatch: '53452547', MatchNumber: 75, StageName: 'Round Of 32', Date: '2026-06-30T01:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'NED', Name: 'Netherlands' }, AwayTeam: { Code: 'MAR', Name: 'Morocco' }, Score: { FullTime: { Home: 1, Away: 1 } }, PenaltyScore: { Home: 2, Away: 3 } },
  { IdMatch: '53452557', MatchNumber: 76, StageName: 'Round Of 32', Date: '2026-06-29T17:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'BRA', Name: 'Brazil' }, AwayTeam: { Code: 'JPN', Name: 'Japan' }, Score: { FullTime: { Home: 2, Away: 1 } } },
  { IdMatch: '53452543', MatchNumber: 77, StageName: 'Round Of 32', Date: '2026-06-30T21:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'FRA', Name: 'France' }, AwayTeam: { Code: 'SWE', Name: 'Sweden' }, Score: { FullTime: { Home: 3, Away: 0 } } },
  { IdMatch: '53452561', MatchNumber: 78, StageName: 'Round Of 32', Date: '2026-06-30T17:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'CIV', Name: 'Ivory Coast' }, AwayTeam: { Code: 'NOR', Name: 'Norway' }, Score: { FullTime: { Home: 1, Away: 2 } } },
  { IdMatch: '53452563', MatchNumber: 79, StageName: 'Round Of 32', Date: '2026-07-01T02:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'MEX', Name: 'Mexico' }, AwayTeam: { Code: 'ECU', Name: 'Ecuador' }, Score: { FullTime: { Home: 2, Away: 0 } } },
  { IdMatch: '53452565', MatchNumber: 80, StageName: 'Round Of 32', Date: '2026-07-01T16:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'ENG', Name: 'England' }, AwayTeam: { Code: 'COD', Name: 'DR Congo' }, Score: { FullTime: { Home: 2, Away: 1 } } },
  { IdMatch: '53452553', MatchNumber: 81, StageName: 'Round Of 32', Date: '2026-07-02T00:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'USA', Name: 'United States' }, AwayTeam: { Code: 'BIH', Name: 'Bosnia and Herzegovina' }, Score: { FullTime: { Home: 2, Away: 0 } } },
  { IdMatch: '53452555', MatchNumber: 82, StageName: 'Round Of 32', Date: '2026-07-01T20:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'BEL', Name: 'Belgium' }, AwayTeam: { Code: 'SEN', Name: 'Senegal' }, Score: { FullTime: { Home: 3, Away: 2 } } },
  { IdMatch: '53452549', MatchNumber: 83, StageName: 'Round Of 32', Date: '2026-07-02T23:00:00.000Z', StatusDescription: 'Live', HomeTeam: { Code: 'POR', Name: 'Portugal' }, AwayTeam: { Code: 'CRO', Name: 'Croatia' }, Score: { FullTime: { Home: 0, Away: 0 } } },
  { IdMatch: '53452551', MatchNumber: 84, StageName: 'Round Of 32', Date: '2026-07-02T19:00:00.000Z', StatusDescription: 'Complete', HomeTeam: { Code: 'ESP', Name: 'Spain' }, AwayTeam: { Code: 'AUT', Name: 'Austria' }, Score: { FullTime: { Home: 3, Away: 0 } } },
  { IdMatch: '53452505', MatchNumber: 85, StageName: 'Round Of 32', Date: '2026-07-03T03:00:00.000Z', StatusDescription: 'Scheduled', HomeTeam: { Code: 'SUI', Name: 'Switzerland' }, AwayTeam: { Code: 'DZA', Name: 'Algeria' }, Score: { FullTime: { Home: null, Away: null } } },
  { IdMatch: '53452569', MatchNumber: 86, StageName: 'Round Of 32', Date: '2026-07-03T22:00:00.000Z', StatusDescription: 'Scheduled', HomeTeam: { Code: 'ARG', Name: 'Argentina' }, AwayTeam: { Code: 'CPV', Name: 'Cape Verde' }, Score: { FullTime: { Home: null, Away: null } } },
  { IdMatch: '53452507', MatchNumber: 87, StageName: 'Round Of 32', Date: '2026-07-04T01:30:00.000Z', StatusDescription: 'Scheduled', HomeTeam: { Code: 'COL', Name: 'Colombia' }, AwayTeam: { Code: 'GHA', Name: 'Ghana' }, Score: { FullTime: { Home: null, Away: null } } },
  { IdMatch: '53452503', MatchNumber: 88, StageName: 'Round Of 32', Date: '2026-07-03T18:00:00.000Z', StatusDescription: 'Scheduled', HomeTeam: { Code: 'AUS', Name: 'Australia' }, AwayTeam: { Code: 'EGY', Name: 'Egypt' }, Score: { FullTime: { Home: null, Away: null } } },
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

function matchNo(match) {
  const officialId = providerId(match);
  if (officialId && FIFA_R32_ID_TO_NO.has(officialId)) return FIFA_R32_ID_TO_NO.get(officialId);
  const value = n(pick(match, ['MatchNumber', 'matchNumber', 'MatchNo', 'matchNo', 'FixtureNumber', 'fixtureNumber', 'Number', 'number']));
  return value && R32.has(value) ? value : null;
}

function stage(match) {
  return [
    desc(pick(match, ['StageName', 'stageName', 'Stage', 'stage', 'RoundName', 'roundName', 'Round', 'round'])),
    desc(pick(match, ['GroupName', 'groupName', 'PhaseName', 'phaseName', 'CompetitionStage', 'competitionStage'])),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isR32(match) {
  if (matchNo(match)) return true;
  const text = stage(match);
  return text.includes('round of 32') || text.includes('last 32') || text.includes('r32') || text.includes('دور الـ32') || text.includes('دور ال32');
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

function fifaId(match, no) {
  return providerId(match) || `r32-${no}`;
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

async function upsert(match, allTeams, sourceUrl, dryRun) {
  const no = matchNo(match);
  if (!no) return { status: 'skipped_missing_match_number', providerId: providerId(match), stage: stage(match) };
  const homeInfo = team(match, 'home');
  const awayInfo = team(match, 'away');
  const home = findTeam(allTeams, homeInfo);
  const away = findTeam(allTeams, awayInfo);
  const matchDate = date(match);
  if (!home || !away || !matchDate) return { matchNo: no, providerId: providerId(match), status: 'skipped_missing_required_data', homeInfo, awayInfo, matchedHome: home?.id || null, matchedAway: away?.id || null, hasDate: Boolean(matchDate) };

  const id = fifaId(match, no);
  const externalId = `fifa-${id}`;
  const homeScore = score(match, 'home') ?? 0;
  const awayScore = score(match, 'away') ?? 0;
  const homePens = penaltyScore(match, 'home');
  const awayPens = penaltyScore(match, 'away');
  const data = {
    externalId,
    stage: 'round_of_32',
    groupPhase: 'round_of_32',
    status: status(match),
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore,
    awayScore,
    matchDate,
    syncSource: 'FIFA',
    lastSyncedAt: new Date(),
    externalIds: { fifaId: id, fifaMatchNumber: no, sourceUrl, penalties: homePens !== null && awayPens !== null ? { home: homePens, away: awayPens } : null },
    syncState: { source: 'FIFA', sourceUrl, rawStage: stage(match), syncedAt: new Date().toISOString() },
  };

  if (dryRun) return { matchNo: no, status: 'dry_run_would_upsert', externalId, home: home.name, away: away.name, score: `${homeScore}-${awayScore}`, penalties: homePens !== null && awayPens !== null ? `${homePens}-${awayPens}` : null, mappedStatus: data.status };

  const existing = await prisma.match.findFirst({ where: { OR: [{ externalId }, { AND: [{ stage: 'round_of_32' }, { homeTeamId: home.id }, { awayTeamId: away.id }] }] }, select: { id: true } });
  const saved = existing ? await prisma.match.update({ where: { id: existing.id }, data }) : await prisma.match.create({ data });
  return { matchNo: no, status: existing ? 'updated' : 'created', matchId: saved.id, externalId, home: home.name, away: away.name, score: `${homeScore}-${awayScore}`, penalties: homePens !== null && awayPens !== null ? `${homePens}-${awayPens}` : null, mappedStatus: data.status };
}

async function run() {
  const dryRun = bool('FIFA_R32_DRY_RUN', false);
  const allowFallback = bool('FIFA_R32_ALLOW_OFFICIAL_FALLBACK', true);
  const { url, payload } = await getPayload();
  const allMatches = listMatches(payload);
  const fifaMatches = allMatches.filter(isR32);
  const usedOfficialFallback = fifaMatches.length === 0 && allowFallback;
  const matches = usedOfficialFallback ? OFFICIAL_R32_FALLBACK : fifaMatches;
  const allTeams = await teams();
  const processed = [];
  for (const match of matches) processed.push(await upsert(match, allTeams, usedOfficialFallback ? `${url}#official-r32-fallback` : url, dryRun));
  const summary = { ok: true, source: 'FIFA', sourceUrl: url, dryRun, detectedMatches: allMatches.length, detectedRoundOf32: fifaMatches.length, usedOfficialFallback, processed };
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (error) => {
  console.error('[fifa-r32-sync] fatal:', error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
