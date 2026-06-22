import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      disabled: true,
      mode: 'match_provider_fetch_disabled',
      reason: 'Clean architecture: match pages and the web service must read database snapshots only. Provider API fetching is moved to a separate worker plan.',
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

export async function POST() {
  return GET();
}
