import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    removed: true,
    provider: 'API_FOOTBALL',
    message: 'Legacy API-Football player performance sync has been removed. Use iSports live sync or approved manual/statistical imports instead.',
  }, { status: 410 });
}
