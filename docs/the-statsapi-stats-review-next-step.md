# TheStatsAPI stats review next step

The v3 endpoint successfully confirms that TheStatsAPI provides additional match data:

- `resolvedProviderMatchId` is now correctly resolved to `mt_...`.
- `/api/football/matches/{matchId}/stats` returns a valid payload.
- `/api/football/matches/{matchId}/lineups` returns confirmed lineups/formations.
- npxG is parsed successfully from `data.np_expected_goals.all`.

## Current parser issue

Some stats are still reported as `missingFromProvider` even though the raw probe shows they exist under:

- `data.overview.ball_possession`
- `data.overview.total_shots`
- `data.overview.shots_on_target`
- `data.shots.shots_off_target`

The reason is that the current `pair()` parser reads only direct values:

```ts
const home = toNumber(value.home);
const away = toNumber(value.away);
```

But many TheStatsAPI stat objects appear to use a nested shape:

```ts
value.all.home
value.all.away
```

## Required code fix

Update `pair()` in `app/api/admin/the-stats-stats-review-v3/route.ts` to support both shapes:

```ts
function pair(value: any, sourcePath: string): ProviderStat | null {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' ? value.all : value;
  const home = toNumber(source.home);
  const away = toNumber(source.away);
  if (home === null && away === null) return null;
  return { home, away, sourcePath };
}
```

## Expected result after fix

After this change, a test such as:

```text
/api/admin/the-stats-stats-review-v3?adminSecret=SECRET_HERE&daysBack=3&take=1
```

should show more parsed provider fields, including possession and shots, instead of only npxG.

The endpoint must remain review-only with no database writes.
