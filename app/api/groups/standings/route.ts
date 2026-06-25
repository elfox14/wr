import { NextResponse } from 'next/server';
import { getHomeGroupStandings } from '@/lib/homeGroupStandings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const groups = await getHomeGroupStandings();
    return NextResponse.json({ ok: true, groups }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('group standings endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
