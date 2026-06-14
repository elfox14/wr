import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function isProviderQuotaMessage(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  const lower = text.toLowerCase();
  return (
    lower.includes('more than 200 trials today') ||
    lower.includes('try again tomorrow') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('requests limit') ||
    lower.includes('local soft daily limit')
  );
}

export function isProviderQuotaError(error: any) {
  if (!error) return false;
  if (Number(error.status) === 429) return true;
  return isProviderQuotaMessage(error.payload || error.message || error.error || error);
}

export async function ensureProviderQuotaGuardTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProviderQuotaGuard" (
      "provider" TEXT PRIMARY KEY,
      "blockedUntil" TIMESTAMP(3) NOT NULL,
      "reason" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function ensureProviderRequestLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProviderRequestLog" (
      "id" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "route" TEXT,
      "providerMatchId" INTEGER,
      "status" INTEGER,
      "ok" BOOLEAN NOT NULL DEFAULT false,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProviderRequestLog_provider_createdAt_idx" ON "ProviderRequestLog" ("provider", "createdAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProviderRequestLog_match_createdAt_idx" ON "ProviderRequestLog" ("providerMatchId", "createdAt")');
}

export async function getProviderQuotaBlock(provider: string) {
  await ensureProviderQuotaGuardTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "ProviderQuotaGuard"
    WHERE "provider" = ${quoteSql(provider)}
      AND "blockedUntil" > CURRENT_TIMESTAMP
    LIMIT 1
  `);
  return rows[0] || null;
}

export async function blockProviderUntil(provider: string, blockedUntil: Date, reason: string) {
  await ensureProviderQuotaGuardTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProviderQuotaGuard" ("provider", "blockedUntil", "reason", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT ("provider") DO UPDATE SET
       "blockedUntil" = EXCLUDED."blockedUntil",
       "reason" = EXCLUDED."reason",
       "updatedAt" = CURRENT_TIMESTAMP`,
    provider,
    blockedUntil,
    reason.slice(0, 500),
  );
  return { provider, blockedUntil: blockedUntil.toISOString(), reason };
}

export async function blockProviderForHours(provider: string, hours: number, reason: string) {
  return blockProviderUntil(provider, new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000), reason);
}

export async function recordProviderRequest(params: {
  provider: string;
  route?: string;
  providerMatchId?: number | null;
  status?: number | null;
  ok?: boolean;
  reason?: string | null;
}) {
  await ensureProviderRequestLogTable();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProviderRequestLog" ("id", "provider", "route", "providerMatchId", "status", "ok", "reason") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    id,
    params.provider,
    params.route || null,
    Number.isFinite(Number(params.providerMatchId)) ? Number(params.providerMatchId) : null,
    Number.isFinite(Number(params.status)) ? Number(params.status) : null,
    Boolean(params.ok),
    params.reason ? String(params.reason).slice(0, 500) : null,
  );
  return id;
}

export async function countProviderRequestsSince(provider: string, since: Date) {
  await ensureProviderRequestLogTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*)::int AS count
    FROM "ProviderRequestLog"
    WHERE "provider" = ${quoteSql(provider)}
      AND "createdAt" >= ${quoteSql(since.toISOString())}::timestamp
  `);
  return Number(rows?.[0]?.count || 0);
}

export async function getProviderUsageSummary(provider: string, since: Date) {
  await ensureProviderRequestLogTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "ok" = true)::int AS ok,
           COUNT(*) FILTER (WHERE "ok" = false)::int AS failed,
           MAX("createdAt") AS "latestAt"
    FROM "ProviderRequestLog"
    WHERE "provider" = ${quoteSql(provider)}
      AND "createdAt" >= ${quoteSql(since.toISOString())}::timestamp
  `);
  const row = rows?.[0] || {};
  return {
    total: Number(row.total || 0),
    ok: Number(row.ok || 0),
    failed: Number(row.failed || 0),
    latestAt: row.latestAt instanceof Date ? row.latestAt.toISOString() : row.latestAt || null,
  };
}
