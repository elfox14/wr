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
  const value = String(status || '').toUpperCase();
  return value === 'FINISHED' || value === 'FT';
}

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function snapshotAgeMinutes(latest: any) {
  if (!latest?.capturedAt) return Number.POSITIVE_INFINITY;
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return Number.POSITIVE_INFINITY;
  return (Date.now() - capturedAt) / 60_000;
}

function hasLikelyFinalSnapshot(match: any, latest: any) {
  if (!latest) return false;
  const minute = Number(latest.minute);
  if (Number.isFinite(minute) && minute >= 90) return true;
  const start = new Date(match.matchDate).getTime();
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(capturedAt)) return false;
  return capturedAt >= start + 105 * 60_000;
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
  const now = new Date();
  const allowHistoricalBackfill = url.searchParams.get('allowHistoricalBackfill') === 'true' || url.searchParams.get('backfillMode') === 'true';
  const finishedHours = clampNumber(url.searchParams.get('finishedHours'), 6, 1, allowHistoricalBackfill ? 240 : 12);
  const backfillDays = clampNumber(url.searchParams.get('backfillDays'), 7, 1, allowHistoricalBackfill ? 120 : 7);
  const backfillMissing = allowHistoricalBackfill && url.searchParams.get('backfillMissing') === 'true';
  const take = hasSingleMatchId ? 1 : clampNumber(url.searchParams.get('take'), 2, 1, allowHistoricalBackfill ? 24 : 4);
  const minStatsIntervalMinutes = hasSingleMatchId ? 0 : clampNumber(url.searchParams.get('minStatsIntervalMinutes'), 30, 10, 180);
  const footballDataFallbackLimit = clampNumber(url.searchParams.get('footballDataFallbackLimit'), 1, 0, 4);
  const finishedSince = new Date(Date.now() - finishedHours * 60 * 60 * 1000);
  const backfillSince = new Date(Date.now() - backfillDays * 24 * 60 * 60 * 1000);
  const inferredLiveStart = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const inferredLiveEnd = new Date(Date.now() + 15 * 60 * 1000);

  try {
    await ensureStatsTable();
    const matches = await prisma.match.findMany({
      where: hasSingleMatchId ? { animationMatchId: singleMatchId } : {
        animationMatchId: { not: null },
        OR: [
          { status: { in: ['IN_PLAY', 'LIVE', 'HT'] } },
          { status: 'SCHEDULED', matchDate: { gte: inferredLiveStart, lte: inferredLiveEnd } },
          { status: 'FINISHED', matchDate: { gte: finishedSince } },
          ...(backfillMissing ? [{ status: 'FINISHED', matchDate: { gte: backfillSince, lte: now }, statsSnapshots: { none: {} } }] : []),
        ],
      },
      orderBy: { matchDate: 'asc' },
      take,
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

    let guard: any = await getProviderQuotaBlock('ISPORTS');
    let footballDataFallbackUsed = 0;
    const processed = [];

    async function fallbackMaybe(match: any, reason: string) {
      if (footballDataFallbackLimit <= 0) return { status: 'football_data_fallback_disabled', reason };
      if (footballDataFallbackUsed >= footballDataFallbackLimit) return { status: 'football_data_fallback_skipped_limit', limit: footballDataFallbackLimit, reason };
      footballDataFallbackUsed += 1;
      return fallback(match, reason, debug);
    }

    for (const match of matches) {
      const latest = await getLatestSnapshot(match.id);
      const ageMinutes = snapshotAgeMinutes(latest);

      if (!hasSingleMatchId && latest && ageMinutes < minStatsIntervalMinutes && !isFinished(match.status)) {
        processed.push({ matchId: match.id, status: 'recent_snapshot_skipped', snapshotId: latest.id, ageMinutes: Math.round(ageMinutes * 10) / 10, minStatsIntervalMinutes });
        continue;
      }

      if (!hasSingleMatchId && isFinished(match.status) && hasLikelyFinalSnapshot(match, latest)) {
        processed.push({ matchId: match.id, status: 'final_snapshot_already_saved', snapshotId: latest.id, minute: latest.minute, capturedAt: latest.capturedAt });
        continue;
      }

      if (guard) {
        const why = guard.reason || 'iSports guard active';
        processed.push({ matchId: match.id, status: 'isports_guard_active', blockedUntil: guard.blockedUntil, fallback: await fallbackMaybe(match, why) });
        continue;
      }

      try {
        const result = await syncMatchStats(match, { debug });
        processed.push({ matchId: match.id, status: result.status, snapshotId: result.snapshotId, stats: result.stats, savedEventsCount: result.savedEvents?.length || 0 });
      } catch (error: any) {
        const why = reasonFrom(error);
        if (isProviderQuotaError(error)) {
          const block = await blockProviderForHours('ISPORTS', 24, why);
          guard = { active: true, blockedUntil: block.blockedUntil, reason: why };
          processed.push({ matchId: match.id, status: 'isports_limit_reached', blockedUntil: block.blockedUntil, fallback: await fallbackMaybe(match, why), ...providerErrorDetails(error, debug) });
        } else {
          processed.push({ matchId: match.id, status: 'isports_failed', fallback: await fallbackMaybe(match, why), ...providerErrorDetails(error, debug) });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      mode: 'isports_primary_with_limited_football_data_fallback',
      guard: guard ? { active: true, blockedUntil: guard.blockedUntil, reason: guard.reason } : { active: false },
      inferredLiveWindow: { from: inferredLiveStart.toISOString(), to: inferredLiveEnd.toISOString(), now: now.toISOString() },
      finishedWindowHours: finishedHours,
      backfill: { enabled: backfillMissing, historicalBackfillAllowed: allowHistoricalBackfill, days: backfillDays, since: backfillSince.toISOString() },
      limits: { take, minStatsIntervalMinutes, footballDataFallbackLimit, footballDataFallbackUsed },
      quotaProtection: {
        note: 'iSports requests are also protected by a local rolling 24h soft limit before calling the external provider.',
        env: 'ISPORTS_DAILY_SOFT_LIMIT',
      },
      count: processed.length,
      processed,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
