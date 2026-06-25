-- Speed up homepage, live-card, and standings queries that filter by status, date, and group.
CREATE INDEX IF NOT EXISTS "Match_status_matchDate_idx" ON "Match" ("status", "matchDate");
CREATE INDEX IF NOT EXISTS "Match_matchDate_idx" ON "Match" ("matchDate");
CREATE INDEX IF NOT EXISTS "Match_groupPhase_status_idx" ON "Match" ("groupPhase", "status");
