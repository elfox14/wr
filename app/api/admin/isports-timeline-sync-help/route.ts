import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function authorized(req: Request, params: URLSearchParams) {
  const valid = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get('x-admin-secret') || '', req.headers.get('x-cron-secret') || '', params.get('key') || '', params.get('adminSecret') || '', params.get('cronSecret') || ''];
  return candidates.some((value) => String(value || '').trim() && valid.includes(String(value || '').trim()));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const matchId = url.searchParams.get('matchId') || '';
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const origin = url.origin;
  const animationMatchId = match.animationMatchId;
  const configured = {
    liveStatsRemoteBrowser: process.env.LIVE_STATS_REMOTE_BROWSER || null,
    hasBrowserlessEndpoint: Boolean(process.env.BROWSERLESS_ENDPOINT),
    hasBrowserlessToken: Boolean(process.env.BROWSERLESS_TOKEN),
  };
  const ready = Boolean(animationMatchId && String(configured.liveStatsRemoteBrowser).toLowerCase() === 'browserless' && configured.hasBrowserlessEndpoint && configured.hasBrowserlessToken);
  const syncUrl = animationMatchId
    ? `${origin}/api/internal/live-ingest/isports/remote-frame-pull?mode=timeline&matchId=${encodeURIComponent(String(animationMatchId))}&dbMatchId=${encodeURIComponent(match.id)}&save=true&replace=true&key=SECRET`
    : null;

  return NextResponse.json({
    ok: true,
    mode: 'isports_timeline_sync_help',
    match: {
      id: match.id,
      localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      status: match.status,
      animationMatchId,
      theStatsExternalId: match.externalId,
    },
    configured,
    ready,
    whyNoISportsEvents: animationMatchId
      ? 'iSport timeline does not push events automatically. It must be pulled through remote-frame-pull with mode=timeline&save=true, and Browserless must be configured.'
      : 'This match has no animationMatchId, so the iSport animation timeline cannot be pulled until the iSport match id is mapped to this local match.',
    syncUrl,
    requiredIfNotReady: {
      missingAnimationMatchId: !animationMatchId,
      missingBrowserless: !(String(configured.liveStatsRemoteBrowser).toLowerCase() === 'browserless' && configured.hasBrowserlessEndpoint && configured.hasBrowserlessToken),
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
