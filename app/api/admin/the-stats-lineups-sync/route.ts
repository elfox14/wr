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
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function str(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return String(value).trim();
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
    .replace('usa', 'united states');
}
function teamMatch(providerName: any, localTeam: any) {
  const p = key(providerName);
  const l = key(localTeam?.name || localTeam?.code);
  return Boolean(p && l && (p === l || p.includes(l) || l.includes(p)));
}
function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999;
  return Math.abs(aa - bb) / 36e5;
}
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
    home: str(home?.name, row?.homeName, row?.home_team_name),
    away: str(away?.name, row?.awayName, row?.away_team_name),
    date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}
async function resolveProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_')) return { id: external, by: 'local_external_id' };
  const list = extractList(await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 })).map(providerMatch).filter((row) => row.id);
  const found = list.find((row) => teamMatch(row.home, match.homeTeam) && teamMatch(row.away, match.awayTeam) && hoursApart(row.date, match.matchDate) <= 4);
  return { id: found?.id || null, by: found ? 'provider_match_list' : null, searched: list.length };
}
function compactPlayer(row: any) {
  const player = row?.player || row?.athlete || row?.person || row;
  const name = str(player?.name, player?.full_name, row?.name, row?.playerName, row?.display_name);
  if (!name) return null;
  return {
    id: str(player?.id, player?.player_id, row?.id, row?.player_id),
    name,
    number: row?.jersey_number ?? row?.shirt_number ?? row?.number ?? player?.jersey_number ?? player?.shirt_number ?? player?.number ?? null,
    image: str(player?.image, player?.photo, player?.image_url, row?.image, row?.photo, row?.image_url),
    position: str(player?.position, row?.position),
    rating: row?.rating ?? player?.rating ?? null,
    isCaptain: Boolean(row?.captain || row?.isCaptain || player?.captain),
  };
}
function compactPlayers(rows: any[]) {
  return rows.map(compactPlayer).filter(Boolean);
}
function summarizeLineup(payload: any) {
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') return null;
  return {
    matchId: data.match_id || null,
    confirmed: Boolean(data.confirmed),
    home: data.home ? {
      id: data.home.id || null,
      name: data.home.name || null,
      formation: data.home.formation || null,
      startingXi: compactPlayers(data.home.starting_xi || data.home.startingXi || data.home.lineup || []),
      substitutes: compactPlayers(data.home.substitutes || data.home.bench || []),
    } : null,
    away: data.away ? {
      id: data.away.id || null,
      name: data.away.name || null,
      formation: data.away.formation || null,
      startingXi: compactPlayers(data.away.starting_xi || data.away.startingXi || data.away.lineup || []),
      substitutes: compactPlayers(data.away.substitutes || data.away.bench || []),
    } : null,
  };
}

async function syncOne(match: any, dryRun: boolean, query: Record<string, string | number>) {
  const resolved = await resolveProviderId(match, query);
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve TheStatsAPI match id', resolved };
  const path = `/api/football/matches/${encodeURIComponent(resolved.id)}/lineups`;
  const payload = await theStatsApiFetch(path, {}, { timeoutMs: 15000 });
  const lineup = summarizeLineup(payload);
  const hasLineup = Boolean(lineup?.home?.startingXi?.length || lineup?.away?.startingXi?.length);
  let snapshotId: string | null = null;
  if (!dryRun && hasLineup) {
    const snapshot = await prisma.matchStatsSnapshot.create({ data: {
      id: randomUUID(),
      matchId: match.id,
      provider: 'THE_STATS_API_LINEUPS',
      providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0,
      rawData: { lineup, source: { provider: 'THE_STATS_API', lineupsPath: path }, importedAt: new Date().toISOString() },
    }, select: { id: true } });
    snapshotId = snapshot.id;
  }
  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, confirmed: Boolean(lineup?.confirmed), hasLineup, homeCount: lineup?.home?.startingXi?.length || 0, awayCount: lineup?.away?.startingXi?.length || 0, saved: Boolean(snapshotId), snapshotId };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const dryRun = ['1', 'true', 'yes', 'on'].includes(String(url.searchParams.get('dryRun') || '').toLowerCase());
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const limit = int(url.searchParams.get('limit'), 8, 1, 30);
  const minutesBack = int(url.searchParams.get('minutesBack'), 30, 0, 720);
  const minutesForward = int(url.searchParams.get('minutesForward'), 120, 0, 720);
  const now = Date.now();
  const query = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: int(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100),
  };
  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, take: limit });
    const results = [];
    for (const match of matches) {
      try { results.push(await syncOne(match, dryRun, query)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, error: safeTheStatsApiError(error) }); }
    }
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'the_stats_lineups_sync', dryRun, saved: !dryRun, matchesFound: matches.length, lineupsSaved: results.filter((item: any) => item.saved).length, successful: results.filter((item: any) => item.ok).length, failed: results.filter((item: any) => !item.ok).length, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'the_stats_lineups_sync', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
