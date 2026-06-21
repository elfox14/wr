import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';



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
  return {
    matchId: Number.isFinite(matchId) ? matchId : null,
    homeName: item.homeName || item.home_name || item.homeTeamName || item.home_team_name || item.homeTeam?.name || item.home?.name,
    awayName: item.awayName || item.away_name || item.awayTeamName || item.away_team_name || item.awayTeam?.name || item.away?.name,
    matchTime: item.matchTime || item.match_time || item.date || item.time || item.kickoffTime || item.startTime,
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

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const threshold = Number(searchParams.get('threshold') || 70);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 40), 1), 100);
    const dryRun = searchParams.get('dryRun') === 'true';

    const localMatches = await prisma.match.findMany({
      where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
      orderBy: { matchDate: 'asc' },
      take: limit,
      include: {
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
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

    const matched: any[] = [];
    const skipped: any[] = [];

    for (const match of localMatches) {
      if (match.animationMatchId) {
        skipped.push({ id: match.id, reason: 'already-linked', animationMatchId: match.animationMatchId });
        continue;
      }
      const candidates = (providerByDate.get(dateOnly(match.matchDate)) || [])
        .map((fixture) => ({ ...fixture, score: scoreCandidate(match, fixture) }))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best || best.score < threshold) {
        skipped.push({ id: match.id, reason: 'no-confident-match', score: best?.score || 0 });
        continue;
      }
      matched.push({ id: match.id, animationMatchId: best.matchId, score: best.score, local: `${match.homeTeam.name} × ${match.awayTeam.name}`, provider: `${best.homeName} × ${best.awayName}` });
    }

    let updated = 0;
    if (!dryRun && matched.length > 0) {
      const result = await prisma.$transaction(matched.map((item) => prisma.match.update({ where: { id: item.id }, data: { animationMatchId: Number(item.animationMatchId) } })));
      updated = result.length;
    }

    return NextResponse.json({ ok: true, dryRun, scanned: localMatches.length, matched: matched.length, updated, threshold, providerErrors, matches: matched, skipped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'sync-animation-matches failed' }, { status: 500 });
  }
}
