const origin = String(
  process.env.LIVE_ANIMATION_SYNC_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.MATCH_EXTRAS_SYNC_TARGET_ORIGIN ||
  'http://localhost:3000'
).replace(/\/$/, '');

const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

if (!secret) {
  console.error('[live-animation-sync-worker] Missing ADMIN_API_SECRET or CRON_SECRET.');
  process.exit(1);
}

const url = new URL('/api/cron/live-animation-sync', origin);

for (const [envName, paramName] of [
  ['LIVE_ANIMATION_SYNC_MATCH_ID', 'matchId'],
  ['LIVE_ANIMATION_SYNC_LIMIT', 'limit'],
  ['LIVE_ANIMATION_SYNC_LOOKBACK_HOURS', 'lookbackHours'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

for (const [envName, paramName] of [
  ['LIVE_ANIMATION_SYNC_ALLOW_FINISHED', 'allowFinished'],
  ['LIVE_ANIMATION_SYNC_DRY_RUN', 'dryRun'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isTransientEmptyResponse(response, payload, text) {
  const status = response?.status || 0;
  return (!text || text.trim() === '') && (status === 0 || status === 502 || status === 503 || status === 504 || status >= 500);
}

async function runOnce(attempt) {
  console.log(`[live-animation-sync-worker] Running ${url.href.replace(/(key|token|secret)=[^&]+/gi, '$1=***')} attempt=${attempt}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });

  const text = await response.text();
  const payload = parsePayload(text);
  console.log(JSON.stringify(payload, null, 2));

  if (response.ok && payload.ok) {
    return { ok: true, response, payload, text };
  }

  return { ok: false, response, payload, text, transientEmpty: isTransientEmptyResponse(response, payload, text) };
}

const maxAttempts = Number(process.env.LIVE_ANIMATION_SYNC_RETRY_ATTEMPTS || 3);
let lastResult = null;

for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
  try {
    lastResult = await runOnce(attempt);
    if (lastResult.ok) process.exit(0);

    if (!lastResult.transientEmpty && attempt >= maxAttempts) {
      process.exit(1);
    }
  } catch (error) {
    lastResult = { ok: false, error: error?.message || String(error) };
    console.error('[live-animation-sync-worker] Request failed:', lastResult.error);
    if (attempt >= maxAttempts) process.exit(1);
  }

  await sleep(Math.min(15000, 1500 * attempt));
}

if (lastResult?.transientEmpty) {
  console.warn('[live-animation-sync-worker] Transient empty response after retries; treating as soft success to avoid noisy Render alerts.');
  process.exit(0);
}

process.exit(1);
