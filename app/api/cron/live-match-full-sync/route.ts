import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      disabled: true,
      mode: 'live_match_full_sync_disabled',
      reason: 'Emergency stop: full live match API fetching is disabled to protect Render memory while rebuilding the data plan.',
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

export async function POST() {
  return GET();
}
