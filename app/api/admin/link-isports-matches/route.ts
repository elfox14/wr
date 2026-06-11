import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function getHeaderOrQuerySecret(req: Request) {
  const expected = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';
  if (!expected) return { valid: false, method: null };
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const { searchParams } = new URL(req.url);
  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-admin-secret', value: req.headers.get('x-admin-secret') || '' },
    { method: 'x-cron-secret', value: req.headers.get('x-cron-secret') || '' },
    { method: 'adminSecret_query', value: searchParams.get('adminSecret') || '' },
    { method: 'cronSecret_query', value: searchParams.get('cronSecret') || '' },
  ];
  const matched = candidates.find((item) => item.value && item.value === expected);
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

async function requireAdmin(req: Request) {
  const secretAuth = getHeaderOrQuerySecret(req);
  if (secretAuth.valid) return { ok: true, authMethod: secretAuth.method };
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (session?.user && isAdminSession(session)) return { ok: true, authMethod: 'admin_session' };
  return { ok: false, authMethod: null };
}

function normalizeTeam(value?: string | null) {
  return normalizeName(value || '').replace(/\bfootball club\b/g, '').replace(/\bfc\b/g, '').replace(/\bnational team\b/g, '').replace(/\bw\b/g, '').replace(/\(w\)/g, '').replace(/\s+/g, ' ').trim();
}

function tokenSet(value?: string | null) {
  return new Set(normalizeTeam(value).split(' ').filter((token) => token.length >= 3));
}

function nameScore(a?: string | null, b?: string | null) {
  const left = normalizeTeam(a);
  const right = normalizeTeam(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 85;
  const aTokens = tokenSet(left);
  const bTokens = tokenSet(right);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let hits = 0;
  aTokens.forEach((token) => { if (bTokens.has(token)) hits += 1; });
  return Math.round((hits / Math.max(aTokens.size, bTokens.size)) * 80);
}

function fixtureDate(fixture: any) {
  const raw = fixture.fixture?.date || fixture.raw?.matchTime || fixture.raw?.match_time || fixture.raw?.time || null;
  if (!raw) return null;
  const numeric = Number(raw);
  const normalizedRaw = Number.isFinite(numeric) && numeric > 100000 ? (numeric < 10000000000 ? numeric * 1000 : numeric) : raw;
  const date = new Date(normalizedRaw);
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function timeScore(localDate: Date, providerDate: Date | null) {
  if (!providerDate) return 10;
  const diffHours = Math.abs(localDate.getTime() - providerDate.getTime()) / 36e5;
  if (diffHours <= 2) return 25;
  if (diffHours <= 8) return 15;
  if (diffHours <= 24) return 5;
  return -20;
}

function normalizeProviderStatus(status?: string | number | null) {
  const value = String(status ?? '').toUpperCase();
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY'].includes(value)) return 'IN_PLAY';
  if (['FT', 'AET', 'PEN', 'FINISHED', 'ENDED', '-1'].includes(value)) return 'FINISHED';
  return 'SCHEDULED';
}

function scoreCandidate(localMatch: any, fixture: any) {
  const homeName = fixture.teams?.home?.name;
  const awayName = fixture.teams?.away?.name;
  const direct = nameScore(localMatch.homeTeam.name, homeName) + nameScore(localMatch.awayTeam.name, awayName);
  const swapped = nameScore(localMatch.homeTeam.name, awayName) + nameScore(localMatch.awayTeam.name, homeName);
  const orientation = direct >= swapped ? 'direct' : 'swapped';
  const teamScore = Math.max(direct, swapped);
  const providerDate = fixtureDate(fixture);
  const finalScore = teamScore + timeScore(new Date(localMatch.matchDate), providerDate);
  return { finalScore, teamScore, orientation, providerDate, homeName, awayName };
}

function getDateRange(dateParam?: string | null) {
  const base = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, dateKey: start.toISOString().slice(0, 10) };
}

async function getLocalMatches(dateParam?: string | null) {
  const { start, end } = getDateRange(dateParam);
  return prisma.match.findMany({ where: { matchDate: { gte: start, lt: end } }, orderBy: { matchDate: 'asc' }, include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } } });
}

async function getIsportsFixtures(dateKey: string) {
  const payload = await apiFootballFetch<{ response?: any[]; _provider?: string }>('/livescores', { live: 'all', date: dateKey });
  return { providerUsed: payload._provider || 'UNKNOWN', fixtures: payload.response || [] };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dryRun') !== 'false';
  const threshold = Number(searchParams.get('threshold') || 140);
  const dateParam = searchParams.get('date');
  const { dateKey } = getDateRange(dateParam);
  const localMatches = await getLocalMatches(dateParam);
  let providerUsed = 'UNKNOWN';
  let fixtures: any[] = [];
  try {
    const result = await getIsportsFixtures(dateKey);
    providerUsed = result.providerUsed;
    fixtures = result.fixtures;
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to fetch provider fixtures', provider: error.provider || null, details: error.payload || null }, { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } });
  }
  const linked: any[] = [];
  const unmatched: any[] = [];
  const candidatesDebug: any[] = [];
  for (const match of localMatches) {
    const ranked = fixtures.map((fixture) => ({ fixture, candidate: scoreCandidate(match, fixture) })).filter((item) => Number.isFinite(item.fixture.fixture?.id)).sort((a, b) => b.candidate.finalScore - a.candidate.finalScore);
    const best = ranked[0];
    candidatesDebug.push({ localMatchId: match.id, local: `${match.homeTeam.name} vs ${match.awayTeam.name}`, best: best ? { fixtureId: best.fixture.fixture?.id, provider: `${best.candidate.homeName} vs ${best.candidate.awayName}`, finalScore: best.candidate.finalScore, teamScore: best.candidate.teamScore, orientation: best.candidate.orientation, providerDate: best.candidate.providerDate } : null });
    if (!best || best.candidate.finalScore < threshold) {
      unmatched.push({ id: match.id, local: `${match.homeTeam.name} vs ${match.awayTeam.name}`, reason: best ? `best score ${best.candidate.finalScore} below threshold ${threshold}` : 'no provider candidate' });
      continue;
    }
    const animationMatchId = Number(best.fixture.fixture.id);
    const nextStatus = normalizeProviderStatus(best.fixture.fixture?.status?.short || best.fixture.fixture?.status?.long);
    const homeScore = Number(best.fixture.goals?.home ?? match.homeScore);
    const awayScore = Number(best.fixture.goals?.away ?? match.awayScore);
    if (!dryRun) {
      await prisma.match.update({ where: { id: match.id }, data: { animationMatchId, status: nextStatus, homeScore, awayScore } });
    }
    linked.push({ id: match.id, local: `${match.homeTeam.name} vs ${match.awayTeam.name}`, animationMatchId, provider: `${best.candidate.homeName} vs ${best.candidate.awayName}`, status: nextStatus, score: `${homeScore}-${awayScore}`, matchScore: best.candidate.finalScore, dryRun });
  }
  return NextResponse.json({ ok: true, authMethod: auth.authMethod, date: dateKey, dryRun, threshold, providerUsed, localMatches: localMatches.length, providerFixtures: fixtures.length, linkedCount: linked.length, unmatchedCount: unmatched.length, linked, unmatched, candidatesDebug, nextAction: dryRun ? 'Review linked candidates, then rerun with dryRun=false to save animationMatchId.' : 'Saved animationMatchId. Rerun diagnostics and open /animation-live.' }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
}

export async function POST(req: Request) { return GET(req); }
