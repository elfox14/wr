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

console.log(`[live-animation-sync-worker] Running ${url.href.replace(/(key|token|secret)=[^&]+/gi, '$1=***')}`);

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
