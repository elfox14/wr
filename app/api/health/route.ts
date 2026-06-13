import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      status: 'healthy',
      database: 'connected',
      environment: process.env.NODE_ENV || 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
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
