import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError } from '@/lib/theStatsApi';

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
        const matchForProvider = forcedProviderMatchId ? { ...match, externalId: forcedProviderMatchId } : match;
        const result: any = await collectTheStatsMatchExtras(matchForProvider, { dryRun, save: false, includeRaw, timeoutMs, query, endpointMode: mode, delayMs });
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
        results.push({ ok: false, matchId: match.id, providerBlocked: Number(safe?.status) === 429 || Number(safe?.status) === 412, rateLimited: Number(safe?.status) === 429, error: safe });
        if (Number(safe?.status) === 429) break;
      }
    }

    const successful = results.filter((item: any) => item.ok);
    const rateLimited = results.some((item: any) => item.rateLimited || item.error?.status === 429);
    const unresolved = results.some((item: any) => item.error === 'Could not resolve TheStats provider match id');
    const snapshotsSaved = results.filter((item: any) => item.saved).length;
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_postmatch_extras', endpointMode: mode, delayMs, forcedProviderMatchId: forcedProviderMatchId || null, dryRun, saveRequested: save, saved: snapshotsSaved > 0, rateLimited, unresolved, advice: rateLimited ? 'TheStats rate limit reached while resolving or fetching the match. Stop retrying for a few minutes, then run once again.' : unresolved ? 'Could not match this database match to TheStats automatically. Retry with providerMatchId=mt_xxx from TheStats.' : undefined, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, snapshotsSaved, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_postmatch_extras', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
