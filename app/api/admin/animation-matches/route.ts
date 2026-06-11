import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = (await getServerSession(authOptions as any)) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function splitKeys(value?: string) {
  return value?.split(',').map((key) => key.trim()).filter(Boolean) || [];
}

function getIsportsKeys() {
  const pool = splitKeys(process.env.ISPORTS_API_KEYS);
  if (pool.length > 0) return pool;
  return [process.env.ISPORTS_API_KEY].filter(Boolean) as string[];
}

function normalizeName(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\b(fc|cf|sc|club|national|team|football|soccer)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function dateOnly(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}

function normalizeProviderMatch(item: any) {
  const matchId = Number(item.matchId ?? item.match_id ?? item.id ?? item.fixtureId ?? item.fixture_id);
  const homeName = item.homeName || item.home_name || item.homeTeamName || item.home_team_name || item.homeTeam?.name || item.home?.name;
  const awayName = item.awayName || item.away_name || item.awayTeamName || item.away_team_name || item.awayTeam?.name || item.away?.name;
  const matchTime = item.matchTime || item.match_time || item.date || item.time || item.kickoffTime || item.startTime;

  return {
    matchId: Number.isFinite(matchId) ? matchId : null,
    homeName,
    awayName,
    matchTime,
    status: item.status || item.statusCode || item.status_code || item.matchStatus || item.match_status,
    raw: item,
  };
}

async function fetchIsportsSchedule(date: string) {
  const keys = getIsportsKeys();
  if (keys.length === 0) return { fixtures: [], error: 'ISPORTS_API_KEY is missing' };

  const baseUrl = process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com';
  const errors: string[] = [];

  for (const apiKey of keys) {
    try {
      const url = new URL(`${baseUrl}/sport/football/schedule`);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('date', date);
      const response = await fetch(url.toString(), { cache: 'no-store', headers: { accept: 'application/json' } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        errors.push(`HTTP ${response.status}`);
        continue;
      }
      const code = payload?.code ?? payload?.status_code ?? payload?.status;
      if (code !== undefined && code !== null && Number(code) !== 0 && Number(code) !== 200 && String(code).toLowerCase() !== 'success') {
        errors.push(String(payload?.message || payload?.msg || code));
        continue;
      }
      return { fixtures: getArrayPayload(payload).map(normalizeProviderMatch).filter((item: any) => item.matchId), error: null };
    } catch (error: any) {
      errors.push(error.message || 'iSports request failed');
    }
  }

  return { fixtures: [], error: errors.join(' | ') || 'iSports schedule request failed' };
}

function scoreCandidate(local: any, provider: any) {
  const localHome = normalizeName(local.homeTeam.name);
  const localAway = normalizeName(local.awayTeam.name);
  const providerHome = normalizeName(provider.homeName);
  const providerAway = normalizeName(provider.awayName);

  let score = 0;
  if (localHome && providerHome && (localHome === providerHome || localHome.includes(providerHome) || providerHome.includes(localHome))) score += 45;
  if (localAway && providerAway && (localAway === providerAway || localAway.includes(providerAway) || providerAway.includes(localAway))) score += 45;

  if (provider.matchTime) {
    const diffHours = Math.abs(new Date(local.matchDate).getTime() - new Date(provider.matchTime).getTime()) / 36e5;
    if (Number.isFinite(diffHours)) score += Math.max(0, 20 - Math.min(20, diffHours * 4));
  }

  return Math.round(score);
}

async function buildSuggestions() {
  const localMatches = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 40,
    include: {
      homeTeam: { select: { id: true, name: true, image: true, code: true } },
      awayTeam: { select: { id: true, name: true, image: true, code: true } },
    },
  });

  const uniqueDates = Array.from(new Set(localMatches.map((match) => dateOnly(match.matchDate))));
  const providerByDate = new Map<string, any[]>();
  const providerErrors: Record<string, string> = {};

  for (const date of uniqueDates) {
    const result = await fetchIsportsSchedule(date);
    providerByDate.set(date, result.fixtures);
    if (result.error) providerErrors[date] = result.error;
  }

  const matches = localMatches.map((match) => {
    const fixtures = providerByDate.get(dateOnly(match.matchDate)) || [];
    const candidates = fixtures
      .map((fixture) => ({ ...fixture, score: scoreCandidate(match, fixture) }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const suggestedAnimationMatchId = best && best.score >= 70 ? best.matchId : null;

    return {
      id: match.id,
      externalId: match.externalId,
      animationMatchId: match.animationMatchId,
      suggestedAnimationMatchId,
      suggestionScore: best?.score || 0,
      matchDate: match.matchDate,
      groupPhase: match.groupPhase,
      status: match.status,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      providerCandidates: candidates.slice(0, 3).map((candidate) => ({
        matchId: candidate.matchId,
        homeName: candidate.homeName,
        awayName: candidate.awayName,
        matchTime: candidate.matchTime,
        score: candidate.score,
      })),
    };
  });

  return { ok: true, matches, providerErrors };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    return NextResponse.json(await buildSuggestions());
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to build animation match suggestions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'sync-all') {
      const suggestions = await buildSuggestions();
      const updates = suggestions.matches.filter((match: any) => !match.animationMatchId && match.suggestedAnimationMatchId);
      const result = await prisma.$transaction(
        updates.map((match: any) => prisma.match.update({ where: { id: match.id }, data: { animationMatchId: Number(match.suggestedAnimationMatchId) } }))
      );
      return NextResponse.json({ ok: true, updated: result.length, matches: result.map((match) => ({ id: match.id, animationMatchId: match.animationMatchId })) });
    }

    const matchId = String(body.matchId || '');
    const animationMatchId = body.animationMatchId === '' || body.animationMatchId == null ? null : Number(body.animationMatchId);
    if (!matchId) return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    if (animationMatchId !== null && !Number.isFinite(animationMatchId)) return NextResponse.json({ error: 'animationMatchId must be a number' }, { status: 400 });

    const match = await prisma.match.update({ where: { id: matchId }, data: { animationMatchId } });
    return NextResponse.json({ ok: true, match: { id: match.id, animationMatchId: match.animationMatchId } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update animation match id' }, { status: 500 });
  }
}
