import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { getLatestSnapshot, hasUsefulStats, publicSnapshot } from '@/lib/live-match-stats';
import { canonicalISportsSourceUrl, extractISportsMatchId, loadRenderedPage, parseISportsVisibleStats, savePageStatsSnapshot } from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);

type FrameMode = 'live' | 'timeline';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed');
  return url;
}

function timelineWrapperUrl(matchId: number, lang = 'en', version = '1') {
  const url = new URL('https://www.isportslive8.com/football/process/demo.html');
  url.searchParams.set('v', version);
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', lang);
  return url.toString();
}

function wrapperUrlFor(matchId: number, mode: FrameMode, lang = 'en', version = '1') {
  return mode === 'timeline' ? timelineWrapperUrl(matchId, lang, version) : canonicalISportsSourceUrl(matchId, lang, version);
}

function md5(value: string) {
  return createHash('md5').update(value).digest('hex').toUpperCase();
}

function lastRegexValue(text: string, regex: RegExp) {
  let found: string | null = null;
  for (const match of text.matchAll(regex)) {
    if (match?.[1]) found = match[1];
  }
  return found;
}

function extractFrameCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g)
    || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g)
    || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
  if (!ak || !sk) return null;
  return { ak, sk };
}

function buildFrameUrl(input: { wrapperUrl: string; mode: FrameMode; providerMatchId: number; wrapperHtml: string }) {
  const wrapper = safeUrl(input.wrapperUrl);
  const credentials = extractFrameCredentials(input.wrapperHtml);
  if (!credentials) throw new Error('Could not extract iSports iframe credentials from wrapper page');

  const lang = wrapper.searchParams.get('lang') || 'en';
  const version = wrapper.searchParams.get('v') || '1';
  const isDark = wrapper.searchParams.get('isDark');
  const ts = Math.floor(Date.now() / 1000);
  const auth = md5(`${credentials.ak}${ts}${credentials.sk}`);
  const path = input.mode === 'timeline' ? '/football/process/attackdetail.aspx' : '/football/detail.html';
  const frame = new URL(path, wrapper.origin);
  frame.searchParams.set('matchId', String(input.providerMatchId));
  frame.searchParams.set('accessKey', credentials.ak);
  frame.searchParams.set('ts', String(ts));
  frame.searchParams.set('auth', auth);

  if (input.mode === 'timeline') {
    frame.searchParams.set('r', String(Date.now()));
    if (isDark !== null) frame.searchParams.set('isDark', isDark);
    if (lang) frame.searchParams.set('lang', lang);
    if (version === '2') frame.searchParams.set('showLogo', '1');
  } else {
    if (!version || version === '1' || version === '3') frame.searchParams.set('statsPanel', 'simple');
    else if (version === '2') frame.searchParams.set('statsPanel', 'hide');
    if (Number(version) > 2) frame.searchParams.set('teamPanel', '1');
    if (lang) frame.searchParams.set('lang', lang);
  }

  return frame.toString();
}

function maskFrameUrl(value: string) {
  const url = new URL(value);
  for (const key of ['accessKey', 'auth', 'ts', 'r']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, '***');
  }
  return url.toString();
}

function parseMode(value: string | null): FrameMode {
  const mode = String(value || 'live').toLowerCase();
  return mode === 'timeline' || mode === 'process' || mode === 'postmatch' ? 'timeline' : 'live';
}

async function findMatch(dbMatchId: string | null, providerMatchId: number) {
  if (dbMatchId) {
    return prisma.match.findUnique({
      where: { id: dbMatchId },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });
  }
  return prisma.match.findFirst({
    where: { animationMatchId: providerMatchId },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
  });
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const save = url.searchParams.get('save') === 'true';
    const mode = parseMode(url.searchParams.get('mode'));
    const dbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const explicitSourceUrl = url.searchParams.get('sourceUrl');
    const rawProviderMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(explicitSourceUrl));
    if (!Number.isFinite(rawProviderMatchId) || rawProviderMatchId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);
    const providerMatchId = Math.floor(rawProviderMatchId);
    const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl).toString() : wrapperUrlFor(providerMatchId, mode, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');

    const match = await findMatch(dbMatchId, providerMatchId);
    const wrapperPage = await loadRenderedPage(wrapperUrl);
    const frameUrl = buildFrameUrl({ wrapperUrl, mode, providerMatchId, wrapperHtml: wrapperPage.html });
    const framePage = await loadRenderedPage(frameUrl);
    const stats = parseISportsVisibleStats(framePage.text, match);
    const hasStats = hasUsefulStats(stats);
    let snapshotId: string | null = null;

    if (save && match && hasStats && mode === 'live') {
      snapshotId = await savePageStatsSnapshot(match, providerMatchId, stats, {
        source: 'ISPORTS_SIGNED_IFRAME',
        mode,
        wrapperUrl,
        frameUrl: maskFrameUrl(frameUrl),
        wrapperLoader: wrapperPage.loader,
        frameLoader: framePage.loader,
        frameRendered: framePage.rendered,
        framePageError: framePage.error || null,
        rawText: framePage.text.slice(0, 24000),
      });
    }

    const latest = match ? await getLatestSnapshot(match.id) : null;
    return json({
      ok: true,
      mode: 'isports_signed_iframe_pull',
      frameMode: mode,
      save,
      wrapper: {
        sourceUrl: wrapperUrl,
        loader: wrapperPage.loader,
        rendered: wrapperPage.rendered,
        pageError: wrapperPage.error || null,
        htmlLength: wrapperPage.html.length,
        textLength: wrapperPage.text.length,
      },
      frame: {
        sourceUrl: maskFrameUrl(frameUrl),
        loader: framePage.loader,
        rendered: framePage.rendered,
        pageError: framePage.error || null,
        htmlLength: framePage.html.length,
        textLength: framePage.text.length,
        textSample: framePage.text.slice(0, 1800),
      },
      match: match ? {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      } : null,
      hasStats,
      stats,
      snapshotId,
      latest: publicSnapshot(latest),
      note: mode === 'live'
        ? 'Live mode reads the signed detail iframe and can save a stats snapshot when visible stats are mapped.'
        : 'Timeline mode reads the signed attackdetail iframe; this is for post-match event timeline inspection and is not saved as match stats yet.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
