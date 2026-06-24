const origin = String(
  process.env.FINISHED_MATCHES_BACKFILL_TARGET_ORIGIN ||
  process.env.MATCH_EXTRAS_SYNC_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

if (!secret) {
  console.error('[finished-matches-backfill-worker] Missing required admin secret environment variable.');
  process.exit(1);
}

const url = new URL('/api/cron/finished-matches-backfill', origin);

for (const [envName, paramName] of [
  ['FINISHED_MATCHES_BACKFILL_MATCH_ID', 'matchId'],
  ['FINISHED_MATCHES_BACKFILL_LIMIT', 'limit'],
  ['FINISHED_MATCHES_BACKFILL_LOOKBACK_DAYS', 'lookbackDays'],
  ['FINISHED_MATCHES_BACKFILL_FRESHNESS_HOURS', 'freshnessHours'],
  ['FINISHED_MATCHES_BACKFILL_TIMEOUT_MS', 'timeoutMs'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

for (const [envName, paramName] of [
  ['FINISHED_MATCHES_BACKFILL_FORCE', 'force'],
  ['FINISHED_MATCHES_BACKFILL_DRY_RUN', 'dryRun'],
  ['FINISHED_MATCHES_BACKFILL_INCLUDE_RAW', 'includeRaw'],
  ['FINISHED_MATCHES_BACKFILL_STOP_ON_RATE_LIMIT', 'stopOnRateLimit'],
  ['FINISHED_MATCHES_BACKFILL_SYNC_ANIMATION', 'syncAnimation'],
  ['FINISHED_MATCHES_BACKFILL_MARK_VERIFIED', 'markVerified'],
]) {
  if (process.env[envName]) url.searchParams.set(paramName, process.env[envName]);
}

console.log(`[finished-matches-backfill-worker] Running ${url.href}`);

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
  process.exit(1);
}
