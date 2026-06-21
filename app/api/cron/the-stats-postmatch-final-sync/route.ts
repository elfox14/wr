import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const DEFAULT_PUBLIC_ORIGIN = 'https://worldcup.mcprim.com';
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function secret() { return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim(); }
function maskUrl(value: string) { return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***'); }
function cleanOrigin(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin; } catch { return null; }
}
function publicOrigin(req: Request, currentUrl: URL) {
  const explicit = cleanOrigin(process.env.LIVE_SYNC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL);
  if (explicit) return explicit;
  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.get('host') || '').split(',')[0].trim();
  const proto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
  const headerOrigin = cleanOrigin(host ? `${proto}://${host}` : null);
  if (headerOrigin && !headerOrigin.includes('localhost') && !headerOrigin.includes('127.0.0.1')) return headerOrigin;
  if (!currentUrl.origin.includes('localhost') && !currentUrl.origin.includes('127.0.0.1')) return currentUrl.origin;
  return DEFAULT_PUBLIC_ORIGIN;
}
async function callJson(name: string, url: URL, timeoutMs: number) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    return { name, ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, url: maskUrl(url.toString()), body };
  } catch (error: any) {
    return { name, ok: false, status: null, durationMs: Date.now() - startedAt, url: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 1000) };
  } finally { clearTimeout(timer); }
}
function withSecret(url: URL, key: string) {
  url.searchParams.set('key', key);
  url.searchParams.set('adminSecret', key);
  url.searchParams.set('cronSecret', key);
  return url;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const key = secret();
  if (!key) return json({ ok: false, error: 'CRON_SECRET or ADMIN_API_SECRET is required' }, 500);

  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const limit = int(url.searchParams.get('limit'), 4, 1, 12);
  const minutesBack = int(url.searchParams.get('minutesBack'), 720, 30, 2880);
  const minutesForward = int(url.searchParams.get('minutesForward'), 15, 0, 120);
  const delayMs = int(url.searchParams.get('delayMs'), 750, 0, 5000);
  const now = Date.now();

  const matches = await prisma.match.findMany({
    where: {
      AND: [
        {
          OR: [
            { status: { in: FINISHED } },
            { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) } },
          ]
        },
        {
          statsSnapshots: {
            none: {
              provider: 'THE_STATS_API_EXTRAS'
            }
          }
        }
      ]
    },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    orderBy: { matchDate: 'desc' },
    take: limit,
  });

  const results = [];
  for (const [index, match] of matches.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    
    // 1. Core Enrichment (Events, Lineups, Ratings) -> THE_STATS_API snapshot
    const enrich = withSecret(new URL('/api/admin/the-stats-import-match-enrichment', origin), key);
    enrich.searchParams.set('matchId', match.id);
    enrich.searchParams.set('dryRun', String(dryRun));
    enrich.searchParams.set('importEvents', 'true');
    results.push(await callJson(`final_enrichment_${match.id}`, enrich, 28_000));

    // Stagger slightly to respect provider limits
    await new Promise((resolve) => setTimeout(resolve, 250));

    // 2. Advanced Detailed Extras (Detailed PlayerStats, Shotmaps) -> THE_STATS_API_EXTRAS snapshot
    const extras = withSecret(new URL('/api/admin/match-postmatch-extras', origin), key);
    extras.searchParams.set('matchId', match.id);
    extras.searchParams.set('dryRun', String(dryRun));
    extras.searchParams.set('mode', 'full');
    results.push(await callJson(`final_extras_${match.id}`, extras, 28_000));
  }

  return json({ ok: true, mode: 'the_stats_postmatch_final_sync', dryRun, origin, matchesFound: matches.length, successful: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results });
}

export async function POST(req: Request) { return GET(req); }
