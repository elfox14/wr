export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

function secretValue() {
  return String(
    process.env.LIVE_INGEST_SECRET ||
    process.env.ADMIN_API_SECRET ||
    process.env.CRON_SECRET ||
    process.env.ADMIN_CRON_SECRET ||
    '',
  ).trim();
}

function tokenFromRequest(req: Request) {
  const url = new URL(req.url);
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const queryToken = String(
    url.searchParams.get('key') ||
    url.searchParams.get('secret') ||
    url.searchParams.get('token') ||
    '',
  ).trim();
  return bearer || queryToken;
}

function isAuthorized(req: Request) {
  const secret = secretValue();
  if (!secret) return false;
  return tokenFromRequest(req) === secret;
}

function applySafeEnvOverrides(req: Request) {
  const url = new URL(req.url);
  const allowed: Array<[string, string, number, number]> = [
    ['limit', 'LIVE_INGEST_MATCH_LIMIT', 1, 6],
    ['maxExternalRequests', 'LIVE_INGEST_MAX_EXTERNAL_REQUESTS', 1, 6],
    ['maxBrowserlessRequests', 'LIVE_INGEST_MAX_BROWSERLESS_REQUESTS', 0, 4],
    ['lookaheadMinutes', 'LIVE_INGEST_LOOKAHEAD_MINUTES', 0, 180],
    ['lookbackHours', 'LIVE_INGEST_LOOKBACK_HOURS', 1, 12],
    ['finishedHours', 'LIVE_INGEST_FINISHED_HOURS', 0, 6],
    ['minIntervalSeconds', 'LIVE_INGEST_MIN_INTERVAL_SECONDS', 15, 600],
  ];

  const previous: Record<string, string | undefined> = {};

  for (const [paramName, envName, min, max] of allowed) {
    const raw = url.searchParams.get(paramName);
    if (raw === null || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    previous[envName] = process.env[envName];
    process.env[envName] = String(Math.max(min, Math.min(max, Math.floor(value))));
  }

  // The HTTP endpoint must run once only. Loop mode is only for Render background workers.
  previous.LIVE_INGEST_LOOP = process.env.LIVE_INGEST_LOOP;
  process.env.LIVE_INGEST_LOOP = 'false';

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const restoreEnv = applySafeEnvOverrides(req);
  const startedAt = Date.now();

  try {
    const mod = await import('../../../../scripts/automated-live-ingest-worker.mjs');
    const runOnce = mod.runOnce as () => Promise<unknown>;
    if (typeof runOnce !== 'function') {
      return jsonResponse({ ok: false, error: 'live_ingest_runOnce_missing' }, 500);
    }

    const result = await runOnce();
    return jsonResponse({
      ok: true,
      mode: 'http_live_ingest_cron_v1',
      durationMs: Date.now() - startedAt,
      result,
    });
  } catch (error: unknown) {
    return jsonResponse({
      ok: false,
      mode: 'http_live_ingest_cron_v1',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  } finally {
    restoreEnv();
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
