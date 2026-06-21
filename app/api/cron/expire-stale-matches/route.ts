import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const MAX_LIVE_MINUTES = 180;
const JOB_NAME = 'expire-stale-matches';



async function ensureCronRunLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CronRunLog" (
      "id" TEXT PRIMARY KEY,
      "jobName" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "message" TEXT,
      "details" JSONB,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" TIMESTAMP(3),
      "durationMs" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CronRunLog_jobName_startedAt_idx" ON "CronRunLog" ("jobName", "startedAt" DESC)');
}

async function insertCronRun(status: 'success' | 'error', startedAt: Date, message: string, details: Record<string, unknown>) {
  await ensureCronRunLogTable();
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CronRunLog" ("id", "jobName", "status", "message", "details", "startedAt", "finishedAt", "durationMs") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    `${JOB_NAME}-${finishedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    JOB_NAME,
    status,
    message,
    JSON.stringify(details),
    startedAt,
    finishedAt,
    durationMs,
  );
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.error;

  const startedAt = new Date();

  try {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - MAX_LIVE_MINUTES * 60 * 1000);

    const result = await prisma.match.updateMany({
      where: {
        status: { in: LIVE_STATUSES },
        matchDate: { lt: staleBefore },
      },
      data: { status: 'FINISHED' },
    });

    const payload = {
      success: true,
      jobName: JOB_NAME,
      rule: `Any ${LIVE_STATUSES.join('/')} match older than ${MAX_LIVE_MINUTES} minutes is marked FINISHED`,
      expiredCount: result.count,
      staleBefore: staleBefore.toISOString(),
    };

    await insertCronRun('success', startedAt, `Expired ${result.count} stale live matches`, payload);

    return NextResponse.json(payload);
  } catch (error: any) {
    const message = error.message || 'Internal Server Error';
    console.error('Expire stale matches error:', error);
    try {
      await insertCronRun('error', startedAt, message, { error: message });
    } catch (logError) {
      console.error('Cron run log insert failed:', logError);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
