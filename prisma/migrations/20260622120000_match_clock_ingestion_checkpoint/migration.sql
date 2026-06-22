CREATE TABLE IF NOT EXISTS "MatchClockState" (
  "matchId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "period" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "providerStatus" TEXT,
  "providerMinute" INTEGER,
  "displayMinute" TEXT,
  "periodStartedAt" TIMESTAMP(3),
  "lastConfirmedAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'DATABASE',
  "confidence" TEXT NOT NULL DEFAULT 'low',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchClockState_pkey" PRIMARY KEY ("matchId")
);

CREATE INDEX IF NOT EXISTS "MatchClockState_status_idx" ON "MatchClockState"("status");
CREATE INDEX IF NOT EXISTS "MatchClockState_lastConfirmedAt_idx" ON "MatchClockState"("lastConfirmedAt");

CREATE TABLE IF NOT EXISTS "DataSourceRun" (
  "id" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "matchId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "cursor" JSONB,
  "checkpoint" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataSourceRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataSourceRun_target_provider_jobType_status_idx" ON "DataSourceRun"("target", "provider", "jobType", "status");
CREATE INDEX IF NOT EXISTS "DataSourceRun_matchId_jobType_idx" ON "DataSourceRun"("matchId", "jobType");
CREATE INDEX IF NOT EXISTS "DataSourceRun_nextAttemptAt_idx" ON "DataSourceRun"("nextAttemptAt");
CREATE INDEX IF NOT EXISTS "DataSourceRun_lockedUntil_idx" ON "DataSourceRun"("lockedUntil");

CREATE TABLE IF NOT EXISTS "DataSourceErrorLog" (
  "id" TEXT NOT NULL,
  "runId" TEXT,
  "matchId" TEXT,
  "provider" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "retryable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataSourceErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataSourceErrorLog_runId_idx" ON "DataSourceErrorLog"("runId");
CREATE INDEX IF NOT EXISTS "DataSourceErrorLog_matchId_createdAt_idx" ON "DataSourceErrorLog"("matchId", "createdAt");
CREATE INDEX IF NOT EXISTS "DataSourceErrorLog_provider_jobType_createdAt_idx" ON "DataSourceErrorLog"("provider", "jobType", "createdAt");
