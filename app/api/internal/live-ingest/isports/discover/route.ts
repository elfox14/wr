import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { discoverISportsHomepage } from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function numberParam(url: URL, key: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') !== 'false';
    const threshold = numberParam(url, 'threshold', 140, 40, 230);
    const date = url.searchParams.get('date');
    const saveUnlinked = url.searchParams.get('saveUnlinked') === 'true';

    const result = await discoverISportsHomepage(date, { dryRun, threshold, saveUnlinked });
    return NextResponse.json({
      ok: true,
      mode: 'isports_homepage_discovery',
      dryRun,
      threshold,
      date: result.dateKey,
      page: {
        url: result.page.url,
        loader: result.page.loader,
        rendered: result.page.rendered,
        error: result.page.error || null,
      },
      localMatches: result.localMatches,
      discoveredCount: result.candidates.length,
      linkedCount: result.candidates.filter((item: any) => item.linked).length,
      linkCandidateCount: result.candidates.filter((item: any) => item.linkCandidate).length,
      candidates: result.candidates,
      nextAction: dryRun ? 'راجع الترشيحات ثم شغّل نفس المسار مع dryRun=false للحفظ.' : 'تم حفظ الروابط المؤكدة وتحديث animationMatchId للمباريات المطابقة.',
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
