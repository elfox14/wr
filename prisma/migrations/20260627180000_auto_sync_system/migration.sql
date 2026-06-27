-- Auto-sync additive schema.

ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "externalIds" JSONB,
  ADD COLUMN IF NOT EXISTS "kickoffAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "competition" TEXT,
  ADD COLUMN IF NOT EXISTS "season" TEXT,
  ADD COLUMN IF NOT EXISTS "minute" INTEGER,
  ADD COLUMN IF NOT EXISTS "syncSource" TEXT,
  ADD COLUMN IF NOT EXISTS "syncState" JSONB,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextSyncAt" TIMESTAMP(3);

ALTER TABLE "MatchEvent"
  ADD COLUMN IF NOT EXISTS "fingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "raw" JSONB;

CREATE TABLE IF NOT EXISTS "MatchStats" (
  "matchId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("matchId")
);

CREATE TABLE IF NOT EXISTS "MatchSnapshot" (
  "id" TEXT NOT NULL,
  "matchId" TEXT,
  "source" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncJob" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "error" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamAlias" (
  "id" TEXT NOT NULL,
  "teamId" TEXT,
  "source" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchEvent_fingerprint_key"
  ON "MatchEvent"("fingerprint");

CREATE INDEX IF NOT EXISTS "Match_status_nextSyncAt_idx"
  ON "Match"("status", "nextSyncAt");

CREATE INDEX IF NOT EXISTS "Match_kickoffAt_idx"
  ON "Match"("kickoffAt");

CREATE INDEX IF NOT EXISTS "MatchSnapshot_matchId_source_fetchedAt_idx"
  ON "MatchSnapshot"("matchId", "source", "fetchedAt");

CREATE INDEX IF NOT EXISTS "SyncJob_type_status_createdAt_idx"
  ON "SyncJob"("type", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamAlias_source_externalId_key"
  ON "TeamAlias"("source", "externalId");

CREATE INDEX IF NOT EXISTS "TeamAlias_name_idx"
  ON "TeamAlias"("name");

CREATE INDEX IF NOT EXISTS "TeamAlias_teamId_idx"
  ON "TeamAlias"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MatchStats_matchId_fkey'
  ) THEN
    ALTER TABLE "MatchStats"
      ADD CONSTRAINT "MatchStats_matchId_fkey"
      FOREIGN KEY ("matchId") REFERENCES "Match"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MatchSnapshot_matchId_fkey'
  ) THEN
    ALTER TABLE "MatchSnapshot"
      ADD CONSTRAINT "MatchSnapshot_matchId_fkey"
      FOREIGN KEY ("matchId") REFERENCES "Match"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamAlias_teamId_fkey'
  ) THEN
    ALTER TABLE "TeamAlias"
      ADD CONSTRAINT "TeamAlias_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Asset"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
