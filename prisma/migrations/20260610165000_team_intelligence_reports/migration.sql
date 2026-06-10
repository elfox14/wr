-- Team Intelligence Reports
-- Stores sourced football analysis reports for national teams.
-- This table is intentionally separate from trading/economy data so the team page can be football-analysis first.

CREATE TABLE IF NOT EXISTS "TeamIntelligenceReport" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT,
  "reportType" TEXT NOT NULL DEFAULT 'TEAM_PROFILE',
  "language" TEXT NOT NULL DEFAULT 'ar',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceCategory" TEXT NOT NULL DEFAULT 'editorial',
  "confidence" TEXT NOT NULL DEFAULT 'D',
  "provider" TEXT,
  "metrics" JSONB,
  "tacticalTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "weaknesses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastCheckedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeamIntelligenceReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TeamIntelligenceReport"
  ADD CONSTRAINT "TeamIntelligenceReport_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "TeamIntelligenceReport_teamId_publishedAt_idx"
  ON "TeamIntelligenceReport"("teamId", "publishedAt");

CREATE INDEX IF NOT EXISTS "TeamIntelligenceReport_sourceCategory_idx"
  ON "TeamIntelligenceReport"("sourceCategory");

CREATE INDEX IF NOT EXISTS "TeamIntelligenceReport_confidence_idx"
  ON "TeamIntelligenceReport"("confidence");
