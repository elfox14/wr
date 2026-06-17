import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProviderRow = {
  providerId: string | null;
  homeName: string | null;
  awayName: string | null;
  status: string | null;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string | null;
};

const FINISHED_STATUSES = new Set(['FINISHED', 'FT', 'FULL_TIME', 'AET', 'PEN', 'ENDED', 'FINAL']);
const TEAM_NAME_ALIASES = new Map([
  ['usa', 'united states'],
  ['us', 'united states'],
  ['u s a', 'united states'],
  ['united states of america', 'united states'],
  ['czechia', 'czech republic'],
  ['bosnia herzegovina', 'bosnia and herzegovina'],
]);

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const validSecrets = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get('x-admin-secret') || '', req.headers.get('x-cron-secret') || '', searchParams.get('adminSecret') || '', searchParams.get('cronSecret') || '', searchParams.get('key') || ''];
  return candidates.some((value) => String(value).trim() && validSecrets.includes(String(value).trim()));
}

function first(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function asString(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function asNumber(...values: any[]) {
  const value = first(...values);
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

function normalizeTeamName(value?: string | null) {
  const normalized = normalizeText(value);
  return TEAM_NAME_ALIASES.get(normalized) || normalized;
}

function normalizeStatus(value?: string | null) {
  const status = String(value || '').trim().toUpperCase();
  return FINISHED_STATUSES.has(status) ? 'FINISHED' : status || null;
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function normalizeProviderMatch(row: any): ProviderRow {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  const score = row?.score || row?.scores || row?.goals || row?.result || {};
  const fullTime = score?.fullTime || score?.full_time || score?.ft || score;
  const statusObject = fixture?.status || row?.status || {};
  return {
    providerId: asString(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    homeName: asString(home?.name, row?.homeName, row?.home_team_name),
    awayName: asString(away?.name, row?.awayName, row?.away_team_name),
    status: normalizeStatus(asString(statusObject?.short, statusObject?.long, row?.status, row?.matchStatus, row?.match_status)),
    homeScore: asNumber(fullTime?.home, score?.home, score?.homeScore, row?.homeScore, row?.home_score, row?.home_goals),
    awayScore: asNumber(fullTime?.away, score?.away, score?.awayScore, row?.awayScore, row?.away_score, row?.away_goals),
    matchDate: asString(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}

function sameDay(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / 36e5;
}

function providerMatchesLocal(providerMatch: ProviderRow, localMatch: any) {
  if (providerMatch.providerId && localMatch.externalId && String(providerMatch.providerId) === String(localMatch.externalId)) return true;
  const providerHome = normalizeTeamName(providerMatch.homeName);
  const providerAway = normalizeTeamName(providerMatch.awayName);
  const localHome = normalizeTeamName(localMatch.homeTeam?.name || localMatch.homeTeam?.code);
  const localAway = normalizeTeamName(localMatch.awayTeam?.name || localMatch.awayTeam?.code);
  const homeMatches = providerHome && localHome && (providerHome === localHome || providerHome.includes(localHome) || localHome.includes(providerHome));
  const awayMatches = providerAway && localAway && (providerAway === localAway || providerAway.includes(localAway) || localAway.includes(providerAway));
  return homeMatches && awayMatches && (sameDay(providerMatch.matchDate, localMatch.matchDate) || hoursApart(providerMatch.matchDate, localMatch.matchDate) <= 4);
}

async function loadPastMatches(daysBack: number) {
  return prisma.match.findMany({
    where: { matchDate: { gte: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000), lte: new Date() } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take: 120,
  });
}

function suggestedChanges(localMatch: any, providerMatch: ProviderRow) {
  const changes: Record<string, any> = {};
  if (providerMatch.providerId && !localMatch.externalId) changes.externalId = providerMatch.providerId;
  if (providerMatch.status === 'FINISHED' && localMatch.status !== 'FINISHED') changes.status = 'FINISHED';
  if (providerMatch.homeScore !== null && localMatch.homeScore !== providerMatch.homeScore) changes.homeScore = providerMatch.homeScore;
  if (providerMatch.awayScore !== null && localMatch.awayScore !== providerMatch.awayScore) changes.awayScore = providerMatch.awayScore;
  return changes;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const daysBack = Math.max(1, Math.min(Number(url.searchParams.get('daysBack') || 3), 30));
  const providerPath = url.searchParams.get('providerPath') || '/api/football/matches';
  const providerQuery = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: Number(url.searchParams.get('per_page') || 100),
  };

  try {
    const [payload, localMatches] = await Promise.all([theStatsApiFetch(providerPath, providerQuery), loadPastMatches(daysBack)]);
    const providerRows = extractArray(payload).map(normalizeProviderMatch).filter((row) => row.status === 'FINISHED');
    const review = localMatches.map((localMatch) => {
      const providerMatch = providerRows.find((row) => providerMatchesLocal(row, localMatch));
      return {
        localMatchId: localMatch.id,
        localTeams: `${localMatch.homeTeam?.name || 'Home'} vs ${localMatch.awayTeam?.name || 'Away'}`,
        localDate: localMatch.matchDate,
        localStatus: localMatch.status,
        localScore: `${localMatch.homeScore}-${localMatch.awayScore}`,
        providerMatchId: providerMatch?.providerId || null,
        providerTeams: providerMatch ? `${providerMatch.homeName} vs ${providerMatch.awayName}` : null,
        providerStatus: providerMatch?.status || null,
        providerScore: providerMatch ? `${providerMatch.homeScore}-${providerMatch.awayScore}` : null,
        suggestedChanges: providerMatch ? suggestedChanges(localMatch, providerMatch) : {},
      };
    });
    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      mode: 'review_only',
      config: getTheStatsApiConfigStatus(),
      localMatches: localMatches.length,
      finishedProviderRows: providerRows.length,
      matched: review.filter((item) => item.providerMatchId).length,
      changedCandidates: review.filter((item) => Object.keys(item.suggestedChanges).length).length,
      review,
      safety: {
        reviewOnly: true,
        previousMatchesOnly: true,
        finishedProviderRowsOnly: true,
        suggestedFields: ['externalId', 'status', 'homeScore', 'awayScore'],
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, provider: 'THE_STATS_API', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
