# Match Extras Snapshot Sync

This feature stores advanced match data in the database so public match pages remain DB-only.

## Endpoint

```text
POST /api/admin/matches/[id]/extras-snapshot
```

Authorization uses the existing admin auth helper.

## What it does

The endpoint calls TheStats from the server with `endpointMode=full`, then saves a `MatchStatsSnapshot` when useful data is returned.

It can include match info, stats, lineups, timeline, shotmap, and playerStats.

Public pages still do not fetch providers directly. They only read saved snapshots.

## Test a match

Use the admin header configured in Render, then verify:

```text
https://worldcup.mcprim.com/api/matches/MATCH_ID/advanced-visuals
```

## Worker

```bash
MATCH_EXTRAS_MATCH_ID=MATCH_ID npm run worker:match-extras-snapshot
```

Useful env vars:

```env
MATCH_EXTRAS_TARGET_ORIGIN=https://worldcup.mcprim.com
MATCH_EXTRAS_MATCH_ID=
MATCH_EXTRAS_TIMEOUT_MS=15000
MATCH_EXTRAS_INCLUDE_RAW=false
MATCH_EXTRAS_DRY_RUN=false
MATCH_EXTRAS_MAX_FINISHED_AGE_HOURS=48
MATCH_EXTRAS_ALLOW_STALE_TARGET=false
```

The single-match worker refuses to call the provider for a finished match older than the configured age. This protects the provider quota when a stale `MATCH_EXTRAS_MATCH_ID` remains pinned in a scheduler. Use the finished-matches backfill worker for historical coverage instead.
