import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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
function cleanText(...values: any[]): string | null {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]' && !/^unknown|n\/a|null|undefined|-$/i.test(text)) return text;
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = cleanText(item);
        if (text) return text;
      }
      continue;
    }
    if (typeof value === 'object') {
      const text = cleanText(value.name, value.fullName, value.full_name, value.displayName, value.display_name, value.title, value.label, value.stadium, value.venue);
      if (text) return text;
    }
  }
  return null;
}
function key(value: any) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim().replace('turkiye', 'turkey').replace('türkiye', 'turkey').replace('usa', 'united states').replace('u s a', 'united states').replace('united states of america', 'united states');
}
function similarity(a: any, b: any) {
  const aa = key(a);
  const bb = key(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 90;
  const aw = new Set(aa.split(' ').filter((word) => word.length > 1));
  const bw = new Set(bb.split(' ').filter((word) => word.length > 1));
  if (!aw.size || !bw.size) return 0;
  const hits = Array.from(aw).filter((word) => bw.has(word)).length;
  return Math.round((hits / Math.max(aw.size, bw.size)) * 80);
}
function teamScore(providerName: any, localTeam: any) {
  return Math.max(similarity(providerName, localTeam?.name), similarity(providerName, localTeam?.code));
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
    raw: row,
  };
}
function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return null;
  return Math.abs(aa - bb) / 36e5;
}
function scoreCandidate(candidate: any, match: any) {
  const direct = (teamScore(candidate.home, match.homeTeam) + teamScore(candidate.away, match.awayTeam)) / 2;
  const swapped = (teamScore(candidate.home, match.awayTeam) + teamScore(candidate.away, match.homeTeam)) / 2;
  const reversed = swapped > direct;
  const team = Math.max(direct, swapped);
  const hours = hoursApart(candidate.date, match.matchDate);
  const timeBoost = hours === null ? 0 : hours <= 4 ? 25 : hours <= 12 ? 15 : hours <= 30 ? 8 : -15;
  return { ...candidate, score: Math.round(team + timeBoost), teamScore: Math.round(team), timeHours: hours === null ? null : Number(hours.toFixed(2)), reversed };
}
function providerIdParam(url: URL) {
  const value = url.searchParams.get('providerMatchId') || url.searchParams.get('theStatsMatchId') || url.searchParams.get('providerId') || '';
  if (!value.trim()) return '';
  const trimmed = value.trim();
  const id = trimmed.startsWith('mt_') ? trimmed : `mt_${trimmed.replace(/^mt_/i, '').replace(/\D/g, '')}`;
  const digits = id.replace(/\D/g, '');
  if (digits.length < 8) return '';
  return id;
}
async function cachedProviderId(matchId: string) {
  const snapshot = await prisma.matchStatsSnapshot.findFirst({
    where: { matchId, provider: { in: ['THE_STATS_API_MATCH_INFO', 'THE_STATS_API_LIVE', 'THE_STATS_API_EXTRAS'] } },
    orderBy: { capturedAt: 'desc' },
    select: { providerMatchId: true, rawData: true },
  }).catch(() => null);
  const raw = snapshot?.rawData as any;
  const id = cleanText(raw?.resolvedProviderMatchId, raw?.providerMatchId, raw?.matchId, snapshot?.providerMatchId ? `mt_${snapshot.providerMatchId}` : null);
  if (!id || id === 'mt_12345') return null;
  const digits = id.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return id;
}
async function resolveProviderId(match: any, query: Record<string, string | number>, forcedId: string) {
  if (forcedId) return { id: forcedId, by: 'forced_provider_match_id' };
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_') && external !== 'mt_12345') {
    const digits = external.replace(/\D/g, '');
    if (digits.length >= 8) {
      return { id: external, by: 'local_external_id' };
    }
  }
  const cached = await cachedProviderId(match.id);
  if (cached) return { id: cached, by: 'cached_snapshot_provider_id' };
  const payload = await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 });
  const list = extractList(payload).map(providerMatch).filter((row) => row.id);
  const candidates = list.map((row) => scoreCandidate(row, match)).sort((a, b) => b.score - a.score).slice(0, 10);
  const found = candidates.find((row) => row.score >= 82 && row.teamScore >= 70 && (row.timeHours === null || row.timeHours <= 30));
  return { id: found?.id ? (String(found.id).startsWith('mt_') ? String(found.id) : `mt_${found.id}`) : null, by: found ? (found.reversed ? 'provider_match_list_fuzzy_reversed' : 'provider_match_list_fuzzy') : null, searched: list.length, confidence: found?.score || 0, candidates: candidates.map(({ raw, ...row }) => row) };
}
function payloadData(payload: any) {
  return payload?.data || payload?.response || payload?.result || payload;
}
function extractMatchInfo(payload: any) {
  const data = payloadData(payload);
  const fixture = data?.fixture || data?.match || data?.game || data;
  const venue = fixture?.venue || fixture?.stadium || fixture?.ground || data?.venue || data?.stadium || data?.ground || {};
  const officials = fixture?.officials || data?.officials || [];
  const referee = fixture?.referee || data?.referee || data?.main_referee || data?.referee_name || officials?.referee || officials?.[0];
  return {
    venue: cleanText(venue?.name, venue?.stadium, venue?.venue, fixture?.venue_name, data?.venue_name, venue),
    city: cleanText(venue?.city, fixture?.city, data?.city, data?.venue_city, data?.location?.city),
    country: cleanText(venue?.country, fixture?.country, data?.country, data?.location?.country),
    referee: cleanText(referee?.name, referee?.fullName, referee?.full_name, fixture?.referee_name, data?.referee_name, referee),
  };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  if (!matchId) return json({ ok: false, error: 'matchId is required' }, 400);
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const save = bool(url.searchParams.get('save'), true);
  const forcedProviderMatchId = providerIdParam(url);
  const query = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    page: 1,
    per_page: int(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100),
  };
  try {
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
    if (!match) return json({ ok: false, error: 'Match not found', matchId }, 404);
    const resolved = await resolveProviderId(match, query, forcedProviderMatchId);
    if (!resolved.id) return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_info_only', matchId, error: 'Could not resolve TheStats provider match id', resolved, config: getTheStatsApiConfigStatus() }, 200);
    const path = `/api/football/matches/${encodeURIComponent(resolved.id)}`;
    const payload = await theStatsApiFetch(path, {}, { timeoutMs: int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000) });
    const matchInfo = extractMatchInfo(payload);
    const useful = Boolean(matchInfo.venue || matchInfo.city || matchInfo.referee);
    let snapshotId: string | null = null;
    if (!dryRun && save && useful) {
      const snapshot = await prisma.matchStatsSnapshot.create({
        data: {
          id: randomUUID(),
          matchId,
          provider: 'THE_STATS_API_MATCH_INFO',
          providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0,
          rawData: { provider: 'THE_STATS_API', mode: 'match_info_only', resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, importedAt: new Date().toISOString(), endpoint: path, matchInfo },
        },
        select: { id: true },
      });
      snapshotId = snapshot.id;
    }
    return json({ ok: useful, provider: 'THE_STATS_API', mode: 'match_info_only', matchId, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, forcedProviderMatchId: forcedProviderMatchId || null, matchInfo, saved: Boolean(snapshotId), snapshotId, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_info_only', matchId, error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
