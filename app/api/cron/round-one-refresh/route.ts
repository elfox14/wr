import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { runLiveAnimationSync } from '@/lib/liveAnimationSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const LIVE = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE', 'HT', 'HALFTIME'];
const SCHEDULED = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function norm(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function boolFrom(value: string | null, fallback = false) {
  if (value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function intFrom(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function queryForMatch(date: Date) {
  const params = new URLSearchParams();
  params.set('date_from', dateOnly(addDays(date, -1)));
  params.set('date_to', dateOnly(addDays(date, 1)));
  return defaultTheStatsQuery(params);
}

function isFinished(status?: string | null) {
  return FINISHED.includes(norm(status));
}

function isLive(status?: string | null) {
  return LIVE.includes(norm(status));
}

function plannedStatus(matchDate: Date, now: number, preStartMinutes: number, liveWindowMinutes: number) {
  const kickoff = new Date(matchDate).getTime();
  if (!Number.isFinite(kickoff)) return null;
  if (now >= kickoff - preStartMinutes * 60000 && now <= kickoff + liveWindowMinutes * 60000) return 'LIVE';
  if (now > kickoff + liveWindowMinutes * 60000) return 'FINISHED';
  return null;
}

function scoreFromFinalScore(value: any) {
  if (!value) return null;
  const home = Number(value.home ?? value.home_score ?? value.homeTeam ?? value.localteam_score ?? value.homeScore);
  const away = Number(value.away ?? value.away_score ?? value.awayTeam ?? value.visitorteam_score ?? value.awayScore);
  if (Number.isFinite(home) && Number.isFinite(away)) return { home, away };
  if (typeof value === 'string') {
    const parts = value.match(/(\d+)\D+(\d+)/);
    if (parts) return { home: Number(parts[1]), away: Number(parts[2]) };
  }
  return null;
}

function scoreFromResult(result: any) {
  const matchInfo = result?.matchInfo || {};
  const candidates = [matchInfo.finalScore, matchInfo.score, result?.debug?.normalizedPreview?.matchInfo?.finalScore];
  for (const candidate of candidates) {
    const score = scoreFromFinalScore(candidate);
    if (score) return score;
  }
  return null;
}

function providerStatusFromResult(result: any) {
  return norm(result?.matchInfo?.status || result?.debug?.normalizedPreview?.matchInfo?.status || '');
}

function isRateLimited(result: any) {
  return Boolean(result?.rateLimited) || JSON.stringify(result?.endpointsFailed || '').includes('429') || JSON.stringify(result?.error || '').includes('429');
}

async function hasRecentBasic(matchId: string, freshnessHours: number) {
  const since = new Date(Date.now() - freshnessHours * 3600000);
  const snapshot = await prisma.matchStatsSnapshot.findFirst({
    where: { matchId, provider: { startsWith: 'THE_STATS_API' }, capturedAt: { gte: since } },
    select: { id: true, rawData: true },
    orderBy: { capturedAt: 'desc' },
  }).catch(() => null);
  const raw = snapshot?.rawData as any;
  const normalized = raw?.normalized || {};
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  return Boolean(snapshot?.id && (Object.keys(stats).length > 0 || normalized?.lineups));
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('dateFrom') || '2026-06-11';
  const dateTo = url.searchParams.get('dateTo') || '2026-06-17';
  const limit = intFrom(url.searchParams.get('limit'), 4, 1, 12);
  const freshnessHours = intFrom(url.searchParams.get('freshnessHours'), 720, 1, 720);
  const timeoutMs = intFrom(url.searchParams.get('timeoutMs'), 30000, 3000, 60000);
  const delayMs = intFrom(url.searchParams.get('delayMs'), 2500, 0, 10000);
  const matchDelayMs = intFrom(url.searchParams.get('matchDelayMs'), 60000, 0, 600000);
  const preStartMinutes = intFrom(url.searchParams.get('preStartMinutes'), 15, 0, 120);
  const liveWindowMinutes = intFrom(url.searchParams.get('liveWindowMinutes'), 130, 90, 220);
  const force = boolFrom(url.searchParams.get('force'), false);
  const dryRun = boolFrom(url.searchParams.get('dryRun'), false);
  const includeRaw = boolFrom(url.searchParams.get('includeRaw'), false);
  const syncAnimation = !['0', 'false', 'no'].includes(String(url.searchParams.get('syncAnimation') || 'true').toLowerCase());
  const stopOnRateLimit = !['0', 'false', 'no'].includes(String(url.searchParams.get('stopOnRateLimit') || 'true').toLowerCase());

  const matches = await prisma.match.findMany({
    where: {
      matchDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lte: new Date(`${dateTo}T23:59:59.999Z`) },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take: 80,
  });

  const now = Date.now();
  const processed: any[] = [];
  let imported = 0;
  let stoppedEarly: string | null = null;

  for (const match of matches) {
    if (imported >= limit || stoppedEarly) break;

    const current = norm(match.status);
    const desired = plannedStatus(match.matchDate, now, preStartMinutes, liveWindowMinutes);
    let statusUpdate: string | null = null;
    let scoreUpdate: any = null;

    if (!isFinished(current) && desired && desired !== current) {
      statusUpdate = desired;
      if (!dryRun) await prisma.match.update({ where: { id: match.id }, data: { status: desired } });
    }

    const shouldImport = force || isFinished(statusUpdate || current) || (desired === 'FINISHED') || !(await hasRecentBasic(match.id, freshnessHours));
    if (!shouldImport) {
      processed.push({ matchId: match.id, title: `${match.homeTeam.name} ضد ${match.awayTeam.name}`, skipped: true, reason: 'recent_basic_snapshot_exists', statusUpdate });
      continue;
    }

    const result = await collectTheStatsMatchExtras(match, {
      dryRun,
      save: !dryRun,
      includeRaw,
      endpointMode: 'essential',
      timeoutMs,
      delayMs,
      query: queryForMatch(match.matchDate),
    });

    imported += 1;

    const providerStatus = providerStatusFromResult(result);
    const score = scoreFromResult(result);
    const finalFromProvider = FINISHED.includes(providerStatus);
    const liveFromProvider = LIVE.includes(providerStatus);
    const updateData: any = {};

    if (score && (score.home !== match.homeScore || score.away !== match.awayScore)) {
      updateData.homeScore = score.home;
      updateData.awayScore = score.away;
      scoreUpdate = score;
    }
    if (finalFromProvider && !isFinished(current)) updateData.status = 'FINISHED';
    else if (liveFromProvider && !isFinished(current)) updateData.status = providerStatus || 'LIVE';

    if (!dryRun && Object.keys(updateData).length) await prisma.match.update({ where: { id: match.id }, data: updateData });

    let animationSync: any = null;
    if (!dryRun && syncAnimation && (isLive(updateData.status || statusUpdate || current) || isFinished(updateData.status || statusUpdate || current))) {
      animationSync = await runLiveAnimationSync({ matchId: match.id, allowFinished: true, dryRun: false, limit: 1 });
    }

    processed.push({
      matchId: match.id,
      title: `${match.homeTeam.name} ضد ${match.awayTeam.name}`,
      matchDate: match.matchDate,
      beforeStatus: match.status,
      statusUpdate,
      providerStatus: providerStatus || null,
      finalStatus: updateData.status || statusUpdate || match.status,
      scoreUpdate,
      ok: result.ok,
      providerMatchId: result.resolvedProviderMatchId || null,
      endpointsOk: result.endpointsOk || [],
      endpointsFailed: result.endpointsFailed || [],
      counts: result.counts || null,
      saved: result.saved,
      snapshotId: result.snapshotId,
      animationSync: animationSync ? { ok: animationSync.ok, results: animationSync.results } : null,
      rateLimited: isRateLimited(result),
    });

    if (stopOnRateLimit && isRateLimited(result)) {
      stoppedEarly = 'rate_limited';
      break;
    }
    if (matchDelayMs > 0) await sleep(matchDelayMs);
  }

  return NextResponse.json({
    ok: true,
    mode: 'round_one_refresh_v1',
    dateFrom,
    dateTo,
    limit,
    freshnessHours,
    timeoutMs,
    delayMs,
    matchDelayMs,
    preStartMinutes,
    liveWindowMinutes,
    force,
    dryRun,
    includeRaw,
    syncAnimation,
    candidates: matches.length,
    imported,
    processed,
    stoppedEarly,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
