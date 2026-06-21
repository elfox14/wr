# Automatic safe TheStats old-match backfill cron

This cron endpoint is designed to be called every 10 minutes by Render Cron, cron-job.org, GitHub Actions, or any trusted scheduler.

## Cron endpoint

```txt
/api/cron/the-stats-safe-old-backfill
```

It forwards to the admin-safe backfill route with conservative defaults:

```txt
phase=auto
limit=1
skipExisting=true
endpointDelayMs=7000
matchDelayMs=30000
cooldownHours=6
```

## What `phase=auto` does

Each cron run processes at most one match in one phase.

It checks phases in this order:

1. `essential`
2. `events`
3. `shots`
4. `players`

If all `essential` data is present for the current filters, it moves to `events`, then `shots`, then `players`.

If TheStatsAPI is in cooldown, the cron returns immediately without making any provider request.

## Recommended cron URL

Use your real secret through `key`, `cronSecret`, `adminSecret`, or Authorization Bearer.

```txt
https://worldcup.mcprim.com/api/cron/the-stats-safe-old-backfill?key=YOUR_CRON_SECRET
```

Optional safer date cursor to avoid the newest match and walk backwards:

```txt
https://worldcup.mcprim.com/api/cron/the-stats-safe-old-backfill?key=YOUR_CRON_SECRET&before=2026-06-21T15:59:59.000Z&order=desc
```

## Frequency

Recommended: every 10 minutes.

Avoid every 5 minutes while on the trial or if 429 appears frequently.

## Expected safe responses

When cooldown is active:

```json
{
  "cooldownActive": true,
  "processed": 0,
  "advice": "TheStatsAPI cooldown is active. No provider requests were made."
}
```

When one batch is processed:

```json
{
  "mode": "safe_old_backfill_auto",
  "selectedPhase": "essential",
  "processed": 1,
  "saved": 1
}
```

When all phases are done for current filters:

```json
{
  "selectedPhase": null,
  "processed": 0,
  "advice": "All safe phases appear complete for the current filters."
}
```

## Important

- Do not use `sequence=safe` for cron.
- Do not use `full` for cron.
- Keep `limit=1`.
- Keep `includeRaw=false`.
- If 429 happens, the route stores a provider cooldown and future cron calls will not hit TheStats until `blockedUntil`.
