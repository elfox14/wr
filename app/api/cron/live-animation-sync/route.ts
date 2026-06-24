import { NextResponse } from 'next/server';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { runLiveAnimationSync } from '@/lib/liveAnimationSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function boolFrom(value: string | null | undefined, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberFrom(value: string | null | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const result = await runLiveAnimationSync({
    matchId: url.searchParams.get('matchId'),
    limit: numberFrom(url.searchParams.get('limit') || process.env.LIVE_ANIMATION_SYNC_LIMIT, 8, 1, 50),
    lookbackHours: numberFrom(url.searchParams.get('lookbackHours') || process.env.LIVE_ANIMATION_SYNC_LOOKBACK_HOURS, 12, 1, 24 * 30),
    allowFinished: boolFrom(url.searchParams.get('allowFinished') || process.env.LIVE_ANIMATION_SYNC_ALLOW_FINISHED, true),
    dryRun: boolFrom(url.searchParams.get('dryRun') || process.env.LIVE_ANIMATION_SYNC_DRY_RUN, false),
  });

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
