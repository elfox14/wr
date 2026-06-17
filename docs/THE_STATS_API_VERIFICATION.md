# TheStatsAPI Verification Layer

## Purpose

TheStatsAPI is integrated as a verification and enrichment provider only. The platform database remains the source of truth for the public UI.

This integration must not be used to rebuild the database from scratch or replace curated data without review.

## Environment variables

```env
THE_STATS_API_ENABLED="false"
THE_STATS_API_VERIFY_ONLY="true"
THE_STATS_API_BLOCK_ODDS="true"
THE_STATS_API_KEY=""
THE_STATS_API_BASE_URL="https://api.thestatsapi.com"
THE_STATS_API_AUTH_HEADER="Authorization"
THE_STATS_API_AUTH_SCHEME="Bearer"
THE_STATS_API_TIMEOUT_MS="15000"
```

Recommended first-run settings:

```env
THE_STATS_API_ENABLED="true"
THE_STATS_API_VERIFY_ONLY="true"
THE_STATS_API_BLOCK_ODDS="true"
```

## Admin endpoint

```text
/api/admin/the-stats-verify
```

The endpoint requires `ADMIN_API_SECRET` or `CRON_SECRET` using one of:

- `Authorization: Bearer <secret>`
- `x-admin-secret: <secret>`
- `x-cron-secret: <secret>`
- `?key=<secret>`
- `?adminSecret=<secret>`

## Safe dry run example

The first verified TheStatsAPI football path is:

```text
/api/football/matches
```

Example:

```text
GET /api/admin/the-stats-verify?providerPath=/api/football/matches&status=scheduled&per_page=5&dryRun=true
```

World Cup 2026 lookup discovered from the provider response:

```text
GET /api/admin/the-stats-verify?providerPath=/api/football/matches&competition_id=comp_6107&season_id=sn_118868&per_page=100&dryRun=true
```

The endpoint returns `providerSample` with normalized rows, including `utc_date` mapped to `matchDate`.

## What the endpoint does

1. Fetches a safe football endpoint from TheStatsAPI.
2. Loads local matches by `matchId`, `externalId`, `date`, or the near live window.
3. Attempts to match provider rows to local matches by external ID first, then team names and kickoff date.
4. Supports TheStatsAPI fields such as:
   - `id`
   - `competition_id`
   - `season_id`
   - `utc_date`
   - `home_team.name`
   - `away_team.name`
   - `score.home`
   - `score.away`
5. Compares safe fields:
   - `status`
   - `homeScore`
   - `awayScore`
   - `matchDate`
   - `stage`
   - `groupPhase`
6. Writes results to `DataVerificationLog` only when a local/provider match is found.
7. Returns a comparison report.

## Apply mode

Apply mode is intentionally locked down.

It requires all of the following:

```text
apply=true
dryRun=false
THE_STATS_API_VERIFY_ONLY=false
```

Even then, it only applies safe corrections for:

- match status
- final home score
- final away score

Everything else remains reported only until a dedicated schema and review workflow are added.

## Prohibited data

The code blocks paths and query parameters that appear to request prohibited commercial prediction or wagering data. Do not add public UI for that kind of data.

The platform should use only sports data such as fixtures, results, lineups, player stats, match events, xG, shot maps, standings, venues, and referees when available.

Provider fields such as availability flags should remain internal/debug only and should not be shown in the public UI.

## Data flow

```text
TheStatsAPI
↓ admin/cron only
/api/admin/the-stats-verify
↓
DataVerificationLog + optional safe match correction
↓
Database-backed public UI
```

Never call TheStatsAPI directly from browser code.
