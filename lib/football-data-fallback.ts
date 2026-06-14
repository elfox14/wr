import prisma from '@/lib/prisma';
import { normalizeName } from '@/lib/apiFootball';
import { saveFootballDataScoreSnapshot } from '@/lib/football-data-snapshot';

type FallbackMatch = {
  id: string;
  matchDate?: Date | string | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: { id?: string; name?: string | null; code?: string | null } | null;
  awayTeam?: { id?: string; name?: string | null; code?: string | null } | null;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeTeamName(name?: string | null) {
  const value = normalizeName(name || '')
    .replace(/&/g, ' and ')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (value === 'south korea' || value === 'korea republic' || value === 'republic of korea') return 'korea republic';
  if (value === 'czech republic' || value === 'czechia') return 'czechia';
  if (value === 'bosnia and herzegovina' || value === 'bosnia herzegovina' || value === 'bosnia h') return 'bosnia h';
  if (value === 'united states' || value === 'united states of america') return 'usa';
  return value;
}

function normalizeFootballDataStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(value)) return 'IN_PLAY';
  if (value === 'FINISHED') return 'FINISHED';
  if (['TIMED', 'SCHEDULED'].includes(value)) return 'SCHEDULED';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(value)) return value;
  return value || 'SCHEDULED';
}

function safeScore(...values: unknown[]) {
  for (const value of values) {
    const score = Number(value);
    if (Number.isFinite(score)) return Math.max(0, Math.min(99, Math.floor(score)));
  }
  return null;
}

function extractScore(match: any) {
  const fullTime = match?.score?.fullTime || {};
  const regular = match?.score?.regularTime || {};
  const halfTime = match?.score?.halfTime || {};
  return {
    homeScore: safeScore(fullTime.home, regular.home, halfTime.home),
    awayScore: safeScore(fullTime.away, regular.away, halfTime.away),
  };
}

async function footballDataFetch(path: string, params: Record<string, string>) {
  const token = String(process.env.FOOTBALL_DATA_API_TOKEN || '').trim();
  if (!token) throw Object.assign(new Error('FOOTBALL_DATA_API_TOKEN is missing'), { status: 400, provider: 'FOOTBALL_DATA' });
  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4').replace(/\/$/, '');
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { 'X-Auth-Token': token, accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(payload?.message || `football-data returned HTTP ${response.status}`), { status: response.status, payload, provider: 'FOOTBALL_DATA' });
  return payload;
}

function providerTeamCandidates(team: any) {
  return [team?.tla, team?.shortName, team?.name].map(normalizeTeamName).filter(Boolean);
}

function localTeamCandidates(team: any) {
  return [team?.code, team?.name].map(normalizeTeamName).filter(Boolean);
}

function teamMatches(providerTeam: any, localTeam: any) {
  const provider = providerTeamCandidates(providerTeam);
  const local = localTeamCandidates(localTeam);
  return provider.some((name) => local.includes(name)) || local.some((name) => provider.includes(name));
}

function findProviderMatch(localMatch: FallbackMatch, matches: any[]) {
  return matches.find((item) => teamMatches(item?.homeTeam, localMatch.homeTeam) && teamMatches(item?.awayTeam, localMatch.awayTeam))
    || matches.find((item) => teamMatches(item?.homeTeam, localMatch.awayTeam) && teamMatches(item?.awayTeam, localMatch.homeTeam))
    || null;
}

async function saveMatchEventIfNew(matchId: string, type: string, detail: string, minute: number | null = null) {
  const existing = await prisma.matchEvent.findFirst({
    where: { matchId, type, detail },
    select: { id: true },
  });
  if (existing) return null;
  return prisma.matchEvent.create({
    data: {
      matchId,
      minute,
      type,
      detail: detail.slice(0, 240),
      sourceName: 'FOOTBALL_DATA_FALLBACK',
    },
  });
}

export async function syncFootballDataFallbackForMatch(localMatch: FallbackMatch, options: { reason?: string; debug?: boolean } = {}) {
  if (!localMatch?.id) return { status: 'missing_local_match', provider: 'FOOTBALL_DATA' };
  const matchDate = localMatch.matchDate ? new Date(localMatch.matchDate) : new Date();
  const date = dateKey(Number.isFinite(matchDate.getTime()) ? matchDate : new Date());
  const competition = String(process.env.FOOTBALL_DATA_COMPETITION || 'WC').trim();
  const payload = await footballDataFetch(`/competitions/${encodeURIComponent(competition)}/matches`, { dateFrom: date, dateTo: date });
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const providerMatch = findProviderMatch(localMatch, matches);

  if (!providerMatch) {
    return { status: 'football_data_match_not_found', provider: 'FOOTBALL_DATA', date, fixturesFetched: matches.length, reason: options.reason };
  }

  const status = normalizeFootballDataStatus(providerMatch.status);
  const { homeScore, awayScore } = extractScore(providerMatch);
  const nextHomeScore = homeScore ?? Number(localMatch.homeScore || 0);
  const nextAwayScore = awayScore ?? Number(localMatch.awayScore || 0);
  const prevHomeScore = Number(localMatch.homeScore || 0);
  const prevAwayScore = Number(localMatch.awayScore || 0);

  await prisma.match.update({
    where: { id: localMatch.id },
    data: {
      status,
      homeScore: nextHomeScore,
      awayScore: nextAwayScore,
    },
  });

  const snapshot = await saveFootballDataScoreSnapshot({
    matchId: localMatch.id,
    providerMatchId: Number(providerMatch.id),
    status,
    homeScore: nextHomeScore,
    awayScore: nextAwayScore,
    provider: 'FOOTBALL_DATA_FALLBACK',
    minIntervalMinutes: status === 'FINISHED' ? 720 : 10,
    rawData: {
      providerStatus: providerMatch.status,
      utcDate: providerMatch.utcDate,
      score: providerMatch.score,
      source: 'football-data fallback',
    },
  });

  const savedEvents = [];
  if (nextHomeScore > prevHomeScore) {
    const saved = await saveMatchEventIfNew(localMatch.id, 'goal_inferred', `هدف مؤكد من football-data.org لـ ${localMatch.homeTeam?.name || 'الفريق الأول'} — النتيجة ${nextHomeScore} - ${nextAwayScore}`);
    if (saved) savedEvents.push(saved.id);
  }
  if (nextAwayScore > prevAwayScore) {
    const saved = await saveMatchEventIfNew(localMatch.id, 'goal_inferred', `هدف مؤكد من football-data.org لـ ${localMatch.awayTeam?.name || 'الفريق الثاني'} — النتيجة ${nextHomeScore} - ${nextAwayScore}`);
    if (saved) savedEvents.push(saved.id);
  }
  if (status !== String(localMatch.status || '')) {
    const saved = await saveMatchEventIfNew(localMatch.id, 'status_change', `تحديث حالة المباراة من football-data.org: ${status}`);
    if (saved) savedEvents.push(saved.id);
  }

  return {
    status: 'football_data_fallback_synced',
    provider: 'FOOTBALL_DATA',
    providerMatchId: providerMatch.id,
    date,
    localMatchId: localMatch.id,
    matchStatus: status,
    previousScore: `${prevHomeScore}-${prevAwayScore}`,
    score: `${nextHomeScore}-${nextAwayScore}`,
    snapshot,
    savedEventsCount: savedEvents.length,
    fixturesFetched: matches.length,
    reason: options.reason,
    ...(options.debug ? { providerMatch } : {}),
  };
}
