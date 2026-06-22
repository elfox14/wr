# Automated Live Ingest Worker

This worker is the next layer after the DB-only match page architecture.

It keeps the public match page safe:

```text
Automated Live Ingest Worker
  -> selects candidate matches from the database
  -> fetches iSports analysis outside the public page request
  -> normalizes stats and important delta events
  -> POSTs the normalized snapshot to /api/internal/live-ingest/match-snapshot
  -> match page and /api/matches/live-stats read the database only
```

## Script

```bash
npm run worker:live-ingest
```

This runs:

```bash
node scripts/automated-live-ingest-worker.mjs
```

By default it runs once and exits. That mode is best for Render Cron Jobs.

## Required environment variables

The worker needs database access, provider access, and ingest access:

```env
DATABASE_URL=...
ISPORTS_API_KEY=...
# or ISPORTS_API_KEYS=key1,key2,key3
LIVE_INGEST_SECRET=...
LIVE_INGEST_TARGET_ORIGIN=https://worldcup.mcprim.com
```

`LIVE_INGEST_SECRET` must match the web service environment because the worker sends this value to the internal ingest endpoint as `x-live-ingest-secret`.

## Recommended Render Cron Job

Create a Render Cron Job using the same GitHub repo.

Recommended command:

```bash
npm ci --no-audit --no-fund && npx prisma generate && npm run worker:live-ingest
```

Recommended schedule during live match windows:

```text
*/3 * * * *
```

This means every 3 minutes. You can reduce/increase this depending on provider quota.

## Optional Background Worker mode

If you prefer a long-running Render Background Worker:

```env
LIVE_INGEST_LOOP=true
LIVE_INGEST_POLL_SECONDS=180
```

Command:

```bash
npm ci --no-audit --no-fund && npx prisma generate && npm run worker:live-ingest
```

The script will loop internally every `LIVE_INGEST_POLL_SECONDS` seconds.

## Safety controls

```env
LIVE_INGEST_MATCH_LIMIT=4
LIVE_INGEST_MAX_EXTERNAL_REQUESTS=4
LIVE_INGEST_MIN_INTERVAL_SECONDS=180
LIVE_INGEST_LOOKBACK_HOURS=3
LIVE_INGEST_LOOKAHEAD_MINUTES=15
LIVE_INGEST_FINISHED_HOURS=3
LIVE_INGEST_SAVE_EMPTY=false
LIVE_INGEST_INCLUDE_RAW=false
```

Meaning:

- `LIVE_INGEST_MATCH_LIMIT`: maximum candidate matches read from DB per run.
- `LIVE_INGEST_MAX_EXTERNAL_REQUESTS`: maximum provider requests per run.
- `LIVE_INGEST_MIN_INTERVAL_SECONDS`: skip a match if a worker snapshot was saved recently.
- `LIVE_INGEST_LOOKBACK_HOURS`: scheduled matches are considered live candidates from this many hours in the past.
- `LIVE_INGEST_LOOKAHEAD_MINUTES`: scheduled matches are considered candidates shortly before kickoff.
- `LIVE_INGEST_FINISHED_HOURS`: recently finished matches may still receive a final snapshot.
- `LIVE_INGEST_SAVE_EMPTY`: if false, skip snapshots with no useful mapped stats.
- `LIVE_INGEST_INCLUDE_RAW`: if true, stores raw provider payload inside snapshot raw data. Keep false unless debugging.

## Candidate selection

The worker only processes matches with `animationMatchId` and one of these conditions:

- status is live-like: `IN_PLAY`, `LIVE`, `1H`, `2H`, `HT`, `ET`, `PAUSED`
- status is `SCHEDULED` and match time is inside the live window
- status is recently finished and inside the final snapshot window

## Output

The worker logs a JSON summary:

```json
{
  "ok": true,
  "at": "2026-06-22T23:40:00.000Z",
  "candidates": 1,
  "externalRequests": 1,
  "processed": [
    {
      "matchId": "...",
      "providerMatchId": 496960921,
      "status": "saved",
      "providerStatus": "1H",
      "minute": 17,
      "hasUsefulStats": true,
      "savedEventsCount": 2,
      "snapshotId": "..."
    }
  ]
}
```

## Verification

After a run, verify the public read path:

```text
/api/matches/live-stats?dbMatchId=<matchId>
```

Expected signs:

```json
"providerSyncEnabled": false
"sourceStatus": { "mode": "database_only_no_provider_fetch" }
"hasStats": true
```

This confirms the public endpoint is still database-only while the worker is doing the provider work separately.
