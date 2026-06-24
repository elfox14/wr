# Saved Match Extras Sync

This server-side feature stores advanced match data in database snapshots so public pages can stay database-only.

It adds an admin route for a single match and a worker script for Render or local use.

The saved snapshot may contain match info, stats, lineups, timeline, shotmap, and player stats, depending on provider availability.
