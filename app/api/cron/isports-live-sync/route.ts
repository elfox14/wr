import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { GET as remoteFlashPullGET } from '@/app/api/internal/live-ingest/isports/remote-flash-pull/route';
import { GET as remoteTimelinePullGET } from '@/app/api/internal/live-ingest/isports/remote-frame-pull-v4/route';
import { GET as remoteVisualStatsPullGET } from '@/app/api/internal/live-ingest/isports/remote-visual-stats-pull/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET'];

type RouteHandler = (req: Request) => Promise<Response | undefined>;

function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }); }
function clampInt(value: string | null, fallback: number, min: number, max: number) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
function boolParam(value: string | null, fallback = false) { return value === null ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase()); }
function adminSecretFromRequest(req: Request) { const url = new URL(req.url); const auth = req.headers.get('authorization') || ''; const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''; return process.env.ADMIN_API_SECRET || req.headers.get('x-admin-secret') || bearer || url.searchParams.get('adminSecret') || ''; }
function requestOrigin(req: Request) { const fallback = new URL(req.url).origin; const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL; if (configured) { try { return new URL(configured).origin; } catch {} } const host = req.headers.get('x-forwarded-host') || req.headers.get('host'); const proto = req.headers.get('x-forwarded-proto') || (fallback.startsWith('https:') ? 'https' : 'http'); return host ? `${proto}://${host}` : fallback; }
async function routeJson(response: Response | undefined) { if (!response) return { status: 500, ok: false, result: { ok: false, error: 'route returned no response' } }; const text = await response.text(); let parsed: any = null; try { parsed = JSON.parse(text); } catch {} return { status: response.status, ok: response.ok, result: parsed || { rawSample: text.slice(0, 1000) } }; }
async function callRoute(handler: RouteHandler, url: URL, adminSecret: string) { const response = await handler(new Request(url.toString(), { method: 'GET', headers: adminSecret ? { 'x-admin-secret': adminSecret } : {} })); return routeJson(response); }
function compactFlash(result: any) { return { ok: Boolean(result?.ok), hasStats: Boolean(result?.hasStats), stats: result?.stats || null, save: result?.save || null, flash: result?.flash || null, error: result?.error || null }; }
function compactTimeline(result: any) { return { ok: Boolean(result?.ok), eventsCount: result?.timeline?.eventsCount || 0, save: result?.timeline?.save || null, statsSave: result?.timeline?.statsSave || null, eventsPreview: Array.isArray(result?.timeline?.events) ? result.timeline.events.slice(0, 4) : [], error: result?.error || null, loader: result?.loader || null, remoteBrowser: result?.remoteBrowser || null, directFrame: result?.directFrame || null, cachedTimeline: result?.cachedTimeline || null }; }
function compactLive(result: any) { return { ok: Boolean(result?.ok), hasStats: Boolean(result?.hasStats), stats: result?.stats || null, validation: result?.validation || null, save: result?.save || null, textSample: result?.textSample || null, error: result?.error || null }; }
function buildFlashUrl(origin: string, match: any, providerMatchId: number, save: boolean, replace: boolean, timeoutMs: number, waitMs: number) {
  const flashUrl = new URL('/api/internal/live-ingest/isports/remote-flash-pull', origin);
  flashUrl.searchParams.set('matchId', String(providerMatchId));
  flashUrl.searchParams.set('dbMatchId', match.id);
  flashUrl.searchParams.set('mode', 'timeline');
  flashUrl.searchParams.set('save', save ? 'true' : 'false');
  flashUrl.searchParams.set('replace', replace ? 'true' : 'false');
  flashUrl.searchParams.set('timeoutMs', String(timeoutMs));
  flashUrl.searchParams.set('waitMs', String(waitMs));
  return flashUrl;
}
function buildLiveUrl(origin: string, match: any, providerMatchId: number, save: boolean, timeoutMs: number, waitMs: number) {
  const liveUrl = new URL('/api/internal/live-ingest/isports/remote-visual-stats-pull', origin);
  liveUrl.searchParams.set('matchId', String(providerMatchId));
  liveUrl.searchParams.set('dbMatchId', match.id);
  liveUrl.searchParams.set('save', save ? 'true' : 'false');
  liveUrl.searchParams.set('timeoutMs', String(timeoutMs));
  liveUrl.searchParams.set('waitMs', String(waitMs));
  return liveUrl;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  try {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const explicitDbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const take = clampInt(url.searchParams.get('take'), explicitDbMatchId ? 1 : 2, 1, 5);
    const timeoutMs = clampInt(url.searchParams.get('timeoutMs'), 35000, 5000, 70000);
    const waitMs = clampInt(url.searchParams.get('waitMs'), 12000, 1000, 30000);
    const directTimeoutMs = clampInt(url.searchParams.get('directTimeoutMs'), explicitDbMatchId ? 6000 : 12000, 2000, 30000);
    const wrapperTimeoutMs = clampInt(url.searchParams.get('wrapperTimeoutMs'), explicitDbMatchId ? 6000 : 10000, 2000, 15000);
    const skipBrowserFallback = boolParam(url.searchParams.get('skipBrowserFallback'), Boolean(explicitDbMatchId));
    const windowBeforeMinutes = clampInt(url.searchParams.get('windowBeforeMinutes'), 240, 15, 720);
    const windowAfterMinutes = clampInt(url.searchParams.get('windowAfterMinutes'), 20, 0, 240);
    const includeFlash = boolParam(url.searchParams.get('includeFlash'), true);
    const includeTimeline = boolParam(url.searchParams.get('includeTimeline'), true);
    const includeLive = boolParam(url.searchParams.get('includeLive'), false);
    const asyncFlash = boolParam(url.searchParams.get('asyncFlash'), false);
    const asyncLive = boolParam(url.searchParams.get('asyncLive'), false);
    const save = boolParam(url.searchParams.get('save'), true);
    const replace = boolParam(url.searchParams.get('replace'), true);
    const explicitProviderMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || 0);
    const start = new Date(Date.now() - windowBeforeMinutes * 60_000);
    const end = new Date(Date.now() + windowAfterMinutes * 60_000);

    const matches = await prisma.match.findMany({
      where: explicitDbMatchId ? { id: explicitDbMatchId, animationMatchId: { not: null } } : Number.isFinite(explicitProviderMatchId) && explicitProviderMatchId > 0 ? { animationMatchId: Math.floor(explicitProviderMatchId) } : { animationMatchId: { not: null }, OR: [{ status: { in: LIVE_STATUSES } }, { matchDate: { gte: start, lte: end } }] },
      orderBy: { matchDate: 'asc' },
      take,
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });

    const origin = requestOrigin(req);
    const adminSecret = adminSecretFromRequest(req);
    const results: any[] = [];

    for (const match of matches) {
      const providerMatchId = Number(match.animationMatchId);
      if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) continue;
      const item: any = { dbMatchId: match.id, providerMatchId, local: `${match.homeTeam.name} vs ${match.awayTeam.name}`, status: match.status, matchDate: match.matchDate.toISOString() };
      try {
        if (includeTimeline) {
          const timelineUrl = new URL('/api/internal/live-ingest/isports/remote-frame-pull-v4', origin);
          timelineUrl.searchParams.set('matchId', String(providerMatchId));
          timelineUrl.searchParams.set('dbMatchId', match.id);
          timelineUrl.searchParams.set('mode', 'timeline');
          timelineUrl.searchParams.set('save', save ? 'true' : 'false');
          timelineUrl.searchParams.set('replace', replace ? 'true' : 'false');
          timelineUrl.searchParams.set('timeoutMs', String(timeoutMs));
          timelineUrl.searchParams.set('waitMs', String(waitMs));
          timelineUrl.searchParams.set('directTimeoutMs', String(directTimeoutMs));
          timelineUrl.searchParams.set('wrapperTimeoutMs', String(wrapperTimeoutMs));
          timelineUrl.searchParams.set('skipBrowserFallback', skipBrowserFallback ? 'true' : 'false');
          const timeline = await callRoute(remoteTimelinePullGET, timelineUrl, adminSecret);
          item.timelineHttpStatus = timeline.status; item.timeline = compactTimeline(timeline.result);
        }
        if (includeFlash) {
          const flashUrl = buildFlashUrl(origin, match, providerMatchId, save, replace, timeoutMs, waitMs);
          if (asyncFlash) {
            item.flash = { queued: true, async: true, save, timeoutMs, waitMs };
            void callRoute(remoteFlashPullGET, flashUrl, adminSecret).catch((error) => console.error('[isports-live-sync] async flash failed', { matchId: match.id, providerMatchId, error: error?.message || String(error) }));
          } else {
            const flash = await callRoute(remoteFlashPullGET, flashUrl, adminSecret);
            item.flashHttpStatus = flash.status; item.flash = compactFlash(flash.result);
          }
        }
        if (includeLive) {
          const liveUrl = buildLiveUrl(origin, match, providerMatchId, save, timeoutMs, waitMs);
          if (asyncLive) {
            item.live = { queued: true, async: true, save, timeoutMs, waitMs };
            void callRoute(remoteVisualStatsPullGET, liveUrl, adminSecret).catch((error) => console.error('[isports-live-sync] async visual stats failed', { matchId: match.id, providerMatchId, error: error?.message || String(error) }));
          } else {
            const live = await callRoute(remoteVisualStatsPullGET, liveUrl, adminSecret);
            item.liveHttpStatus = live.status; item.live = compactLive(live.result);
          }
        }
        item.ok = Boolean(item.flash?.ok || item.flash?.queued || item.timeline?.ok || item.live?.ok || item.live?.queued);
        item.dataMode = item.live?.queued ? 'visual_stats_queued' : item.live?.hasStats ? 'visual_stats_flash_and_timeline' : item.flash?.queued ? 'timeline_with_flash_queued' : item.flash?.hasStats ? 'flash_stats_and_timeline' : item.timeline?.eventsCount ? 'timeline_events_only' : 'no_reliable_data';
      } catch (error: any) { item.ok = false; item.error = error?.message || 'sync failed'; }
      results.push(item);
    }

    const queued = results.some((item) => item.flash?.queued || item.live?.queued);
    return json({ ok: true, mode: 'cron_isports_live_sync', save, includeFlash, includeTimeline, includeLive, asyncFlash, asyncLive, skipBrowserFallback, directTimeoutMs, wrapperTimeoutMs, processed: results.length, durationMs: Date.now() - startedAt, window: { start: start.toISOString(), end: end.toISOString() }, results, note: queued ? 'Some heavy iSports pulls were queued in the background to avoid external cron timeout.' : 'Cron-safe route. Targeted matches use fast direct timeline by default; Browserless fallback can be enabled manually with skipBrowserFallback=false.' });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
