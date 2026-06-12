import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function validSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function getAuth(req: Request) {
  const secrets = validSecrets();
  if (secrets.length === 0) return { valid: false, method: 'missing_server_secret' };
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-admin-secret', value: req.headers.get('x-admin-secret')?.trim() || '' },
    { method: 'x-cron-secret', value: req.headers.get('x-cron-secret')?.trim() || '' },
    { method: 'key_query', value: url.searchParams.get('key')?.trim() || '' },
    { method: 'adminSecret_query', value: url.searchParams.get('adminSecret')?.trim() || '' },
    { method: 'cronSecret_query', value: url.searchParams.get('cronSecret')?.trim() || '' },
  ];
  const matched = candidates.find((item) => item.value && secrets.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMatch(match: any) {
  return {
    id: match.id,
    externalId: match.externalId,
    animationMatchId: match.animationMatchId,
    status: match.status,
    score: `${toNumber(match.homeScore)}-${toNumber(match.awayScore)}`,
    homeScore: toNumber(match.homeScore),
    awayScore: toNumber(match.awayScore),
    matchDate: match.matchDate.toISOString(),
    groupPhase: match.groupPhase,
    stage: match.stage,
    homeTeam: match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name, code: match.homeTeam.code, image: match.homeTeam.image } : null,
    awayTeam: match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name, code: match.awayTeam.code, image: match.awayTeam.image } : null,
  };
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const url = new URL(req.url);
  const now = new Date();
  const hours = Math.min(Math.max(Number(url.searchParams.get('hours') || 72), 6), 720);
  const from = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const [unlinked, linkedNear, totalUnlinked] = await Promise.all([
    prisma.match.findMany({
      where: {
        animationMatchId: null,
        matchDate: { gte: from, lte: to },
      },
      orderBy: { matchDate: 'asc' },
      take: 100,
      include: {
        homeTeam: { select: { id: true, name: true, code: true, image: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true } },
      },
    }),
    prisma.match.count({ where: { animationMatchId: { not: null }, matchDate: { gte: from, lte: to } } }),
    prisma.match.count({ where: { animationMatchId: null } }),
  ]);

  return NextResponse.json({
    ok: true,
    authMethod: auth.method,
    updatedAt: now.toISOString(),
    window: { from: from.toISOString(), to: to.toISOString(), hoursAhead: hours },
    counters: {
      unlinkedInWindow: unlinked.length,
      linkedInWindow: linkedNear,
      totalUnlinked,
    },
    environment: {
      cronBaseUrl: process.env.CRON_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || null,
      cronBaseUrlRecommended: 'https://worldcup.mcprim.com',
      apiFootballCronEnabled: process.env.ENABLE_API_FOOTBALL_CRON === 'true',
    },
    matches: unlinked.map(formatMatch),
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
}
