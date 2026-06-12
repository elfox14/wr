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
    lower.includes('requests limit')
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
