# Finished Matches Backfill Worker

This worker is responsible for filling finished matches with final post-match data.

It is intentionally server-side only. Public pages continue to read saved database state and never call external providers during page load.

## Purpose

For every finished match, the worker:

1. Resolves the TheStats provider match id.
2. Fetches full post-match extras from TheStats.
3. Saves a `THE_STATS_API_EXTRAS` `MatchStatsSnapshot`.
4. Projects final timeline / shotmap items into `MatchEvent` rows.
5. Projects final player stats into `PlayerPerformance` rows when a local player asset can be matched.
6. Rebuilds `LiveAnimationEvent` rows from saved DB events.
7. Writes a `FINISHED_MATCHES_BACKFILL_SUMMARY` snapshot with data quality.
8. Marks the match as `FINAL_VERIFIED` when useful final data was saved.

## Public architecture

```text
TheStats / provider APIs
↓
Cron / Worker only
↓
Database snapshots + events + player performances
↓
Public pages read DB only
```

## Route

```text
/api/cron/finished-matches-backfill
```

The route supports `GET` and `POST` and requires the admin secret header.

## Manual commands

### Dry run for one match

```bash
curl -X POST \
  -H "Authorization: Bearer SECRET_NEW" \
  "https://worldcup.mcprim.com/api/cron/finished-matches-backfill?matchId=cmq6vhgfh0128g7g4ntiqi8hf&force=true&dryRun=true"
```

### Update one match

```bash
curl -X POST \
  -H "Authorization: Bearer SECRET_NEW" \
  "https://worldcup.mcprim.com/api/cron/finished-matches-backfill?matchId=cmq6vhgfh0128g7g4ntiqi8hf&force=true"
```

### Update latest finished matches

```bash
curl -X POST \
  -H "Authorization: Bearer SECRET_NEW" \
  "https://worldcup.mcprim.com/api/cron/finished-matches-backfill?limit=5&lookbackDays=14"
```

## Query parameters

| Param | Default | Meaning |
|---|---:|---|
| `matchId` | empty | Run for a single match only |
| `limit` | `5` | Max non-skipped matches to process |
| `lookbackDays` | `14` | Candidate finished match lookback |
| `freshnessHours` | `24` | Skip if a recent full TheStats extras snapshot exists |
| `timeoutMs` | `30000` | Per-request provider timeout |
| `force` | `false` | Ignore recent/full snapshot skip rules |
| `dryRun` | `false` | Fetch/analyze without saving |
| `includeRaw` | `false` | Store raw provider payloads in snapshot |
| `stopOnRateLimit` | `true` | Stop early on 429/rate limit |
| `syncAnimation` | `true` | Rebuild `LiveAnimationEvent` after saving events |
| `markVerified` | `true` | Mark useful matches as `FINAL_VERIFIED` |

## Render Cron

Command:

```bash
npm run worker:finished-matches-backfill
```

Recommended env:

```env
FINISHED_MATCHES_BACKFILL_TARGET_ORIGIN=https://worldcup.mcprim.com
FINISHED_MATCHES_BACKFILL_LIMIT=5
FINISHED_MATCHES_BACKFILL_LOOKBACK_DAYS=14
FINISHED_MATCHES_BACKFILL_FRESHNESS_HOURS=24
FINISHED_MATCHES_BACKFILL_TIMEOUT_MS=30000
FINISHED_MATCHES_BACKFILL_FORCE=false
FINISHED_MATCHES_BACKFILL_DRY_RUN=false
FINISHED_MATCHES_BACKFILL_INCLUDE_RAW=false
FINISHED_MATCHES_BACKFILL_STOP_ON_RATE_LIMIT=true
FINISHED_MATCHES_BACKFILL_SYNC_ANIMATION=true
FINISHED_MATCHES_BACKFILL_MARK_VERIFIED=true
ADMIN_API_SECRET=SECRET_NEW
```

## Safe schedule

During tournament days:

```text
Every 30-60 minutes: limit=3 to 5
Every 2-3 hours: limit=5 to 10
Daily after midnight Cairo time: force=false, lookbackDays=2
```

Start conservatively because provider rate limits can occur.

## Output shape

Successful run returns:

```json
{
  "ok": true,
  "mode": "finished_matches_backfill_worker_v1",
  "processed": [
    {
      "matchId": "...",
      "ok": true,
      "counts": {
        "stats": 12,
        "detailedEvents": 31,
        "shots": 18,
        "playerStats": 28,
        "lineups": 1
      },
      "quality": {
        "dataQuality": "complete",
        "saved": true
      },
      "projections": {
        "events": { "inserted": 20, "skipped": 4 },
        "players": { "upserted": 22, "skipped": 6 }
      },
      "markedFinalVerified": true
    }
  ]
}
```

## Data quality

The summary snapshot records:

```text
complete
partial
missing
```

No values are invented. If a provider endpoint is missing or rate limited, the run reports it and the match stays partial or missing.

## Important notes

- iSports timeline can remain useful for live events.
- TheStats is preferred after full time because it provides better player/stat identity.
- Re-running with `force=false` is safe because recent full extras are skipped.
- Re-running with `force=true` is for manual repair or backfills.
- Public pages never call TheStats directly.
