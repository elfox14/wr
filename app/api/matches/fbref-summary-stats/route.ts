import { NextResponse } from 'next/server';
import { getFbrefTournamentSummary } from '@/lib/fbrefTournamentSummary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(getFbrefTournamentSummary(), {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
