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

function bool(value: string | null, fallback = true) { if (value === null) return fallback; return !['false', '0', 'no', 'off'].includes(value.toLowerCase()); }
function int(value: string | null, fallback: number, min: number, max: number) { const parsed = Number(value ?? fallback); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback; }
function secret() { return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim(); }
function maskUrl(value: string) { return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***'); }
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }); }
function cleanOrigin(value: string | null | undefined) { const raw = String(value || '').trim(); if (!raw) return null; try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin; } catch { return null; } }
function publicOrigin(req: Request, currentUrl: URL) { const explicit = cleanOrigin(process.env.LIVE_SYNC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL); if (explicit) return explicit; const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0].trim(); const host = forwardedHost || String(req.headers.get('host') || '').split(',')[0].trim(); const proto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https'; const headerOrigin = cleanOrigin(host ? `${proto}://${host}` : null); if (headerOrigin && !headerOrigin.includes('localhost') && !headerOrigin.includes('127.0.0.1')) return headerOrigin; if (!currentUrl.origin.includes('localhost') && !currentUrl.origin.includes('127.0.0.1')) return currentUrl.origin; return DEFAULT_PUBLIC_ORIGIN; }
function withSecrets(url: URL, key: string) { url.searchParams.set('key', key); url.searchParams.set('adminSecret', key); url.searchParams.set('cronSecret', key); return url; }
async function callJson(name: string, url: URL, timeoutMs = 30_000): Promise<Stage> { const startedAt = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } }); const text = await res.text(); let body: any = text; try { body = JSON.parse(text); } catch {} return { name, ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, url: maskUrl(url.toString()), body }; } catch (error: any) { return { name, ok: false, status: null, durationMs: Date.now() - startedAt, url: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 1000) }; } finally { clearTimeout(timer); } }
function isFinishedStatus(value: any) { return FINISHED.includes(String(value || '').toUpperCase()); }
function isLiveStatus(value: any) { return LIVE.includes(String(value || '').toUpperCase()); }
function hasRateLimit(stage: any) { const body = stage?.body || {}; const text = JSON.stringify(body).toLowerCase(); return Number(stage?.status) === 429 || text.includes('rate_limited') || text.includes('rate limit'); }
function resultsFromCatchupBody(body: any): any[] { return Array.isArray(body?.results) ? body.results : []; }
function catchupResultFromBody(body: any, matchId: string) { return resultsFromCatchupBody(body).find((item: any) => String(item?.matchId || '') === matchId) || null; }
function resolvedIdFromCatchupBody(body: any, matchId: string) { return catchupResultFromBody(body, matchId)?.resolvedProviderMatchId || null; }
function hasOfficialTheStatsTimeline(result: any, minEvents: number) { return Boolean(result?.timelineOk !== false && Number(result?.providerEventsFound || 0) >= minEvents); }
function isNotLiveConflict(result: any) { const error = result?.liveStatsError || result?.error; const status = Number(error?.status || error?.payload?.error?.status_code || 0); const message = [error?.message, error?.code, error?.payload?.error?.message, error?.payload?.error?.code].map((v) => String(v || '').toLowerCase()).join(' '); return status === 409 && (message.includes('not live') || message.includes('conflict')); }
function usefulMatchInfo(raw: any) { const info = raw?.matchInfo || raw?.normalized?.matchInfo || raw || {}; return Boolean(info?.venue || info?.city || info?.referee); }
async function hasSavedMatchInfo(matchId: string) { const row = await prisma.matchStatsSnapshot.findFirst({ where: { matchId, provider: 'THE_STATS_API_MATCH_INFO' }, orderBy: { capturedAt: 'desc' }, select: { capturedAt: true, rawData: true } }).catch(() => null); return row && usefulMatchInfo(row.rawData) ? { found: true, capturedAt: row.capturedAt } : { found: false, capturedAt: row?.capturedAt || null }; }
async function autoFinishFromOfficialTimeline(match: any, result: any, dryRun: boolean) { const latestMinute = Number(result?.latestMinute || 0); const providerEventsFound = Number(result?.providerEventsFound || 0); const liveStatsOk = Boolean(result?.liveStatsOk); const conflictFinish = isNotLiveConflict(result) && providerEventsFound > 0 && latestMinute >= 90; const staleOverLimitFinish = latestMinute >= 120 && liveStatsOk; const shouldFinish = conflictFinish || staleOverLimitFinish; if (!shouldFinish) return { checked: true, shouldFinish: false, reason: 'official_timeline_does_not_confirm_finished', isNotLiveConflict: isNotLiveConflict(result), latestMinute, providerEventsFound, liveStatsOk }; if (!dryRun && String(match.status || '').toUpperCase() !== 'FINISHED') await prisma.match.update({ where: { id: match.id }, data: { status: 'FINISHED' } }); return { checked: true, shouldFinish: true, updated: !dryRun, reason: staleOverLimitFinish ? 'TheStats live minute reached 120+, so stale IN_PLAY clock was closed as FINISHED' : 'TheStats timeline exists, latestMinute >= 90, and live-stats says match is not live', latestMinute, providerEventsFound, liveStatsOk }; }

function priorityScore(match: any, now: number) {
  const status = String(match.status || '').toUpperCase();
  const time = new Date(match.matchDate).getTime();
  const minutesFromKickoff = Number.isFinite(time) ? Math.abs(now - time) / 60_000 : 99999;
  if (isLiveStatus(status)) return 0 + Math.min(minutesFromKickoff, 240) / 10000;
  if (!isFinishedStatus(status) && time <= now && now - time <= 4 * 60 * 60 * 1000) return 1 + minutesFromKickoff / 10000;
  if (!isFinishedStatus(status) && time > now && time - now <= 90 * 60_000) return 2 + minutesFromKickoff / 10000;
  if (isFinishedStatus(status) && now - time <= 6 * 60 * 60 * 1000) return 3 + minutesFromKickoff / 10000;
  return 9 + minutesFromKickoff / 10000;
}
async function selectActiveMatches(matchId: string, minutesBack: number, minutesForward: number, postMatchMinutes: number, limit: number) {
  const now = Date.now();
  const include = { homeTeam: { select: { name: true, code: true } }, awayTeam: { select: { name: true, code: true } } };
  if (matchId) return prisma.match.findMany({ where: { id: matchId }, include, take: 1 });
  const candidates = await prisma.match.findMany({
    where: { OR: [
      { status: { in: LIVE } },
      { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) }, status: { notIn: FINISHED } },
      { status: { in: FINISHED }, matchDate: { gte: new Date(now - postMatchMinutes * 60_000), lte: new Date(now) } },
    ] },
    include,
    orderBy: { matchDate: 'asc' },
    take: Math.max(20, limit * 4),
  });
  return candidates.sort((a, b) => priorityScore(a, now) - priorityScore(b, now)).slice(0, limit);
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const key = secret();
  if (!key) return json({ ok: false, error: 'CRON_SECRET or ADMIN_API_SECRET is required' }, 500);

  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const requestedMatchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const runTheStats = bool(url.searchParams.get('theStats'), true);
  const runMatchInfo = bool(url.searchParams.get('matchInfo'), true);
  const runTheStatsExtras = bool(url.searchParams.get('theStatsExtras'), false);
  const runTheStatsExtrasRaw = bool(url.searchParams.get('theStatsExtrasRaw'), false);
  const runLineups = bool(url.searchParams.get('lineups'), false);
  const runISports = bool(url.searchParams.get('forceCoreISports'), false) || bool(url.searchParams.get('isports'), false);
  const runISportStats = runISports && bool(url.searchParams.get('isportStats'), false);
  const runISportVisualStats = runISports && bool(url.searchParams.get('isportVisualStats'), false);
  const runDedupe = bool(url.searchParams.get('dedupe'), true);
  const runTheStatsPostmatch = bool(url.searchParams.get('theStatsPostmatch'), true);
  const officialTimelineMinEvents = int(url.searchParams.get('officialTimelineMinEvents'), 1, 1, 500);
  const isportStatsTimeoutMs = int(url.searchParams.get('isportStatsTimeoutMs'), 30000, 5000, 80000);
  const isportStatsWaitMs = int(url.searchParams.get('isportStatsWaitMs'), 6000, 1000, 35000);
  const limit = requestedMatchId ? 1 : int(url.searchParams.get('limit'), 3, 1, 8);
  const minutesBack = int(url.searchParams.get('minutesBack'), 240, 15, 480);
  const minutesForward = int(url.searchParams.get('minutesForward'), 300, 0, 360);
  const postMatchMinutes = int(url.searchParams.get('postMatchMinutes'), 360, 30, 720);
  const delayMs = int(url.searchParams.get('delayMs'), 250, 0, 2000);

  const out: any = { ok: true, mode: 'live_match_full_sync_priority', dryRun, requestedMatchId: requestedMatchId || null, publicOrigin: origin, matchesFound: 0, policy: { selection: 'LIVE and closest-to-now matches are prioritized before old scheduled/stale rows', theStats: 'per selected match by db matchId, so automatic cron behaves like manual cron', matchInfo: runMatchInfo ? 'enabled: lightweight venue/city/referee snapshot' : 'disabled', theStatsExtras: runTheStatsExtras ? 'enabled only when explicitly requested' : 'disabled by default', database: 'frontend reads database snapshots/events only' }, perMatch: [] as any[] };

  const matches = await selectActiveMatches(requestedMatchId, minutesBack, minutesForward, postMatchMinutes, limit);
  out.matchesFound = matches.length;

  for (const [index, match] of matches.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const item: any = { matchId: match.id, teams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, previousStatus: match.status, externalId: match.externalId, animationMatchId: match.animationMatchId, priorityScore: Number(priorityScore(match, Date.now()).toFixed(4)), theStatsLive: null, resolvedTheStatsMatchId: null, theStatsMatchInfo: null, theStatsAutoFinish: null, theStatsPostmatchFinal: null, theStatsExtras: null, isportsTimeline: null, isportsStats: null, isportsVisualStats: null, dedupe: null };

    let theStatsBlocked = false;
    let theStatsMatchResult: any = null;
    if (runTheStats) {
      const catchup = withSecrets(new URL('/api/admin/the-stats-live-catchup', origin), key);
      catchup.searchParams.set('matchId', match.id);
      catchup.searchParams.set('dryRun', String(dryRun));
      catchup.searchParams.set('skipSimilarExisting', 'true');
      item.theStatsLive = await callJson('the_stats_live_stats_and_timeline_by_match_id', catchup, 24_000);
      theStatsBlocked = hasRateLimit(item.theStatsLive);
      theStatsMatchResult = catchupResultFromBody((item.theStatsLive as any)?.body, match.id);
      item.resolvedTheStatsMatchId = resolvedIdFromCatchupBody((item.theStatsLive as any)?.body, match.id);
      item.officialTheStatsTimelineAvailable = hasOfficialTheStatsTimeline(theStatsMatchResult, officialTimelineMinEvents);
    }

    if (runMatchInfo && runTheStats && !theStatsBlocked) {
      const savedInfo = await hasSavedMatchInfo(match.id);
      if (savedInfo?.found) item.theStatsMatchInfo = { skipped: true, reason: 'venue_city_referee_already_saved', capturedAt: savedInfo.capturedAt };
      else { const info = withSecrets(new URL('/api/admin/the-stats-match-info-sync', origin), key); info.searchParams.set('matchId', match.id); info.searchParams.set('dryRun', String(dryRun)); info.searchParams.set('save', String(!dryRun)); info.searchParams.set('timeoutMs', '12000'); item.theStatsMatchInfo = await callJson('the_stats_match_info_light', info, 18_000); }
    } else if (runMatchInfo) item.theStatsMatchInfo = { skipped: true, reason: theStatsBlocked ? 'TheStats rate limited; match info skipped this cycle' : 'TheStats disabled' };

    if (runLineups && !theStatsBlocked) { const lineups = withSecrets(new URL('/api/admin/the-stats-lineups-sync', origin), key); lineups.searchParams.set('matchId', match.id); lineups.searchParams.set('dryRun', String(dryRun)); item.theStatsLineups = await callJson('the_stats_official_lineups_by_match_id', lineups, 18_000); }
    else if (runLineups) item.theStatsLineups = { skipped: true, reason: 'TheStats rate limited; lineups skipped this cycle' };

    if (theStatsMatchResult) item.theStatsAutoFinish = await autoFinishFromOfficialTimeline(match, theStatsMatchResult, dryRun);
    const finishedBeforeSync = isFinishedStatus(match.status);
    const finishedByTheStatsNow = Boolean(item.theStatsAutoFinish?.shouldFinish);
    const shouldRunPostmatch = runTheStats && runTheStatsPostmatch && !theStatsBlocked && (finishedBeforeSync || finishedByTheStatsNow);
    if (shouldRunPostmatch) { const finalCatchup = withSecrets(new URL('/api/admin/the-stats-live-catchup', origin), key); finalCatchup.searchParams.set('matchId', match.id); finalCatchup.searchParams.set('dryRun', String(dryRun)); finalCatchup.searchParams.set('skipSimilarExisting', 'true'); item.theStatsPostmatchFinal = await callJson('the_stats_postmatch_final_by_match_id', finalCatchup, 22_000); }
    else if (runTheStatsPostmatch && theStatsBlocked) item.theStatsPostmatchFinal = { skipped: true, reason: 'TheStats rate limited; postmatch final skipped this cycle' };

    const shouldRunExtras = runTheStats && runTheStatsExtras && !theStatsBlocked && (finishedBeforeSync || finishedByTheStatsNow || bool(url.searchParams.get('forceExtras'), false));
    if (shouldRunExtras) { const extras = withSecrets(new URL('/api/admin/match-extra-data', origin), key); extras.searchParams.set('matchId', match.id); extras.searchParams.set('dryRun', String(dryRun)); extras.searchParams.set('save', String(!dryRun)); extras.searchParams.set('includeRaw', String(runTheStatsExtrasRaw)); extras.searchParams.set('timeoutMs', '15000'); item.theStatsExtras = await callJson('the_stats_match_extra_data', extras, 40_000); }
    else if (runTheStatsExtras) item.theStatsExtras = { skipped: true, reason: theStatsBlocked ? 'TheStats rate limited; extras skipped this cycle' : 'Extras are skipped unless finished or forceExtras=true' };

    if (runISports && match.animationMatchId) { const isports = withSecrets(new URL('/api/internal/live-ingest/isports/remote-frame-pull-v4', origin), key); isports.searchParams.set('mode', 'timeline'); isports.searchParams.set('matchId', String(match.animationMatchId)); isports.searchParams.set('dbMatchId', match.id); isports.searchParams.set('save', String(!dryRun)); isports.searchParams.set('replace', 'true'); item.isportsTimeline = await callJson('isports_timeline_direct', isports, 18_000); } else if (runISports) item.isportsTimeline = { skipped: true, reason: 'No animationMatchId mapped for this match' };
    if (runISports && runISportStats && match.animationMatchId) { const stats = withSecrets(new URL('/api/internal/live-ingest/isports/remote-flash-pull', origin), key); stats.searchParams.set('mode', 'live'); stats.searchParams.set('matchId', String(match.animationMatchId)); stats.searchParams.set('dbMatchId', match.id); stats.searchParams.set('save', String(!dryRun)); stats.searchParams.set('replace', 'true'); stats.searchParams.set('timeoutMs', String(isportStatsTimeoutMs)); stats.searchParams.set('waitMs', String(isportStatsWaitMs)); item.isportsStats = await callJson('isports_flash_direct', stats, Math.min(35_000, isportStatsTimeoutMs + isportStatsWaitMs + 5_000)); }
    if (runISports && runISportVisualStats && match.animationMatchId) { const visual = withSecrets(new URL('/api/internal/live-ingest/isports/remote-visual-stats-pull', origin), key); visual.searchParams.set('matchId', String(match.animationMatchId)); visual.searchParams.set('dbMatchId', match.id); visual.searchParams.set('save', String(!dryRun)); visual.searchParams.set('timeoutMs', String(isportStatsTimeoutMs)); visual.searchParams.set('waitMs', String(isportStatsWaitMs)); item.isportsVisualStats = await callJson('isports_visual_direct', visual, Math.min(35_000, isportStatsTimeoutMs + isportStatsWaitMs + 5_000)); }

    if (runDedupe) { const dedupe = withSecrets(new URL('/api/admin/match-events-dedupe', origin), key); dedupe.searchParams.set('matchId', match.id); dedupe.searchParams.set('dryRun', String(dryRun)); dedupe.searchParams.set('preferTheStats', 'true'); dedupe.searchParams.set('preferTheStatsMinEvents', String(officialTimelineMinEvents)); item.dedupe = await callJson('dedupe_the_stats_first', dedupe, 12_000); }
    out.perMatch.push(item);
  }

  return json(out);
}

export async function POST(req: Request) { return GET(req); }
