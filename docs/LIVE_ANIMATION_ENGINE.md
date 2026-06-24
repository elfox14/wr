# Live Animation Engine v1

This feature separates the virtual match animation from the normal match center.

## Public routes

```text
/live-animation/[matchId]
```

Shows an interactive virtual pitch with:

- scoreboard
- match phase
- animated event overlay
- event points on the pitch
- event feed
- 5-second DB-only polling while the match is live

## API

```text
/api/matches/[id]/animation-state?afterSeq=123
```

Returns only saved database state:

- score
- minute
- phase
- teams
- new events after `afterSeq`
- `lastSequence`

It never fetches hSport, iSports, TheStats, or any external provider during page load.

## Storage

The migration creates:

```text
LiveAnimationEvent
LiveAnimationState
```

`LiveAnimationEvent` is the normalized event queue for the pitch.

Important fields:

```text
matchId
sequenceNumber
minute
second
teamId
playerId
playerName
jerseyNumber
eventType
eventLabel
x
y
endX
endY
zone
provider
rawProviderEventId
payload
```

## Data pipeline

Recommended flow:

```text
hSport / iSports animation feed
+ TheStats lineups/player identity
↓
server-side worker / cron
↓
normalize event
↓
upsert LiveAnimationEvent
↓
/live-animation/[id] reads DB only
```

## Fallback behavior

If the migration is not applied yet or no `LiveAnimationEvent` rows exist, the API and page fall back to the existing `MatchEvent` table.

This lets the UI work immediately, then become more accurate as the animation worker starts filling the normalized table.

## Event quality levels

The UI supports three levels:

1. Full coordinates: uses `x`, `y`, `endX`, `endY`.
2. Partial coordinates: uses `x`, `y` and animates the ball/event point.
3. Event-only: falls back to a safe approximate zone based on team side.

## Next step

Build the worker that converts provider animation/timeline payloads into `LiveAnimationEvent` rows.

Recommended first target:

```text
scripts/live-animation-sync-worker.mjs
/api/cron/live-animation-sync
```

Keep the same architecture rule: workers fetch providers; pages read DB only.
