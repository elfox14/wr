-- Live animation spatial intelligence v2
-- Adds explicit coordinate metadata and display controls for inferred provider events.

ALTER TABLE "LiveAnimationEvent"
  ADD COLUMN IF NOT EXISTS "coordinateSource" TEXT NOT NULL DEFAULT 'HEURISTIC',
  ADD COLUMN IF NOT EXISTS "coordinateConfidence" TEXT NOT NULL DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS "eventSide" TEXT NOT NULL DEFAULT 'NEUTRAL',
  ADD COLUMN IF NOT EXISTS "isInferred" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "anchorZone" TEXT,
  ADD COLUMN IF NOT EXISTS "displayPriority" INTEGER NOT NULL DEFAULT 50;

CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_coordinateSource_idx" ON "LiveAnimationEvent"("matchId", "coordinateSource");
CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_displayPriority_idx" ON "LiveAnimationEvent"("matchId", "displayPriority");
