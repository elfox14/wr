import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { getLatestSnapshot, publicSnapshot, syncMatchStats } from '@/lib/live-match-stats';
import {
  canonicalISportsSourceUrl,
  ensureLiveIngestTables,
  extractISportsMatchId,
  getExternalSourceByProviderMatchId,
  recordLiveIngestLog,
  scrapeISportsMatchPage,
  upsertExternalMatchSource,
} from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function toInt(value?: string | null) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function findMatch(input: { dbMatchId?: string | null; providerMatchId?: number | null }) {
  if (input.dbMatchId) {
    return prisma.match.findUnique({
      where: { id: input.dbMatchId },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });
  }
  if (input.providerMatchId) {
    return prisma.match.findFirst({
      where: { animationMatchId: input.providerMatchId },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });
  }
  return null;
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const started = Date.now();
  try {
    await ensureLiveIngestTables();
    const url = new URL(req.url);
    const sourceUrlParam = url.searchParams.get('sourceUrl');
    const providerMatchId = toInt(url.searchParams.get('providerMatchId') || url.searchParams.get('matchId')) || extractISportsMatchId(sourceUrlParam);
    const dbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const save = url.searchParams.get('save') !== 'false';
    const fallbackToApi = url.searchParams.get('fallbackToApi') !== 'false';

    if (!providerMatchId && !dbMatchId) {
      return NextResponse.json({ ok: false, error: 'providerMatchId, sourceUrl, or dbMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const match = await findMatch({ dbMatchId, providerMatchId });
    const sourceRow = providerMatchId ? await getExternalSourceByProviderMatchId(providerMatchId) : null;
    const finalProviderMatchId = providerMatchId || Number(match?.animationMatchId || 0);
    if (!finalProviderMatchId) {
      return NextResponse.json({ ok: false, error: 'No provider match id found for this match.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const sourceUrl = sourceUrlParam || sourceRow?.sourceUrl || canonicalISportsSourceUrl(finalProviderMatchId);
    if (match && save) {
      await upsertExternalMatchSource({
        matchId: match.id,
        providerMatchId: finalProviderMatchId,
        sourceUrl,
        status: 'active',
        rawLabel: `${match.homeTeam?.name || ''} vs ${match.awayTeam?.name || ''}`.trim(),
      });
    }

    const scrape = await scrapeISportsMatchPage({ sourceUrl, providerMatchId: finalProviderMatchId, match, save });
    let apiFallback: any = null;

    if (!scrape.hasStats && fallbackToApi && match?.animationMatchId) {
      try {
        apiFallback = await syncMatchStats(match, { debug: false, force: true });
      } catch (error: any) {
        apiFallback = { status: 'failed', error: error?.message || 'API fallback failed', providerStatus: error?.status || null };
      }
    }

    const latest = match ? publicSnapshot(await getLatestSnapshot(match.id)) : null;
    await recordLiveIngestLog({
      matchId: match?.id || null,
      status: scrape.hasStats ? 'pull_route_saved' : apiFallback?.snapshotId ? 'pull_route_api_fallback_saved' : 'pull_route_no_stats',
      message: JSON.stringify({ providerMatchId: finalProviderMatchId, sourceUrl, scrapeStatus: scrape.hasStats, apiFallbackStatus: apiFallback?.status || null }).slice(0, 1000),
      durationMs: Date.now() - started,
    });

    return NextResponse.json({
      ok: true,
      mode: 'isports_page_pull',
      save,
      fallbackToApi,
      match: match ? {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        matchDate: match.matchDate.toISOString(),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      } : null,
      scrape,
      apiFallback,
      latest,
      note: scrape.hasStats ? 'تم حفظ snapshot من صفحة iSports في قاعدة البيانات.' : 'لم يتم العثور على إحصائيات مرئية؛ تم استخدام fallback إن كان متاحًا.',
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
