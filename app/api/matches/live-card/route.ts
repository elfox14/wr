import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 8,
    include: { homeTeam: true, awayTeam: true },
  });

  return NextResponse.json({
    matches,
    updatedAt: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
