# Live Animation Sync Worker

This worker fills the normalized `LiveAnimationEvent` table used by `/live-animation/[matchId]`.

## Current v1 behavior

The first version reads saved `MatchEvent` rows from the database and writes normalized rows into `LiveAnimationEvent`.

It does not fetch external providers yet.

```text
MatchEvent
↓
normalize event type, label, rough pitch coordinates, sequence number
↓
LiveAnimationEvent
↓
/live-animation/[id]
```

This makes the virtual pitch useful immediately while keeping the architecture ready for hSport/iSports animation feeds later.

## API route

```text
POST /api/cron/live-animation-sync
```

Requires admin auth:

```http
Authorization: Bearer ADMIN_API_SECRET
```

Supported query params:

```text
matchId=optional-single-match-id
limit=8
lookbackHours=12
allowFinished=true
dryRun=false
```

Example:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_API_SECRET" \
  "https://worldcup.mcprim.com/api/cron/live-animation-sync?matchId=cmq6vhgfh0128g7g4ntiqi8hf&allowFinished=true"
```

## Render Cron

Command:

```bash
npm run worker:live-animation-sync
```

Recommended environment:

```env
LIVE_ANIMATION_SYNC_TARGET_ORIGIN=https://worldcup.mcprim.com
LIVE_ANIMATION_SYNC_LIMIT=8
LIVE_ANIMATION_SYNC_LOOKBACK_HOURS=12
LIVE_ANIMATION_SYNC_ALLOW_FINISHED=true
LIVE_ANIMATION_SYNC_DRY_RUN=false
ADMIN_API_SECRET=your-secret
```

For a one-match manual run:

```env
LIVE_ANIMATION_SYNC_MATCH_ID=cmq6vhgfh0128g7g4ntiqi8hf
```

Remove `LIVE_ANIMATION_SYNC_MATCH_ID` after the manual run so the worker returns to batch mode.

## Future provider mode

The next upgrade should add provider-specific ingestion before normalization:

```text
hSport/iSports animation feed
+ TheStats player/lineup identity
↓
normalize provider event
↓
upsert LiveAnimationEvent
```

The public UI and `/api/matches/[id]/animation-state` must remain DB-only.
