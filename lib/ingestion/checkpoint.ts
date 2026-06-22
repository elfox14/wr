import prisma from '@/lib/prisma';

type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'retrying';

type RunRow = {
  id: string;
  target: string;
  provider: string;
  jobType: string;
  matchId: string | null;
  status: RunStatus;
  cursor: unknown;
  checkpoint: unknown;
  attempts: number;
};

let tablesReady: Promise<void> | null = null;

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataSourceRun" (
      "id" TEXT PRIMARY KEY,
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceRun_target_provider_jobType_status_idx" ON "DataSourceRun" ("target", "provider", "jobType", "status")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceRun_matchId_jobType_idx" ON "DataSourceRun" ("matchId", "jobType")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceRun_nextAttemptAt_idx" ON "DataSourceRun" ("nextAttemptAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceRun_lockedUntil_idx" ON "DataSourceRun" ("lockedUntil")');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataSourceErrorLog" (
      "id" TEXT PRIMARY KEY,
      "runId" TEXT,
      "matchId" TEXT,
      "provider" TEXT NOT NULL,
      "jobType" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "details" JSONB,
      "retryable" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceErrorLog_runId_idx" ON "DataSourceErrorLog" ("runId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceErrorLog_matchId_createdAt_idx" ON "DataSourceErrorLog" ("matchId", "createdAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataSourceErrorLog_provider_jobType_createdAt_idx" ON "DataSourceErrorLog" ("provider", "jobType", "createdAt")');
}

function cuidLike() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function backoffMinutes(attempts: number) {
  return Math.min(60, Math.max(1, 2 ** Math.min(5, attempts)));
}

async function ready() {
  tablesReady ||= ensureTables();
  await tablesReady;
}

export async function acquireDataSourceRun(input: { target: string; provider: string; jobType: string; matchId?: string | null; lockMs?: number }) {
  await ready();
  const lockMs = input.lockMs ?? 10 * 60_000;
  const rows = await prisma.$queryRawUnsafe<RunRow[]>(
    `SELECT * FROM "DataSourceRun"
     WHERE "target" = $1 AND "provider" = $2 AND "jobType" = $3
       AND COALESCE("matchId", '') = COALESCE($4, '')
       AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
       AND ("lockedUntil" IS NULL OR "lockedUntil" <= NOW())
     ORDER BY "updatedAt" DESC
     LIMIT 1`,
    input.target,
    input.provider,
    input.jobType,
    input.matchId || null,
  );
  const existing = rows[0];
  const id = existing?.id || cuidLike();
  await prisma.$executeRawUnsafe(
    existing
      ? `UPDATE "DataSourceRun" SET "status" = 'running', "attempts" = "attempts" + 1, "lockedUntil" = NOW() + ($2::text || ' milliseconds')::interval, "startedAt" = COALESCE("startedAt", NOW()), "updatedAt" = NOW() WHERE "id" = $1`
      : `INSERT INTO "DataSourceRun" ("id", "target", "provider", "jobType", "matchId", "status", "attempts", "lockedUntil", "startedAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, 'running', 1, NOW() + ($6::text || ' milliseconds')::interval, NOW(), NOW())`,
    ...(existing ? [id, lockMs] : [id, input.target, input.provider, input.jobType, input.matchId || null, lockMs]),
  );
  return { id, checkpoint: existing?.checkpoint ?? null, cursor: existing?.cursor ?? null, attempts: existing?.attempts ?? 0 };
}

export async function recordDataSourceCheckpoint(runId: string, checkpoint: unknown, cursor?: unknown) {
  await ready();
  await prisma.$executeRawUnsafe(
    'UPDATE "DataSourceRun" SET "checkpoint" = $2::jsonb, "cursor" = COALESCE($3::jsonb, "cursor"), "updatedAt" = NOW() WHERE "id" = $1',
    runId,
    JSON.stringify(checkpoint ?? null),
    cursor === undefined ? null : JSON.stringify(cursor),
  );
}

export async function recordDataSourceSuccess(runId: string, checkpoint?: unknown) {
  await ready();
  await prisma.$executeRawUnsafe(
    'UPDATE "DataSourceRun" SET "status" = $2, "checkpoint" = COALESCE($3::jsonb, "checkpoint"), "lockedUntil" = NULL, "nextAttemptAt" = NULL, "lastError" = NULL, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1',
    runId,
    'success',
    checkpoint === undefined ? null : JSON.stringify(checkpoint),
  );
}

export async function recordDataSourceFailure(input: { runId: string; provider: string; jobType: string; matchId?: string | null; error: unknown; checkpoint?: unknown; retryable?: boolean }) {
  await ready();
  const message = input.error instanceof Error ? input.error.message : String(input.error || 'Unknown ingestion error');
  const attempts = await prisma.$queryRawUnsafe<Array<{ attempts: number }>>('SELECT "attempts" FROM "DataSourceRun" WHERE "id" = $1 LIMIT 1', input.runId);
  const nextMinutes = input.retryable === false ? null : backoffMinutes(attempts[0]?.attempts || 1);
  await prisma.$executeRawUnsafe(
    `UPDATE "DataSourceRun"
     SET "status" = $2, "checkpoint" = COALESCE($3::jsonb, "checkpoint"), "lockedUntil" = NULL,
         "nextAttemptAt" = ${nextMinutes === null ? 'NULL' : `NOW() + INTERVAL '${nextMinutes} minutes'`},
         "lastError" = $4, "updatedAt" = NOW()
     WHERE "id" = $1`,
    input.runId,
    input.retryable === false ? 'failed' : 'retrying',
    input.checkpoint === undefined ? null : JSON.stringify(input.checkpoint),
    message,
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO "DataSourceErrorLog" ("id", "runId", "matchId", "provider", "jobType", "message", "details", "retryable") VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
    cuidLike().replace('run_', 'err_'),
    input.runId,
    input.matchId || null,
    input.provider,
    input.jobType,
    message,
    JSON.stringify({ checkpoint: input.checkpoint ?? null }),
    input.retryable !== false,
  );
}
