import prisma from '@/lib/prisma';
import { theStatsApiFetch } from '@/lib/theStatsApi';

function str(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]' && !/^null|undefined|-$/i.test(text)) return text;
      continue;
    }
    if (value && typeof value === 'object') {
      const text = str(value.name, value.fullName, value.full_name, value.title, value.label, value.display_name, value.displayName);
      if (text) return text;
    }
  }
  return null;
}

function key(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('czechia', 'czech republic')
    .replace('usa', 'united states')
    .replace('u s a', 'united states')
    .replace('united states of america', 'united states')
    .replace('turkiye', 'turkey')
    .replace('türkiye', 'turkey');
}

function words(value: any) { return key(value).split(' ').filter((w) => w.length > 1); }
function similarity(a: any, b: any) {
  const aa = key(a);
  const bb = key(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 88;
  const aw = new Set(words(aa));
  const bw = new Set(words(bb));
  if (!aw.size || !bw.size) return 0;
  const hit = Array.from(aw).filter((w) => bw.has(w)).length;
  return Math.round((hit / Math.max(aw.size, bw.size)) * 75);
}
function teamScore(providerName: any, localTeam: any) { return Math.max(similarity(providerName, localTeam?.name), similarity(providerName, localTeam?.code)); }
function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999;
  return Math.abs(aa - bb) / 36e5;
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function extractList(payload: any) {
  if (Array.isArray(payload)) return payload;
  for (const field of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[field])) return payload[field];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  return [];
}
function providerMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: str(home?.name, row?.homeName, row?.home_team_name, home),
    away: str(away?.name, row?.awayName, row?.away_team_name, away),
    date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff, row?.start_time),
    raw: row,
  };
}
function candidateScore(candidate: any, match: any) {
  const directHome = teamScore(candidate.home, match.homeTeam);
  const directAway = teamScore(candidate.away, match.awayTeam);
  const swappedHome = teamScore(candidate.home, match.awayTeam);
  const swappedAway = teamScore(candidate.away, match.homeTeam);
  const direct = (directHome + directAway) / 2;
  const swapped = (swappedHome + swappedAway) / 2;
  const reversed = swapped > direct;
  const team = Math.max(direct, swapped);
  const hours = hoursApart(candidate.date, match.matchDate);
  const time = hours <= 4 ? 25 : hours <= 12 ? 15 : hours <= 30 ? 8 : candidate.date ? -15 : 0;
  return { ...candidate, score: Math.round(team + time), teamScore: Math.round(team), timeHours: hours === 999 ? null : Number(hours.toFixed(2)), reversed };
}
function normalizeProviderId(value: any) {
  const raw = str(value);
  if (!raw) return null;
  const id = raw.startsWith('mt_') ? raw : `mt_${raw.replace(/^mt_/i, '').replace(/\D/g, '')}`;
  return id && id !== 'mt_' && id !== 'mt_12345' ? id : null;
}
function isPageOutOfRange(error: any) {
  const code = String(error?.payload?.error?.code || error?.code || '').toUpperCase();
  const message = String(error?.payload?.error?.message || error?.message || '').toLowerCase();
  return code === 'PAGE_OUT_OF_RANGE' || message.includes('out of range');
}

export function defaultTheStatsQuery(params: URLSearchParams) {
  const out: Record<string, string | number> = {
    competition_id: params.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: params.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: Number(params.get('providerMatchesPerPage') || 100),
  };
  for (const keyName of ['date_from', 'date_to', 'status', 'stage', 'group', 'utc_offset']) {
    const value = params.get(keyName);
    if (value) out[keyName] = value;
  }
  return out;
}

async function fetchProviderMatches(query: Record<string, string | number>) {
  const seen = new Set<string>();
  const rows: any[] = [];
  const perPage = Math.max(50, Math.min(100, Number(query.per_page || 100) || 100));
  const base = { ...query, per_page: perPage };
  for (const page of [1, 2, 3]) {
    let payload: any;
    try {
      payload = await theStatsApiFetch('/api/football/matches', { ...base, page }, { timeoutMs: 15000 });
    } catch (error: any) {
      if (page > 1 && isPageOutOfRange(error)) break;
      throw error;
    }
    const list = extractList(payload).map(providerMatch).filter((row) => row.id);
    for (const row of list) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    if (list.length < perPage) break;
    await sleep(350);
  }
  return rows;
}

async function existingProviderId(matchId: string) {
  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: { matchId, provider: { startsWith: 'THE_STATS_API' } },
    orderBy: { capturedAt: 'desc' },
    take: 20,
    select: { providerMatchId: true, rawData: true },
  }).catch(() => []);

  for (const snapshot of snapshots) {
    const raw = snapshot?.rawData as any;
    const candidates = [
      raw?.resolvedProviderMatchId,
      raw?.providerMatchId,
      raw?.matchId,
      raw?.source?.providerMatchId,
      raw?.source?.matchId,
      raw?.theStatsApi?.matchId,
      raw?.normalized?.matchInfo?.providerMatchId,
      snapshot?.providerMatchId ? `mt_${snapshot.providerMatchId}` : null,
    ];
    for (const candidate of candidates) {
      const id = normalizeProviderId(candidate);
      if (id) return id;
    }
  }
  return null;
}

export async function resolveTheStatsProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_') && external !== 'mt_12345') return { id: external, by: 'local_external_id' };
  const cached = await existingProviderId(match.id);
  if (cached) return { id: cached, by: 'cached_the_stats_snapshot' };
  const list = await fetchProviderMatches(query);
  const candidates = list.map((row) => candidateScore(row, match)).sort((a, b) => b.score - a.score).slice(0, 8);
  const found = candidates.find((row) => row.score >= 82 && row.teamScore >= 70 && (row.timeHours === null || row.timeHours <= 30));
  return { id: found?.id || null, by: found ? (found.reversed ? 'provider_match_list_fuzzy_reversed' : 'provider_match_list_fuzzy') : null, searched: list.length, confidence: found?.score || 0, candidates: candidates.map(({ raw, ...row }) => row) };
}
