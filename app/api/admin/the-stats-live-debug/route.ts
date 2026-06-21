import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, params: URLSearchParams) {
  const validSecrets = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret') || '',
    req.headers.get('x-cron-secret') || '',
    params.get('key') || '',
    params.get('adminSecret') || '',
    params.get('cronSecret') || '',
  ];
  return candidates.some((value) => String(value).trim() && validSecrets.includes(String(value).trim()));
}

function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}

function str(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function text(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  return [];
}

function normalizeProviderMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: str(home?.name, row?.homeName, row?.home_team_name),
    away: str(away?.name, row?.awayName, row?.away_team_name),
    date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999;
  return Math.abs(aa - bb) / 36e5;
}

function teamMatches(providerName: any, localTeam: any) {
  const provider = text(providerName).replace('czechia', 'czech republic').replace('usa', 'united states');
  const local = text(localTeam?.name || localTeam?.code).replace('czechia', 'czech republic').replace('usa', 'united states');
  return Boolean(provider && local && (provider === local || provider.includes(local) || local.includes(provider)));
}

async function resolveProviderId(match: any, params: URLSearchParams) {
  const explicit = String(params.get('providerMatchId') || '').trim();
  if (explicit) return { id: explicit, by: 'explicit_provider_match_id' };
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_')) {
    const digits = external.replace(/\D/g, '');
    if (digits.length >= 8) {
      return { id: external, by: 'local_external_id' };
    }
  }

  const query = {
    competition_id: params.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: params.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: 100,
  };
  const payload = await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 });
  const list = extractArray(payload).map(normalizeProviderMatch).filter((row) => row.id);
  const found = list.find((row) => teamMatches(row.home, match.homeTeam) && teamMatches(row.away, match.awayTeam) && hoursApart(row.date, match.matchDate) <= 4);
  return { id: found?.id || null, by: found ? 'provider_match_list' : null, searched: list.length };
}

function shape(value: any, depth = 0): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      sample: depth < 2 && value.length ? shape(value[0], depth + 1) : null,
    };
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const preview: Record<string, any> = {};
    for (const key of keys.slice(0, 25)) {
      const item = value[key];
      preview[key] = depth < 2 && item && typeof item === 'object' ? shape(item, depth + 1) : item;
    }
    return { kind: 'object', keys, preview };
  }
  return value;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const matchId = url.searchParams.get('matchId') || '';
  if (!matchId && !url.searchParams.get('providerMatchId')) {
    return NextResponse.json({ ok: false, error: 'matchId or providerMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const match = matchId
      ? await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } })
      : null;
    if (matchId && !match) {
      return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const resolved = match ? await resolveProviderId(match, url.searchParams) : { id: url.searchParams.get('providerMatchId'), by: 'explicit_provider_match_id' };
    if (!resolved.id) {
      return NextResponse.json({ ok: false, error: 'Could not resolve provider match id', resolved, config: getTheStatsApiConfigStatus() }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const liveStatsPath = `/api/football/matches/${encodeURIComponent(resolved.id)}/live-stats`;
    const timelinePath = `/api/football/matches/${encodeURIComponent(resolved.id)}/timeline`;
    const [liveStats, timeline] = await Promise.all([
      theStatsApiFetch(liveStatsPath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) })),
      theStatsApiFetch(timelinePath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) })),
    ]);

    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      mode: 'the_stats_live_debug',
      matchId: match?.id || null,
      localTeams: match ? `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}` : null,
      resolvedProviderMatchId: resolved.id,
      resolvedBy: resolved.by,
      liveStatsOk: liveStats.ok,
      liveStatsError: liveStats.ok ? null : liveStats.error,
      liveStatsShape: liveStats.ok ? shape(liveStats.payload) : null,
      timelineOk: timeline.ok,
      timelineError: timeline.ok ? null : timeline.error,
      timelineShape: timeline.ok ? shape(timeline.payload) : null,
      paths: { liveStatsPath, timelinePath },
      config: getTheStatsApiConfigStatus(),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      provider: 'THE_STATS_API',
      mode: 'the_stats_live_debug',
      error: safeTheStatsApiError(error),
      config: getTheStatsApiConfigStatus(),
    }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
