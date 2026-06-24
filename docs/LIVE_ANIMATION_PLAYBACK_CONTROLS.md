# Live Animation Playback Controls

This update changes the live animation pitch behavior:

- The pitch shows one active event only.
- It does not render all timeline events at once.
- Clicking an event in the right-side event list shows that event only.
- The playback button starts/stops one-by-one event playback.
- Manual event selection pauses playback.

## UI behavior

In `components/live-animation/LiveAnimationPitch.tsx`:

- The event count remains visible.
- A new button appears next to the event count:

```text
تشغيل الأحداث / إيقاف الأحداث
```

## Why

Showing every event marker at once made the pitch visually crowded. The new behavior makes the pitch act like a tactical replay:

```text
selected event -> one marker on pitch
playback -> event 1, event 2, event 3...
```

## Public page

```text
/live-animation/[matchId]
```

No external provider fetch is added. The page still reads saved database state only.
