const origin = String(
  process.env.FINISHED_MATCHES_BACKFILL_TARGET_ORIGIN ||
  process.env.MATCH_EXTRAS_SYNC_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

if (!secret) {
  console.error('[finished-matches-backfill-all-worker] Missing required admin secret environment variable.');
  process.exit(1);
}

function numberFrom(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function boolFrom(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(payload) {
  if (!payload) return false;
  if (payload.stoppedEarly && String(payload.stoppedEarly).toLowerCase().includes('rate')) return true;
  return JSON.stringify(payload.processed || []).toLowerCase().includes('429') || JSON.stringify(payload.processed || []).toLowerCase().includes('rate_limited');
}

function processedWorkCount(payload) {
  return Array.isArray(payload?.processed) ? payload.processed.filter((item) => item && !item.skipped && item.ok !== false).length : 0;
}

const batches = numberFrom(process.env.FINISHED_MATCHES_BACKFILL_ALL_BATCHES, 12, 1, 100);
const limit = numberFrom(process.env.FINISHED_MATCHES_BACKFILL_LIMIT, 2, 1, 5);
const lookbackDays = numberFrom(process.env.FINISHED_MATCHES_BACKFILL_LOOKBACK_DAYS, 120, 1, 365);
const freshnessHours = numberFrom(process.env.FINISHED_MATCHES_BACKFILL_FRESHNESS_HOURS, 24, 1, 720);
const timeoutMs = numberFrom(process.env.FINISHED_MATCHES_BACKFILL_TIMEOUT_MS || process.env.THE_STATS_API_TIMEOUT_MS, 30000, 3000, 60000);
const delaySeconds = numberFrom(process.env.FINISHED_MATCHES_BACKFILL_BATCH_DELAY_SECONDS, 120, 10, 3600);
const includeRaw = boolFrom(process.env.FINISHED_MATCHES_BACKFILL_INCLUDE_RAW, true);
const syncAnimation = boolFrom(process.env.FINISHED_MATCHES_BACKFILL_SYNC_ANIMATION, false);
const markVerified = boolFrom(process.env.FINISHED_MATCHES_BACKFILL_MARK_VERIFIED, true);

console.log('[finished-matches-backfill-all-worker] Running in all-matches mode. FINISHED_MATCHES_BACKFILL_MATCH_ID is intentionally ignored.');
console.log(JSON.stringify({ origin, batches, limit, lookbackDays, freshnessHours, timeoutMs, delaySeconds, includeRaw, syncAnimation, markVerified }, null, 2));

for (let batch = 1; batch <= batches; batch += 1) {
  const url = new URL('/api/cron/finished-matches-backfill', origin);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lookbackDays', String(lookbackDays));
  url.searchParams.set('freshnessHours', String(freshnessHours));
  url.searchParams.set('timeoutMs', String(timeoutMs));
  url.searchParams.set('force', 'false');
  url.searchParams.set('dryRun', 'false');
  url.searchParams.set('includeRaw', String(includeRaw));
  url.searchParams.set('syncAnimation', String(syncAnimation));
  url.searchParams.set('markVerified', String(markVerified));
  url.searchParams.set('stopOnRateLimit', 'true');

  console.log(`[finished-matches-backfill-all-worker] Batch ${batch}/${batches}: ${url.href}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  console.log(JSON.stringify(payload, null, 2));

  if (!response.ok || !payload.ok) {
    console.error('[finished-matches-backfill-all-worker] Request failed. Stopping.');
    process.exit(1);
  }

  if (isRateLimited(payload)) {
    console.log('[finished-matches-backfill-all-worker] Rate limit detected. Stop now and run again later.');
    break;
  }

  if (processedWorkCount(payload) === 0) {
    console.log('[finished-matches-backfill-all-worker] No new matches processed in this batch. All currently eligible matches may be complete or skipped.');
    break;
  }

  if (batch < batches) {
    console.log(`[finished-matches-backfill-all-worker] Waiting ${delaySeconds}s before next batch...`);
    await sleep(delaySeconds * 1000);
  }
}
