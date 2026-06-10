import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { seedTeamIntelligenceReports } from '@/lib/seedTeamIntelligenceReports';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = process.env.ADMIN_CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';

  return bearerToken === secret || queryToken === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await seedTeamIntelligenceReports(prisma);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to seed team intelligence reports:', error);
    return NextResponse.json({ error: 'Failed to seed team intelligence reports' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST to seed team intelligence reports.',
  });
}
