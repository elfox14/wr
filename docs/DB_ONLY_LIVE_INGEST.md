# DB-only live ingest

This project separates the match page from provider fetching:

1. A private worker or trusted admin job fetches/normalizes provider data outside the public match page request.
2. The worker writes the normalized payload to the database through the internal ingest endpoint.
3. The match page and public live-stats endpoint read the latest saved database snapshot only.

Public routes must not call external live providers, browser renderers, or visual scrapers.

## Internal ingest endpoint

`POST /api/internal/live-ingest/match-snapshot`

Authentication is required through one of these headers:

- `Authorization: Bearer <LIVE_INGEST_SECRET>`
- `x-live-ingest-secret: <LIVE_INGEST_SECRET>`
- `x-cron-secret: <CRON_SECRET>`
- `x-admin-secret: <ADMIN_API_SECRET>`

Set `LIVE_INGEST_SECRET` in Render for a dedicated ingest secret. If no secret is configured, the endpoint returns an error and refuses writes.

## Minimal payload

```json
{
  "matchId": "database-match-id",
  "provider": "WORKER",
  "providerMatchId": 123456,
  "status": "1H",
  "minute": 17,
  "homeScore": 0,
  "awayScore": 0,
  "stats": {
    "homePossession": 54,
    "awayPossession": 46,
    "homeShots": 3,
    "awayShots": 1,
    "homeShotsOnTarget": 1,
    "awayShotsOnTarget": 0,
    "homeCorners": 2,
    "awayCorners": 0
  },
  "events": [
    {
      "minute": 17,
      "type": "shot_on_target",
      "teamSide": "home",
      "detail": "تسديدة على المرمى للفريق صاحب الأرض",
      "sourceName": "Worker"
    }
  ]
}
```

You may identify a match by `matchId`/`dbMatchId` or by `animationMatchId`/`providerMatchId` when it is linked to a `Match.animationMatchId` row.

## What the endpoint writes

- Creates a new `MatchStatsSnapshot` row.
- Optionally updates `Match.status`, `Match.homeScore`, and `Match.awayScore` only from explicit payload values.
- Inserts new `MatchEvent` rows with duplicate protection.

It never fetches an external provider itself.

## Public read path

`GET /api/matches/live-stats?dbMatchId=<id>` or `GET /api/matches/live-stats?matchId=<animationMatchId>` reads saved snapshots only. Even if a request passes `sync=1` or `force=1`, the public endpoint ignores it and returns `sync.status = "ignored_database_only"`.

The match page should continue reading from database snapshots/events, not from provider APIs.

## Render setup

Add this environment variable to the web service and to any private worker that posts snapshots:

```bash
LIVE_INGEST_SECRET=<strong-random-secret>
```

For a separate worker service, set its target URL to:

```bash
https://worldcup.mcprim.com/api/internal/live-ingest/match-snapshot
```
