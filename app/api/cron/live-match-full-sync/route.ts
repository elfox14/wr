import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];
const LIVE = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET'];
const DEFAULT_PUBLIC_ORIGIN = 'https://worldcup.mcprim.com';

type StageResult = { name: string; ok: boolean; skipped?: boolean; status?: number | null; url?: string; durationMs?: number; body?: any; error?: string };

function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function secret() {
  return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim();
}

function maskUrl(value: string) {
  return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***');
}

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function cleanOrigin(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function publicOrigin(req: Request, currentUrl: URL) {
  const explicit = cleanOrigin(process.env.LIVE_SYNC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL);
  if (explicit) return explicit;
  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.get('host') || '').split(',')[0].trim();
  const forwardedProto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
  const headerOrigin = cleanOrigin(host ? `${forwardedProto}://${host}` : null);
  if (headerOrigin && !headerOrigin.includes('localhost') && !headerOrigin.includes('127.0.0.1')) return headerOrigin;
  if (!currentUrl.origin.includes('localhost') && !currentUrl.origin.includes('127.0.0.1')) return currentUrl.origin;
  return DEFAULT_PUBLIC_ORIGIN;
}

async function callJson(name: string, url: URL, timeoutMs = 45000): Promise<StageResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    return { name, ok: res.ok, status: res.status, url: maskUrl(url.toString()), durationMs: Date.now() - startedAt, body };
  } catch (error: any) {
    return { name, ok: false, status: null, url: maskUrl(url.toString()), durationMs: Date.now() - startedAt, error: String(error?.message || error).slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

function withSecret(url: URL, key: string) {
  url.searchParams.set('key', key);
  url.searchParams.set('adminSecret', key);
  url.searchParams.set('cronSecret', key);
  return url;
}

async function selectSyncMatches(minutesBack: number, minutesForward: number, limit: number) {
  const now = Date.now();
  return prisma.match.findMany({
    where: {
      OR: [
        { status: { in: LIVE } },
        { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) }, status: { notIn: FINISHED } },
        { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + 30 * 60_000) }, status: { in: FINISHED } },
      ],
    },
    include: {
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 8, select: { id: true, provider: true, rawData: true, capturedAt: true } },
    },
    orderBy: { matchDate: 'asc' },
    take: limit,
  });
}

function resultRows(body: any): any[] {
  return Array.isArray(body?.results) ? body.results : [];
}

function catchupResult(body: any, matchId: string) {
  return resultRows(body).find((item: any) => String(item?.matchId || '') === matchId) || null;
}

function providerIdsFromCatchup(body: any) {
  const map = new Map<string, string>();
  for (const item of resultRows(body)) {
    if (item?.matchId && item?.resolvedProviderMatchId) map.set(String(item.matchId), String(item.resolvedProviderMatchId));
  }
  return map;
}

function hasLineupSnapshot(match: any) {
  return (match.statsSnapshots || []).some((snapshot: any) => {
    const data = snapshot?.rawData as any;
    const lineup = data?.lineup || data?.lineups || data?.theStatsApi?.lineup;
    if (!lineup || lineup.error) return false;
    const home = lineup.home || lineup.homeTeam;
    const away = lineup.away || lineup.awayTeam;
    const homeCount = Number(home?.startingXi?.length || home?.starting_xi?.length || home?.lineup?.length || 0);
    const awayCount = Number(away?.startingXi?.length || away?.starting_xi?.length || away?.lineup?.length || 0);
    return homeCount + awayCount > 0;
  });
}

function hasOfficialTimeline(result: any, minEvents: number) {
  return Boolean(result?.timelineOk !== false && Number(result?.providerEventsFound || 0) >= minEvents);
}

function isNotLiveConflict(result: any) {
  const error = result?.liveStatsError || result?.error;
  const status = Number(error?.status || error?.payload?.error?.status_code || 0);
  const message = [error?.message, error?.code, error?.payload?.error?.message, error?.payload?.error?.code].map((value) => String(value || '').toLowerCase()).join(' ');
  return status === 409 && (message.includes('not live') || message.includes('conflict'));
}

function isFinishedStatus(status: any) {
  return FINISHED.includes(String(status || '').toUpperCase());
}

async function autoFinishFromTheStats(match: any, result: any, dryRun: boolean) {
  const latestMinute = Number(result?.latestMinute || 0);
  const providerEventsFound = Number(result?.providerEventsFound || 0);
  const shouldFinish = isNotLiveConflict(result) && providerEventsFound > 0 && latestMinute >= 90;
  if (!shouldFinish) return { checked: true, shouldFinish: false, isNotLiveConflict: isNotLiveConflict(result), latestMinute, providerEventsFound };
  if (!dryRun && !isFinishedStatus(match.status)) await prisma.match.update({ where: { id: match.id }, data: { status: 'FINISHED' } });
  return { checked: true, shouldFinish: true, updated: !dryRun, latestMinute, providerEventsFound };
}

function makeUrl(origin: string, path: string, key: string) {
  return withSecret(new URL(path, origin), key);
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const key = secret();
  if (!key) return json({ ok: false, error: 'CRON_SECRET or ADMIN_API_SECRET is required' }, 500);

  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const runTheStats = bool(url.searchParams.get('theStats'), true);
  const runISports = bool(url.searchParams.get('isports'), true);
  const runISportStats = bool(url.searchParams.get('isportStats'), true);
  const runISportVisualStats = bool(url.searchParams.get('isportVisualStats'), false);
  const runDedupe = bool(url.searchParams.get('dedupe'), true);
  const mapISports = bool(url.searchParams.get('mapISports'), true);
  const runEnrichment = bool(url.searchParams.get('theStatsEnrichment'), true);
  const enrichLineups = bool(url.searchParams.get('enrichLineups'), true);
  const postmatchTheStats = bool(url.searchParams.get('postmatchTheStats'), true);
  const autoFinish = bool(url.searchParams.get('autoFinish'), true);
  const officialTimelineMinEvents = int(url.searchParams.get('officialTimelineMinEvents'), 1, 1, 500);
  const isportStatsTimeoutMs = int(url.searchParams.get('isportStatsTimeoutMs'), 30000, 5000, 80000);
  const isportStatsWaitMs = int(url.searchParams.get('isportStatsWaitMs'), 6000, 1000, 35000);
  const limit = int(url.searchParams.get('limit'), 8, 1, 20);
  const minutesBack = int(url.searchParams.get('minutesBack'), 240, 15, 720);
  const minutesForward = int(url.searchParams.get('minutesForward'), 300, 0, 360);
  const delayMs = int(url.searchParams.get('delayMs'), 500, 0, 5000);

  const out: any = {
    ok: true,
    mode: 'live_match_full_sync',
    dryRun,
    publicOrigin: origin,
    matchesFound: 0,
    policy: {
      theStats: 'primary provider for official stats, final timeline, and post-match replacement',
      iSport: 'core live provider for animation timeline and flash stats while TheStats live events are incomplete',
      lineups: 'TheStats enrichment is called automatically until official lineup appears in snapshots',
      postmatch: 'when TheStats timeline is available, dedupe removes iSport timeline events to prevent duplicates',
      cancelledGoals: 'dedupe keeps cancelled/disallowed goals separate from valid goals',
      officialTimelineMinEvents,
    },
    iSportLiveMap: null,
    theStatsCatchup: null,
    perMatch: [] as any[],
  };

  if (mapISports) {
    const liveMap = makeUrl(origin, '/api/cron/live-market-sync', key);
    liveMap.searchParams.set('forceLive', 'true');
    liveMap.searchParams.set('forceProviderFetch', 'true');
    out.iSportLiveMap = await callJson('isport_live_map', liveMap, 45000);
  }

  const matches = await selectSyncMatches(minutesBack, minutesForward, limit);
  out.matchesFound = matches.length;

  let providerIds = new Map<string, string>();
  if (runTheStats) {
    const catchup = makeUrl(origin, '/api/admin/the-stats-live-catchup', key);
    catchup.searchParams.set('dryRun', String(dryRun));
    catchup.searchParams.set('limit', String(limit));
    catchup.searchParams.set('minutesBack', String(minutesBack));
    catchup.searchParams.set('minutesForward', String(minutesForward));
    catchup.searchParams.set('skipSimilarExisting', 'true');
    out.theStatsCatchup = await callJson('the_stats_live_catchup', catchup, 65000);
    providerIds = providerIdsFromCatchup(out.theStatsCatchup?.body);
  }

  for (const [index, match] of matches.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const theStatsResult = runTheStats ? catchupResult(out.theStatsCatchup?.body, match.id) : null;
    const providerMatchId = providerIds.get(match.id) || (String(match.externalId || '').startsWith('mt_') ? String(match.externalId) : null);
    const item: any = {
      matchId: match.id,
      teams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      previousStatus: match.status,
      externalId: match.externalId,
      animationMatchId: match.animationMatchId,
      providerMatchId,
      theStatsEventsFound: Number(theStatsResult?.providerEventsFound || 0),
      officialTheStatsTimelineAvailable: hasOfficialTimeline(theStatsResult, officialTimelineMinEvents),
      hasOfficialLineupSnapshot: hasLineupSnapshot(match),
      theStatsAutoFinish: null,
      lineupsEnrichment: null,
      postmatchEnrichment: null,
      isportsTimeline: null,
      isportsStats: null,
      isportsVisualStats: null,
      dedupe: null,
    };

    if (autoFinish && theStatsResult) item.theStatsAutoFinish = await autoFinishFromTheStats(match, theStatsResult, dryRun);

    const finishedNow = isFinishedStatus(match.status) || item.theStatsAutoFinish?.shouldFinish || isNotLiveConflict(theStatsResult);
    const shouldLineupEnrich = runTheStats && runEnrichment && enrichLineups && !item.hasOfficialLineupSnapshot;
    const shouldFinalEnrich = runTheStats && runEnrichment && postmatchTheStats && finishedNow;

    if (shouldLineupEnrich || shouldFinalEnrich) {
      const enrichment = makeUrl(origin, '/api/admin/the-stats-import-match-enrichment', key);
      enrichment.searchParams.set('matchId', match.id);
      enrichment.searchParams.set('dryRun', String(dryRun));
      enrichment.searchParams.set('importEvents', String(shouldFinalEnrich));
      if (providerMatchId) enrichment.searchParams.set('providerMatchId', providerMatchId);
      const stageName = shouldFinalEnrich ? 'the_stats_postmatch_enrichment' : 'the_stats_lineup_enrichment';
      const result = await callJson(stageName, enrichment, 65000);
      if (shouldFinalEnrich) item.postmatchEnrichment = result;
      else item.lineupsEnrichment = result;
    }

    if (runISports && match.animationMatchId) {
      const isports = makeUrl(origin, '/api/internal/live-ingest/isports/remote-frame-pull-v4', key);
      isports.searchParams.set('mode', 'timeline');
      isports.searchParams.set('matchId', String(match.animationMatchId));
      isports.searchParams.set('dbMatchId', match.id);
      isports.searchParams.set('save', String(!dryRun));
      isports.searchParams.set('replace', 'true');
      item.isportsTimeline = await callJson('isports_animation_timeline', isports, 70000);
    } else if (runISports) {
      item.isportsTimeline = { name: 'isports_animation_timeline', ok: true, skipped: true, reason: 'No animationMatchId mapped for this match' };
    }

    if (runISports && runISportStats && match.animationMatchId) {
      const stats = makeUrl(origin, '/api/internal/live-ingest/isports/remote-flash-pull', key);
      stats.searchParams.set('mode', 'live');
      stats.searchParams.set('matchId', String(match.animationMatchId));
      stats.searchParams.set('dbMatchId', match.id);
      stats.searchParams.set('save', String(!dryRun));
      stats.searchParams.set('replace', 'true');
      stats.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
      stats.searchParams.set('waitMs', String(isportStatsWaitMs));
      item.isportsStats = await callJson('isports_flash_stats', stats, Math.min(85000, isportStatsTimeoutMs + isportStatsWaitMs + 20000));
    } else if (runISports && runISportStats) {
      item.isportsStats = { name: 'isports_flash_stats', ok: true, skipped: true, reason: 'No animationMatchId mapped for this match' };
    }

    if (runISports && runISportVisualStats && match.animationMatchId) {
      const visual = makeUrl(origin, '/api/internal/live-ingest/isports/remote-visual-stats-pull', key);
      visual.searchParams.set('matchId', String(match.animationMatchId));
      visual.searchParams.set('dbMatchId', match.id);
      visual.searchParams.set('save', String(!dryRun));
      visual.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
      visual.searchParams.set('waitMs', String(isportStatsWaitMs));
      item.isportsVisualStats = await callJson('isports_visual_stats', visual, Math.min(85000, isportStatsTimeoutMs + isportStatsWaitMs + 20000));
    }

    if (runDedupe) {
      const dedupe = makeUrl(origin, '/api/admin/match-events-dedupe', key);
      dedupe.searchParams.set('matchId', match.id);
      dedupe.searchParams.set('dryRun', String(dryRun));
      dedupe.searchParams.set('preferTheStats', 'true');
      dedupe.searchParams.set('preferTheStatsMinEvents', String(officialTimelineMinEvents));
      item.dedupe = await callJson('match_events_dedupe', dedupe, 30000);
    }

    out.perMatch.push(item);
  }

  return json(out);
}

export async function POST(req: Request) { return GET(req); }
