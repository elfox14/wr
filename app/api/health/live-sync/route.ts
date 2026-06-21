import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const startedAt = Date.now();
  try {
    const liveMatchesCount = await prisma.match.count({
      where: {
        status: {
          in: ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET']
        }
      }
    });
    const isLive = liveMatchesCount > 0;

    const logs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "startedAt", "finishedAt", "status" FROM "CronRunLog" WHERE "jobName" = 'worldcup-live-auto' AND "status" = 'success' ORDER BY "startedAt" DESC LIMIT 1`
    ).catch(() => []);

    const lastSuccess = logs[0] || null;
    const now = new Date();

    if (!lastSuccess) {
      return NextResponse.json({
        ok: false,
        status: 'unhealthy',
        message: 'No successful worldcup-live-auto runs found in CronRunLog table.',
        isLiveMatchActive: isLive,
        checkedAt: now.toISOString(),
        responseTimeMs: Date.now() - startedAt,
      }, { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const lastSuccessDate = new Date(lastSuccess.startedAt);
    const diffMs = now.getTime() - lastSuccessDate.getTime();
    const diffMinutes = diffMs / 60_000;

    const thresholdMinutes = isLive ? 4 : 15;
    const isHealthy = diffMinutes <= thresholdMinutes;

    const responsePayload = {
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      isLiveMatchActive: isLive,
      lastSuccessTime: lastSuccessDate.toISOString(),
      minutesSinceLastSuccess: Math.round(diffMinutes * 10) / 10,
      thresholdMinutes,
      checkedAt: now.toISOString(),
      responseTimeMs: Date.now() - startedAt,
    };

    return NextResponse.json(responsePayload, {
      status: isHealthy ? 200 : 500,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      status: 'error',
      message: error?.message || 'Database or query execution failed',
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
    }, { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
