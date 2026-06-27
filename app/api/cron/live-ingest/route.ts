import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const execFileAsync = promisify(execFile);

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

function safeQueryMeta(req: Request) {
  const url = new URL(req.url);
  const entries: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (/key|secret|token/i.test(key)) continue;
    entries[key] = value;
  }
  return entries;
}

async function createSyncJob(req: Request) {
  try {
    return await prisma.syncJob.create({
      data: {
        type: 'LIVE_INGEST',
        source: 'AUTOMATED_LIVE_INGEST',
        status: 'RUNNING',
        startedAt: new Date(),
        meta: {
          route: '/api/cron/live-ingest',
          query: safeQueryMeta(req),
        },
      },
      select: { id: true },
    });
  } catch (error) {
    console.error('[live-ingest-cron] failed to create SyncJob:', error);
    return null;
  }
}

async function finishSyncJob(
  job: { id: string } | null,
  status: 'SUCCESS' | 'FAILED',
  meta: Record<string, any>,
  error?: unknown,
) {
  if (!job) return;
  try {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: new Date(),
        error: error ? String((error as { message?: string })?.message || error).slice(0, 1000) : null,
        meta,
      },
    });
  } catch (updateError) {
    console.error('[live-ingest-cron] failed to update SyncJob:', updateError);
  }
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

  previous.LIVE_INGEST_LOOP = process.env.LIVE_INGEST_LOOP;
  process.env.LIVE_INGEST_LOOP = 'false';

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function parseWorkerSummary(stdout: string) {
  const text = String(stdout || '').trim();
  const marker = '\n{';
  const index = text.lastIndexOf(marker);
  const jsonText = index >= 0 ? text.slice(index + 1) : text;
  try {
    return JSON.parse(jsonText);
  } catch {
    return { raw: text.slice(-12000) };
  }
}

async function runFreshWorkerProcess() {
  const timeoutMs = Number(process.env.LIVE_INGEST_HTTP_PROCESS_TIMEOUT_MS || 55000);
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['scripts/automated-live-ingest-worker.mjs'],
    {
      cwd: process.cwd(),
      env: { ...process.env, LIVE_INGEST_LOOP: 'false' },
      timeout: Math.max(15000, Math.min(90000, timeoutMs)),
      maxBuffer: 1024 * 1024 * 4,
    },
  );

  return {
    stdout: stdout ? String(stdout).slice(-12000) : '',
    stderr: stderr ? String(stderr).slice(-4000) : '',
    summary: parseWorkerSummary(String(stdout || '')),
  };
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const restoreEnv = applySafeEnvOverrides(req);
  const startedAt = Date.now();
  const syncJob = await createSyncJob(req);

  try {
    const worker = await runFreshWorkerProcess();
    const responsePayload = {
      ok: true,
      mode: 'http_live_ingest_cron_v2_fresh_process',
      syncJobId: syncJob?.id,
      durationMs: Date.now() - startedAt,
      result: worker.summary,
      stderr: worker.stderr || undefined,
    };
    await finishSyncJob(syncJob, 'SUCCESS', {
      route: '/api/cron/live-ingest',
      query: safeQueryMeta(req),
      durationMs: responsePayload.durationMs,
      result: worker.summary,
      stderr: worker.stderr || undefined,
    });
    return jsonResponse(responsePayload);
  } catch (error: unknown) {
    const anyError = error as { message?: string; stdout?: string; stderr?: string };
    const result = anyError?.stdout ? parseWorkerSummary(String(anyError.stdout)) : undefined;
    const responsePayload = {
      ok: false,
      mode: 'http_live_ingest_cron_v2_fresh_process',
      syncJobId: syncJob?.id,
      durationMs: Date.now() - startedAt,
      error: anyError?.message || String(error),
      result,
      stderr: anyError?.stderr ? String(anyError.stderr).slice(-4000) : undefined,
    };
    await finishSyncJob(syncJob, 'FAILED', {
      route: '/api/cron/live-ingest',
      query: safeQueryMeta(req),
      durationMs: responsePayload.durationMs,
      result,
      stderr: responsePayload.stderr,
    }, error);
    return jsonResponse(responsePayload, 500);
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
