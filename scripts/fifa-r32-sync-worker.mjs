import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const R32 = new Set(Array.from({ length: 16 }, (_, index) => 73 + index));

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
  if (['bosnia and herzegovina', 'bosnia herzegovina', 'bosnia h'].includes(name)) return 'bosnia h';
  if (['cote d ivoire', 'cote divoire', 'ivory coast'].includes(name)) return 'ivory coast';
  if (['dr congo', 'congo dr', 'democratic republic of the congo'].includes(name)) return 'dr congo';
  if (['cape verde', 'cabo verde'].includes(name)) return 'cape verde';
  if (['curacao', 'curaçao'].includes(name)) return 'curacao';
  if (['ir iran', 'iran'].includes(name)) return 'iran';
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

function listMatches(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.Results || payload?.results || payload?.Matches || payload?.matches || [];
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
  if (value && typeof value === 'object') return String(value.Description || value.description || value.Name || value.name || '').trim();
  return '';
}

function matchNo(match) {
  const value = n(pick(match, ['MatchNumber', 'matchNumber', 'MatchNo', 'matchNo', 'FixtureNumber', 'fixtureNumber', 'Number', 'number']));
  return value && R32.has(value) ? value : null;
}

function stage(match) {
  return [
    desc(pick(match, ['StageName', 'stageName', 'Stage', 'stage', 'RoundName', 'roundName', 'Round', 'round'])),
    desc(pick(match, ['GroupName', 'groupName', 'PhaseName', 'phaseName'])),
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
  const obj = pick(match, [upper, lower, `${upper}Team`, `${lower}Team`, `Team${upper}`, `team${upper}`]) || {};
  const code = String(pick(obj, ['Abbreviation', 'abbreviation', 'TLA', 'tla', 'Code', 'code']) || pick(match, [`${upper}TeamCode`, `${lower}TeamCode`, `${upper}Code`, `${lower}Code`]) || '').trim();
  const name = String(pick(obj, ['Name', 'name', 'ShortClubName', 'shortClubName', 'DisplayName', 'displayName', 'TeamName', 'teamName']) || pick(match, [`${upper}TeamName`, `${lower}TeamName`, `${upper}Name`, `${lower}Name`]) || '').trim();
  return { code, name };
}

function score(match, side) {
  const upper = side === 'home' ? 'Home' : 'Away';
  const lower = side;
  const s = match.Score || match.score || match.Result || match.result || {};
  const ft = s.FullTime || s.fullTime || {};
  const value = pick(match, [`${upper}TeamScore`, `${lower}TeamScore`, `${upper}Score`, `${lower}Score`]) ?? pick(ft, [upper, lower]) ?? pick(s, [upper, lower, `${lower}Team`, `${upper}Team`]);
  const number = n(value);
  return number === null ? null : Math.max(0, number);
}

function status(match) {
  const raw = String(desc(pick(match, ['MatchStatusDescription', 'matchStatusDescription', 'StatusDescription', 'statusDescription'])) || pick(match, ['MatchStatus', 'matchStatus', 'Status', 'status']) || '').toLowerCase();
  if (raw.includes('finished') || raw.includes('full') || raw.includes('final') || raw.includes('ended') || raw.includes('12')) return 'FINISHED';
  if (raw.includes('half') || raw === 'ht') return 'HT';
  if (raw.includes('live') || raw.includes('play')) return 'IN_PLAY';
  return 'SCHEDULED';
}

function date(match) {
  const raw = pick(match, ['Date', 'date', 'UTCDate', 'utcDate', 'MatchDate', 'matchDate', 'LocalDate', 'localDate']);
  const value = raw ? new Date(String(raw)) : null;
  return value && Number.isFinite(value.getTime()) ? value : null;
}

function providerId(match, no) {
  return String(pick(match, ['IdMatch', 'idMatch', 'MatchId', 'matchId', 'Id', 'id']) || `r32-${no}`).trim();
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
  if (!no) return { status: 'skipped_missing_match_number' };
  const homeInfo = team(match, 'home');
  const awayInfo = team(match, 'away');
  const home = findTeam(allTeams, homeInfo);
  const away = findTeam(allTeams, awayInfo);
  const matchDate = date(match);
  if (!home || !away || !matchDate) return { matchNo: no, status: 'skipped_missing_required_data', homeInfo, awayInfo, matchedHome: home?.id || null, matchedAway: away?.id || null, hasDate: Boolean(matchDate) };

  const id = providerId(match, no);
  const externalId = `fifa-${id}`;
  const homeScore = score(match, 'home') ?? 0;
  const awayScore = score(match, 'away') ?? 0;
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
    externalIds: { fifaId: id, fifaMatchNumber: no, sourceUrl },
    syncState: { source: 'FIFA', sourceUrl, rawStage: stage(match), syncedAt: new Date().toISOString() },
  };

  if (dryRun) return { matchNo: no, status: 'dry_run_would_upsert', externalId, home: home.name, away: away.name, score: `${homeScore}-${awayScore}`, mappedStatus: data.status };

  const existing = await prisma.match.findFirst({ where: { OR: [{ externalId }, { AND: [{ stage: 'round_of_32' }, { homeTeamId: home.id }, { awayTeamId: away.id }] }] }, select: { id: true } });
  const saved = existing ? await prisma.match.update({ where: { id: existing.id }, data }) : await prisma.match.create({ data });
  return { matchNo: no, status: existing ? 'updated' : 'created', matchId: saved.id, externalId, home: home.name, away: away.name, score: `${homeScore}-${awayScore}`, mappedStatus: data.status };
}

async function run() {
  const dryRun = bool('FIFA_R32_DRY_RUN', false);
  const { url, payload } = await getPayload();
  const matches = listMatches(payload).filter(isR32);
  const allTeams = await teams();
  const processed = [];
  for (const match of matches) processed.push(await upsert(match, allTeams, url, dryRun));
  const summary = { ok: true, source: 'FIFA', sourceUrl: url, dryRun, detectedRoundOf32: matches.length, processed };
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (error) => {
  console.error('[fifa-r32-sync] fatal:', error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
