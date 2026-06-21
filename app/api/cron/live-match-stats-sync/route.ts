import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  ensureStatsTable,
  hasUsefulStats,
  normalizeStats,
  providerErrorDetails,
  syncMatchStats,
} from '@/lib/live-match-stats';
import { footballFetchFromProvider } from '@/lib/apiFootball';
import { getProviderQuotaBlock } from '@/lib/provider-quota-guard';

import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;


  try {
    await ensureStatsTable();
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === 'true';
    const singleMatchId = Number(url.searchParams.get('matchId') || 0);
    const hasSingleMatchId = Boolean(singleMatchId && Number.isFinite(singleMatchId));
    const allowLegacyBulkSync = url.searchParams.get('allowLegacy') === 'true';

    if (!hasSingleMatchId && !allowLegacyBulkSync) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        mode: 'legacy_bulk_isports_sync_disabled',
        message: 'This legacy bulk iSports route is disabled by default to protect the daily quota. Use /api/cron/isports-safe-sync for scheduled jobs, or pass matchId for a single manual diagnostic.',
        externalRequestsUsed: 0,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const guard = await getProviderQuotaBlock('ISPORTS');
    if (guard) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        mode: 'legacy_bulk_isports_sync_guarded',
        guard: { blockedUntil: guard.blockedUntil, reason: guard.reason },
        externalRequestsUsed: 0,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const recentlyFinishedSince = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const matches = await prisma.match.findMany({
      where: hasSingleMatchId
        ? { animationMatchId: singleMatchId }
        : {
            animationMatchId: { not: null },
            OR: [
              { status: { in: ['IN_PLAY', 'LIVE', 'HT'] } },
              { status: 'FINISHED', matchDate: { gte: recentlyFinishedSince } },
            ],
          },
      orderBy: { matchDate: 'asc' },
      take: hasSingleMatchId ? 1 : 2,
      select: {
        id: true,
        animationMatchId: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    if (hasSingleMatchId && matches.length === 0) {
      try {
        const raw = await footballFetchFromProvider('ISPORTS', '/analysis', { fixture: singleMatchId });
        const stats = normalizeStats(raw);
        return NextResponse.json({
          ok: true,
          authMethod: (auth as any).mode,
          count: 1,
          linkedInDatabase: false,
          message: 'iSports analysis fetched directly, but this matchId is not linked to a Match row yet.',
          processed: [{ providerMatchId: singleMatchId, status: hasUsefulStats(stats) ? 'direct_debug_mapped' : 'direct_debug_unmapped', stats, ...(debug ? { raw } : {}) }],
        }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error: any) {
        return NextResponse.json({
          ok: true,
          authMethod: (auth as any).mode,
          count: 1,
          linkedInDatabase: false,
          processed: [{ providerMatchId: singleMatchId, status: 'direct_fetch_failed', ...providerErrorDetails(error, debug) }],
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const processed = [];
    for (const match of matches) {
      if (!match.animationMatchId) continue;
      try {
        const result = await syncMatchStats(match, { debug });
        processed.push({
          matchId: match.id,
          providerMatchId: match.animationMatchId,
          status: result.status,
          matchStatus: match.status,
          snapshotId: result.snapshotId,
          stats: result.stats,
          savedEventsCount: result.savedEvents?.length || 0,
          ...(debug && 'raw' in result ? { raw: (result as any).raw } : {}),
        });
      } catch (error: any) {
        processed.push({ matchId: match.id, providerMatchId: match.animationMatchId, status: 'failed', matchStatus: match.status, ...providerErrorDetails(error, debug) });
      }
    }

    return NextResponse.json({ ok: true, authMethod: (auth as any).mode, count: processed.length, linkedInDatabase: matches.length > 0, pollHintSeconds: 300, finalStatsWindowHours: 3, processed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('live-match-stats-sync error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
