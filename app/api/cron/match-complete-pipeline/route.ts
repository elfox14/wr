import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'PAUSED'];
const LIVE_SNAPSHOT_PROVIDERS = ['WORKER_ISPORTS', 'ISPORTS_ANIMATION_BROWSERLESS', 'AUTOMATED_LIVE_INGEST', 'ISPORTS_QUOTA_FALLBACK'];

type MatchWithData = Awaited<ReturnType<typeof loadMatchCandidates>>[number];

type PipelineStep = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  status?: number;
  durationMs: number;
  url?: string;
  result?: unknown;
  error?: string;
};

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function dateOnly(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function isFinished(status: string) {
  return FINISHED.includes(String(status || '').toUpperCase());
}

function isLive(status: string) {
  return LIVE.includes(String(status || '').toUpperCase());
}

function isNearLive(match: { status: string; matchDate: Date }) {
  if (isLive(match.status)) return true;
  if (isFinished(match.status)) return false;
  const diffMinutes = (Date.now() - new Date(match.matchDate).getTime()) / 60000;
  return diffMinutes >= -30 && diffMinutes <= 160;
}

function isUpcomingSoon(match: { status: string; matchDate: Date }, hours = 72) {
  if (isFinished(match.status) || isLive(match.status)) return false;
  const diffHours = (new Date(match.matchDate).getTime() - Date.now()) / 36e5;
  return diffHours >= -3 && diffHours <= hours;
}

function normalizedOf(snapshot: any) {
  return snapshot?.rawData?.normalized || {};
}

function snapshotCounts(snapshot: any) {
  const normalized = normalizedOf(snapshot);
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  const playerRatings = players.filter((player: any) => player?.rating !== null && player?.rating !== undefined && player?.rating !== '').length;
  return { stats: Object.keys(stats || {}).length, events: events.length, shots: shots.length, players: players.length, playerRatings, lineups: normalized?.lineups ? 1 : 0 };
}

function hasSnapshotColumnStats(snapshot: any) {
  if (!snapshot) return false;
  return [
    snapshot.homePossession,
    snapshot.awayPossession,
    snapshot.homeShots,
    snapshot.awayShots,
    snapshot.homeShotsOnTarget,
    snapshot.awayShotsOnTarget,
    snapshot.homeCorners,
    snapshot.awayCorners,
  ].some((value) => value !== null && value !== undefined);
}

function articleMapRows(rows: any[]) {
  return new Map(rows.map((row) => [row.matchId, row]));
}

async function loadArticles(matchIds: string[]) {
  await ensurePostMatchContentTables();
  if (!matchIds.length) return new Map<string, any>();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "matchId", "slug", "status", "infographicImageUrl", "heroImageUrl" FROM "MatchArticle" WHERE "language" = 'ar' AND "matchId" = ANY($1)`,
    matchIds,
  ).catch(() => []);
  return articleMapRows(rows);
}

async function loadMatchCandidates(options: { matchId?: string | null; lookbackDays: number; lookaheadHours: number; take: number }) {
  const now = Date.now();
  const where = options.matchId
    ? { id: options.matchId }
    : {
        matchDate: {
          gte: new Date(now - options.lookbackDays * 864e5),
          lte: new Date(now + options.lookaheadHours * 36e5),
        },
      };

  const matches = await prisma.match.findMany({
    where: where as any,
    orderBy: { matchDate: 'asc' },
    take: options.matchId ? 1 : options.take,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: {
        orderBy: { capturedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          provider: true,
          providerMatchId: true,
          capturedAt: true,
          homePossession: true,
          awayPossession: true,
          homeShots: true,
          awayShots: true,
          homeShotsOnTarget: true,
          awayShotsOnTarget: true,
          homeCorners: true,
          awayCorners: true,
          rawData: true,
        },
      },
    },
  });

  const articles = await loadArticles(matches.map((match) => match.id));
  return matches.map((match) => ({ ...match, article: articles.get(match.id) || null }));
}

function completeness(match: MatchWithData) {
  const finalSnapshot = match.statsSnapshots.find((snapshot) => snapshot.provider.startsWith('THE_STATS_API')) || null;
  const liveSnapshot = match.statsSnapshots.find((snapshot) => LIVE_SNAPSHOT_PROVIDERS.some((provider) => snapshot.provider.includes(provider))) || null;
  const finalCounts = snapshotCounts(finalSnapshot);
  const liveLinked = Boolean(match.animationMatchId);
  const liveSnapshotReady = Boolean(liveSnapshot);
  const resultSynced = isFinished(match.status) || isLive(match.status) || match.homeScore !== 0 || match.awayScore !== 0;
  const finalStatsReady = Boolean(finalSnapshot && (finalCounts.stats > 0 || hasSnapshotColumnStats(finalSnapshot)));
  const finalEventsReady = Boolean(finalSnapshot && finalCounts.events > 0);
  const playerRatingsReady = Boolean(finalSnapshot && finalCounts.playerRatings > 0);
  const articleReady = Boolean(match.article?.slug);
  const infographicReady = Boolean(match.article?.infographicImageUrl);

  const weights = [
    [liveLinked, 10],
    [liveSnapshotReady || isFinished(match.status), 10],
    [resultSynced, 15],
    [finalStatsReady || !isFinished(match.status), 20],
    [finalEventsReady || !isFinished(match.status), 15],
    [playerRatingsReady || !isFinished(match.status), 10],
    [articleReady || !isFinished(match.status), 15],
    [infographicReady || !isFinished(match.status), 5],
  ] as const;

  const score = weights.reduce((sum, [ok, value]) => sum + (ok ? value : 0), 0);
  const missing = {
    liveLinked: !liveLinked,
    liveSnapshotReady: !liveSnapshotReady && !isFinished(match.status),
    resultSynced: !resultSynced,
    finalStatsReady: !finalStatsReady && isFinished(match.status),
    finalEventsReady: !finalEventsReady && isFinished(match.status),
    playerRatingsReady: !playerRatingsReady && isFinished(match.status),
    articleReady: !articleReady && isFinished(match.status),
    infographicReady: !infographicReady && isFinished(match.status),
  };

  return {
    percent: Math.max(0, Math.min(100, score)),
    finalSnapshotId: finalSnapshot?.id || null,
    liveSnapshotId: liveSnapshot?.id || null,
    finalCounts,
    flags: { liveLinked, liveSnapshotReady, resultSynced, finalStatsReady, finalEventsReady, playerRatingsReady, articleReady, infographicReady },
    missing,
  };
}

function candidatePriority(match: MatchWithData) {
  const c = completeness(match);
  if (isNearLive(match) && !c.flags.liveLinked) return 1000;
  if (isNearLive(match) && c.flags.liveLinked) return 950;
  if (isUpcomingSoon(match) && !c.flags.liveLinked) return 850;
  if (isFinished(match.status) && !c.flags.finalStatsReady) return 800;
  if (isFinished(match.status) && (!c.flags.finalEventsReady || !c.flags.playerRatingsReady) && match.externalId) return 760;
  if (isFinished(match.status) && c.flags.finalStatsReady && !c.flags.articleReady) return 700;
  if (isFinished(match.status) && c.flags.articleReady && !c.flags.infographicReady) return 680;
  return 100 - c.percent;
}

function pickMatch(matches: MatchWithData[]) {
  return [...matches]
    .map((match) => ({ match, priority: candidatePriority(match), completeness: completeness(match) }))
    .sort((a, b) => b.priority - a.priority || new Date(a.match.matchDate).getTime() - new Date(b.match.matchDate).getTime())[0] || null;
}

async function callJson(name: string, url: string, init?: RequestInit, timeoutMs = 45000): Promise<PipelineStep> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const text = await res.text();
    let result: unknown = text;
    try { result = JSON.parse(text); } catch {}
    return { name, ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, url, result };
  } catch (error: any) {
    return { name, ok: false, durationMs: Date.now() - startedAt, url, error: error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(error?.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

function endpointBase(req: Request) {
  return new URL(req.url).origin;
}

function withKey(path: string, key: string, params: Record<string, string | number | boolean | null | undefined> = {}, req?: Request) {
  const base = req ? endpointBase(req) : '';
  const url = new URL(`${base}${path}`);
  url.searchParams.set('key', key);
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(name, String(value));
  }
  return url.toString();
}

function requestKey(req: Request) {
  const url = new URL(req.url);
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return bearer || url.searchParams.get('key') || url.searchParams.get('cronSecret') || url.searchParams.get('adminSecret') || '';
}

async function refreshMatch(matchId: string) {
  const matches = await loadMatchCandidates({ matchId, lookbackDays: 14, lookaheadHours: 120, take: 1 });
  return matches[0] || null;
}

async function runNextStep(req: Request, match: MatchWithData, key: string, options: { includeResults: boolean; maxStepTimeoutMs: number }) {
  const c = completeness(match);
  const date = dateOnly(match.matchDate);

  if (isNearLive(match) && !c.flags.liveLinked) {
    return callJson('sync-animation-matches', withKey('/api/cron/sync-animation-matches', key, {
      limit: 80,
      lookbackHours: 12,
      lookaheadHours: 120,
      threshold: 65,
      dryRun: false,
      includeAlreadyLinked: false,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (isUpcomingSoon(match) && !c.flags.liveLinked) {
    return callJson('sync-animation-matches', withKey('/api/cron/sync-animation-matches', key, {
      limit: 80,
      lookbackHours: 12,
      lookaheadHours: 120,
      threshold: 65,
      dryRun: false,
      includeAlreadyLinked: false,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (isNearLive(match) && c.flags.liveLinked && !isFinished(match.status)) {
    return callJson('live-ingest', withKey('/api/cron/live-ingest', key, {
      limit: 1,
      maxExternalRequests: 1,
      maxBrowserlessRequests: 1,
      lookaheadMinutes: 45,
      lookbackHours: 3,
      finishedHours: 0,
      minIntervalSeconds: 60,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (options.includeResults && (isNearLive(match) || isFinished(match.status))) {
    return callJson('football-data-results-sync', withKey('/api/cron/football-data-results-sync', key, {
      dateFrom: date,
      dateTo: date,
      localLimit: 30,
      lookbackDays: 1,
      lookaheadDays: 1,
      season: 2026,
      competition: 'WC',
      dryRun: false,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (isFinished(match.status) && !c.flags.finalStatsReady) {
    return callJson('the-stats-finalize-matches', withKey('/api/cron/the-stats-finalize-matches', key, {
      matchId: match.id,
      apply: true,
      limit: 1,
      days: 60,
      requestsPerMinute: 110,
      timeoutMs: 20000,
      includeRaw: false,
      writeMatchEvents: false,
      purgeISportsSnapshots: false,
      dryRun: false,
    }, req), undefined, Math.max(options.maxStepTimeoutMs, 55000));
  }

  if (isFinished(match.status) && (!c.flags.finalEventsReady || !c.flags.playerRatingsReady) && match.externalId) {
    return callJson('manual-final-import', withKey('/api/cron/manual-final-import', key, {
      matchId: match.id,
      providerMatchId: match.externalId,
      scope: 'full',
      dryRun: false,
      includeRaw: false,
      syncAnimation: true,
      timeoutMs: 25000,
      delayMs: 1000,
    }, req), undefined, Math.max(options.maxStepTimeoutMs, 55000));
  }

  if (isFinished(match.status) && c.flags.finalStatsReady && !c.flags.articleReady) {
    return callJson('generate-match-content', withKey('/api/admin/match-content', key, {}, req), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, autoPublish: false }),
    }, options.maxStepTimeoutMs);
  }

  return { name: 'no-action', ok: true, skipped: true, durationMs: 0, result: { reason: 'match already complete or needs manual provider id', completeness: c } } satisfies PipelineStep;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return response({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const key = String(requestKey(req)).trim();
  const startedAt = Date.now();
  const matchId = url.searchParams.get('matchId');
  const maxSteps = intParam(url, 'maxSteps', 2, 1, 5);
  const lookbackDays = intParam(url, 'lookbackDays', 7, 1, 60);
  const lookaheadHours = intParam(url, 'lookaheadHours', 120, 1, 24 * 14);
  const take = intParam(url, 'candidateLimit', 80, 1, 200);
  const maxStepTimeoutMs = intParam(url, 'stepTimeoutMs', 45000, 5000, 90000);
  const includeResults = boolParam(url, 'includeResults', true);

  const candidates = await loadMatchCandidates({ matchId, lookbackDays, lookaheadHours, take });
  const picked = matchId ? (candidates[0] ? { match: candidates[0], priority: 9999, completeness: completeness(candidates[0]) } : null) : pickMatch(candidates);

  if (!picked) {
    return response({ ok: true, mode: 'match_complete_pipeline_v1', status: 'no_candidates', durationMs: Date.now() - startedAt });
  }

  const steps: PipelineStep[] = [];
  let current = picked.match;

  for (let index = 0; index < maxSteps; index += 1) {
    const step = await runNextStep(req, current, key, { includeResults: includeResults && index === 0, maxStepTimeoutMs });
    steps.push(step);
    if (!step.ok || step.skipped) break;
    const fresh = await refreshMatch(current.id);
    if (!fresh) break;
    current = fresh;
  }

  const finalCompleteness = completeness(current);
  return response({
    ok: true,
    mode: 'match_complete_pipeline_v1_one_match',
    durationMs: Date.now() - startedAt,
    selected: {
      matchId: current.id,
      teams: `${current.homeTeam?.name || current.homeTeamId} vs ${current.awayTeam?.name || current.awayTeamId}`,
      status: current.status,
      matchDate: current.matchDate,
      priority: picked.priority,
    },
    before: picked.completeness,
    after: finalCompleteness,
    steps,
    nextActionHint: finalCompleteness.percent >= 100 ? 'complete' : 'run again in 5 minutes or use admin manual ID if TheStats matching failed',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
