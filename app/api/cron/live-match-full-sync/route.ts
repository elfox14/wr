import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];
const LIVE = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET'];
const DEFAULT_PUBLIC_ORIGIN = 'https://worldcup.mcprim.com';

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
  const explicit = cleanOrigin(
    process.env.LIVE_SYNC_PUBLIC_ORIGIN
      || process.env.NEXT_PUBLIC_SITE_URL
      || process.env.NEXTAUTH_URL
      || process.env.APP_URL
  );
  if (explicit) return explicit;

  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.get('host') || '').split(',')[0].trim();
  const forwardedProto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
  const headerOrigin = cleanOrigin(host ? `${forwardedProto}://${host}` : null);
  if (headerOrigin && !headerOrigin.includes('localhost') && !headerOrigin.includes('127.0.0.1')) return headerOrigin;

  if (!currentUrl.origin.includes('localhost') && !currentUrl.origin.includes('127.0.0.1')) return currentUrl.origin;
  return DEFAULT_PUBLIC_ORIGIN;
}

async function callJson(url: URL, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, url: maskUrl(url.toString()), body };
  } catch (error: any) {
    return { ok: false, status: null, url: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

async function postBrowserlessWake(endpoint: string | null, timeoutMs = 20000) {
  if (!endpoint) return { skipped: true, reason: 'no_fallback_endpoint' };
  const url = new URL(endpoint);
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/content';
  const token = process.env.BROWSERLESS_FALLBACK_TOKEN || process.env.BROWSERLESS_BACKUP_TOKEN;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'text/html,application/json,*/*' },
      body: JSON.stringify({ url: 'https://example.com', bestAttempt: true, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 10000 }, waitForTimeout: 1000 }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, endpoint: maskUrl(url.toString()), rawLength: text.length, sample: text.slice(0, 120) };
  } catch (error: any) {
    return { ok: false, endpoint: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

async function selectActiveMatches(minutesBack: number, minutesForward: number, limit: number) {
  const now = Date.now();
  return prisma.match.findMany({
    where: {
      OR: [
        { status: { in: LIVE } },
        { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) }, status: { notIn: FINISHED } },
      ],
    },
    include: { homeTeam: { select: { name: true, code: true } }, awayTeam: { select: { name: true, code: true } } },
    orderBy: { matchDate: 'asc' },
    take: limit,
  });
}

function resultsFromCatchupBody(body: any): any[] {
  return Array.isArray(body?.results) ? body.results : [];
}

function resolvedIdsFromTheStats(body: any) {
  const map = new Map<string, string>();
  for (const item of resultsFromCatchupBody(body)) {
    if (item?.matchId && item?.resolvedProviderMatchId) map.set(String(item.matchId), String(item.resolvedProviderMatchId));
  }
  return map;
}

function catchupResultFromBody(body: any, matchId: string) {
  return resultsFromCatchupBody(body).find((item: any) => String(item?.matchId || '') === matchId) || null;
}

function providerIdFromCatchupBody(body: any, matchId: string) {
  const found = catchupResultFromBody(body, matchId);
  return String(found?.resolvedProviderMatchId || '').trim() || null;
}

function hasOfficialTheStatsTimeline(result: any, minEvents: number) {
  return Boolean(result?.timelineOk !== false && Number(result?.providerEventsFound || 0) >= minEvents);
}

function isNotLiveConflict(result: any) {
  const error = result?.liveStatsError || result?.error;
  const status = Number(error?.status || error?.payload?.error?.status_code || 0);
  const message = [
    error?.message,
    error?.code,
    error?.payload?.error?.message,
    error?.payload?.error?.code,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return status === 409 && (message.includes('not live') || message.includes('conflict'));
}

async function autoFinishFromOfficialTimeline(match: any, result: any, dryRun: boolean) {
  const latestMinute = Number(result?.latestMinute || 0);
  const providerEventsFound = Number(result?.providerEventsFound || 0);
  const shouldFinish = isNotLiveConflict(result) && providerEventsFound > 0 && latestMinute >= 90;
  if (!shouldFinish) {
    return {
      checked: true,
      shouldFinish: false,
      reason: 'official_timeline_does_not_confirm_finished',
      isNotLiveConflict: isNotLiveConflict(result),
      latestMinute,
      providerEventsFound,
    };
  }
  if (!dryRun && String(match.status || '').toUpperCase() !== 'FINISHED') {
    await prisma.match.update({ where: { id: match.id }, data: { status: 'FINISHED' } });
  }
  return {
    checked: true,
    shouldFinish: true,
    updated: !dryRun,
    reason: 'TheStats timeline exists, latestMinute >= 90, and live-stats says match is not live',
    latestMinute,
    providerEventsFound,
  };
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
  const wakeFallback = bool(url.searchParams.get('wakeFallback'), true);
  const mapISports = bool(url.searchParams.get('mapISports'), true);
  const updateStatusFromStats = bool(url.searchParams.get('updateStatusFromStats'), false);
  const forceStatsOnly = bool(url.searchParams.get('forceStatsOnly'), false);
  const autoFinish = bool(url.searchParams.get('autoFinish'), true);
  const isportFallbackOnly = bool(url.searchParams.get('isportFallbackOnly'), true);
  const officialTimelineMinEvents = int(url.searchParams.get('officialTimelineMinEvents'), 5, 1, 500);
  const isportStatsTimeoutMs = int(url.searchParams.get('isportStatsTimeoutMs'), 30000, 5000, 80000);
  const isportStatsWaitMs = int(url.searchParams.get('isportStatsWaitMs'), 6000, 1000, 35000);
  const limit = int(url.searchParams.get('limit'), 8, 1, 20);
  const minutesBack = int(url.searchParams.get('minutesBack'), 210, 15, 480);
  const minutesForward = int(url.searchParams.get('minutesForward'), 45, 0, 240);
  const delayMs = int(url.searchParams.get('delayMs'), 750, 0, 5000);

  const out: any = {
    ok: true,
    mode: 'live_match_full_sync',
    dryRun,
    publicOrigin: origin,
    internalRequestOrigin: url.origin,
    matchesFound: 0,
    policy: {
      theStats: 'primary source for score, status, and live stats',
      iSport: isportFallbackOnly ? 'fallback only when official TheStats timeline is not available' : 'fallback animation timeline events when animationMatchId exists',
      iSportStats: 'iSport flashdata stats are saved as ISPORTS_FLASH to fill attacks, dangerous attacks, score, phase, and corners without requiring Browserless /function',
      iSportVisualStats: runISportVisualStats ? 'optional visual stats are enabled for possession/shots from the rendered page' : 'optional visual stats are disabled by default because /function is not available on the backup browser',
      iSportMapping: 'live-market-sync runs first to map missing animationMatchId values from the iSport live feed',
      database: 'last successful snapshot/events remain visible if a provider fails',
      dedupe: 'removes duplicates after provider pulls; official TheStats timeline replaces iSport fallback when available',
      rateLimitProtection: 'stats-only is disabled by default because live-catchup already calls live-stats',
      officialTimelineMinEvents,
    },
    wakeFallback: null,
    iSportLiveMap: null,
    theStatsCatchup: null,
    perMatch: [] as any[],
  };

  if (wakeFallback) {
    out.wakeFallback = await postBrowserlessWake(process.env.BROWSERLESS_FALLBACK_ENDPOINT || process.env.BROWSERLESS_BACKUP_ENDPOINT || 'https://browserless-backup-5k6y.onrender.com');
  }

  if (mapISports) {
    const liveMap = new URL('/api/cron/live-market-sync', origin);
    liveMap.searchParams.set('forceLive', 'true');
    liveMap.searchParams.set('key', key);
    out.iSportLiveMap = await callJson(liveMap, 45000);
  }

  const matches = await selectActiveMatches(minutesBack, minutesForward, limit);
  out.matchesFound = matches.length;

  let providerIds = new Map<string, string>();
  if (runTheStats) {
    const catchup = new URL('/api/admin/the-stats-live-catchup', origin);
    catchup.searchParams.set('dryRun', String(dryRun));
    catchup.searchParams.set('limit', String(limit));
    catchup.searchParams.set('minutesBack', String(minutesBack));
    catchup.searchParams.set('minutesForward', String(minutesForward));
    catchup.searchParams.set('skipSimilarExisting', 'true');
    catchup.searchParams.set('key', key);
    out.theStatsCatchup = await callJson(catchup, 65000);
    providerIds = resolvedIdsFromTheStats((out.theStatsCatchup as any)?.body);
  }

  for (const [index, match] of matches.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    let theStatsMatchResult = runTheStats ? catchupResultFromBody((out.theStatsCatchup as any)?.body, match.id) : null;
    const item: any = {
      matchId: match.id,
      teams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      previousStatus: match.status,
      externalId: match.externalId,
      animationMatchId: match.animationMatchId,
      officialTheStatsTimelineAvailable: false,
      theStatsResolveCatchup: null,
      theStatsAutoFinish: null,
      theStatsStatus: null,
      isportsTimeline: null,
      isportsStats: null,
      isportsVisualStats: null,
      dedupe: null,
    };

    let providerMatchId = providerIds.get(match.id) || (String(match.externalId || '').startsWith('mt_') ? String(match.externalId) : null);
    if (runTheStats && !providerMatchId) {
      const oneCatchup = new URL('/api/admin/the-stats-live-catchup', origin);
      oneCatchup.searchParams.set('matchId', match.id);
      oneCatchup.searchParams.set('dryRun', String(dryRun));
      oneCatchup.searchParams.set('skipSimilarExisting', 'true');
      oneCatchup.searchParams.set('key', key);
      item.theStatsResolveCatchup = await callJson(oneCatchup, 65000);
      theStatsMatchResult = catchupResultFromBody((item.theStatsResolveCatchup as any)?.body, match.id);
      providerMatchId = providerIdFromCatchupBody((item.theStatsResolveCatchup as any)?.body, match.id);
      if (providerMatchId) providerIds.set(match.id, providerMatchId);
    }

    item.officialTheStatsTimelineAvailable = hasOfficialTheStatsTimeline(theStatsMatchResult, officialTimelineMinEvents);

    if (autoFinish && theStatsMatchResult) {
      item.theStatsAutoFinish = await autoFinishFromOfficialTimeline(match, theStatsMatchResult, dryRun);
    }

    if (updateStatusFromStats && providerMatchId && (forceStatsOnly || (!theStatsMatchResult?.liveStatsOk && !isNotLiveConflict(theStatsMatchResult)))) {
      const statsOnly = new URL('/api/admin/the-stats-live-stats-only', origin);
      statsOnly.searchParams.set('matchId', match.id);
      statsOnly.searchParams.set('providerMatchId', providerMatchId);
      statsOnly.searchParams.set('dryRun', String(dryRun));
      statsOnly.searchParams.set('cleanupSyntheticEvents', 'true');
      statsOnly.searchParams.set('key', key);
      item.theStatsStatus = await callJson(statsOnly, 30000);
    } else if (updateStatusFromStats) {
      item.theStatsStatus = { skipped: true, providerMatchId, reason: 'Handled by live-catchup or skipped to avoid duplicate TheStatsAPI live-stats request' };
    } else {
      item.theStatsStatus = { skipped: true, providerMatchId, reason: 'stats-only disabled by default; live-catchup is the primary TheStats sync path' };
    }

    if (runISports && match.animationMatchId) {
      if (isportFallbackOnly && item.officialTheStatsTimelineAvailable) {
        item.isportsTimeline = {
          skipped: true,
          reason: 'Official TheStats timeline is available; iSport fallback not needed for this run',
          providerEventsFound: Number(theStatsMatchResult?.providerEventsFound || 0),
        };
      } else {
        const isports = new URL('/api/internal/live-ingest/isports/remote-frame-pull-v4', origin);
        isports.searchParams.set('mode', 'timeline');
        isports.searchParams.set('matchId', String(match.animationMatchId));
        isports.searchParams.set('dbMatchId', match.id);
        isports.searchParams.set('save', String(!dryRun));
        isports.searchParams.set('replace', 'true');
        isports.searchParams.set('key', key);
        item.isportsTimeline = await callJson(isports, 70000);
      }
    } else if (runISports) {
      item.isportsTimeline = { skipped: true, reason: 'No animationMatchId mapped for this match after iSport live map step' };
    }

    if (runISports && runISportStats && match.animationMatchId) {
      const stats = new URL('/api/internal/live-ingest/isports/remote-flash-pull', origin);
      stats.searchParams.set('mode', 'live');
      stats.searchParams.set('matchId', String(match.animationMatchId));
      stats.searchParams.set('dbMatchId', match.id);
      stats.searchParams.set('save', String(!dryRun));
      stats.searchParams.set('replace', 'true');
      stats.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
      stats.searchParams.set('waitMs', String(isportStatsWaitMs));
      stats.searchParams.set('key', key);
      item.isportsStats = await callJson(stats, Math.min(85000, isportStatsTimeoutMs + isportStatsWaitMs + 20000));
    } else if (runISports && runISportStats) {
      item.isportsStats = { skipped: true, reason: 'No animationMatchId mapped for iSport flash stats' };
    }

    if (runISports && runISportVisualStats && match.animationMatchId) {
      const visual = new URL('/api/internal/live-ingest/isports/remote-visual-stats-pull', origin);
      visual.searchParams.set('matchId', String(match.animationMatchId));
      visual.searchParams.set('dbMatchId', match.id);
      visual.searchParams.set('save', String(!dryRun));
      visual.searchParams.set('timeoutMs', String(isportStatsTimeoutMs));
      visual.searchParams.set('waitMs', String(isportStatsWaitMs));
      visual.searchParams.set('key', key);
      item.isportsVisualStats = await callJson(visual, Math.min(85000, isportStatsTimeoutMs + isportStatsWaitMs + 20000));
    } else if (runISports && runISportVisualStats) {
      item.isportsVisualStats = { skipped: true, reason: 'No animationMatchId mapped for iSport visual stats' };
    }

    if (runDedupe) {
      const dedupe = new URL('/api/admin/match-events-dedupe', origin);
      dedupe.searchParams.set('matchId', match.id);
      dedupe.searchParams.set('dryRun', String(dryRun));
      dedupe.searchParams.set('preferTheStats', 'true');
      dedupe.searchParams.set('preferTheStatsMinEvents', String(officialTimelineMinEvents));
      dedupe.searchParams.set('key', key);
      item.dedupe = await callJson(dedupe, 30000);
    }

    out.perMatch.push(item);
  }

  return json(out);
}

export async function POST(req: Request) { return GET(req); }
