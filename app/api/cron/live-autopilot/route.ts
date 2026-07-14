import { NextResponse } from 'next/server';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIVE_MATCH_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'ET', 'BT', 'P', 'PEN_LIVE'];

type StepResult = {
  step: string;
  due: boolean;
  ok?: boolean;
  status?: number;
  durationMs?: number;
  url?: string;
  result?: unknown;
  error?: string;
};

function json(payload: unknown, status = 200) {
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

function numberParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function secretFrom(req: Request, url: URL) {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  return (
    bearer ||
    req.headers.get('x-admin-secret') ||
    req.headers.get('x-cron-secret') ||
    url.searchParams.get('adminSecret') ||
    url.searchParams.get('cronSecret') ||
    url.searchParams.get('key') ||
    ''
  ).trim();
}

function publicOrigin(req: Request) {
  const configured = process.env.LIVE_SYNC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function shouldRunEvery(minutes: number, now = new Date()) {
  if (minutes <= 1) return true;
  const bucket = now.getUTCMinutes();
  return bucket % minutes === 0;
}

function safeUrlForOutput(value: URL) {
  const copy = new URL(value.toString());
  if (copy.searchParams.has('key')) copy.searchParams.set('key', '***');
  if (copy.searchParams.has('adminSecret')) copy.searchParams.set('adminSecret', '***');
  if (copy.searchParams.has('cronSecret')) copy.searchParams.set('cronSecret', '***');
  return copy.pathname + copy.search;
}

async function callStep(step: string, endpoint: string, params: Record<string, string | number | boolean | null | undefined>, options: { origin: string; secret: string; timeoutMs: number; due: boolean }): Promise<StepResult> {
  if (!options.due) return { step, due: false };

  const target = new URL(endpoint, options.origin);
  target.searchParams.set('key', options.secret);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    target.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let result: unknown = text.slice(0, 4000);
    try { result = JSON.parse(text); } catch {}

    return {
      step,
      due: true,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      url: safeUrlForOutput(target),
      result,
    };
  } catch (error: any) {
    return {
      step,
      due: true,
      ok: false,
      durationMs: Date.now() - startedAt,
      url: safeUrlForOutput(target),
      error: error?.name === 'AbortError' ? `timeout_after_${options.timeoutMs}ms` : error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function selectedMatchId(step: StepResult) {
  if (!step.result || typeof step.result !== 'object') return '';
  const selected = (step.result as { selected?: { matchId?: unknown } }).selected;
  return typeof selected?.matchId === 'string' ? selected.matchId.trim() : '';
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const startedAt = Date.now();
  const origin = publicOrigin(req);
  const secret = secretFrom(req, url);
  const now = new Date();
  const nearUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const recentSince = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const [liveMatches, nearMatches, recentlyFinishedMatches] = await Promise.all([
    prisma.match.count({ where: { status: { in: LIVE_MATCH_STATUSES } } }),
    prisma.match.count({ where: { status: 'SCHEDULED', matchDate: { gte: now, lte: nearUntil } } }),
    prisma.match.count({ where: { status: 'FINISHED', matchDate: { gte: recentSince, lte: now } } }),
  ]);
  const activeOrNear = liveMatches > 0 || nearMatches > 0 || recentlyFinishedMatches > 0;

  const force = boolParam(url, 'force', false);
  const dryRun = boolParam(url, 'dryRun', false);
  const dbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('matchId') || '';
  const providerMatchId = url.searchParams.get('providerMatchId') || '';
  const isportsVisual = boolParam(url, 'isportsVisual', false);
  const lineups = boolParam(url, 'lineups', false);
  const theStatsEnrichment = boolParam(url, 'theStatsEnrichment', true);

  const timeoutMs = numberParam(url, 'timeoutMs', 18000, 3000, 55000);
  const liveLimit = numberParam(url, 'limit', 6, 1, 20);
  const animationLimit = numberParam(url, 'animationLimit', 50, 1, 100);
  const lookaheadMinutes = numberParam(url, 'lookaheadMinutes', 180, 15, 1440);
  const lookbackHours = numberParam(url, 'lookbackHours', 3, 0, 48);
  const lookaheadHours = numberParam(url, 'lookaheadHours', dbMatchId || providerMatchId ? 8 : 24, 1, 72);
  const footballLookaheadDays = numberParam(url, 'footballLookaheadDays', 7, 0, 14);
  const footballLookbackDays = numberParam(url, 'footballLookbackDays', 1, 0, 30);

  const due = {
    liveIngest: true,
    animation: force || Boolean(dbMatchId || providerMatchId) || (activeOrNear && shouldRunEvery(30, now)),
    footballData: force || (activeOrNear && shouldRunEvery(5, now)),
    knockout: force || (activeOrNear && shouldRunEvery(30, now)),
    theStats: theStatsEnrichment
      && (force || lineups || ((liveMatches > 0 || recentlyFinishedMatches > 0) && shouldRunEvery(5, now))),
  };

  const steps: StepResult[] = [];

  steps.push(await callStep('fifa_knockout_sync', '/api/cron/fifa-knockout-sync', {
    dryRun,
  }, { origin, secret, timeoutMs, due: due.knockout }));

  steps.push(await callStep('isports_live_ingest', '/api/cron/live-ingest', {
    dbMatchId: dbMatchId || undefined,
    providerMatchId: providerMatchId || undefined,
    finishedHours: 6,
    limit: liveLimit,
    maxExternalRequests: dbMatchId || providerMatchId ? 6 : 3,
    maxBrowserlessRequests: isportsVisual ? 2 : 1,
    lookaheadMinutes,
    lookbackHours,
    minIntervalSeconds: 60,
    dryRun,
  }, { origin, secret, timeoutMs, due: due.liveIngest }));

  steps.push(await callStep('isports_animation_match_link', '/api/cron/sync-animation-matches', {
    dbMatchId: dbMatchId || undefined,
    providerMatchId: providerMatchId || undefined,
    lookaheadHours,
    lookbackHours,
    dryRun,
    threshold: 45,
    limit: animationLimit,
  }, { origin, secret, timeoutMs, due: due.animation }));

  steps.push(await callStep('football_data_confirmation', '/api/cron/football-data-results-sync', {
    lookbackDays: footballLookbackDays,
    lookaheadDays: footballLookaheadDays,
    competition: url.searchParams.get('competition') || 'WC',
    season: url.searchParams.get('season') || '2026',
    quick: boolParam(url, 'footballQuick', true),
    dryRun,
  }, { origin, secret, timeoutMs, due: due.footballData }));

  const statisticsCompletion = await callStep('the_stats_completion', '/api/cron/match-complete-pipeline', {
    matchId: dbMatchId || undefined,
    includeResults: false,
    includeContent: false,
    maxSteps: 1,
    lookbackDays: numberParam(url, 'theStatsDays', 60, 1, 60),
    lookaheadHours: 6,
    candidateLimit: 120,
    stepTimeoutMs: numberParam(url, 'theStatsTimeoutMs', 18000, 3000, 55000),
  }, { origin, secret, timeoutMs, due: due.theStats });
  steps.push(statisticsCompletion);

  const statisticsMatchId = selectedMatchId(statisticsCompletion);
  steps.push(await callStep('player_performance_materialization', '/api/cron/the-stats-player-performance-sync-safe', {
    matchId: statisticsMatchId || undefined,
    limit: 1,
    lookbackDays: 365,
    dryRun,
  }, { origin, secret, timeoutMs, due: due.theStats && Boolean(statisticsMatchId) }));

  const ran = steps.filter((step) => step.due);
  const failed = ran.filter((step) => step.ok === false);

  return json({
    ok: failed.length === 0,
    mode: 'live_autopilot_orchestrator_v1_existing_crons',
    at: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    origin,
    cadence: {
      liveIngest: 'every_run',
      animation: 'every_30_minutes_or_priority_match',
      footballData: 'every_5_minutes_around_matches',
      knockout: 'every_30_minutes_around_matches',
      theStats: 'every_5_minutes_during_live_or_recent_postmatch',
    },
    scope: { dbMatchId: dbMatchId || null, providerMatchId: providerMatchId || null, isportsVisual, lineups, dryRun },
    syncWindow: { liveMatches, nearMatches, recentlyFinishedMatches, activeOrNear },
    summary: { total: steps.length, ran: ran.length, skipped: steps.length - ran.length, failed: failed.length },
    steps,
  }, failed.length ? 207 : 200);
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
