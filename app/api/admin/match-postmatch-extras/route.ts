import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function endpointMode(value: string | null): 'essential' | 'full' {
  return value === 'full' || value === 'all' ? 'full' : 'essential';
}
function providerIdParam(url: URL) {
  const value = url.searchParams.get('providerMatchId') || url.searchParams.get('theStatsMatchId') || url.searchParams.get('providerId') || '';
  if (!value.trim()) return '';
  const trimmed = value.trim();
  return trimmed.startsWith('mt_') ? trimmed : `mt_${trimmed.replace(/^mt_/i, '')}`;
}
function realText(value: unknown) {
  const text = String(value || '').trim();
  return Boolean(text && text !== '[object Object]' && !/^null|undefined|-$/i.test(text));
}
function usefulResult(result: any) {
  const endpointsOk = Array.isArray(result?.endpointsOk) ? result.endpointsOk.length : 0;
  const counts = result?.counts || {};
  const matchInfo = result?.matchInfo || {};
  const hasCounts = Number(counts.shots || 0) > 0 || Number(counts.detailedEvents || 0) > 0 || Number(counts.playerStats || 0) > 0 || Number(counts.goalkeeperStats || 0) > 0 || Number(counts.standings || 0) > 0;
  const hasInfo = realText(matchInfo.venue) || realText(matchInfo.city) || realText(matchInfo.referee) || matchInfo.finalScore?.home !== null || matchInfo.finalScore?.away !== null;
  return endpointsOk > 0 && (hasCounts || hasInfo);
}
function isProviderBlocked(result: any) {
  return Boolean(result?.rateLimited || result?.error?.status === 429 || result?.error?.status === 412 || result?.error?.code === 'provider_disabled');
}
function cleanText(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]' && !/^null|undefined|-$/i.test(text)) return text;
    } else if (value && typeof value === 'object') {
      const text = cleanText(value.name, value.fullName, value.full_name, value.title, value.label, value.displayName, value.display_name);
      if (text) return text;
    }
  }
  return null;
}
function nameKey(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('turkiye', 'turkey')
    .replace('türkiye', 'turkey')
    .replace('u s a', 'united states')
    .replace('usa', 'united states')
    .replace('united states of america', 'united states');
}
function similarity(a: any, b: any) {
  const aa = nameKey(a);
  const bb = nameKey(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 90;
  const aw = new Set(aa.split(' ').filter((x) => x.length > 1));
  const bw = new Set(bb.split(' ').filter((x) => x.length > 1));
  if (!aw.size || !bw.size) return 0;
  const hits = Array.from(aw).filter((word) => bw.has(word)).length;
  return Math.round((hits / Math.max(aw.size, bw.size)) * 80);
}
function teamScore(providerName: any, localTeam: any) {
  return Math.max(similarity(providerName, localTeam?.name), similarity(providerName, localTeam?.code));
}
function hoursApart(a: any, b: any) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return null;
  return Math.abs(aa - bb) / 36e5;
}
function extractList(payload: any) {
  if (Array.isArray(payload)) return payload;
  for (const field of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[field])) return payload[field];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  return [];
}
function providerMatch(row: any) {
  const fixture = row?.fixture || row?.match || row?.game || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: cleanText(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: cleanText(home?.name, row?.homeName, row?.home_team_name, home),
    away: cleanText(away?.name, row?.awayName, row?.away_team_name, away),
    date: cleanText(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff, row?.start_time),
  };
}
function scoreCandidate(candidate: any, match: any) {
  const direct = (teamScore(candidate.home, match.homeTeam) + teamScore(candidate.away, match.awayTeam)) / 2;
  const reversedScore = (teamScore(candidate.home, match.awayTeam) + teamScore(candidate.away, match.homeTeam)) / 2;
  const reversed = reversedScore > direct;
  const team = Math.max(direct, reversedScore);
  const hours = hoursApart(candidate.date, match.matchDate);
  const timeBoost = hours === null ? 0 : hours <= 4 ? 25 : hours <= 12 ? 15 : hours <= 30 ? 8 : -15;
  return { ...candidate, score: Math.round(team + timeBoost), teamScore: Math.round(team), timeHours: hours === null ? null : Number(hours.toFixed(2)), reversed };
}
async function resolveProviderIdFromFirstPage(match: any, query: Record<string, string | number>) {
  const payload = await theStatsApiFetch('/api/football/matches', { ...query, page: 1, per_page: Math.max(50, Math.min(100, Number(query.per_page || 100) || 100)) }, { timeoutMs: 15000 });
  const list = extractList(payload).map(providerMatch).filter((row) => row.id);
  const candidates = list.map((row) => scoreCandidate(row, match)).sort((a, b) => b.score - a.score).slice(0, 8);
  const found = candidates.find((row) => row.score >= 82 && row.teamScore >= 70 && (row.timeHours === null || row.timeHours <= 30));
  return { id: found?.id ? (String(found.id).startsWith('mt_') ? String(found.id) : `mt_${found.id}`) : null, by: found ? (found.reversed ? 'route_first_page_fuzzy_reversed' : 'route_first_page_fuzzy') : null, searched: list.length, confidence: found?.score || 0, candidates };
}
async function saveUsefulSnapshot(matchId: string, result: any, includeRaw: boolean) {
  const normalized = result?.debug?.normalizedPreview || result?.debug?.normalized || null;
  if (!normalized) return null;
  const endpointSummaries = result?.debug?.endpointSummaries || [];
  const rawData: Record<string, any> = {
    provider: 'THE_STATS_API',
    mode: 'match_extras',
    endpointMode: result.endpointMode,
    rateLimited: Boolean(result.rateLimited),
    resolvedProviderMatchId: result.resolvedProviderMatchId,
    resolvedBy: result.resolvedBy,
    importedAt: new Date().toISOString(),
    endpoints: endpointSummaries.map((item: any) => ({ key: item.key, path: item.path, ok: item.ok, error: item.error || null, keySummary: item.keySummary || null })),
    normalized,
  };
  if (includeRaw && result?.debug?.endpoints) rawData.raw = Object.fromEntries(Object.entries(result.debug.endpoints).filter(([, value]: any) => value?.ok).map(([key, value]: any) => [key, value.payload]));
  const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId, provider: 'THE_STATS_API_EXTRAS', providerMatchId: Number(String(result.resolvedProviderMatchId || '').replace(/\D/g, '')) || 0, rawData }, select: { id: true } });
  return snapshot.id;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const forcedProviderMatchId = providerIdParam(url);
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const save = bool(url.searchParams.get('save'), true);
  const includeRaw = bool(url.searchParams.get('includeRaw'), false);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  const delayMs = int(url.searchParams.get('delayMs'), 700, 0, 5000);
  const mode = endpointMode(url.searchParams.get('endpointMode') || url.searchParams.get('mode'));
  const limit = int(url.searchParams.get('limit'), 1, 1, 3);
  const minutesBack = int(url.searchParams.get('minutesBack'), 720, 30, 1440);
  const now = Date.now();
  const query = defaultTheStatsQuery(url.searchParams);

  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { status: { in: FINISHED }, matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now) } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'desc' }, take: limit });

    const results = [];
    for (const match of matches) {
      if (!FINISHED.includes(String(match.status || '').toUpperCase()) && !matchId) continue;
      try {
        let routeResolved: any = null;
        if (!forcedProviderMatchId) routeResolved = await resolveProviderIdFromFirstPage(match, query);
        if (!forcedProviderMatchId && !routeResolved?.id) {
          results.push({ ok: false, matchId: match.id, error: 'Could not resolve TheStats provider match id from first page', resolved: routeResolved, saved: false, snapshotId: null, rejectedEmptySnapshot: false });
          continue;
        }
        const providerId = forcedProviderMatchId || routeResolved.id;
        const matchForProvider = { ...match, externalId: providerId };
        const result: any = await collectTheStatsMatchExtras(matchForProvider, { dryRun, save: false, includeRaw, timeoutMs, query, endpointMode: mode, delayMs });
        if (routeResolved && result) {
          result.routeResolvedProviderMatchId = routeResolved.id;
          result.routeResolvedBy = routeResolved.by;
          result.routeResolvedConfidence = routeResolved.confidence;
        }
        const useful = usefulResult(result);
        const blocked = isProviderBlocked(result);
        let snapshotId: string | null = null;
        if (!dryRun && save && useful) snapshotId = await saveUsefulSnapshot(match.id, result, includeRaw);
        results.push({
          ...result,
          ok: useful,
          saved: Boolean(snapshotId),
          snapshotId,
          rejectedEmptySnapshot: !useful && !blocked,
          providerBlocked: blocked,
          advice: blocked
            ? result.advice || 'TheStats is temporarily unavailable or rate limited. Wait before retrying; no empty snapshot was saved.'
            : useful
              ? result.advice
              : forcedProviderMatchId
                ? 'Provider match id returned no valid endpoint data. Check the real TheStats match id; example IDs like mt_12345 will return 404 and will not be saved.'
                : result.advice,
        });
        if (result.rateLimited) break;
      } catch (error: any) {
        const safe = safeTheStatsApiError(error);
        results.push({ ok: false, matchId: match.id, providerBlocked: Number(safe?.status) === 429 || Number(safe?.status) === 412, rateLimited: Number(safe?.status) === 429, error: safe, saved: false, snapshotId: null, rejectedEmptySnapshot: false });
        if (Number(safe?.status) === 429) break;
      }
    }

    const successful = results.filter((item: any) => item.ok);
    const rateLimited = results.some((item: any) => item.rateLimited || item.error?.status === 429);
    const unresolved = results.some((item: any) => String(item.error || '').includes('Could not resolve TheStats provider match id'));
    const snapshotsSaved = results.filter((item: any) => item.saved).length;
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_postmatch_extras', endpointMode: mode, delayMs, forcedProviderMatchId: forcedProviderMatchId || null, dryRun, saveRequested: save, saved: snapshotsSaved > 0, rateLimited, unresolved, advice: rateLimited ? 'TheStats rate limit reached while resolving or fetching the match. Stop retrying for a few minutes, then run once again.' : unresolved ? 'Could not match this database match to TheStats automatically. Check results[0].resolved.candidates.' : undefined, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, snapshotsSaved, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_postmatch_extras', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
