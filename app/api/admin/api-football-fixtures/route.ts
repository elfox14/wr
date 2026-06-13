import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: false,
    removed: true,
    provider: 'API_FOOTBALL',
    message: 'API-Football has been removed from the platform. Use iSports sync or approved manual/statistical imports instead.',
  }, { status: 410 });
}
