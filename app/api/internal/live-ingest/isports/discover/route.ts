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

    // discoverISportsHomepage currently returns discovery diagnostics only.
    // Keep this route type-safe and avoid passing removed options such as saveUnlinked.
    const result = await discoverISportsHomepage(date, { dryRun, threshold });
    const loaded = result.loaded;
    const candidates = result.candidates || [];

    return NextResponse.json({
      ok: true,
      mode: 'isports_homepage_discovery',
      dryRun,
      threshold,
      date: result.dateKey,
      page: {
        url: loaded.url || result.pageUrl,
        loader: loaded.loader,
        rendered: loaded.rendered,
        error: loaded.error || null,
      },
      localMatches: [],
      discoveredCount: candidates.length,
      linkedCount: candidates.filter((item: any) => item.linked).length,
      linkCandidateCount: candidates.filter((item: any) => item.linkCandidate).length,
      candidates,
      nextAction: 'استخدم matchId الظاهر من candidates لربط المباراة أو شغّل مسارات remote-live/remote-timeline للمباريات المرتبطة بالفعل.',
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
