import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { ensureLiveSyncResumeGuardTables, getLiveSyncResumeSummary } from '@/lib/live-sync-resume-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    await ensureLiveSyncResumeGuardTables();
    const url = new URL(req.url);
    const target = {
      dbMatchId: url.searchParams.get('dbMatchId') || url.searchParams.get('id'),
      providerMatchId: url.searchParams.get('providerMatchId') || url.searchParams.get('matchId'),
    };
    return json({ ok: true, mode: 'live_sync_resume_status', target, resumeGuard: await getLiveSyncResumeSummary(target) });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
