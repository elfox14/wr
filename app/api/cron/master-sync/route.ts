import { NextResponse } from 'next/server';

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
  payload?: unknown;
};

function getAuth(req: Request) {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  if (!expected) return { valid: false, method: 'missing_server_secret' };

  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  const adminHeader = req.headers.get('x-admin-secret') || '';
  const cronQuery = url.searchParams.get('cronSecret') || '';
  const adminQuery = url.searchParams.get('adminSecret') || '';
  const keyQuery = url.searchParams.get('key') || '';

  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'cronSecret_query', value: cronQuery },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'key_query', value: keyQuery },
  ];

  const matched = candidates.find((item) => item.value && item.value === expected);
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function shouldRunAnimationSync(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('animation') === 'false') return false;
  if (url.searchParams.get('forceAnimation') === 'true') return true;

  const minute = new Date().getUTCMinutes();
  return minute % 5 === 0;
}

async function runStep(origin: string, name: string, path: string, secret: string, query?: Record<string, string>): Promise<StepResult> {
  const started = Date.now();
  const target = new URL(`${origin}${path}`);

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

    return {
      name,
      path,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - started,
      payload,
    };
  } catch (error: any) {
    return {
      name,
      path,
      ok: false,
      status: 500,
      durationMs: Date.now() - started,
      payload: { error: error?.message || 'Request failed' },
    };
  }
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const secret = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  const date = url.searchParams.get('date') || '';
  const forceAnimation = url.searchParams.get('forceAnimation') === 'true';
  const runAnimation = shouldRunAnimationSync(req);
  const startedAt = new Date();
  const steps: StepResult[] = [];

  if (runAnimation) {
    steps.push(await runStep(origin, 'sync-animation-matches', '/api/cron/sync-animation-matches', secret, {
      dryRun: 'false',
    }));
  } else {
    steps.push({
      name: 'sync-animation-matches',
      path: '/api/cron/sync-animation-matches',
      ok: true,
      status: 200,
      skipped: true,
      reason: 'Runs every 5 minutes by default. Use forceAnimation=true to run now.',
    });
  }

  steps.push(await runStep(origin, 'football-auto-sync', '/api/cron/football-auto-sync', secret, {
    ...(date ? { date } : {}),
  }));

  steps.push(await runStep(origin, 'live-market-sync', '/api/cron/live-market-sync', secret, {
    ...(date ? { date } : {}),
  }));

  const ok = steps.every((step) => step.ok || step.skipped);

  return NextResponse.json({
    ok,
    mode: 'master_sync',
    authMethod: auth.method,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    animationSyncRan: runAnimation,
    forceAnimation,
    steps,
  }, {
    status: ok ? 200 : 207,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
