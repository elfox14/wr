# Live Animation Spatial Intelligence + Stadium Theme v2

This phase upgrades the virtual pitch from generic event placement to deterministic spatial placement and a richer stadium visual layer.

## Goals

- Stop visually random event placement.
- Add spatial metadata to `LiveAnimationEvent`.
- Show coordinate quality to the user/team.
- Add team flags/watermarks to each half of the pitch.
- Add light crowd stands with team shirt colors.
- Add crowd pulse reactions for goal events.

## Spatial metadata

The migration adds:

```text
coordinateSource
coordinateConfidence
eventSide
isInferred
anchorZone
displayPriority
```

### coordinateSource

```text
EXACT_PROVIDER
INFERRED_ZONE
HEURISTIC
```

### coordinateConfidence

```text
HIGH
MEDIUM
LOW
```

## Placement rules

The new spatial rules live in:

```text
lib/liveAnimationSpatial.ts
```

They map event type + team side into stable pitch coordinates.

Examples:

- Goal: attacking penalty box with ball path to goal.
- Shot: half-space / attacking third with ball path to goal.
- Corner: correct attacking corner.
- Substitution: touchline near midfield.
- Cards/Fouls: stable midfield pressure zone.
- Penalty: penalty spot.
- Kickoff/Half-time/Full-time: center circle.

When provider coordinates become available later, they can be stored as `EXACT_PROVIDER` with `HIGH` confidence.

## Team visuals

Team color themes live in:

```text
lib/teamVisualThemes.ts
```

They provide:

```text
flagEmoji
primaryColor
secondaryColor
accentColor
crowdPrimary
crowdSecondary
shirtPrimary
shirtSecondary
```

The client uses these themes to render:

- faint flag/code watermark in each half
- team-colored player dots
- top/bottom crowd stands
- goal reaction pulse for the scoring team's crowd

## Public behavior

The public page remains:

```text
/live-animation/[id]
```

The public API remains DB-only:

```text
/api/matches/[id]/animation-state
```

No public page fetches iSports, hSport, or TheStats.

## Required follow-up after deploy

Re-run the normalizer so old `LiveAnimationEvent` rows get the new spatial metadata:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_API_SECRET" \
  "https://worldcup.mcprim.com/api/cron/live-animation-sync?matchId=cmq6vhgfh0128g7g4ntiqi8hf&allowFinished=true"
```

Then open:

```text
https://worldcup.mcprim.com/live-animation/cmq6vhgfh0128g7g4ntiqi8hf
```

Expected improvements:

- Events include coordinate source/confidence.
- Goal/corner/substitution/card placement is more logical.
- Team flags and crowd stands are visible.
- Goal events trigger the scoring team's crowd pulse.
