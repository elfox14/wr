import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';

export type LiveSyncTarget = {
  dbMatchId?: string | null;
  providerMatchId?: string | null;
};

export type LiveSyncStageResult = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  status?: number | null;
  durationMs?: number;
  url?: string;
  bodyBytes?: number;
  error?: string;
};

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function q(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function liveSyncTargetKey(target: LiveSyncTarget = {}) {
  const dbMatchId = String(target.dbMatchId || '').trim();
  if (dbMatchId) return { targetKind: 'MATCH', targetId: dbMatchId };
  const providerMatchId = String(target.providerMatchId || '').trim();
  if (providerMatchId) return { targetKind: 'PROVIDER_MATCH', targetId: providerMatchId };
  return { targetKind: 'GLOBAL', targetId: 'autopilot' };
}

export async function ensureLiveSyncResumeGuardTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveSyncCheckpoint" (
      "id" TEXT PRIMARY KEY,
      "targetKind" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "lastStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "lastOk" BOOLEAN NOT NULL DEFAULT false,
      "successCount" INTEGER NOT NULL DEFAULT 0,
      "failureCount" INTEGER NOT NULL DEFAULT 0,
      "lastStartedAt" TIMESTAMP(3),
      "lastSucceededAt" TIMESTAMP(3),
      "lastFailedAt" TIMESTAMP(3),
      "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastDurationMs" INTEGER,
      "lastHttpStatus" INTEGER,
      "lastError" TEXT,
      "lastStageUrl" TEXT,
      "lastResponseBytes" INTEGER,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("targetKind", "targetId", "stage")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProviderRetryQueue" (
      "id" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL DEFAULT 'AUTOPILOT',
      "targetKind" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "stageUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 12,
      "httpStatus" INTEGER,
      "reason" TEXT,
      "error" TEXT,
      "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lockedAt" TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LiveSyncCheckpoint_target_stage_idx" ON "LiveSyncCheckpoint" ("targetKind", "targetId", "stage")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LiveSyncCheckpoint_nextRunAt_idx" ON "LiveSyncCheckpoint" ("nextRunAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProviderRetryQueue_due_idx" ON "ProviderRetryQueue" ("status", "nextRunAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProviderRetryQueue_target_stage_idx" ON "ProviderRetryQueue" ("targetKind", "targetId", "stage")');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ProviderRetryQueue_active_unique_idx" ON "ProviderRetryQueue" ("targetKind", "targetId", "stage") WHERE "status" IN (\'PENDING\', \'RUNNING\')');
}

function isRateLimitLike(result: LiveSyncStageResult) {
  const text = `${result.error || ''} ${result.status || ''}`.toLowerCase();
  return result.status === 429 || text.includes('quota') || text.includes('rate') || text.includes('limit') || text.includes('too many requests');
}

function isTimeoutLike(result: LiveSyncStageResult) {
  const text = String(result.error || '').toLowerCase();
  return text.includes('abort') || text.includes('timeout') || text.includes('time_budget');
}

function baseBackoffMs(result: LiveSyncStageResult) {
  if (isRateLimitLike(result)) return 30 * 60_000;
  if (isTimeoutLike(result)) return 60_000;
  if (Number(result.status || 0) >= 500) return 5 * 60_000;
  return 2 * 60_000;
}

async function getActiveRetry(targetKind: string, targetId: string, stage: string) {
  await ensureLiveSyncResumeGuardTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "ProviderRetryQueue"
    WHERE "targetKind" = ${q(targetKind)}
      AND "targetId" = ${q(targetId)}
      AND "stage" = ${q(stage)}
      AND "status" = 'PENDING'
    ORDER BY "nextRunAt" ASC
    LIMIT 1
  `);
  return rows[0] || null;
}

export async function shouldRunLiveSyncStage(target: LiveSyncTarget, stage: string) {
  const { targetKind, targetId } = liveSyncTargetKey(target);
  const retry = await getActiveRetry(targetKind, targetId, stage);
  if (!retry) return { run: true, targetKind, targetId, stage, retry: null };

  const nextRunAt = retry.nextRunAt instanceof Date ? retry.nextRunAt.getTime() : new Date(retry.nextRunAt).getTime();
  if (Number.isFinite(nextRunAt) && nextRunAt > Date.now()) {
    return {
      run: false,
      targetKind,
      targetId,
      stage,
      retry: {
        id: retry.id,
        attempts: Number(retry.attempts || 0),
        nextRunAt: iso(retry.nextRunAt),
        reason: retry.reason || retry.error || 'retry backoff active',
      },
    };
  }

  return { run: true, targetKind, targetId, stage, retry };
}

export async function recordLiveSyncStageStart(target: LiveSyncTarget, stage: string) {
  const { targetKind, targetId } = liveSyncTargetKey(target);
  await ensureLiveSyncResumeGuardTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LiveSyncCheckpoint" ("id", "targetKind", "targetId", "stage", "lastStatus", "lastOk", "lastStartedAt", "updatedAt")
     VALUES ($1,$2,$3,$4,'RUNNING',false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("targetKind", "targetId", "stage") DO UPDATE SET
       "lastStatus" = 'RUNNING',
       "lastStartedAt" = CURRENT_TIMESTAMP,
       "updatedAt" = CURRENT_TIMESTAMP`,
    randomUUID(),
    targetKind,
    targetId,
    stage,
  );
}

export async function recordLiveSyncStageSuccess(target: LiveSyncTarget, result: LiveSyncStageResult) {
  const { targetKind, targetId } = liveSyncTargetKey(target);
  await ensureLiveSyncResumeGuardTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LiveSyncCheckpoint" (
       "id", "targetKind", "targetId", "stage", "lastStatus", "lastOk", "successCount", "lastStartedAt",
       "lastSucceededAt", "nextRunAt", "lastDurationMs", "lastHttpStatus", "lastStageUrl", "lastResponseBytes", "updatedAt"
     ) VALUES ($1,$2,$3,$4,'SUCCESS',true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$5,$6,$7,$8,CURRENT_TIMESTAMP)
     ON CONFLICT ("targetKind", "targetId", "stage") DO UPDATE SET
       "lastStatus" = 'SUCCESS',
       "lastOk" = true,
       "successCount" = "LiveSyncCheckpoint"."successCount" + 1,
       "lastSucceededAt" = CURRENT_TIMESTAMP,
       "nextRunAt" = CURRENT_TIMESTAMP,
       "lastDurationMs" = EXCLUDED."lastDurationMs",
       "lastHttpStatus" = EXCLUDED."lastHttpStatus",
       "lastError" = NULL,
       "lastStageUrl" = EXCLUDED."lastStageUrl",
       "lastResponseBytes" = EXCLUDED."lastResponseBytes",
       "updatedAt" = CURRENT_TIMESTAMP`,
    randomUUID(),
    targetKind,
    targetId,
    result.name,
    Number.isFinite(Number(result.durationMs)) ? Number(result.durationMs) : null,
    Number.isFinite(Number(result.status)) ? Number(result.status) : null,
    result.url || null,
    Number.isFinite(Number(result.bodyBytes)) ? Number(result.bodyBytes) : null,
  );

  await prisma.$executeRawUnsafe(
    `UPDATE "ProviderRetryQueue"
     SET "status" = 'SUCCEEDED', "completedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "targetKind" = $1 AND "targetId" = $2 AND "stage" = $3 AND "status" IN ('PENDING','RUNNING')`,
    targetKind,
    targetId,
    result.name,
  );
}

export async function recordLiveSyncStageFailure(target: LiveSyncTarget, result: LiveSyncStageResult) {
  const { targetKind, targetId } = liveSyncTargetKey(target);
  await ensureLiveSyncResumeGuardTables();
  const existing = await getActiveRetry(targetKind, targetId, result.name);
  const attempts = Math.max(0, Number(existing?.attempts || 0)) + 1;
  const baseMs = baseBackoffMs(result);
  const delayMs = isRateLimitLike(result) ? baseMs : Math.min(baseMs * Math.pow(2, Math.min(attempts - 1, 4)), 30 * 60_000);
  const nextRunAt = new Date(Date.now() + delayMs);
  const reason = result.error || (result.status ? `HTTP ${result.status}` : 'stage failed');

  await prisma.$executeRawUnsafe(
    `INSERT INTO "LiveSyncCheckpoint" (
       "id", "targetKind", "targetId", "stage", "lastStatus", "lastOk", "failureCount", "lastStartedAt",
       "lastFailedAt", "nextRunAt", "lastDurationMs", "lastHttpStatus", "lastError", "lastStageUrl", "lastResponseBytes", "updatedAt"
     ) VALUES ($1,$2,$3,$4,'FAILED',false,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
     ON CONFLICT ("targetKind", "targetId", "stage") DO UPDATE SET
       "lastStatus" = 'FAILED',
       "lastOk" = false,
       "failureCount" = "LiveSyncCheckpoint"."failureCount" + 1,
       "lastFailedAt" = CURRENT_TIMESTAMP,
       "nextRunAt" = EXCLUDED."nextRunAt",
       "lastDurationMs" = EXCLUDED."lastDurationMs",
       "lastHttpStatus" = EXCLUDED."lastHttpStatus",
       "lastError" = EXCLUDED."lastError",
       "lastStageUrl" = EXCLUDED."lastStageUrl",
       "lastResponseBytes" = EXCLUDED."lastResponseBytes",
       "updatedAt" = CURRENT_TIMESTAMP`,
    randomUUID(),
    targetKind,
    targetId,
    result.name,
    nextRunAt,
    Number.isFinite(Number(result.durationMs)) ? Number(result.durationMs) : null,
    Number.isFinite(Number(result.status)) ? Number(result.status) : null,
    String(reason).slice(0, 500),
    result.url || null,
    Number.isFinite(Number(result.bodyBytes)) ? Number(result.bodyBytes) : null,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProviderRetryQueue" (
       "id", "provider", "targetKind", "targetId", "stage", "stageUrl", "status", "attempts", "httpStatus", "reason", "error", "nextRunAt", "updatedAt"
     ) VALUES ($1,'AUTOPILOT',$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
     ON CONFLICT ("targetKind", "targetId", "stage") WHERE "status" IN ('PENDING','RUNNING') DO UPDATE SET
       "stageUrl" = EXCLUDED."stageUrl",
       "status" = 'PENDING',
       "attempts" = EXCLUDED."attempts",
       "httpStatus" = EXCLUDED."httpStatus",
       "reason" = EXCLUDED."reason",
       "error" = EXCLUDED."error",
       "nextRunAt" = EXCLUDED."nextRunAt",
       "lockedAt" = NULL,
       "updatedAt" = CURRENT_TIMESTAMP`,
    existing?.id || randomUUID(),
    targetKind,
    targetId,
    result.name,
    result.url || null,
    attempts,
    Number.isFinite(Number(result.status)) ? Number(result.status) : null,
    String(reason).slice(0, 500),
    result.error ? String(result.error).slice(0, 500) : null,
    nextRunAt,
  );

  return {
    targetKind,
    targetId,
    stage: result.name,
    attempts,
    nextRunAt: nextRunAt.toISOString(),
    delayMs,
    reason: String(reason).slice(0, 300),
  };
}

export async function getLiveSyncResumeSummary(target: LiveSyncTarget) {
  const { targetKind, targetId } = liveSyncTargetKey(target);
  await ensureLiveSyncResumeGuardTables();
  const [checkpoints, retries] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(`
      SELECT "stage", "lastStatus", "lastOk", "successCount", "failureCount", "lastSucceededAt", "lastFailedAt", "nextRunAt", "lastHttpStatus", "lastError"
      FROM "LiveSyncCheckpoint"
      WHERE "targetKind" = ${q(targetKind)} AND "targetId" = ${q(targetId)}
      ORDER BY "updatedAt" DESC
      LIMIT 20
    `),
    prisma.$queryRawUnsafe<any[]>(`
      SELECT "stage", "status", "attempts", "nextRunAt", "httpStatus", "reason"
      FROM "ProviderRetryQueue"
      WHERE "targetKind" = ${q(targetKind)} AND "targetId" = ${q(targetId)} AND "status" IN ('PENDING','RUNNING')
      ORDER BY "nextRunAt" ASC
      LIMIT 20
    `),
  ]);

  return {
    targetKind,
    targetId,
    checkpoints: checkpoints.map((row) => ({ ...row, lastSucceededAt: iso(row.lastSucceededAt), lastFailedAt: iso(row.lastFailedAt), nextRunAt: iso(row.nextRunAt) })),
    retries: retries.map((row) => ({ ...row, nextRunAt: iso(row.nextRunAt) })),
  };
}
