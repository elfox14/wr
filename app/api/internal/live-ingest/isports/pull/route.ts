import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: false, disabled: true, route: 'isports-pull' });
}

export async function POST() {
  return GET();
}
