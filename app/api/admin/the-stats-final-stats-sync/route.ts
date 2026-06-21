import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const PROVIDER = 'THE_STATS_API_FINAL';

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

function number(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}

function pair(value: any) {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' ? value.all : value;
  const home = number(first(source.home, source.homeTeam, source.home_team, source.local));
  const away = number(first(source.away, source.awayTeam, source.away_team, source.visitor, source.guest));
  if (home === null && away === null) return null;
  return { home, away };
}

function findDeepPair(raw: any, names: string[]) {
  const seen = new Set<any>();
  const stack = [{ node: raw, path: '' }];
  while (stack.length) {
    const { node, path } = stack.pop() as any;
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      const fullPath = path ? `${path}.${key}` : key;
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (names.some((name) => normalized === name || normalized.includes(name))) {
        const parsed = pair(value);
        if (parsed) return { ...parsed, sourcePath: fullPath };
      }
      if (value && typeof value === 'object') stack.push({ node: value, path: fullPath });
    }
  }
  return null;
}

function parseFinalStats(payload: any) {
  const data = payload?.data || payload?.response || payload?.result || payload || {};
  const stats: Record<string, any> = {};
  const map: Record<string, string[]> = {
    possession: ['ballpossession', 'possession'],
    shots: ['totalshots', 'shots'],
    shotsOnTarget: ['shotsontarget', 'ontarget'],
    shotsOffTarget: ['shotsofftarget', 'offtarget'],
    corners: ['cornerkicks', 'corners'],
    yellowCards: ['yellowcards', 'yellowcard'],
    redCards: ['redcards', 'redcard'],
    attacks: ['attacks'],
    dangerousAttacks: ['dangerousattacks'],
  };
  for (const [key, aliases] of Object.entries(map)) {
    const parsed = findDeepPair(data, aliases);
    if (parsed) stats[key] = parsed;
  }
  return { stats, data };
}

function stat(stats: Record<string, any>, key: string, side: 'home' | 'away') {
  return number(stats[key]?.[side]);
}

async function cachedProviderId(matchId: string) {
  const row = await prisma.matchStatsSnapshot.findFirst({
    where: { matchId, provider: { in: ['THE_STATS_API_LIVE', 'THE_STATS_API_FINAL', 'THE_STATS_API_EXTRAS', 'THE_STATS_API_MATCH_INFO'] } },
    orderBy: { capturedAt: 'desc' },
    select: { providerMatchId: true, rawData: true },
  }).catch(() => null);
  const raw = row?.rawData as any;
  const fromRaw = first(raw?.resolvedProviderMatchId, raw?.providerMatchId, raw?.matchId, raw?.source?.providerMatchId);
  if (fromRaw) return String(fromRaw).startsWith('mt_') ? String(fromRaw) : `mt_${String(fromRaw).replace(/^mt_/i, '')}`;
  if (row?.providerMatchId) return `mt_${row.providerMatchId}`;
  return null;
}

async function syncOne(matchId: string, save: boolean, replace: boolean, timeoutMs: number, forcedProviderId = '') {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match) return { ok: false, matchId, error: 'match_not_found' };
  const cached = await cachedProviderId(match.id);
  const providerId = forcedProviderId ? (forcedProviderId.startsWith('mt_') ? forcedProviderId : `mt_${forcedProviderId}`) : cached;
  if (!providerId) return { ok: false, matchId, error: 'could_not_resolve_the_stats_provider_match_id' };

  const path = `/api/football/matches/${encodeURIComponent(providerId)}/stats`;
  const payload = await theStatsApiFetch(path, {}, { timeoutMs });
  const parsed = parseFinalStats(payload);
  const stats = parsed.stats;
  const keys = Object.keys(stats);
  let deleted = 0;
  let snapshot: any = null;
  if (save && keys.length) {
    if (replace) deleted = (await prisma.matchStatsSnapshot.deleteMany({ where: { matchId: match.id, provider: PROVIDER } })).count;
    snapshot = await prisma.matchStatsSnapshot.create({
      data: {
        id: randomUUID(),
        matchId: match.id,
        provider: PROVIDER,
        providerMatchId: Number(providerId.replace(/\D/g, '')) || 0,
        minute: null,
        homePossession: stat(stats, 'possession', 'home'),
        awayPossession: stat(stats, 'possession', 'away'),
        homeAttacks: stat(stats, 'attacks', 'home'),
        awayAttacks: stat(stats, 'attacks', 'away'),
        homeDangerousAttacks: stat(stats, 'dangerousAttacks', 'home'),
        awayDangerousAttacks: stat(stats, 'dangerousAttacks', 'away'),
        homeShots: stat(stats, 'shots', 'home'),
        awayShots: stat(stats, 'shots', 'away'),
        homeShotsOnTarget: stat(stats, 'shotsOnTarget', 'home'),
        awayShotsOnTarget: stat(stats, 'shotsOnTarget', 'away'),
        homeShotsOffTarget: stat(stats, 'shotsOffTarget', 'home'),
        awayShotsOffTarget: stat(stats, 'shotsOffTarget', 'away'),
        homeCorners: stat(stats, 'corners', 'home'),
        awayCorners: stat(stats, 'corners', 'away'),
        homeYellowCards: stat(stats, 'yellowCards', 'home'),
        awayYellowCards: stat(stats, 'yellowCards', 'away'),
        homeRedCards: stat(stats, 'redCards', 'home'),
        awayRedCards: stat(stats, 'redCards', 'away'),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        rawData: { source: PROVIDER, providerMatchId: providerId, path, stats, raw: payload, importedAt: new Date().toISOString() },
      },
      select: { id: true, capturedAt: true },
    });
  }
  return { ok: true, matchId: match.id, teams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, providerMatchId: providerId, path, statsFound: keys.length, statsKeys: keys, saved: Boolean(snapshot), deleted, snapshot, preview: stats };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const forcedProviderId = url.searchParams.get('providerMatchId') || url.searchParams.get('theStatsMatchId') || '';
  const save = bool(url.searchParams.get('save'), true);
  const replace = bool(url.searchParams.get('replace'), true);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  if (!matchId) return json({ ok: false, mode: 'the_stats_final_stats_sync', error: 'matchId is required' }, 400);
  try {
    const result = await syncOne(matchId, save, replace, timeoutMs, forcedProviderId);
    return json({ ok: Boolean(result.ok), provider: 'THE_STATS_API', mode: 'the_stats_final_stats_sync', save, replace, result, config: getTheStatsApiConfigStatus() }, result.ok ? 200 : 422);
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'the_stats_final_stats_sync', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
