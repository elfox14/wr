#!/usr/bin/env node

const origin = String(
  process.env.POST_MATCH_STATS_SYNC_TARGET_ORIGIN ||
  process.env.LIVE_INGEST_TARGET_ORIGIN ||
  process.env.MATCH_EXTRAS_SYNC_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

if (!secret) {
  console.error('[post-match-stats-sync-worker] Missing ADMIN_API_SECRET or CRON_SECRET.');
  process.exit(1);
}

function numberFromEnv(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorSummary(error) {
  return {
    name: error?.name || null,
    message: String(error?.message || error),
    code: error?.code || error?.cause?.code || null,
    cause: error?.cause?.message || null,
  };
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

const url = new URL('/api/cron/post-match-stats-sync', origin);

for (const [envName, paramName] of [
  ['POST_MATCH_STATS_SYNC_HOURS', 'hours'],
  ['POST_MATCH_STATS_SYNC_LIMIT', 'limit'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

if (process.env.POST_MATCH_STATS_SYNC_DEBUG) {
  url.searchParams.set('debug', process.env.POST_MATCH_STATS_SYNC_DEBUG);
}

const maxAttempts = numberFromEnv('POST_MATCH_STATS_WORKER_MAX_ATTEMPTS', 3, 1, 5);
const retryDelayMs = numberFromEnv('POST_MATCH_STATS_WORKER_RETRY_DELAY_MS', 3000, 500, 30000);
const workerTimeoutMs = numberFromEnv('POST_MATCH_STATS_WORKER_TIMEOUT_MS', 90000, 10000, 180000);

console.log(`[post-match-stats-sync-worker] Running ${url.href.replace(/key=[^&]+/g, 'key=***')}`);

let lastError = null;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const { response, payload } = await fetchJsonWithTimeout(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${secret}`,
        'x-cron-secret': secret,
        accept: 'application/json',
      },
    }, workerTimeoutMs);

    console.log(JSON.stringify({
      workerAttempt: attempt,
      workerMaxAttempts: maxAttempts,
      ...payload,
    }, null, 2));

    if (!response.ok || !payload.ok) process.exit(1);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(JSON.stringify({
      ok: false,
      worker: 'post-match-stats-sync-worker',
      workerAttempt: attempt,
      workerMaxAttempts: maxAttempts,
      transportError: true,
      error: errorSummary(error),
    }, null, 2));

    if (attempt < maxAttempts) await sleep(retryDelayMs * attempt);
  }
}

console.error(JSON.stringify({
  ok: false,
  worker: 'post-match-stats-sync-worker',
  transportError: true,
  error: errorSummary(lastError),
}, null, 2));

process.exit(1);
