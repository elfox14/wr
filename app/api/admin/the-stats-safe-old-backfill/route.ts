import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras, defaultTheStatsQuery, type TheStatsExtrasEndpointMode } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError } from '@/lib/theStatsApi';
import { blockProviderForHours, getProviderQuotaBlock, recordProviderRequest } from '@/lib/provider-quota-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const PROVIDER = 'THE_STATS_API';
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const MODE_SEQUENCE: TheStatsExtrasEndpointMode[] = ['essential', 'events', 'shots', 'players'];

type CandidateMatch = {
  id: string;
  externalId: string | null;
  matchDate: Date;
  status: string;
  homeTeam: any;
  awayTeam: any;
  statsSnapshots?: { id: string; provider: string; rawData: any; capturedAt: Date }[];
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function bool(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function modeParam(value: string | null): TheStatsExtrasEndpointMode {
  const mode = String(value || 'essential').toLowerCase().trim();
  if (mode === 'all' || mode === 'full') return 'full';
  if (mode === 'timeline' || mode === 'events') return 'events';
  if (mode === 'shotmap' || mode === 'shots') return 'shots';
  if (mode === 'player-stats' || mode === 'playerstats' || mode === 'players') return 'players';
  if (mode === 'lineup' || mode === 'lineups') return 'lineups';
  if (mode === 'match-info' || mode === 'matchinfo' || mode === 'info') return 'info';
  if (mode === 'match-stats' || mode === 'stats') return 'stats';
  return 'essential';
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function providerMatchNumber(value: unknown) {
  const number = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(number) ? number : null;
}
function statusFromResult(result: any) {
  const firstFailed = Array.isArray(result?.endpointsFailed) ? result.endpointsFailed[0] : null;
  return Number(result?.error?.status || firstFailed?.status || 0) || null;
}
function shouldBlockForRateLimit(result: any) {
  return Boolean(result?.rateLimited || Number(result?.error?.status) === 429 || (Array.isArray(result?.endpointsFailed) && result.endpointsFailed.some((item: any) => Number(item?.status) === 429)));
}
async function getActiveCooldown() {
  return getProviderQuotaBlock(PROVIDER).catch(() => null);
}
async function setRateLimitCooldown(reason: string, hours: number) {
  return blockProviderForHours(PROVIDER, hours, reason).catch(() => null);
}
function modeCoveredBySnapshot(rawData: any, mode: TheStatsExtrasEndpointMode) {
  const snapshotMode = String(rawData?.endpointMode || rawData?.mode || '').toLowerCase();
  const endpoints = Array.isArray(rawData?.endpoints) ? rawData.endpoints : [];
  const endpointKeys = new Set(endpoints.filter((item: any) => item?.ok !== false).map((item: any) => String(item?.key || '').toLowerCase()));
  const normalized = rawData?.normalized || {};
  if (snapshotMode === 'full' || snapshotMode === 'all') return true;
  if (mode === 'full') return snapshotMode === 'full' || snapshotMode === 'all';
  if (mode === 'essential') return snapshotMode === 'essential' || (endpointKeys.has('matchinfo') && endpointKeys.has('stats')) || Object.keys(normalized?.liveStats?.stats || {}).length > 0;
  if (mode === 'events') return snapshotMode === 'events' || snapshotMode === 'timeline' || endpointKeys.has('timeline') || Number(normalized?.eventsDetailed?.all?.length || 0) > 0;
  if (mode === 'shots') return snapshotMode === 'shots' || snapshotMode === 'shotmap' || endpointKeys.has('shotmap') || Number(normalized?.shotmap?.length || 0) > 0;
  if (mode === 'players') return snapshotMode === 'players' || snapshotMode === 'player-stats' || endpointKeys.has('playerstats') || Number(normalized?.playerStats?.length || 0) > 0;
  if (mode === 'lineups') return snapshotMode === 'lineups' || endpointKeys.has('lineups') || Boolean(normalized?.lineups);
  if (mode === 'info') return snapshotMode === 'info' || endpointKeys.has('matchinfo') || Boolean(normalized?.matchInfo?.venue || normalized?.matchInfo?.referee);
  if (mode === 'stats') return snapshotMode === 'stats' || endpointKeys.has('stats') || Object.keys(normalized?.liveStats?.stats || {}).length > 0;
  return false;
}
function matchHasMode(match: CandidateMatch, mode: TheStatsExtrasEndpointMode) {
  const snapshots = Array.isArray(match.statsSnapshots) ? match.statsSnapshots : [];
  return snapshots.some((snapshot) => modeCoveredBySnapshot(snapshot.rawData, mode));
}
function phaseSequenceFromParam(value: string | null) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'single') return null;
  if (raw === 'safe' || raw === 'default') return MODE_SEQUENCE;
  return raw.split(',').map((item) => modeParam(item)).filter(Boolean);
}
function matchLabel(match: CandidateMatch) {
  return `${match.homeTeam?.name || match.homeTeam?.code || 'Home'} vs ${match.awayTeam?.name || match.awayTeam?.code || 'Away'}`;
}
async function candidateMatches(params: {
  matchId: string;
  mode: TheStatsExtrasEndpointMode;
  skipExisting: boolean;
  candidateWindow: number;
  after?: Date | null;
  before?: Date | null;
  order: 'asc' | 'desc';
}) {
  const where: any = params.matchId
    ? { id: params.matchId }
    : {
        status: { in: FINISHED },
        ...(params.after || params.before ? { matchDate: { ...(params.after ? { gte: params.after } : {}), ...(params.before ? { lte: params.before } : {}) } } : {}),
      };
  const rows = await prisma.match.findMany({
    where,
    orderBy: { matchDate: params.order },
    take: params.matchId ? 1 : params.candidateWindow,
    include: {
      homeTeam: true,
      awayTeam: true,
      statsSnapshots: {
        where: { provider: { startsWith: 'THE_STATS_API' } },
        orderBy: { capturedAt: 'desc' },
        take: 20,
        select: { id: true, provider: true, rawData: true, capturedAt: true },
      },
    },
  });
  if (!params.skipExisting) return rows as CandidateMatch[];
  return (rows as CandidateMatch[]).filter((match) => !matchHasMode(match, params.mode));
}
async function runSingleMode(req: Request, mode: TheStatsExtrasEndpointMode) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const save = bool(url.searchParams.get('save'), true);
  const includeRaw = bool(url.searchParams.get('includeRaw'), false);
  const skipExisting = bool(url.searchParams.get('skipExisting'), true);
  const stopOnRateLimit = bool(url.searchParams.get('stopOnRateLimit'), true);
  const limit = int(url.searchParams.get('limit'), 1, 1, mode === 'full' ? 1 : 3);
  const candidateWindow = int(url.searchParams.get('candidateWindow'), Math.max(20, limit * 8), limit, 120);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  const endpointDelayMs = int(url.searchParams.get('endpointDelayMs') || url.searchParams.get('delayMs'), mode === 'full' ? 1500 : 900, 0, 10000);
  const matchDelayMs = int(url.searchParams.get('matchDelayMs'), mode === 'full' ? 3000 : 1800, 0, 20000);
  const cooldownHours = int(url.searchParams.get('cooldownHours'), 4, 1, 24);
  const ignoreCooldown = bool(url.searchParams.get('ignoreCooldown'), false);
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const before = url.searchParams.get('before') ? new Date(String(url.searchParams.get('before'))) : null;
  const after = url.searchParams.get('after') ? new Date(String(url.searchParams.get('after'))) : null;
  const query = defaultTheStatsQuery(url.searchParams);

  const activeBlock = ignoreCooldown ? null : await getActiveCooldown();
  if (activeBlock) {
    return { mode, dryRun, saveRequested: save, skipExisting, limit, candidateWindow, selected: 0, processed: 0, saved: 0, successful: 0, failed: 0, rateLimited: true, cooldownActive: true, blockedUntil: activeBlock.blockedUntil instanceof Date ? activeBlock.blockedUntil.toISOString() : activeBlock.blockedUntil, blockReason: activeBlock.reason || null, next: null, advice: 'TheStatsAPI cooldown is active. No provider requests were made. Retry after blockedUntil, or pass ignoreCooldown=true only if you intentionally want to override it.', results: [] };
  }

  const candidates = await candidateMatches({ matchId, mode, skipExisting, candidateWindow, before, after, order });
  const selected = candidates.slice(0, limit);
  const results = [];
  let rateLimited = false;
  let cooldown: any = null;

  for (let index = 0; index < selected.length; index += 1) {
    const match = selected[index];
    try {
      const result: any = await collectTheStatsMatchExtras(match, { dryRun, save, includeRaw, timeoutMs, query, endpointMode: mode, delayMs: endpointDelayMs });
      const status = statusFromResult(result);
      const blocked = shouldBlockForRateLimit(result) || Number(result?.error?.status) === 412;
      rateLimited = rateLimited || shouldBlockForRateLimit(result);
      await recordProviderRequest({ provider: PROVIDER, route: `safe-old-backfill:${mode}`, providerMatchId: providerMatchNumber(result?.resolvedProviderMatchId), status, ok: Boolean(result?.ok), reason: result?.invalidProviderMatchId ? 'invalid_provider_match_id' : result?.rateLimited ? 'rate_limited' : result?.advice || null }).catch(() => null);
      if (rateLimited && !cooldown) cooldown = await setRateLimitCooldown('TheStatsAPI returned 429 during safe old backfill', cooldownHours);
      results.push({ matchId: match.id, match: matchLabel(match), matchDate: match.matchDate, mode, ok: Boolean(result?.ok), saved: Boolean(result?.saved), snapshotId: result?.snapshotId || null, resolvedProviderMatchId: result?.resolvedProviderMatchId || null, resolvedBy: result?.resolvedBy || null, invalidProviderMatchId: Boolean(result?.invalidProviderMatchId), providerBlocked: blocked, rateLimited: Boolean(result?.rateLimited), counts: result?.counts || null, endpointsOk: result?.endpointsOk || [], endpointsFailed: result?.endpointsFailed || [], error: result?.error || null, advice: result?.advice || null });
      if (stopOnRateLimit && rateLimited) break;
    } catch (error: any) {
      const safe = safeTheStatsApiError(error);
      const status = Number(safe.status) || null;
      rateLimited = rateLimited || status === 429;
      await recordProviderRequest({ provider: PROVIDER, route: `safe-old-backfill:${mode}`, status, ok: false, reason: safe.code || safe.message || null }).catch(() => null);
      if (rateLimited && !cooldown) cooldown = await setRateLimitCooldown('TheStatsAPI returned 429 while resolving provider match id', cooldownHours);
      results.push({ matchId: match.id, match: matchLabel(match), matchDate: match.matchDate, mode, ok: false, saved: false, providerBlocked: status === 429 || status === 412, rateLimited: status === 429, error: safe });
      if (stopOnRateLimit && status === 429) break;
    }
    if (index < selected.length - 1 && matchDelayMs > 0) await sleep(matchDelayMs);
  }
  const lastProcessed = results[results.length - 1] || null;
  return { mode, dryRun, saveRequested: save, skipExisting, limit, candidateWindow, selected: selected.length, processed: results.length, saved: results.filter((item: any) => item.saved).length, successful: results.filter((item: any) => item.ok).length, failed: results.filter((item: any) => !item.ok).length, rateLimited, cooldownActive: Boolean(cooldown), blockedUntil: cooldown?.blockedUntil || null, next: lastProcessed?.matchDate ? { before: order === 'desc' ? lastProcessed.matchDate : undefined, after: order === 'asc' ? lastProcessed.matchDate : undefined, order } : null, advice: rateLimited ? '429/rate limit detected. Cooldown was saved; stop now and retry after blockedUntil. Use limit=1 with higher endpointDelayMs/matchDelayMs when retrying.' : selected.length === 0 ? 'No eligible finished matches found for this mode. Try another phase or set skipExisting=false for verification.' : 'Safe batch complete. Run the same URL again to continue, or move to the next mode after this mode finishes.', results };
}
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const mode = modeParam(url.searchParams.get('mode') || url.searchParams.get('phase'));
  const sequence = phaseSequenceFromParam(url.searchParams.get('sequence'));
  try {
    if (sequence?.length) {
      const phaseResults = [];
      for (const phase of sequence) {
        const result = await runSingleMode(req, phase);
        phaseResults.push(result);
        if (result.rateLimited) break;
        const phasePauseMs = int(url.searchParams.get('phasePauseMs'), 5000, 0, 30000);
        if (phasePauseMs > 0) await sleep(phasePauseMs);
      }
      return json({ ok: true, provider: PROVIDER, mode: 'safe_old_backfill_sequence', sequence, phaseResults, config: getTheStatsApiConfigStatus() });
    }
    const result = await runSingleMode(req, mode);
    return json({ ok: true, provider: PROVIDER, mode: 'safe_old_backfill', ...result, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: PROVIDER, mode: 'safe_old_backfill', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}
export async function POST(req: Request) { return GET(req); }
