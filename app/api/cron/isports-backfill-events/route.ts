import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { GET as remoteFlashPullGET } from '@/app/api/internal/live-ingest/isports/remote-flash-pull/route';
import { GET as remoteTimelinePullGET } from '@/app/api/internal/live-ingest/isports/remote-frame-pull/route';
import { GET as remoteVisualStatsPullGET } from '@/app/api/internal/live-ingest/isports/remote-visual-stats-pull/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];

type RouteHandler = (req: Request) => Promise<Response | undefined>;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function boolParam(value: string | null, fallback = false) {
  return value === null ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
function adminSecretFromRequest(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return process.env.ADMIN_API_SECRET || req.headers.get('x-admin-secret') || bearer || url.searchParams.get('adminSecret') || '';
}
function requestOrigin(req: Request) {
  const fallback = new URL(req.url).origin;
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL;
  if (configured) {
    try { return new URL(configured).origin; } catch {}
  }
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (fallback.startsWith('https:') ? 'https' : 'http');
  return host ? `${proto}://${host}` : fallback;
}
function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}
async function routeJson(response: Response | undefined) {
  if (!response) return { status: 500, ok: false, result: { ok: false, error: 'route returned no response' } };
  const text = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: response.status, ok: response.ok, result: parsed || { rawSample: text.slice(0, 1000) } };
}
async function callRoute(handler: RouteHandler, url: URL, adminSecret: string) {
  const response = await handler(new Request(url.toString(), { method: 'GET', headers: adminSecret ? { 'x-admin-secret': adminSecret } : {} }));
  return routeJson(response);
}
function compactTimeline(result: any) {
  return {
    ok: Boolean(result?.ok),
    eventsCount: result?.timeline?.eventsCount || 0,
    save: result?.timeline?.save || null,
    statsSave: result?.timeline?.statsSave || null,
    error: result?.error || null,
  };
}
function compactFlash(result: any) {
  return {
    ok: Boolean(result?.ok),
    hasStats: Boolean(result?.hasStats),
    stats: result?.stats || null,
    save: result?.save || null,
    error: result?.error || null,
  };
}
function compactLive(result: any) {
  return {
    ok: Boolean(result?.ok),
    hasStats: Boolean(result?.hasStats),
    stats: result?.stats || null,
    save: result?.save || null,
    error: result?.error || null,
  };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const take = clampInt(url.searchParams.get('take'), 4, 1, 8);
    const skip = clampInt(url.searchParams.get('skip'), 0, 0, 10000);
    const timeoutMs = clampInt(url.searchParams.get('timeoutMs'), 45000, 5000, 80000);
    const waitMs = clampInt(url.searchParams.get('waitMs'), 12000, 1000, 35000);
    const includeTimeline = boolParam(url.searchParams.get('includeTimeline'), true);
    const includeFlash = boolParam(url.searchParams.get('includeFlash'), true);
    const includeLive = boolParam(url.searchParams.get('includeLive'), false);
    const save = boolParam(url.searchParams.get('save'), true);
    const replace = boolParam(url.searchParams.get('replace'), true);
    const missingOnly = boolParam(url.searchParams.get('missingOnly'), true);
    const statusMode = String(url.searchParams.get('status') || 'finished').toLowerCase();
    const before = parseDate(url.searchParams.get('before') || url.searchParams.get('to'), new Date(Date.now() - 30 * 60_000));
    const after = parseDate(url.searchParams.get('after') || url.searchParams.get('from'), new Date('2026-06-01T00:00:00.000Z'));
    const explicitDbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const explicitProviderMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || 0);

    const where: any = explicitDbMatchId
      ? { id: explicitDbMatchId, animationMatchId: { not: null } }
      : Number.isFinite(explicitProviderMatchId) && explicitProviderMatchId > 0
        ? { animationMatchId: Math.floor(explicitProviderMatchId) }
        : {
            animationMatchId: { not: null },
            matchDate: { gte: after, lte: before },
            ...(statusMode === 'all' ? {} : { OR: [{ status: { in: FINISHED_STATUSES } }, { matchDate: { lte: before } }] }),
            ...(missingOnly ? { events: { none: {} } } : {}),
          };

    const matches = await prisma.match.findMany({
      where,
      orderBy: { matchDate: 'asc' },
      skip: explicitDbMatchId || explicitProviderMatchId ? 0 : skip,
      take,
      include: {
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
        _count: { select: { events: true, statsSnapshots: true } },
      },
    });

    const origin = requestOrigin(req);
    const adminSecret = adminSecretFromRequest(req);
    const results: any[] = [];

    for (const match of matches) {
      const providerMatchId = Number(match.animationMatchId);
      const item: any = {
        dbMatchId: match.id,
        providerMatchId,
        local: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        status: match.status,
        matchDate: match.matchDate.toISOString(),
        beforeCounts: match._count,
      };
      if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) {
        item.ok = false;
        item.error = 'missing provider match id';
        results.push(item);
        continue;
      }

      try {
        if (includeTimeline) {
          const timelineUrl = new URL('/api/internal/live-ingest/isports/remote-frame-pull', origin);
          timelineUrl.searchParams.set('matchId', String(providerMatchId));
          timelineUrl.searchParams.set('dbMatchId', match.id);
          timelineUrl.searchParams.set('mode', 'timeline');
          timelineUrl.searchParams.set('save', save ? 'true' : 'false');
          timelineUrl.searchParams.set('replace', replace ? 'true' : 'false');
          timelineUrl.searchParams.set('timeoutMs', String(timeoutMs));
          timelineUrl.searchParams.set('waitMs', String(waitMs));
          const timeline = await callRoute(remoteTimelinePullGET, timelineUrl, adminSecret);
          item.timelineHttpStatus = timeline.status;
          item.timeline = compactTimeline(timeline.result);
        }

        if (includeFlash) {
          const flashUrl = new URL('/api/internal/live-ingest/isports/remote-flash-pull', origin);
          flashUrl.searchParams.set('matchId', String(providerMatchId));
          flashUrl.searchParams.set('dbMatchId', match.id);
          flashUrl.searchParams.set('mode', 'timeline');
          flashUrl.searchParams.set('save', save ? 'true' : 'false');
          flashUrl.searchParams.set('replace', replace ? 'true' : 'false');
          flashUrl.searchParams.set('timeoutMs', String(timeoutMs));
          flashUrl.searchParams.set('waitMs', String(waitMs));
          const flash = await callRoute(remoteFlashPullGET, flashUrl, adminSecret);
          item.flashHttpStatus = flash.status;
          item.flash = compactFlash(flash.result);
        }

        if (includeLive) {
          const liveUrl = new URL('/api/internal/live-ingest/isports/remote-visual-stats-pull', origin);
          liveUrl.searchParams.set('matchId', String(providerMatchId));
          liveUrl.searchParams.set('dbMatchId', match.id);
          liveUrl.searchParams.set('save', save ? 'true' : 'false');
          liveUrl.searchParams.set('timeoutMs', String(timeoutMs));
          liveUrl.searchParams.set('waitMs', String(waitMs));
          const live = await callRoute(remoteVisualStatsPullGET, liveUrl, adminSecret);
          item.liveHttpStatus = live.status;
          item.live = compactLive(live.result);
        }

        item.ok = Boolean(item.timeline?.ok || item.flash?.ok || item.live?.ok);
        item.dataMode = item.live?.hasStats ? 'visual_stats_flash_and_timeline' : item.flash?.hasStats ? 'flash_stats_and_timeline' : item.timeline?.eventsCount ? 'timeline_events_only' : 'no_reliable_data';
      } catch (error: any) {
        item.ok = false;
        item.error = error?.message || 'backfill failed';
      }
      results.push(item);
    }

    return json({
      ok: true,
      mode: 'cron_isports_backfill_events',
      save,
      replace,
      missingOnly,
      includeTimeline,
      includeFlash,
      includeLive,
      processed: results.length,
      durationMs: Date.now() - startedAt,
      query: { after: after.toISOString(), before: before.toISOString(), take, skip, statusMode },
      results,
      next: results.length === take && !missingOnly ? { skip: skip + take } : null,
      note: 'Historical backfill for previous linked iSports matches. Default missingOnly=true means each run fills the next matches that have no saved events.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
