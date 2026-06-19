import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];
const LIVE = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET'];
const DEFAULT_PUBLIC_ORIGIN = 'https://worldcup.mcprim.com';

type Stage = { name: string; ok?: boolean; skipped?: boolean; url?: string; status?: number | null; body?: any; error?: string; durationMs?: number };

function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function secret() { return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim(); }
function maskUrl(value: string) { return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***'); }
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }); }
function cleanOrigin(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin; } catch { return null; }
}
function publicOrigin(req: Request, currentUrl: URL) {
  const explicit = cleanOrigin(process.env.LIVE_SYNC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL);
  if (explicit) return explicit;
  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.get('host') || '').split(',')[0].trim();
  const proto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
  const headerOrigin = cleanOrigin(host ? `${proto}://${host}` : null);
  if (headerOrigin && !headerOrigin.includes('localhost') && !headerOrigin.includes('127.0.0.1')) return headerOrigin;
  if (!currentUrl.origin.includes('localhost') && !currentUrl.origin.includes('127.0.0.1')) return currentUrl.origin;
  return DEFAULT_PUBLIC_ORIGIN;
}
function withSecrets(url: URL, key: string) {
  url.searchParams.set('key', key);
  url.searchParams.set('adminSecret', key);
  url.searchParams.set('cronSecret', key);
  return url;
}
async function callJson(name: string, url: URL, timeoutMs = 30_000): Promise<Stage> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    return { name, ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, url: maskUrl(url.toString()), body };
  } catch (error: any) {
    return { name, ok: false, status: null, durationMs: Date.now() - startedAt, url: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 1000) };
  } finally { clearTimeout(timer); }
}
async function selectActiveMatches(minutesBack: number, minutesForward: number, limit: number) {
  const now = Date.now();
  return prisma.match.findMany({
    where: { OR: [
      { status: { in: LIVE } },
      { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) }, status: { notIn: FINISHED } },
    ] },
    include: { homeTeam: { select: { name: true, code: true } }, awayTeam: { select: { name: true, code: true } } },
    orderBy: { matchDate: 'asc' },
    take: limit,
  });
}
function resultsFromCatchupBody(body: any): any[] { return Array.isArray(body?.results) ? body.results : []; }
function catchupResultFromBody(body: any, matchId: string) { return resultsFromCatchupBody(body).find((item: any) => String(item?.matchId || '') === matchId) || null; }
function resolvedIdsFromTheStats(body: any) {
  const map = new Map<string, string>();
  for (const item of resultsFromCatchupBody(body)) if (item?.matchId && item?.resolvedProviderMatchId) map.set(String(item.matchId), String(item.resolvedProviderMatchId));
  return map;
}
function hasOfficialTheStatsTimeline(result: any, minEvents: number) { return Boolean(result?.timelineOk !== false && Number(result?.providerEventsFound || 0) >= minEvents); }
function isNotLiveConflict(result: any) {
  const error = result?.liveStatsError || result?.error;
  const status = Number(error?.status || error?.payload?.error?.status_code || 0);
  const message = [error?.message, error?.code, error?.payload?.error?.message, error?.payload?.error?.code].map((v) => String(v || '').toLowerCase()).join(' ');
  return status === 409 && (message.includes('not live') || message.includes('conflict'));
}
async function autoFinishFromOfficialTimeline(match: any, result: any, dryRun: boolean) {
  const latestMinute = Number(result?.latestMinute || 0);
  const providerEventsFound = Number(result?.providerEventsFound || 0);
  const shouldFinish = isNotLiveConflict(result) && providerEventsFound > 0 && latestMinute >= 90;
  if (!shouldFinish) return { checked: true, shouldFinish: false, reason: 'official_timeline_does_not_confirm_finished', isNotLiveConflict: isNotLiveConflict(result), latestMinute, providerEventsFound };
  if (!dryRun && String(match.status || '').toUpperCase() !== 'FINISHED') await prisma.match.update({ where: { id: match.id }, data: { status: 'FINISHED' } });
  return { checked: true, shouldFinish: true, updated: !dryRun, reason: 'TheStats timeline exists, latestMinute >= 90, and live-stats says match is not live', latestMinute, providerEventsFound };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const key = secret();
  if (!key) return json({ ok: false, error: 'CRON_SECRET or ADMIN_API_SECRET is required' }, 500);

  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const forceCoreISports = bool(url.searchParams.get('forceCoreISports'), true);
  const runTheStats = bool(url.searchParams.get('theStats'), true);
  const runLineups = bool(url.searchParams.get('lineups'), true);
  const runISports = forceCoreISports || bool(url.searchParams.get('isports'), true);
  const runISportStats = forceCoreISports || bool(url.searchParams.get('isportStats'), true);
  const runISportVisualStats = bool(url.searchParams.get('isportVisualStats'), false);
  const runDedupe = bool(url.searchParams.get('dedupe'), true);
  const mapISports = forceCoreISports || bool(url.searchParams.get('mapISports'), true);
  const runISportSafeCron = runISports && bool(url.searchParams.get('isportSafeCron'), true);
  const perMatchISports = bool(url.searchParams.get('perMatchISports'), Boolean(url.searchParams.get('dbMatchId') || url.searchParams.get('id') || url.searchParams.get('matchId')));
  const autoFinish = bool(url.searchParams.get('autoFinish'), true);
  const officialTimelineMinEvents = int(url.searchParams.get('officialTimelineMinEvents'), 1, 1, 500);
  const isportStatsTimeoutMs = int(url.searchParams.get('isportStatsTimeoutMs'), 30000, 5000, 80000);
  const isportStatsWaitMs = int(url.searchParams.get('isportStatsWaitMs'), 6000, 1000, 35000);
  const limit = int(url.searchParams.get('limit'), 8, 1, 20);
  const minutesBack = int(url.searchParams.get('minutesBack'), 240, 15, 480);
  const minutesForward = int(url.searchParams.get('minutesForward'), 300, 0, 360);
  const delayMs = int(url.searchParams.get('delayMs'), 250, 0, 5000);

  const out: any = {
    ok: true,
    mode: 'live_match_full_sync_official_first',
    dryRun,
    publicOrigin: origin,
    matchesFound: 0,
    policy: {
      theStats: 'primary source for live-stats, timeline, score, official lineups, post-match stats, and events',
      iSport: runISportSafeCron ? 'cron-safe visual/fallback layer; no heavy per-match pulls by default' : 'disabled unless explicitly enabled',
      perMatchISports,
      iSportMapping: mapISports ? 'enabled to map animationMatchId values' : 'disabled',
      database: 'frontend reads database snapshots/events only',
      officialTimelineMinEvents,
    },
    iSportLiveMap: null,
    iSportSafeSync: null,
    theStatsCatchup: null,
    theStatsLineups: null,
    perMatch: [] as any[],
  };

  if (mapISports) {
    const liveMap = withSecrets(new URL('/api/cron/live-market-sync', origin), key);
    liveMap.searchParams.set('forceLive', 'true');
    liveMap.searchParams.set('forceProviderFetch', 'true');
    out.iSportLiveMap = await callJson('isports_live_map', liveMap, 15_000);
  }

  const matches = await selectActiveMatches(minutesBack, minutesForward, limit);
  out.matchesFound = matches.length;

  if (runTheStats) {
    const catchup = withSecrets(new URL('/api/admin/the-stats-live-catchup', origin), key);
    catchup.searchParams.set('dryRun', String(dryRun));
    catchup.searchParams.set('limit', String(limit));
    catchup.searchParams.set('minutesBack', String(minutesBack));
    catchup.searchParams.set('minutesForward', String(minutesForward));
    catchup.searchParams.set('skipSimilarExisting', 'true');
    out.theStatsCatchup = await callJson('the_stats_live_stats_and_timeline', catchup, 30_000);
  }

  if (runLineups) {
    const lineups = withSecrets(new URL('/api/admin/the-stats-lineups-sync', origin), key);
    lineups.searchParams.set('dryRun', String(dryRun));
    lineups.searchParams.set('limit', String(limit));
    lineups.searchParams.set('minutesBack', String(Math.min(minutesBack, 180)));
    lineups.searchParams.set('minutesForward', String(Math.min(Math.max(minutesForward, 120), 360)));
    out.theStatsLineups = await callJson('the_stats_official_lineups', lineups, 22_000);
  }

  if (runISportSafeCron) {
    const safe = withSecrets(new URL('/api/cron/isports-live-sync', origin), key);
    safe.searchParams.set('take', String(int(url.searchParams.get('isportsTake'), 3, 1, 5)));
    safe.searchParams.set('save', String(!dryRun));
    safe.searchParams.set('replace', 'true');
    safe.searchParams.set('includeTimeline', 'true');
    safe.searchParams.set('includeFlash', String(runISportStats));
    safe.searchParams.set('asyncFlash', 'true');
    safe.searchParams.set('includeLive', String(runISportVisualStats));
    safe.searchParams.set('asyncLive', 'true');
    safe.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
    safe.searchParams.set('waitMs', String(isportStatsWaitMs));
    out.iSportSafeSync = await callJson('isports_safe_visual_fallback', safe, 12_000);
  }

  const providerIds = resolvedIdsFromTheStats((out.theStatsCatchup as any)?.body);
  for (const [index, match] of matches.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const theStatsMatchResult = runTheStats ? catchupResultFromBody((out.theStatsCatchup as any)?.body, match.id) : null;
    const item: any = {
      matchId: match.id,
      teams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      previousStatus: match.status,
      externalId: match.externalId,
      animationMatchId: match.animationMatchId,
      resolvedTheStatsMatchId: providerIds.get(match.id) || null,
      officialTheStatsTimelineAvailable: hasOfficialTheStatsTimeline(theStatsMatchResult, officialTimelineMinEvents),
      theStatsAutoFinish: null,
      isportsTimeline: null,
      isportsStats: null,
      isportsVisualStats: null,
      dedupe: null,
    };

    if (autoFinish && theStatsMatchResult) item.theStatsAutoFinish = await autoFinishFromOfficialTimeline(match, theStatsMatchResult, dryRun);

    if (perMatchISports && runISports && match.animationMatchId) {
      const isports = withSecrets(new URL('/api/internal/live-ingest/isports/remote-frame-pull-v4', origin), key);
      isports.searchParams.set('mode', 'timeline');
      isports.searchParams.set('matchId', String(match.animationMatchId));
      isports.searchParams.set('dbMatchId', match.id);
      isports.searchParams.set('save', String(!dryRun));
      isports.searchParams.set('replace', 'true');
      item.isportsTimeline = await callJson('isports_timeline_direct', isports, 35_000);
    } else if (runISports) {
      item.isportsTimeline = { skipped: true, reason: perMatchISports ? 'No animationMatchId mapped for this match' : 'Handled by cron-safe iSport sync' };
    }

    if (perMatchISports && runISports && runISportStats && match.animationMatchId) {
      const stats = withSecrets(new URL('/api/internal/live-ingest/isports/remote-flash-pull', origin), key);
      stats.searchParams.set('mode', 'live');
      stats.searchParams.set('matchId', String(match.animationMatchId));
      stats.searchParams.set('dbMatchId', match.id);
      stats.searchParams.set('save', String(!dryRun));
      stats.searchParams.set('replace', 'true');
      stats.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
      stats.searchParams.set('waitMs', String(isportStatsWaitMs));
      item.isportsStats = await callJson('isports_flash_direct', stats, Math.min(60_000, isportStatsTimeoutMs + isportStatsWaitMs + 10_000));
    } else if (runISports && runISportStats) {
      item.isportsStats = { skipped: true, reason: perMatchISports ? 'No animationMatchId mapped for iSport flash stats' : 'Handled by cron-safe iSport sync' };
    }

    if (perMatchISports && runISports && runISportVisualStats && match.animationMatchId) {
      const visual = withSecrets(new URL('/api/internal/live-ingest/isports/remote-visual-stats-pull', origin), key);
      visual.searchParams.set('matchId', String(match.animationMatchId));
      visual.searchParams.set('dbMatchId', match.id);
      visual.searchParams.set('save', String(!dryRun));
      visual.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
      visual.searchParams.set('waitMs', String(isportStatsWaitMs));
      item.isportsVisualStats = await callJson('isports_visual_direct', visual, Math.min(60_000, isportStatsTimeoutMs + isportStatsWaitMs + 10_000));
    } else if (runISports && runISportVisualStats) {
      item.isportsVisualStats = { skipped: true, reason: perMatchISports ? 'No animationMatchId mapped for iSport visual stats' : 'Handled by cron-safe iSport sync' };
    }

    if (runDedupe) {
      const dedupe = withSecrets(new URL('/api/admin/match-events-dedupe', origin), key);
      dedupe.searchParams.set('matchId', match.id);
      dedupe.searchParams.set('dryRun', String(dryRun));
      dedupe.searchParams.set('preferTheStats', 'true');
      dedupe.searchParams.set('preferTheStatsMinEvents', String(officialTimelineMinEvents));
      item.dedupe = await callJson('dedupe_the_stats_first', dedupe, 18_000);
    }

    out.perMatch.push(item);
  }

  return json(out);
}

export async function POST(req: Request) { return GET(req); }
