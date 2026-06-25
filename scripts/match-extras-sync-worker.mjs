#!/usr/bin/env node

const origin = String(
  process.env.MATCH_EXTRAS_SYNC_TARGET_ORIGIN ||
  process.env.MATCH_EXTRAS_TARGET_ORIGIN ||
  process.env.POST_MATCH_CONTENT_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

if (!secret) {
  console.error('[match-extras-sync-worker] Missing ADMIN_API_SECRET or CRON_SECRET.');
  process.exit(1);
}

function numberFromEnv(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function boolFromEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
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
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

const url = new URL('/api/cron/match-extras-sync', origin);

for (const [envName, paramName] of [
  ['MATCH_EXTRAS_SYNC_LIMIT', 'limit'],
  ['MATCH_EXTRAS_SYNC_LOOKBACK_DAYS', 'lookbackDays'],
  ['MATCH_EXTRAS_SYNC_FRESHNESS_HOURS', 'freshnessHours'],
  ['MATCH_EXTRAS_TIMEOUT_MS', 'timeoutMs'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

for (const [envName, paramName] of [
  ['MATCH_EXTRAS_SYNC_ALLOW_LIVE', 'allowLive'],
  ['MATCH_EXTRAS_SYNC_FORCE', 'force'],
  ['MATCH_EXTRAS_SYNC_DRY_RUN', 'dryRun'],
  ['MATCH_EXTRAS_INCLUDE_RAW', 'includeRaw'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

const maxAttempts = numberFromEnv('MATCH_EXTRAS_WORKER_MAX_ATTEMPTS', 3, 1, 5);
const retryDelayMs = numberFromEnv('MATCH_EXTRAS_WORKER_RETRY_DELAY_MS', 3000, 500, 30000);
const workerTimeoutMs = numberFromEnv('MATCH_EXTRAS_WORKER_TIMEOUT_MS', 90000, 10000, 180000);
const softFailTransportErrors = boolFromEnv('MATCH_EXTRAS_WORKER_SOFT_FAIL_TRANSPORT_ERRORS', true);

console.log(`[match-extras-sync-worker] Running ${url.href.replace(/key=[^&]+/g, 'key=***')}`);

let lastError = null;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const { response, payload } = await fetchJsonWithTimeout(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        accept: 'application/json',
      },
    }, workerTimeoutMs);

    console.log(JSON.stringify({
      workerAttempt: attempt,
      workerMaxAttempts: maxAttempts,
      ...payload,
    }, null, 2));

    if (!response.ok || !payload.ok) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(JSON.stringify({
      ok: false,
      worker: 'match-extras-sync-worker',
      workerAttempt: attempt,
      workerMaxAttempts: maxAttempts,
      transportError: true,
      error: errorSummary(error),
    }, null, 2));

    if (attempt < maxAttempts) {
      await sleep(retryDelayMs * attempt);
    }
  }
}

console.error(JSON.stringify({
  ok: false,
  worker: 'match-extras-sync-worker',
  transportError: true,
  softFailed: softFailTransportErrors,
  error: errorSummary(lastError),
  note: softFailTransportErrors
    ? 'Transport failure after retries. Cron is treated as soft-failed because public pages read the latest saved DB snapshots.'
    : 'Transport failure after retries. Set MATCH_EXTRAS_WORKER_SOFT_FAIL_TRANSPORT_ERRORS=true to avoid Render failure alerts for transient fetch errors.',
}, null, 2));

process.exit(softFailTransportErrors ? 0 : 1);
