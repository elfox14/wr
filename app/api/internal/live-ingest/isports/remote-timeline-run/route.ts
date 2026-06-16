import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_LOOKAHEAD_DAYS = 2;
const DEFAULT_TAKE = 3;
const MAX_TAKE = 10;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function boolFromParam(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function adminSecretFromRequest(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return process.env.ADMIN_API_SECRET || req.headers.get('x-admin-secret') || bearer || url.searchParams.get('adminSecret') || '';
}

function compactPullResult(result: any) {
  return {
    ok: Boolean(result?.ok),
    remoteBrowser: result?.remoteBrowser ? {
      ok: result.remoteBrowser.ok,
      status: result.remoteBrowser.status,
      rawLength: result.remoteBrowser.rawLength,
      error: result.remoteBrowser.error || null,
    } : null,
    match: result?.match || null,
    timeline: result?.timeline ? {
      eventsCount: result.timeline.eventsCount,
      save: result.timeline.save || null,
      eventsPreview: Array.isArray(result.timeline.events) ? result.timeline.events.slice(0, 5) : [],
    } : null,
    error: result?.error || null,
  };
}

async function callRemoteFramePull(origin: string, adminSecret: string, input: { providerMatchId: number; dbMatchId: string; timeoutMs: number; waitMs: number; save: boolean; replace: boolean }) {
  const url = new URL('/api/internal/live-ingest/isports/remote-frame-pull', origin);
  url.searchParams.set('matchId', String(input.providerMatchId));
  url.searchParams.set('dbMatchId', input.dbMatchId);
  url.searchParams.set('mode', 'timeline');
  url.searchParams.set('timeoutMs', String(input.timeoutMs));
  url.searchParams.set('waitMs', String(input.waitMs));
  url.searchParams.set('save', input.save ? 'true' : 'false');
  url.searchParams.set('replace', input.replace ? 'true' : 'false');

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: adminSecret ? { 'x-admin-secret': adminSecret } : {},
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: response.status, ok: response.ok, result: parsed || { rawSample: text.slice(0, 1000) } };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const take = clampInt(url.searchParams.get('take'), DEFAULT_TAKE, 1, MAX_TAKE);
    const timeoutMs = clampInt(url.searchParams.get('timeoutMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_TIMEOUT_MS || 25000), 5000, 60000);
    const waitMs = clampInt(url.searchParams.get('waitMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_WAIT_MS || 12000), 1000, 30000);
    const save = boolFromParam(url.searchParams.get('save'), true);
    const replace = boolFromParam(url.searchParams.get('replace'), true);
    const explicitDbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const explicitProviderMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || 0);
    const now = new Date();
    const fromDefault = new Date(now);
    fromDefault.setDate(fromDefault.getDate() - DEFAULT_LOOKBACK_DAYS);
    const toDefault = new Date(now);
    toDefault.setDate(toDefault.getDate() + DEFAULT_LOOKAHEAD_DAYS);
    const dateFrom = parseDate(url.searchParams.get('dateFrom'), fromDefault);
    const dateTo = parseDate(url.searchParams.get('dateTo'), toDefault);

    const matches = await prisma.match.findMany({
      where: explicitDbMatchId
        ? { id: explicitDbMatchId, animationMatchId: { not: null } }
        : Number.isFinite(explicitProviderMatchId) && explicitProviderMatchId > 0
          ? { animationMatchId: Math.floor(explicitProviderMatchId) }
          : { animationMatchId: { not: null }, matchDate: { gte: dateFrom, lte: dateTo } },
      orderBy: [{ matchDate: 'desc' }],
      take,
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });

    const adminSecret = adminSecretFromRequest(req);
    const results: any[] = [];
    for (const match of matches) {
      const providerMatchId = Number(match.animationMatchId);
      if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) continue;
      try {
        const pull = await callRemoteFramePull(url.origin, adminSecret, {
          providerMatchId,
          dbMatchId: match.id,
          timeoutMs,
          waitMs,
          save,
          replace,
        });
        results.push({
          dbMatchId: match.id,
          providerMatchId,
          local: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          status: match.status,
          matchDate: match.matchDate.toISOString(),
          httpStatus: pull.status,
          ...compactPullResult(pull.result),
        });
      } catch (error: any) {
        results.push({
          dbMatchId: match.id,
          providerMatchId,
          local: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          status: match.status,
          matchDate: match.matchDate.toISOString(),
          ok: false,
          error: error?.message || 'Timeline pull failed',
        });
      }
    }

    return json({
      ok: true,
      mode: 'isports_remote_timeline_run',
      save,
      replace,
      take,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      processed: results.length,
      durationMs: Date.now() - startedAt,
      results,
      note: 'Runs Browserless timeline ingestion for linked matches only. Use take/dateFrom/dateTo to control Browserless usage.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
