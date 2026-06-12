import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureStatsTable, getLatestSnapshot, providerErrorDetails, syncMatchStats } from '@/lib/live-match-stats';
import { blockProviderForHours, getProviderQuotaBlock, isProviderQuotaError } from '@/lib/provider-quota-guard';
import { syncFootballDataFallbackForMatch } from '@/lib/football-data-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function reasonFrom(error: any) {
  if (typeof error?.payload === 'string') return error.payload;
  if (error?.payload) return JSON.stringify(error.payload);
  return error?.message || 'iSports daily limit reached';
}

function hasKey(req: Request, url: URL) {
  const valid = [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET].map((v) => String(v || '').trim()).filter(Boolean);
  if (valid.length === 0) return true;
  const candidates = [
    url.searchParams.get('key')?.trim() || '',
    url.searchParams.get('cronSecret')?.trim() || '',
    url.searchParams.get('adminSecret')?.trim() || '',
    req.headers.get('x-cron-secret')?.trim() || '',
    req.headers.get('x-admin-secret')?.trim() || '',
  ];
  return candidates.some((value) => value && valid.includes(value));
}

function isFinished(status?: string | null) {
  return String(status || '').toUpperCase() === 'FINISHED';
}

async function fallback(match: any, reason: string, debug: boolean) {
  try {
    return await syncFootballDataFallbackForMatch(match, { reason, debug });
  } catch (error: any) {
    return { status: 'football_data_fallback_failed', error: error?.message || 'fallback failed', providerStatus: error?.status };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!hasKey(req, url)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const debug = url.searchParams.get('debug') === 'true';
  const singleMatchId = Number(url.searchParams.get('matchId') || 0);
  const hasSingleMatchId = Boolean(singleMatchId && Number.isFinite(singleMatchId));
  const finishedSince = new Date(Date.now() - Number(url.searchParams.get('finishedHours') || 36) * 60 * 60 * 1000);

  try {
    await ensureStatsTable();
    const matches = await prisma.match.findMany({
      where: hasSingleMatchId ? { animationMatchId: singleMatchId } : {
        animationMatchId: { not: null },
        OR: [
          { status: { in: ['IN_PLAY', 'LIVE', 'HT'] } },
          { status: 'FINISHED', matchDate: { gte: finishedSince } },
        ],
      },
      orderBy: { matchDate: 'asc' },
      take: hasSingleMatchId ? 1 : 12,
      select: {
        id: true,
        animationMatchId: true,
        matchDate: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
      },
    });

    const guard = await getProviderQuotaBlock('ISPORTS');
    const processed = [];

    for (const match of matches) {
      const latest = await getLatestSnapshot(match.id);
      if (!hasSingleMatchId && isFinished(match.status) && latest) {
        processed.push({ matchId: match.id, status: 'finished_snapshot_already_saved', snapshotId: latest.id, capturedAt: latest.capturedAt });
        continue;
      }

      if (guard) {
        const why = guard.reason || 'iSports guard active';
        processed.push({ matchId: match.id, status: 'isports_guard_active', fallback: await fallback(match, why, debug) });
        continue;
      }
      try {
        const result = await syncMatchStats(match, { debug });
        processed.push({ matchId: match.id, status: result.status, snapshotId: result.snapshotId, stats: result.stats, savedEventsCount: result.savedEvents?.length || 0 });
      } catch (error: any) {
        if (isProviderQuotaError(error)) {
          const why = reasonFrom(error);
          const block = await blockProviderForHours('ISPORTS', 24, why);
          processed.push({ matchId: match.id, status: 'isports_limit_reached', blockedUntil: block.blockedUntil, fallback: await fallback(match, why, debug), ...providerErrorDetails(error, debug) });
        } else {
          processed.push({ matchId: match.id, status: 'isports_failed', ...providerErrorDetails(error, debug) });
        }
      }
    }

    return NextResponse.json({ ok: true, mode: 'isports_primary_with_football_data_fallback', guard: guard ? { active: true, blockedUntil: guard.blockedUntil, reason: guard.reason } : { active: false }, finishedWindowHours: Number(url.searchParams.get('finishedHours') || 36), count: processed.length, processed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
