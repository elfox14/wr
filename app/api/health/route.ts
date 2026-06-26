import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveTheStatsProviderId } from '@/lib/theStatsMatchExtras';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const testMatch = await prisma.match.findFirst({
      where: {
        homeTeam: { name: 'Sweden' },
        awayTeam: { name: 'Tunisia' }
      }
    });

    const resolutionResult = testMatch 
      ? await resolveTheStatsProviderId(testMatch, {}).catch(err => ({ error: err.message }))
      : null;

    return NextResponse.json({
      ok: true,
      status: 'healthy',
      database: 'connected',
      environment: process.env.NODE_ENV || 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      resolutionResult,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error?.message || 'Unknown health check error',
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    }, { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
