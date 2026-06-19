import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { safeTheStatsApiError } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_KEY = 'matches:the-stats-summary-stats:v1';
const PROVIDER = 'THE_STATS_API';
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET', 'BREAK'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'];
const RECENT_FINISHED_REFRESH_WINDOW_MS = 3 * 60 * 60 * 1000;
const FRESH_STATS_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

type CacheRow = {
  key: string;
  provider: string;
  payload: any;
  fetchedAt: Date;
  expiresAt: Date;
  refreshLockUntil: Date | null;
  lastError: any | null;
  updatedAt: Date;
};

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name] || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function iso(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function getOrigin() {
  const list = await headers();
  const host = list.get('x-forwarded-host') || list.get('host');
  const proto = list.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : null;
}

async function ensureCacheTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ApiResponseCache" (
      "key" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "fetchedAt" TIMESTAMPTZ NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "refreshLockUntil" TIMESTAMPTZ,
      "lastError" JSONB,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApiResponseCache_provider_idx" ON "ApiResponseCache" ("provider")`);
}

async function readCacheRow() {
  const rows = await prisma.$queryRawUnsafe<CacheRow[]>(`SELECT * FROM "ApiResponseCache" WHERE "key" = $1 LIMIT 1`, CACHE_KEY);
  return rows[0] || null;
}

async function saveCachePayload(payload: any, now: Date, expiresAt: Date) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ApiResponseCache" ("key", "provider", "payload", "fetchedAt", "expiresAt", "refreshLockUntil", "lastError", "updatedAt")
     VALUES ($1, $2, $3::jsonb, $4, $5, NULL, NULL, $4)
     ON CONFLICT ("key") DO UPDATE SET
       "provider" = EXCLUDED."provider",
       "payload" = EXCLUDED."payload",
       "fetchedAt" = EXCLUDED."fetchedAt",
       "expiresAt" = EXCLUDED."expiresAt",
       "refreshLockUntil" = NULL,
       "lastError" = NULL,
       "updatedAt" = EXCLUDED."updatedAt"`,
    CACHE_KEY,
    PROVIDER,
    JSON.stringify(payload),
    now,
    expiresAt,
  );
}

async function saveCacheError(error: any) {
  await prisma.$executeRawUnsafe(
    `UPDATE "ApiResponseCache" SET "refreshLockUntil" = NULL, "lastError" = $2::jsonb, "updatedAt" = NOW() WHERE "key" = $1`,
    CACHE_KEY,
    JSON.stringify(error),
  );
}

async function acquireRefreshLock(now: Date, lockMs: number) {
  const lockUntil = new Date(now.getTime() + lockMs);
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "ApiResponseCache"
     SET "refreshLockUntil" = $2, "updatedAt" = $1
     WHERE "key" = $3 AND ("refreshLockUntil" IS NULL OR "refreshLockUntil" < $1)`,
    now,
    lockUntil,
    CACHE_KEY,
  );
  return Number(updated) > 0;
}

function withCacheMeta(payload: any, meta: Record<string, any>) {
  return {
    ...payload,
    cache: {
      ...(payload?.cache || {}),
      ...meta,
    },
  };
}

async function isMatchWindowActive(now: Date) {
  const preMatchWindow = new Date(now.getTime() - 30 * 60 * 1000);
  const postKickoffWindow = new Date(now.getTime() + 150 * 60 * 1000);
  const recentlyFinishedWindow = new Date(now.getTime() - RECENT_FINISHED_REFRESH_WINDOW_MS);
  const activeCount = await prisma.match.count({
    where: {
      OR: [
        { status: { in: LIVE_STATUSES } },
        {
          status: { notIn: FINISHED_STATUSES },
          matchDate: { gte: preMatchWindow, lte: postKickoffWindow },
        },
        {
          status: { in: FINISHED_STATUSES },
          matchDate: { gte: recentlyFinishedWindow, lte: now },
        },
      ],
    },
  });
  return activeCount > 0;
}

async function fetchFreshSummary() {
  const origin = await getOrigin();
  if (!origin) {
    throw new Error('Unable to resolve request origin for internal summary refresh.');
  }

  const response = await fetch(`${origin}/api/matches/the-stats-summary-stats`, {
    cache: 'no-store',
    headers: { 'x-provider-cache-refresh': '1' },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw Object.assign(new Error(payload?.error?.message || payload?.error || `Summary refresh failed with status ${response.status}`), {
      status: response.status,
      payload,
    });
  }

  return payload;
}

export async function GET() {
  const now = new Date();
  const normalCacheMs = envInt('THE_STATS_API_SUMMARY_DB_CACHE_MS', 60 * 60 * 1000, 10 * 60 * 1000, 24 * 60 * 60 * 1000);
  const liveCacheMs = envInt('THE_STATS_API_SUMMARY_LIVE_DB_CACHE_MS', 60 * 1000, 30 * 1000, 10 * 60 * 1000);
  const lockMs = envInt('THE_STATS_API_SUMMARY_REFRESH_LOCK_MS', 45 * 1000, 15 * 1000, 10 * 60 * 1000);

  try {
    await ensureCacheTable();

    const matchWindowActive = await isMatchWindowActive(now);
    const cacheMs = matchWindowActive ? liveCacheMs : normalCacheMs;
    const mode = matchWindowActive ? 'match_or_recent_final_refresh' : 'normal_hourly';
    const row = await readCacheRow();
    const fetchedAtMs = row?.fetchedAt ? new Date(row.fetchedAt).getTime() : 0;
    const nextRefreshAt = fetchedAtMs ? new Date(fetchedAtMs + cacheMs) : null;
    const ttlMs = nextRefreshAt ? nextRefreshAt.getTime() - now.getTime() : 0;

    if (row?.payload && ttlMs > 0) {
      return NextResponse.json(withCacheMeta(row.payload, {
        hit: true,
        stored: true,
        source: 'database_cache',
        mode,
        ttlMs,
        fetchedAt: iso(row.fetchedAt),
        nextRefreshAt: iso(nextRefreshAt),
        matchWindowActive,
      }), { headers: FRESH_STATS_HEADERS });
    }

    if (row?.payload && row.refreshLockUntil && new Date(row.refreshLockUntil).getTime() > now.getTime()) {
      return NextResponse.json(withCacheMeta(row.payload, {
        hit: true,
        stale: true,
        stored: true,
        source: 'database_cache_refresh_locked',
        mode,
        fetchedAt: iso(row.fetchedAt),
        nextRefreshAt: iso(nextRefreshAt),
        refreshLockUntil: iso(row.refreshLockUntil),
        matchWindowActive,
      }), { headers: FRESH_STATS_HEADERS });
    }

    if (row?.payload) {
      const lockAcquired = await acquireRefreshLock(now, lockMs);
      if (!lockAcquired) {
        return NextResponse.json(withCacheMeta(row.payload, {
          hit: true,
          stale: true,
          stored: true,
          source: 'database_cache_lock_not_acquired',
          mode,
          fetchedAt: iso(row.fetchedAt),
          nextRefreshAt: iso(nextRefreshAt),
          matchWindowActive,
        }), { headers: FRESH_STATS_HEADERS });
      }
    }

    try {
      const freshPayload = await fetchFreshSummary();
      const expiresAt = new Date(now.getTime() + cacheMs);
      await saveCachePayload(freshPayload, now, expiresAt);

      return NextResponse.json(withCacheMeta(freshPayload, {
        hit: false,
        stored: true,
        source: 'provider_refresh_saved_to_database',
        mode,
        ttlMs: cacheMs,
        fetchedAt: iso(now),
        nextRefreshAt: iso(expiresAt),
        matchWindowActive,
      }), { headers: FRESH_STATS_HEADERS });
    } catch (error: any) {
      const safeError = safeTheStatsApiError(error);
      if (row?.payload) {
        await saveCacheError(safeError);
        return NextResponse.json(withCacheMeta(row.payload, {
          hit: true,
          stale: true,
          stored: true,
          source: 'database_cache_provider_refresh_failed',
          mode,
          fetchedAt: iso(row.fetchedAt),
          nextRefreshAt: iso(nextRefreshAt),
          matchWindowActive,
          refreshError: safeError,
        }), { headers: FRESH_STATS_HEADERS });
      }

      return NextResponse.json({ ok: false, provider: PROVIDER, error: safeError }, { status: safeError.status || 502, headers: FRESH_STATS_HEADERS });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, provider: PROVIDER, error: safeTheStatsApiError(error) }, { status: error?.status || 500, headers: FRESH_STATS_HEADERS });
  }
}
