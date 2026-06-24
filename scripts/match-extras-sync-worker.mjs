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

console.log(`[match-extras-sync-worker] Running ${url.href.replace(/key=[^&]+/g, 'key=***')}`);

const response = await fetch(url, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
});

const text = await response.text();
let payload;
try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
console.log(JSON.stringify(payload, null, 2));

if (!response.ok || !payload.ok) {
  process.exit(1);
}
