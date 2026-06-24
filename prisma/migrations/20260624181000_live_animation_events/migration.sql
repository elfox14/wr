-- Live animation engine v1
-- Stores normalized provider events for the interactive virtual pitch.

CREATE TABLE IF NOT EXISTS "LiveAnimationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "matchId" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "minute" INTEGER,
  "second" INTEGER,
  "teamId" TEXT,
  "playerId" TEXT,
  "playerName" TEXT,
  "jerseyNumber" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'note',
  "eventLabel" TEXT NOT NULL DEFAULT 'حدث',
  "x" DOUBLE PRECISION,
  "y" DOUBLE PRECISION,
  "endX" DOUBLE PRECISION,
  "endY" DOUBLE PRECISION,
  "zone" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'NORMALIZED_ANIMATION',
  "rawProviderEventId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveAnimationEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_sequenceNumber_key" ON "LiveAnimationEvent"("matchId", "sequenceNumber");
CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_createdAt_idx" ON "LiveAnimationEvent"("matchId", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_eventType_idx" ON "LiveAnimationEvent"("matchId", "eventType");
CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_rawProviderEventId_idx" ON "LiveAnimationEvent"("rawProviderEventId");

CREATE TABLE IF NOT EXISTS "LiveAnimationState" (
  "matchId" TEXT NOT NULL PRIMARY KEY,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "currentMinute" INTEGER,
  "currentPhase" TEXT,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "lastEventId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveAnimationState_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
