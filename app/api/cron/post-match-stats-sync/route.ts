import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureStatsTable, providerErrorDetails, syncMatchStats } from '@/lib/live-match-stats';
import { getProviderQuotaBlock } from '@/lib/provider-quota-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H'];
const SAFE_FINALIZE_AFTER_MINUTES = 100;

function validSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function getCronAuth(req: Request) {
  const expected = validSecrets();
  if (expected.length === 0) return { valid: true, method: 'no_secret_configured' };
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret')?.trim() || '';
  const adminHeader = req.headers.get('x-admin-secret')?.trim() || '';
  const { searchParams } = new URL(req.url);
  const cronQuery = searchParams.get('cronSecret')?.trim() || '';
  const adminQuery = searchParams.get('adminSecret')?.trim() || '';
  const keyQuery = searchParams.get('key')?.trim() || '';
  const matched = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'cronSecret_query', value: cronQuery },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'key_query', value: keyQuery },
  ].find((item) => item.value && expected.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function minutesSinceKickoff(matchDate: Date, now: Date) {
  return Math.floor((now.getTime() - new Date(matchDate).getTime()) / 60_000);
}

function shouldFinalize(match: any, now: Date) {
  if (FINISHED_STATUSES.includes(String(match.status || '').toUpperCase())) return true;
  if (!LIVE_STATUSES.includes(String(match.status || '').toUpperCase())) return false;
  return minutesSinceKickoff(match.matchDate, now) >= SAFE_FINALIZE_AFTER_MINUTES;
}

export async function GET(req: Request) {
  const auth = getCronAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await ensureStatsTable();
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === 'true';
    const hours = Math.max(1, Math.min(48, Number(url.searchParams.get('hours') || 12)));
    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') || 8)));
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const finalCandidateBefore = new Date(now.getTime() - SAFE_FINALIZE_AFTER_MINUTES * 60 * 1000);

    const guard = await getProviderQuotaBlock('ISPORTS');
    if (guard) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        mode: 'post_match_stats_sync_guarded',
        guard: { blockedUntil: guard.blockedUntil, reason: guard.reason },
        externalRequestsUsed: 0,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const matches = await prisma.match.findMany({
      where: {
        animationMatchId: { not: null },
        matchDate: { gte: since },
        OR: [
          { status: { in: FINISHED_STATUSES } },
          { status: { in: LIVE_STATUSES }, matchDate: { lte: finalCandidateBefore } },
        ],
      },
      orderBy: { matchDate: 'desc' },
      take: limit,
      select: {
        id: true,
        animationMatchId: true,
        status: true,
        matchDate: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    const processed = [];
    for (const match of matches) {
      try {
        const result = await syncMatchStats(match, { debug, force: true });
        const homeScore = numberOrNull(result.stats?.homeScore);
        const awayScore = numberOrNull(result.stats?.awayScore);
        const updateData: any = {};
        if (homeScore !== null) updateData.homeScore = homeScore;
        if (awayScore !== null) updateData.awayScore = awayScore;
        if (shouldFinalize(match, now)) updateData.status = 'FINISHED';

        let updated = false;
        if (Object.keys(updateData).length > 0) {
          await prisma.match.update({ where: { id: match.id }, data: updateData });
          updated = true;
        }

        processed.push({
          matchId: match.id,
          providerMatchId: match.animationMatchId,
          previousStatus: match.status,
          status: result.status,
          snapshotId: result.snapshotId,
          savedEventsCount: result.savedEvents?.length || 0,
          updatedMatch: updated,
          updateData,
          stats: result.stats,
          ...(debug && 'raw' in result ? { raw: (result as any).raw } : {}),
        });
      } catch (error: any) {
        processed.push({
          matchId: match.id,
          providerMatchId: match.animationMatchId,
          previousStatus: match.status,
          status: 'failed',
          ...providerErrorDetails(error, debug),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      authMethod: auth.method,
      mode: 'post_match_stats_sync',
      hours,
      limit,
      count: processed.length,
      safeFinalizeAfterMinutes: SAFE_FINALIZE_AFTER_MINUTES,
      processed,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('post-match-stats-sync error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
