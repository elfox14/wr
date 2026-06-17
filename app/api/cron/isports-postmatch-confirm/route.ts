import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { GET as remoteTimelinePullGET } from '@/app/api/internal/live-ingest/isports/remote-frame-pull/route';
import { GET as remoteFlashPullGET } from '@/app/api/internal/live-ingest/isports/remote-flash-pull/route';
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
function compactFlash(result: any) {
  return {
    ok: Boolean(result?.ok),
    hasStats: Boolean(result?.hasStats),
    stats: result?.stats || null,
    save: result?.save || null,
    flash: result?.flash || null,
    error: result?.error || null,
  };
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
function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function scoreText(stats: any) {
  const home = numberValue(stats?.homeScore);
  const away = numberValue(stats?.awayScore);
  return home !== null && away !== null ? `${home}-${away}` : null;
}
function finalStatsWhere() {
  return {
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
    const take = clampInt(url.searchParams.get('take'), 1, 1, 3);
    const skip = clampInt(url.searchParams.get('skip'), 0, 0, 10000);
    const timeoutMs = clampInt(url.searchParams.get('timeoutMs'), 45000, 5000, 80000);
    const waitMs = clampInt(url.searchParams.get('waitMs'), 12000, 1000, 30000);
    const windowBeforeMinutes = clampInt(url.searchParams.get('windowBeforeMinutes'), 0, 0, 43200);
    const includeTimeline = boolParam(url.searchParams.get('includeTimeline'), true);
    const includeFlash = boolParam(url.searchParams.get('includeFlash'), true);
    const includeLive = boolParam(url.searchParams.get('includeLive'), true);
    const save = boolParam(url.searchParams.get('save'), true);
    const replace = boolParam(url.searchParams.get('replace'), true);
    const dryRun = boolParam(url.searchParams.get('dryRun'), false);
    const missingOnly = boolParam(url.searchParams.get('missingOnly'), false);
    const hasExplicitAfter = Boolean(url.searchParams.get('after') || url.searchParams.get('from'));
    const before = parseDate(url.searchParams.get('before') || url.searchParams.get('to'), new Date(Date.now() - 10 * 60_000));
    const afterFallback = windowBeforeMinutes > 0 ? new Date(Date.now() - windowBeforeMinutes * 60_000) : new Date('2026-06-01T00:00:00.000Z');
    const after = parseDate(url.searchParams.get('after') || url.searchParams.get('from'), afterFallback);
    const orderParam = String(url.searchParams.get('order') || '').toLowerCase();
    const orderDirection: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc';
    const explicitDbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const explicitProviderMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || 0);

    const baseWhere: any = explicitDbMatchId
      ? { id: explicitDbMatchId, animationMatchId: { not: null } }
      : Number.isFinite(explicitProviderMatchId) && explicitProviderMatchId > 0
        ? { animationMatchId: Math.floor(explicitProviderMatchId) }
        : {
            animationMatchId: { not: null },
            matchDate: { gte: after, lte: before },
            OR: [{ status: { in: FINISHED_STATUSES } }, { matchDate: { lte: before } }],
          };
    const targetWhere = missingOnly
      ? { ...baseWhere, OR: [{ events: { none: {} } }, { statsSnapshots: { none: finalStatsWhere() } }] }
      : baseWhere;

    const matches = await prisma.match.findMany({
      where: targetWhere,
      orderBy: { matchDate: orderDirection },
      skip: explicitDbMatchId || explicitProviderMatchId || missingOnly ? 0 : skip,
      take,
      include: {
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
        _count: { select: { events: true, statsSnapshots: true } },
        statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1, select: { provider: true, homeScore: true, awayScore: true, homeCorners: true, awayCorners: true, homePossession: true, awayPossession: true, homeShots: true, awayShots: true, capturedAt: true } },
      },
    });

    if (dryRun) {
      return json({
        ok: true,
        mode: 'cron_isports_postmatch_confirm',
        dryRun: true,
        save,
        replace,
        includeTimeline,
        includeFlash,
        includeLive,
        processed: 0,
        selected: matches.length,
        query: { after: after.toISOString(), before: before.toISOString(), take, skip, missingOnly, order: orderDirection, windowBeforeMinutes: hasExplicitAfter ? null : windowBeforeMinutes },
        targets: matches.map((match) => ({
          dbMatchId: match.id,
          providerMatchId: match.animationMatchId,
          local: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          status: match.status,
          matchDate: match.matchDate.toISOString(),
          counts: match._count,
          latestSnapshot: match.statsSnapshots[0] || null,
        })),
        note: 'Dry run only. This route confirms post-match data from iSports Timeline, FlashData, and Visual Stats. Timeline save uses replace=true by default, so if the source has extra events, the local timeline is refreshed with them.',
      });
    }

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
        beforeLatestSnapshot: match.statsSnapshots[0] || null,
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
          flashUrl.searchParams.set('replace', 'true');
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

        const afterCounts = await prisma.match.findUnique({ where: { id: match.id }, select: { _count: { select: { events: true, statsSnapshots: true } }, homeScore: true, awayScore: true } });
        item.afterCounts = afterCounts?._count || null;
        item.scoreConfirmation = {
          local: afterCounts ? `${afterCounts.homeScore}-${afterCounts.awayScore}` : null,
          timeline: scoreText(item.timeline?.statsSave?.counts),
          flash: scoreText(item.flash?.stats),
        };
        item.addedOrRefreshedEvents = item.timeline?.save ? { deleted: item.timeline.save.deleted || 0, inserted: item.timeline.save.inserted || 0 } : null;
        item.ok = Boolean(item.timeline?.ok || item.flash?.ok || item.live?.ok);
        item.dataMode = item.live?.hasStats ? 'confirmed_timeline_flash_visual' : item.flash?.hasStats ? 'confirmed_timeline_flash' : item.timeline?.eventsCount ? 'confirmed_timeline_only' : 'no_confirmed_source_data';
      } catch (error: any) {
        item.ok = false;
        item.error = error?.message || 'post-match confirmation failed';
      }
      results.push(item);
    }

    return json({
      ok: true,
      mode: 'cron_isports_postmatch_confirm',
      save,
      replace,
      includeTimeline,
      includeFlash,
      includeLive,
      processed: results.length,
      durationMs: Date.now() - startedAt,
      query: { after: after.toISOString(), before: before.toISOString(), take, skip, missingOnly, order: orderDirection, windowBeforeMinutes: hasExplicitAfter ? null : windowBeforeMinutes },
      results,
      note: 'Post-match confirmation uses iSports Timeline for final events, FlashData for score/corners/attacks, and Visual Stats for possession/shots. If Timeline has extra events, replace=true refreshes the saved timeline events.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
