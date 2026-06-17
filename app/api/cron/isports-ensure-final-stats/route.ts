import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { GET as remoteVisualStatsPullGET } from '@/app/api/internal/live-ingest/isports/remote-visual-stats-pull/route';
import { GET as remoteFlashPullGET } from '@/app/api/internal/live-ingest/isports/remote-flash-pull/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINAL_STAT_PROVIDERS = ['ISPORTS_REMOTE_LIVE', 'ISPORTS_COMBINED'];
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
function compactLive(result: any) {
  return {
    ok: Boolean(result?.ok),
    hasStats: Boolean(result?.hasStats),
    stats: result?.stats || null,
    validation: result?.validation || null,
    save: result?.save || null,
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
function finalStatsWhere() {
  return {
    provider: { in: FINAL_STAT_PROVIDERS },
    OR: [
      { homePossession: { not: null } },
      { awayPossession: { not: null } },
      { homeShots: { not: null } },
      { awayShots: { not: null } },
      { homeShotsOnTarget: { not: null } },
      { awayShotsOnTarget: { not: null } },
      { homeAttacks: { not: null } },
      { awayAttacks: { not: null } },
    ],
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
    const dryRun = boolParam(url.searchParams.get('dryRun'), false);
    const includeFlash = boolParam(url.searchParams.get('includeFlash'), false);
    const take = clampInt(url.searchParams.get('take'), force ? 2 : 1, 1, 3);
    const skip = clampInt(url.searchParams.get('skip'), 0, 0, 10000);
    const timeoutMs = clampInt(url.searchParams.get('timeoutMs'), 45000, 5000, 80000);
    const waitMs = clampInt(url.searchParams.get('waitMs'), 15000, 1000, 35000);
    const maxRuntimeMs = clampInt(url.searchParams.get('maxRuntimeMs'), 90000, 10000, 115000);
    const statusMode = String(url.searchParams.get('status') || 'finished').toLowerCase();

    const baseWhere: any = {
      animationMatchId: { not: null },
      matchDate: { gte: after, lte: before },
      ...(statusMode === 'all' ? {} : { OR: [{ status: { in: FINISHED_STATUSES } }, { matchDate: { lte: before } }] }),
    };
    const hasFinalStatsWhere = finalStatsWhere();
    const targetWhere = force ? baseWhere : { ...baseWhere, statsSnapshots: { none: hasFinalStatsWhere } };

    const [totalLinked, withFinalStats, missingFinalStats, targets] = await Promise.all([
      prisma.match.count({ where: baseWhere }),
      prisma.match.count({ where: { ...baseWhere, statsSnapshots: { some: hasFinalStatsWhere } } }),
      prisma.match.count({ where: { ...baseWhere, statsSnapshots: { none: hasFinalStatsWhere } } }),
      prisma.match.findMany({
        where: targetWhere,
        orderBy: { matchDate: 'asc' },
        skip: force ? skip : 0,
        take,
        include: {
          homeTeam: { select: { id: true, name: true, code: true } },
          awayTeam: { select: { id: true, name: true, code: true } },
          _count: { select: { events: true, statsSnapshots: true } },
        },
      }),
    ]);

    if (dryRun) {
      return json({
        ok: true,
        mode: 'cron_isports_ensure_final_stats',
        dryRun: true,
        complete: missingFinalStats === 0 && !force,
        summary: { totalLinked, withFinalStats, missingFinalStats, targetCount: targets.length, force },
        query: { after: after.toISOString(), before: before.toISOString(), take, skip, statusMode, includeFlash },
        targets: targets.map((match) => ({
          dbMatchId: match.id,
          providerMatchId: match.animationMatchId,
          local: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          status: match.status,
          matchDate: match.matchDate.toISOString(),
          counts: match._count,
        })),
        note: force ? 'Dry run only. force=true would refresh final visual stats for selected matches.' : 'Dry run only. force=false targets previous linked matches that do not have final visual stats saved.',
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
        beforeCounts: match._count,
      };

      if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) {
        item.ok = false;
        item.error = 'missing provider match id';
        results.push(item);
        continue;
      }

      try {
        if (includeFlash) {
          const flashUrl = new URL('/api/internal/live-ingest/isports/remote-flash-pull', origin);
          flashUrl.searchParams.set('matchId', String(providerMatchId));
          flashUrl.searchParams.set('dbMatchId', match.id);
          flashUrl.searchParams.set('mode', 'timeline');
          flashUrl.searchParams.set('save', save ? 'true' : 'false');
          flashUrl.searchParams.set('replace', 'true');
          flashUrl.searchParams.set('timeoutMs', String(timeoutMs));
          flashUrl.searchParams.set('waitMs', String(Math.min(waitMs, 12000)));
          const flash = await callRoute(remoteFlashPullGET, flashUrl, adminSecret);
          item.flashHttpStatus = flash.status;
          item.flash = compactFlash(flash.result);
        }

        const liveUrl = new URL('/api/internal/live-ingest/isports/remote-visual-stats-pull', origin);
        liveUrl.searchParams.set('matchId', String(providerMatchId));
        liveUrl.searchParams.set('dbMatchId', match.id);
        liveUrl.searchParams.set('save', save ? 'true' : 'false');
        liveUrl.searchParams.set('timeoutMs', String(timeoutMs));
        liveUrl.searchParams.set('waitMs', String(waitMs));
        const live = await callRoute(remoteVisualStatsPullGET, liveUrl, adminSecret);
        item.liveHttpStatus = live.status;
        item.live = compactLive(live.result);
        item.ok = Boolean(item.live?.hasStats || item.flash?.hasStats);
        item.dataMode = item.live?.hasStats && item.flash?.hasStats ? 'final_visual_and_flash_stats' : item.live?.hasStats ? 'final_visual_stats' : item.flash?.hasStats ? 'flash_stats_only' : 'no_final_visual_stats';
      } catch (error: any) {
        item.ok = false;
        item.error = error?.message || 'final stats backfill failed';
      }
      results.push(item);
    }

    const [afterWithFinalStats, afterMissingFinalStats] = await Promise.all([
      prisma.match.count({ where: { ...baseWhere, statsSnapshots: { some: hasFinalStatsWhere } } }),
      prisma.match.count({ where: { ...baseWhere, statsSnapshots: { none: hasFinalStatsWhere } } }),
    ]);

    return json({
      ok: true,
      mode: 'cron_isports_ensure_final_stats',
      force,
      save,
      includeFlash,
      complete: afterMissingFinalStats === 0 && (force ? results.length === targets.length : true),
      processed: results.length,
      durationMs: Date.now() - startedAt,
      query: { after: after.toISOString(), before: before.toISOString(), take, skip, statusMode, maxRuntimeMs },
      summaryBefore: { totalLinked, withFinalStats, missingFinalStats, targetCount: targets.length },
      summaryAfter: { totalLinked, withFinalStats: afterWithFinalStats, missingFinalStats: afterMissingFinalStats },
      remainingSelectedThisRun: Math.max(0, targets.length - results.length),
      results,
      note: force ? 'force=true refreshed final visual stats for selected previous matches. Use low take to protect Browserless quota.' : 'Ensures previous linked iSports matches have final visual stats. Use dryRun=true first; keep take small because this uses Browserless.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
