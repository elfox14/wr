import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureStatsTable, getLatestSnapshot, providerErrorDetails, syncMatchStats } from '@/lib/live-match-stats';
import { blockProviderForHours, getProviderQuotaBlock, isProviderQuotaError } from '@/lib/provider-quota-guard';
import { syncFootballDataFallbackForMatch } from '@/lib/football-data-fallback';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

process.env.ISPORTS_DAILY_SOFT_LIMIT ||= '200';

function reasonFrom(error: any) {
  if (typeof error?.payload === 'string') return error.payload;
  if (error?.payload) return JSON.stringify(error.payload);
  return error?.message || 'iSports daily limit reached';
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

function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function teamName(match: any, side: 'home' | 'away') {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  return team?.name || team?.code || (side === 'home' ? 'الفريق الأول' : 'الفريق الثاني');
}

function teamId(match: any, side: 'home' | 'away') {
  return side === 'home' ? match.homeTeamId : match.awayTeamId;
}

async function latestISportsSnapshot(matchId: string) {
  try {
    return await prisma.matchStatsSnapshot.findFirst({
      where: { matchId, provider: 'ISPORTS' },
      orderBy: { capturedAt: 'desc' },
    });
  } catch {
    return null;
  }
}

async function saveGeneratedEvent(match: any, event: { minute: number | null; type: string; side: 'home' | 'away'; detail: string }) {
  const detail = event.detail.slice(0, 240);
  const existing = await prisma.matchEvent.findFirst({
    where: {
      matchId: match.id,
      minute: event.minute,
      type: event.type,
      detail,
      sourceName: 'MC PRIME iSport Monitor',
    },
    select: { id: true },
  });
  if (existing) return null;
  return prisma.matchEvent.create({
    data: {
      matchId: match.id,
      minute: event.minute,
      type: event.type,
      teamId: teamId(match, event.side),
      playerName: null,
      detail,
      sourceName: 'MC PRIME iSport Monitor',
      sourceUrl: null,
    },
  });
}

async function generateISportsDeltaEvents(match: any, previous: any, stats: any) {
  if (!stats) return [];
  const minute = num(stats.minute);
  const events: Array<{ minute: number | null; type: string; side: 'home' | 'away'; detail: string }> = [];

  function addDelta(side: 'home' | 'away', field: string, type: string, label: string, minDelta = 1) {
    const before = previous ? num(previous[field]) : 0;
    const after = num(stats[field]);
    if (after === null || before === null || after - before < minDelta) return;
    const diff = after - before;
    const suffix = diff > 1 ? ` +${diff}` : '';
    events.push({ minute, type, side, detail: `${teamName(match, side)} - د${minute ?? '-'}' - ${label}${suffix} (الإجمالي ${after})` });
  }

  function addScore(side: 'home' | 'away') {
    const field = side === 'home' ? 'homeScore' : 'awayScore';
    const before = previous ? num(previous[field]) : num(match[field]);
    const after = num(stats[field]);
    if (after === null || before === null || after <= before) return;
    events.push({ minute, type: 'goal', side, detail: `${teamName(match, side)} - د${minute ?? '-'}' - هدف من iSport Animation (النتيجة ${stats.homeScore ?? match.homeScore}-${stats.awayScore ?? match.awayScore})` });
  }

  addScore('home');
  addScore('away');
  addDelta('home', 'homeShotsOnTarget', 'shot_on_target', 'تسديدة على المرمى');
  addDelta('away', 'awayShotsOnTarget', 'shot_on_target', 'تسديدة على المرمى');
  addDelta('home', 'homeShots', 'shot', 'تسديدة');
  addDelta('away', 'awayShots', 'shot', 'تسديدة');
  addDelta('home', 'homeShotsOffTarget', 'shot_off_target', 'تسديدة خارج المرمى');
  addDelta('away', 'awayShotsOffTarget', 'shot_off_target', 'تسديدة خارج المرمى');
  addDelta('home', 'homeCorners', 'corner', 'ركنية');
  addDelta('away', 'awayCorners', 'corner', 'ركنية');
  addDelta('home', 'homeDangerousAttacks', 'dangerous_attack', 'هجمة خطيرة');
  addDelta('away', 'awayDangerousAttacks', 'dangerous_attack', 'هجمة خطيرة');
  addDelta('home', 'homeYellowCards', 'yellow_card', 'بطاقة صفراء');
  addDelta('away', 'awayYellowCards', 'yellow_card', 'بطاقة صفراء');
  addDelta('home', 'homeRedCards', 'red_card', 'بطاقة حمراء');
  addDelta('away', 'awayRedCards', 'red_card', 'بطاقة حمراء');

  const saved = [];
  for (const event of events) {
    const row = await saveGeneratedEvent(match, event);
    if (row) saved.push(row);
  }
  return saved;
}

async function fallback(match: any, reason: string, debug: boolean) {
  try {
    return await syncFootballDataFallbackForMatch(match, { reason, debug });
  } catch (error: any) {
    return { status: 'football_data_fallback_failed', error: error?.message || 'fallback failed', providerStatus: error?.status };
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const url = new URL(req.url);

  const debug = url.searchParams.get('debug') === 'true';
  const singleMatchId = Number(url.searchParams.get('matchId') || 0);
  const hasSingleMatchId = Boolean(singleMatchId && Number.isFinite(singleMatchId));
  const now = new Date();
  const allowHistoricalBackfill = url.searchParams.get('allowHistoricalBackfill') === 'true' || url.searchParams.get('backfillMode') === 'true';
  const finishedHours = clampNumber(url.searchParams.get('finishedHours'), 6, 1, allowHistoricalBackfill ? 240 : 12);
  const backfillDays = clampNumber(url.searchParams.get('backfillDays'), 7, 1, allowHistoricalBackfill ? 120 : 7);
  const backfillMissing = allowHistoricalBackfill && url.searchParams.get('backfillMissing') === 'true';
  const take = hasSingleMatchId ? 1 : clampNumber(url.searchParams.get('take'), 2, 1, allowHistoricalBackfill ? 24 : 4);
  const minStatsIntervalMinutes = hasSingleMatchId ? 0 : clampNumber(url.searchParams.get('minStatsIntervalMinutes'), 5, 2, 180);
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
      const latestISports = await latestISportsSnapshot(match.id);
      const ageMinutes = snapshotAgeMinutes(latestISports || latest);

      if (!hasSingleMatchId && latestISports && ageMinutes < minStatsIntervalMinutes && !isFinished(match.status)) {
        processed.push({ matchId: match.id, status: 'recent_isports_snapshot_skipped', snapshotId: latestISports.id, ageMinutes: Math.round(ageMinutes * 10) / 10, minStatsIntervalMinutes });
        continue;
      }

      if (!hasSingleMatchId && isFinished(match.status) && hasLikelyFinalSnapshot(match, latest)) {
        processed.push({ matchId: match.id, status: 'final_snapshot_already_saved', snapshotId: latest?.id, minute: latest?.minute, capturedAt: latest?.capturedAt });
        continue;
      }

      if (guard) {
        const why = guard.reason || 'iSports guard active';
        processed.push({ matchId: match.id, status: 'isports_guard_active', blockedUntil: guard.blockedUntil, fallback: await fallbackMaybe(match, why) });
        continue;
      }

      try {
        const result = await syncMatchStats(match, { debug });
        const deltaEvents = await generateISportsDeltaEvents(match, latestISports, result.stats);
        processed.push({ matchId: match.id, status: result.status, snapshotId: result.snapshotId, stats: result.stats, savedEventsCount: (result.savedEvents?.length || 0) + deltaEvents.length, rawSavedEventsCount: result.savedEvents?.length || 0, deltaSavedEventsCount: deltaEvents.length });
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
        defaultSoftLimit: 200,
      },
      count: processed.length,
      processed,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
