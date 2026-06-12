import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StepResult = {
  name: string;
  path: string;
  ok: boolean;
  status: number;
  skipped?: boolean;
  reason?: string;
  durationMs?: number;
  targetUrl?: string;
  payload?: unknown;
};

type SyncWindow = {
  now: string;
  liveOrInPlayMatches: number;
  nearUpcomingMatches: number;
  recentlyFinishedMatches: number;
  activeOrNear: boolean;
  nearWindowHours: number;
  recentWindowHours: number;
};

function configuredSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function downstreamSecret() {
  return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim();
}

function getAuth(req: Request) {
  const validSecrets = configuredSecrets();
  if (validSecrets.length === 0) return { valid: false, method: 'missing_server_secret' };

  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret')?.trim() || '';
  const adminHeader = req.headers.get('x-admin-secret')?.trim() || '';
  const cronQuery = url.searchParams.get('cronSecret')?.trim() || '';
  const adminQuery = url.searchParams.get('adminSecret')?.trim() || '';
  const keyQuery = url.searchParams.get('key')?.trim() || '';

  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'cronSecret_query', value: cronQuery },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'key_query', value: keyQuery },
  ];

  const matched = candidates.find((item) => item.value && validSecrets.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function getCronBaseUrl(req: Request) {
  const configured = (process.env.CRON_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const url = new URL(req.url);
  return url.origin;
}

async function getSyncWindow(req: Request): Promise<SyncWindow> {
  const url = new URL(req.url);
  const now = new Date();
  const nearWindowHours = Math.min(Math.max(Number(url.searchParams.get('nearHours') || 3), 1), 12);
  const recentWindowHours = Math.min(Math.max(Number(url.searchParams.get('recentHours') || 4), 1), 12);
  const nearUntil = new Date(now.getTime() + nearWindowHours * 60 * 60 * 1000);
  const recentSince = new Date(now.getTime() - recentWindowHours * 60 * 60 * 1000);

  const [liveOrInPlayMatches, nearUpcomingMatches, recentlyFinishedMatches] = await Promise.all([
    prisma.match.count({ where: { status: { in: ['IN_PLAY', 'LIVE'] } } }),
    prisma.match.count({ where: { status: 'SCHEDULED', matchDate: { gte: now, lte: nearUntil } } }),
    prisma.match.count({ where: { status: 'FINISHED', matchDate: { gte: recentSince, lte: now } } }),
  ]);

  return {
    now: now.toISOString(),
    liveOrInPlayMatches,
    nearUpcomingMatches,
    recentlyFinishedMatches,
    activeOrNear: liveOrInPlayMatches > 0 || nearUpcomingMatches > 0 || recentlyFinishedMatches > 0,
    nearWindowHours,
    recentWindowHours,
  };
}

function minuteModulo(interval: number) {
  return new Date().getUTCMinutes() % interval === 0;
}

function shouldRunAnimationSync(req: Request, window: SyncWindow) {
  const url = new URL(req.url);
  if (url.searchParams.get('animation') === 'false') return false;
  if (url.searchParams.get('forceAnimation') === 'true') return true;
  if (!window.activeOrNear) return false;

  const interval = Math.min(Math.max(Number(url.searchParams.get('animationInterval') || 15), 5), 60);
  return minuteModulo(interval);
}

function shouldRunLiveMarket(req: Request, window: SyncWindow) {
  const url = new URL(req.url);
  if (url.searchParams.get('liveMarket') === 'false') return false;
  if (url.searchParams.get('forceLive') === 'true') return true;
  return window.activeOrNear;
}

function shouldRunDemandUpdate(req: Request, window: SyncWindow) {
  const url = new URL(req.url);
  if (url.searchParams.get('demand') === 'false') return false;
  if (url.searchParams.get('forceDemand') === 'true') return true;
  if (!window.activeOrNear) return false;
  const interval = Math.min(Math.max(Number(url.searchParams.get('demandInterval') || 15), 5), 120);
  return minuteModulo(interval);
}

function shouldRunFootballAuto(req: Request, window: SyncWindow) {
  const url = new URL(req.url);
  if (url.searchParams.get('footballAuto') === 'false') return false;
  if (url.searchParams.get('includeFootballAuto') === 'true') return true;
  if (process.env.ENABLE_API_FOOTBALL_CRON !== 'true') return false;
  if (!window.activeOrNear) return false;

  const interval = Math.min(Math.max(Number(url.searchParams.get('footballAutoInterval') || 120), 30), 720);
  return minuteModulo(interval);
}

async function runStep(baseUrl: string, name: string, path: string, secret: string, query?: Record<string, string>): Promise<StepResult> {
  const started = Date.now();
  const target = new URL(`${baseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) target.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        authorization: `Bearer ${secret}`,
        'x-cron-secret': secret,
        accept: 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    const logicalOk = response.ok || response.status === 207;

    return {
      name,
      path,
      ok: logicalOk,
      status: response.status,
      durationMs: Date.now() - started,
      targetUrl: target.toString().replace(/(cronSecret|adminSecret|key)=([^&]+)/g, '$1=***'),
      payload,
    };
  } catch (error: any) {
    return {
      name,
      path,
      ok: false,
      status: 599,
      durationMs: Date.now() - started,
      targetUrl: target.toString().replace(/(cronSecret|adminSecret|key)=([^&]+)/g, '$1=***'),
      payload: {
        error: error?.message || 'Request failed',
        hint: 'Downstream cron endpoint could not be reached from master-sync. Set CRON_BASE_URL=https://worldcup.mcprim.com in Render, redeploy, then retry. If it still fails, use external-run jobs separately.',
      },
    };
  }
}

function skippedStep(name: string, path: string, reason: string): StepResult {
  return { name, path, ok: true, status: 200, skipped: true, reason };
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const baseUrl = getCronBaseUrl(req);
  const secret = downstreamSecret();
  const date = url.searchParams.get('date') || '';
  const forceAnimation = url.searchParams.get('forceAnimation') === 'true';
  const forceDemand = url.searchParams.get('forceDemand') === 'true';
  const allowApiFootballFallback = url.searchParams.get('allowApiFootballFallback') === 'true' || url.searchParams.get('providerFallback') === 'true';
  const startedAt = new Date();
  const steps: StepResult[] = [];
  const syncWindow = await getSyncWindow(req);
  const runAnimation = shouldRunAnimationSync(req, syncWindow);
  const runLive = shouldRunLiveMarket(req, syncWindow);
  const runDemand = shouldRunDemandUpdate(req, syncWindow);
  const runFootballAuto = shouldRunFootballAuto(req, syncWindow);

  if (runAnimation) {
    steps.push(await runStep(baseUrl, 'sync-animation-matches', '/api/cron/sync-animation-matches', secret, {
      dryRun: 'false',
    }));
  } else {
    steps.push(skippedStep(
      'sync-animation-matches',
      '/api/cron/sync-animation-matches',
      syncWindow.activeOrNear ? 'Budget mode: runs every 15 minutes by default. Use forceAnimation=true to run now.' : 'No live, near, or recently finished local matches.'
    ));
  }

  if (runFootballAuto) {
    steps.push(await runStep(baseUrl, 'football-auto-sync', '/api/cron/football-auto-sync', secret, {
      ...(date ? { date } : {}),
    }));
  } else {
    steps.push(skippedStep(
      'football-auto-sync',
      '/api/cron/football-auto-sync',
      'API-Football budget protection: skipped by default. Use includeFootballAuto=true manually or set ENABLE_API_FOOTBALL_CRON=true with a long interval.'
    ));
  }

  if (runLive) {
    steps.push(await runStep(baseUrl, 'live-market-sync', '/api/cron/live-market-sync', secret, {
      ...(date ? { date } : {}),
      ...(allowApiFootballFallback ? { allowApiFootballFallback: 'true' } : {}),
    }));
  } else {
    steps.push(skippedStep('live-market-sync', '/api/cron/live-market-sync', 'No live, near, or recently finished local matches.'));
  }

  if (runDemand) {
    steps.push(await runStep(baseUrl, 'update-demand', '/api/cron/update-demand', secret));
  } else {
    steps.push(skippedStep('update-demand', '/api/cron/update-demand', syncWindow.activeOrNear ? 'Runs every 15 minutes by default during live windows. Use forceDemand=true to run now.' : 'No live, near, or recently finished local matches.'));
  }

  const ok = steps.every((step) => step.ok || step.skipped);

  return NextResponse.json({
    ok,
    mode: 'budget_aware_master_sync',
    authMethod: auth.method,
    baseUrl: baseUrl.replace(/(cronSecret|adminSecret|key)=([^&]+)/g, '$1=***'),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    syncWindow,
    animationSyncRan: runAnimation,
    footballAutoSyncRan: runFootballAuto,
    liveMarketSyncRan: runLive,
    demandUpdateRan: runDemand,
    forceAnimation,
    forceDemand,
    allowApiFootballFallback,
    apiFootballProtection: {
      enabled: true,
      defaultBehavior: 'football-auto-sync is skipped unless includeFootballAuto=true or ENABLE_API_FOOTBALL_CRON=true',
      liveFallbackDefault: 'disabled unless allowApiFootballFallback=true is passed',
      dailyLimitTarget: 100,
    },
    steps,
  }, {
    status: ok ? 200 : 207,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
