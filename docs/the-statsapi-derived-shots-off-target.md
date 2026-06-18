# TheStatsAPI derived shots-off-target comparison

The v3 stats review endpoint is now parsing TheStatsAPI stats correctly. The remaining repeated difference is for `shotsOffTarget`.

## Observed pattern

For tested matches, local iSports `shotsOffTarget` equals:

```text
TheStatsAPI shots.shots_off_target + TheStatsAPI shots.blocked_shots
```

Examples:

```text
Sweden vs Tunisia
Local off target: 6-4
TheStatsAPI off target: 3-3
TheStatsAPI blocked: 3-1
Derived: 6-4

Spain vs Cape Verde
Local off target: 20-5
TheStatsAPI off target: 12-3
TheStatsAPI blocked: 8-2
Derived: 20-5

Belgium vs Egypt
Local off target: 12-11
TheStatsAPI off target: 7-4
TheStatsAPI blocked: 5-7
Derived: 12-11
```

## Recommended next code change

Keep raw provider fields:

- `shotsOffTarget`
- `blockedShots`

Add a derived comparison-only field:

```ts
function addPairs(a?: ProviderStat, b?: ProviderStat, sourcePath = 'derived') {
  if (!a && !b) return null;
  const home = (a?.home ?? 0) + (b?.home ?? 0);
  const away = (a?.away ?? 0) + (b?.away ?? 0);
  return { home, away, sourcePath };
}

stats.shotsOffTargetForLocalCompare = addPairs(
  stats.shotsOffTarget,
  stats.blockedShots,
  'derived: data.shots.shots_off_target + data.shots.blocked_shots'
);
```

Then compare local `homeShotsOffTarget/awayShotsOffTarget` against `shotsOffTargetForLocalCompare`, while still displaying raw `shotsOffTarget` and `blockedShots` as provider fields.

## Safety

- Review-only.
- No database writes.
- No automatic overwrite.
- This is a semantic mapping clarification, not a data import.
