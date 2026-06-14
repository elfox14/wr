import { createHash, randomUUID } from 'crypto';
import prisma from '@/lib/prisma';

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function providerCacheKey(provider: string, route: string, params: Record<string, any> = {}) {
  const normalizedParams = Object.keys(params || {})
    .sort()
    .reduce<Record<string, any>>((acc, key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') acc[key] = value;
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify({ provider, route, params: normalizedParams })).digest('hex');
}

export async function ensureProviderResponseCacheTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProviderResponseCache" (
      "id" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "cacheKey" TEXT NOT NULL UNIQUE,
      "route" TEXT NOT NULL,
      "params" JSONB,
      "payload" JSONB,
      "status" INTEGER,
      "ok" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProviderResponseCache_provider_updatedAt_idx" ON "ProviderResponseCache" ("provider", "updatedAt")');
}

export async function getCachedProviderResponse(params: {
  provider: string;
  route: string;
  requestParams?: Record<string, any>;
  maxAgeSeconds?: number;
}) {
  const maxAgeSeconds = Math.max(0, Number(params.maxAgeSeconds || 0));
  if (maxAgeSeconds <= 0) return null;
  await ensureProviderResponseCacheTable();
  const cacheKey = providerCacheKey(params.provider, params.route, params.requestParams || {});
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "ProviderResponseCache"
    WHERE "cacheKey" = ${quoteSql(cacheKey)}
      AND "updatedAt" >= CURRENT_TIMESTAMP - INTERVAL '${Math.floor(maxAgeSeconds)} seconds'
    LIMIT 1
  `);
  return rows[0] || null;
}

export async function saveProviderResponse(params: {
  provider: string;
  route: string;
  requestParams?: Record<string, any>;
  payload: any;
  status?: number | null;
  ok?: boolean;
}) {
  await ensureProviderResponseCacheTable();
  const cacheKey = providerCacheKey(params.provider, params.route, params.requestParams || {});
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProviderResponseCache" ("id", "provider", "cacheKey", "route", "params", "payload", "status", "ok", "updatedAt")
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,CURRENT_TIMESTAMP)
     ON CONFLICT ("cacheKey") DO UPDATE SET
       "payload" = EXCLUDED."payload",
       "status" = EXCLUDED."status",
       "ok" = EXCLUDED."ok",
       "updatedAt" = CURRENT_TIMESTAMP`,
    id,
    params.provider,
    cacheKey,
    params.route,
    JSON.stringify(params.requestParams || {}),
    JSON.stringify(params.payload ?? null),
    Number.isFinite(Number(params.status)) ? Number(params.status) : null,
    params.ok !== false,
  );
  return { cacheKey };
}
