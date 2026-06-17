import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { GET as remoteTimelinePullGET } from '@/app/api/internal/live-ingest/isports/remote-frame-pull/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];

type RouteHandler = (req: Request) => Promise<Response | undefined>;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function boolParam(value: string | null, fallback = false) {
  return value === null ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
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

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const after = parseDate(url.searchParams.get('after') || url.searchParams.get('from'), new Date('2026-06-01T00:00:00.000Z'));
    const before = parseDate(url.searchParams.get('before') || url.searchParams.get('to'), new Date(Date.now() - 30 * 60_000));
    const force = boolParam(url.searchParams.get('force'), false);
    const save = boolParam(url.searchParams.get('save'), true);
    const replace = boolParam(url.searchParams.get('replace'), true);
    const dryRun = boolParam(url.searchParams.get('dryRun'), false);
    const take = clampInt(url.searchParams.get('take'), force ? 20 : 50, 1, 50);
    const timeoutMs = clampInt(url.searchParams.get('timeoutMs'), 45000, 5000, 80000);
    const waitMs = clampInt(url.searchParams.get('waitMs'), 10000, 500, 35000);
    const maxRuntimeMs = clampInt(url.searchParams.get('maxRuntimeMs'), 85000, 10000, 110000);
    const statusMode = String(url.searchParams.get('status') || 'finished').toLowerCase();

    const baseWhere: any = {
      animationMatchId: { not: null },
      matchDate: { gte: after, lte: before },
      ...(statusMode === 'all' ? {} : { OR: [{ status: { in: FINISHED_STATUSES } }, { matchDate: { lte: before } }] }),
    };
    const targetWhere = force ? baseWhere : { ...baseWhere, events: { none: {} } };

    const [totalLinked, withEvents, missingEvents, targets] = await Promise.all([
      prisma.match.count({ where: baseWhere }),
      prisma.match.count({ where: { ...baseWhere, events: { some: {} } } }),
      prisma.match.count({ where: { ...baseWhere, events: { none: {} } } }),
      prisma.match.findMany({
        where: targetWhere,
        orderBy: { matchDate: 'asc' },
        take,
        include: {
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
          _count: { select: { events: true } },
        },
      }),
    ]);

    if (dryRun) {
      return json({
        ok: true,
        mode: 'cron_isports_ensure_events',
        dryRun: true,
        complete: missingEvents === 0 && !force,
        summary: { totalLinked, withEvents, missingEvents, targetCount: targets.length, force },
        query: { after: after.toISOString(), before: before.toISOString(), take, statusMode },
        targets: targets.map((match) => ({ dbMatchId: match.id, providerMatchId: match.animationMatchId, local: `${match.homeTeam.name} vs ${match.awayTeam.name}`, status: match.status, matchDate: match.matchDate.toISOString(), eventsBefore: match._count.events })),
        note: force ? 'Dry run only. force=true would refresh events for all selected matches.' : 'Dry run only. force=false targets matches that have no saved events.',
      });
    }

    const origin = requestOrigin(req);
    const adminSecret = adminSecretFromRequest(req);
    const results: any[] = [];

    for (const match of targets) {
      if (Date.now() - startedAt > maxRuntimeMs) break;
      const providerMatchId = Number(match.animationMatchId);
      const item: any = {
        dbMatchId: match.id,
        providerMatchId,
        local: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        status: match.status,
        matchDate: match.matchDate.toISOString(),
        eventsBefore: match._count.events,
      };

      if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) {
        item.ok = false;
        item.error = 'missing provider match id';
        results.push(item);
        continue;
      }

      const timelineUrl = new URL('/api/internal/live-ingest/isports/remote-frame-pull', origin);
      timelineUrl.searchParams.set('matchId', String(providerMatchId));
      timelineUrl.searchParams.set('dbMatchId', match.id);
      timelineUrl.searchParams.set('mode', 'timeline');
      timelineUrl.searchParams.set('save', save ? 'true' : 'false');
      timelineUrl.searchParams.set('replace', replace ? 'true' : 'false');
      timelineUrl.searchParams.set('timeoutMs', String(timeoutMs));
      timelineUrl.searchParams.set('waitMs', String(waitMs));

      try {
        const timeline = await callRoute(remoteTimelinePullGET, timelineUrl, adminSecret);
        item.timelineHttpStatus = timeline.status;
        item.timeline = compactTimeline(timeline.result);
        item.ok = Boolean(item.timeline?.ok);
      } catch (error: any) {
        item.ok = false;
        item.error = error?.message || 'timeline backfill failed';
      }
      results.push(item);
    }

    const [afterWithEvents, afterMissingEvents] = await Promise.all([
      prisma.match.count({ where: { ...baseWhere, events: { some: {} } } }),
      prisma.match.count({ where: { ...baseWhere, events: { none: {} } } }),
    ]);

    return json({
      ok: true,
      mode: 'cron_isports_ensure_events',
      force,
      save,
      replace,
      complete: afterMissingEvents === 0 && (force ? results.length === targets.length : true),
      processed: results.length,
      durationMs: Date.now() - startedAt,
      query: { after: after.toISOString(), before: before.toISOString(), take, statusMode, maxRuntimeMs },
      summaryBefore: { totalLinked, withEvents, missingEvents, targetCount: targets.length },
      summaryAfter: { totalLinked, withEvents: afterWithEvents, missingEvents: afterMissingEvents },
      remainingSelectedThisRun: Math.max(0, targets.length - results.length),
      results,
      note: force ? 'force=true refreshed timeline events for the selected previous matches. If complete=false, rerun once more or lower take.' : 'Ensures every previous linked iSports match has saved timeline events. If missingEvents becomes 0, all selected previous matches have events.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
