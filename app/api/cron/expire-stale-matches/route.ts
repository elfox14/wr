import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const MAX_LIVE_MINUTES = 180;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const headerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret');
  return headerToken === secret || queryToken === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    return NextResponse.json({
      success: true,
      rule: `Any ${LIVE_STATUSES.join('/')} match older than ${MAX_LIVE_MINUTES} minutes is marked FINISHED`,
      expiredCount: result.count,
      staleBefore: staleBefore.toISOString(),
    });
  } catch (error: any) {
    console.error('Expire stale matches error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
