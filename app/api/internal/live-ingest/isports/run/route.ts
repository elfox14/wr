import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { getLatestSnapshot, syncMatchStats } from '@/lib/live-match-stats';
import {
  canonicalISportsSourceUrl,
  discoverISportsHomepage,
  ensureLiveIngestTables,
  getExternalSourceByProviderMatchId,
  recordLiveIngestLog,
  scrapeISportsMatchPage,
} from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET'];

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function snapshotAgeSeconds(latest: any) {
  if (!latest?.capturedAt) return Number.POSITIVE_INFINITY;
  const capturedAt = new Date(latest.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return Number.POSITIVE_INFINITY;
  return (Date.now() - capturedAt) / 1000;
}

async function getCandidateMatches(take: number) {
  const liveStart = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const liveEnd = new Date(Date.now() + 20 * 60 * 1000);
  return prisma.match.findMany({
    where: {
      animationMatchId: { not: null },
      OR: [
        { status: { in: LIVE_STATUSES } },
        { status: 'SCHEDULED', matchDate: { gte: liveStart, lte: liveEnd } },
      ],
    },
    orderBy: { matchDate: 'asc' },
    take,
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
  });
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const started = Date.now();
  try {
    await ensureLiveIngestTables();
    const url = new URL(req.url);
    const take = clampNumber(url.searchParams.get('take'), 4, 1, 12);
    const minIntervalSeconds = clampNumber(url.searchParams.get('minIntervalSeconds'), 30, 10, 600);
    const runDiscovery = url.searchParams.get('discover') === 'true';
    const dryRunDiscovery = url.searchParams.get('discoverDryRun') !== 'false';
    const fallbackToApi = url.searchParams.get('fallbackToApi') !== 'false';

    const discovery = runDiscovery ? await discoverISportsHomepage(url.searchParams.get('date'), { dryRun: dryRunDiscovery, threshold: clampNumber(url.searchParams.get('threshold'), 140, 40, 230) }) : null;
    const matches = await getCandidateMatches(take);
    const processed = [];

    for (const match of matches) {
      const latest = await getLatestSnapshot(match.id);
      const ageSeconds = snapshotAgeSeconds(latest);
      if (ageSeconds < minIntervalSeconds) {
        processed.push({ matchId: match.id, animationMatchId: match.animationMatchId, status: 'recent_snapshot_skipped', ageSeconds: Math.round(ageSeconds) });
        continue;
      }

      const providerMatchId = Number(match.animationMatchId);
      const source = await getExternalSourceByProviderMatchId(providerMatchId);
      const sourceUrl = source?.sourceUrl || canonicalISportsSourceUrl(providerMatchId);
      const scrape = await scrapeISportsMatchPage({ sourceUrl, providerMatchId, match, save: true });
      let apiFallback: any = null;
      if (!scrape.hasStats && fallbackToApi) {
        try {
          apiFallback = await syncMatchStats(match, { debug: false, force: true });
        } catch (error: any) {
          apiFallback = { status: 'failed', error: error?.message || 'API fallback failed', providerStatus: error?.status || null };
        }
      }

      processed.push({
        matchId: match.id,
        animationMatchId: providerMatchId,
        match: `${match.homeTeam?.name || ''} vs ${match.awayTeam?.name || ''}`,
        sourceUrl,
        status: scrape.hasStats ? 'scraped_saved' : apiFallback?.snapshotId ? 'api_fallback_saved' : 'no_stats_found',
        loader: scrape.loader,
        rendered: scrape.rendered,
        snapshotId: scrape.snapshotId || apiFallback?.snapshotId || null,
        apiFallbackStatus: apiFallback?.status || null,
      });
    }

    await recordLiveIngestLog({
      status: 'worker_completed',
      message: JSON.stringify({ take, minIntervalSeconds, discovered: discovery?.candidates?.length || 0, processed: processed.length }).slice(0, 1000),
      durationMs: Date.now() - started,
    });

    return NextResponse.json({
      ok: true,
      mode: 'isports_page_background_worker',
      discovery: discovery ? { date: discovery.dateKey, dryRun: dryRunDiscovery, discoveredCount: discovery.candidates.length, linkCandidateCount: discovery.candidates.filter((item: any) => item.linkCandidate).length } : null,
      limits: { take, minIntervalSeconds, fallbackToApi },
      candidates: matches.length,
      processed,
      note: 'هذا المسار مخصص للكرون/الإدارة فقط. الواجهة تقرأ من /api/matches/live-stats وليس من صفحة iSports مباشرة.',
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
