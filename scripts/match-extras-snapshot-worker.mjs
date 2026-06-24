const origin = String(
  process.env.MATCH_EXTRAS_TARGET_ORIGIN ||
  process.env.POST_MATCH_CONTENT_TARGET_ORIGIN ||
  process.env.LIVE_INGEST_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const matchId = process.env.MATCH_EXTRAS_MATCH_ID || process.argv[2];
const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

if (!matchId) {
  console.error('[match-extras-snapshot-worker] Missing MATCH_EXTRAS_MATCH_ID or first CLI argument.');
  process.exit(1);
}

if (!secret) {
  console.error('[match-extras-snapshot-worker] Missing ADMIN_API_SECRET or CRON_SECRET.');
  process.exit(1);
}

const url = new URL(`/api/admin/matches/${encodeURIComponent(matchId)}/extras-snapshot`, origin);
url.searchParams.set('timeoutMs', process.env.MATCH_EXTRAS_TIMEOUT_MS || process.env.THE_STATS_API_TIMEOUT_MS || '15000');
if (process.env.MATCH_EXTRAS_INCLUDE_RAW === 'true') url.searchParams.set('includeRaw', 'true');
if (process.env.MATCH_EXTRAS_DRY_RUN === 'true') url.searchParams.set('dryRun', 'true');

console.log(`[match-extras-snapshot-worker] Syncing ${matchId} via ${url.origin}`);

const response = await fetch(url, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${secret}`,
  },
});

const text = await response.text();
let payload;
try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

console.log(JSON.stringify(payload, null, 2));

if (!response.ok || !payload.ok) {
  process.exit(1);
}
