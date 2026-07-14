const origin = String(
  process.env.MATCH_EXTRAS_TARGET_ORIGIN ||
  process.env.POST_MATCH_CONTENT_TARGET_ORIGIN ||
  process.env.LIVE_INGEST_TARGET_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const matchId = process.env.MATCH_EXTRAS_MATCH_ID || process.argv[2];
const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET || '';

function boolFrom(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberFrom(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

if (!matchId) {
  console.error('[match-extras-snapshot-worker] Missing MATCH_EXTRAS_MATCH_ID or first CLI argument.');
  process.exit(1);
}

if (!secret) {
  console.error('[match-extras-snapshot-worker] Missing ADMIN_API_SECRET or CRON_SECRET.');
  process.exit(1);
}

const allowStaleTarget = boolFrom(process.env.MATCH_EXTRAS_ALLOW_STALE_TARGET, false);
const maxFinishedAgeHours = numberFrom(process.env.MATCH_EXTRAS_MAX_FINISHED_AGE_HOURS, 48, 1, 24 * 365);

if (!allowStaleTarget) {
  try {
    const matchResponse = await fetch(new URL(`/api/matches/${encodeURIComponent(matchId)}`, origin), {
      headers: { accept: 'application/json' },
    });
    if (matchResponse.ok) {
      const match = await matchResponse.json();
      const finished = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'].includes(String(match?.status || '').toUpperCase());
      const matchTime = new Date(match?.matchDate || '').getTime();
      const ageHours = Number.isFinite(matchTime) ? (Date.now() - matchTime) / 36e5 : 0;
      if (finished && ageHours > maxFinishedAgeHours) {
        console.log(JSON.stringify({
          ok: true,
          skipped: true,
          reason: 'stale_pinned_match_target',
          matchId,
          matchDate: match.matchDate,
          ageHours: Number(ageHours.toFixed(1)),
          maxFinishedAgeHours,
          action: 'Clear MATCH_EXTRAS_MATCH_ID and use npm run worker:finished-matches-backfill-all for coverage repair.',
        }, null, 2));
        process.exit(0);
      }
    }
  } catch (error) {
    console.warn(`[match-extras-snapshot-worker] Could not validate target age; continuing safely: ${error?.message || error}`);
  }
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
