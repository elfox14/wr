# Safe old TheStatsAPI backfill

This workflow is designed to import old finished-match data without hammering TheStatsAPI.

## Route

```txt
/api/admin/the-stats-safe-old-backfill
```

Admin auth is required through the existing `requireAdmin` guard.

## Why this route exists

Do not run `THE_STATS_API_EXTRAS` as one heavy `full` request for many matches. The heavy endpoints are split into small phases:

1. `essential` → match info + match stats + lineups
2. `events` → timeline/events only
3. `shots` → shotmap only
4. `players` → player-stats only

Each run processes a tiny batch, sleeps between endpoint calls, sleeps between matches, skips matches that already have that phase saved, and stops when a 429 rate limit is detected.

## Recommended first dry run

```txt
/api/admin/the-stats-safe-old-backfill?phase=essential&limit=1&dryRun=true&skipExisting=true
```

Check the JSON response before saving.

## Safe production sequence

Run one phase at a time. Start with `limit=1`.

```txt
/api/admin/the-stats-safe-old-backfill?phase=essential&limit=1&skipExisting=true&endpointDelayMs=1200&matchDelayMs=3000
```

Then:

```txt
/api/admin/the-stats-safe-old-backfill?phase=events&limit=1&skipExisting=true&endpointDelayMs=1200&matchDelayMs=3000
```

Then:

```txt
/api/admin/the-stats-safe-old-backfill?phase=shots&limit=1&skipExisting=true&endpointDelayMs=1200&matchDelayMs=3000
```

Then:

```txt
/api/admin/the-stats-safe-old-backfill?phase=players&limit=1&skipExisting=true&endpointDelayMs=1200&matchDelayMs=3000
```

## Slightly faster but still conservative

Only use this if the API responds normally and there are no 429s:

```txt
/api/admin/the-stats-safe-old-backfill?phase=essential&limit=2&skipExisting=true&endpointDelayMs=1500&matchDelayMs=5000
```

For `players`, keep `limit=1` unless the plan is upgraded.

## Sequence mode

This can run all phases in one call, but it is safer to use manually only for one match or very small batches:

```txt
/api/admin/the-stats-safe-old-backfill?sequence=safe&limit=1&skipExisting=true&endpointDelayMs=1500&matchDelayMs=5000&phasePauseMs=8000
```

## Date filters

Use `before`, `after`, and `order` to walk through old matches:

```txt
/api/admin/the-stats-safe-old-backfill?phase=events&limit=1&before=2026-06-20T00:00:00.000Z&order=desc
```

The response includes a `next.before` or `next.after` cursor when it processed a match.

## Important rules

- Keep `includeRaw=false` unless debugging; raw payloads make snapshots heavy.
- Keep `skipExisting=true` to avoid duplicate calls.
- Stop immediately if `rateLimited=true` appears.
- Do not use odds or betting endpoints. The shared TheStats wrapper blocks them.
- Use `full` only for a single match when debugging.

## Response fields to watch

- `processed`
- `saved`
- `successful`
- `failed`
- `rateLimited`
- `results[].counts`
- `results[].endpointsFailed`

If `rateLimited=true`, wait before retrying and restart with:

```txt
limit=1&endpointDelayMs=2500&matchDelayMs=10000
```
