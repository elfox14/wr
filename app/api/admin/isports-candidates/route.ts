import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type IMatch = {
  fixtureId: number;
  homeName: string;
  awayName: string;
  date?: string | null;
  status?: string | null;
  score?: string;
  raw?: any;
  confidence: number;
  reasons: string[];
};

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

function splitKeys(value?: string) {
  return value?.split(',').map((key) => key.trim()).filter(Boolean) || [];
}

function getISportsKey() {
  const pool = splitKeys(process.env.ISPORTS_API_KEYS);
  if (pool.length > 0) return pool[0];
  return String(process.env.ISPORTS_API_KEY || '').trim();
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalize(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(fc|football club|national team|u19|u20|u21|u23|women|w)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value?: string | null) {
  return normalize(value).split(' ').filter((token) => token.length > 1);
}

function similarity(a?: string | null, b?: string | null) {
  const aa = normalize(a);
  const bb = normalize(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.88;
  const ta = new Set(tokens(aa));
  const tb = new Set(tokens(bb));
  const inter = [...ta].filter((token) => tb.has(token)).length;
  const union = new Set([...ta, ...tb]).size || 1;
  return inter / union;
}

function pickArray(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.response)) return payload.response;
  return [];
}

function getField(item: any, keys: string[]) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], item);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function normalizeItem(item: any) {
  const fixtureId = Number(getField(item, ['matchId', 'match_id', 'id', 'fixtureId', 'fixture_id']));
  const homeName = String(getField(item, ['homeName', 'home_name', 'homeTeamName', 'home_team_name', 'homeTeam.name', 'home.name']) || '');
  const awayName = String(getField(item, ['awayName', 'away_name', 'awayTeamName', 'away_team_name', 'awayTeam.name', 'away.name']) || '');
  const date = getField(item, ['matchTime', 'match_time', 'date', 'time', 'kickoffTime', 'startTime']);
  const status = getField(item, ['status', 'statusCode', 'status_code', 'matchStatus', 'match_status', 'statusName', 'status_name']);
  const homeScore = getField(item, ['homeScore', 'home_score', 'homeGoals', 'home_goals', 'score.home']);
  const awayScore = getField(item, ['awayScore', 'away_score', 'awayGoals', 'away_goals', 'score.away']);
  return { fixtureId, homeName, awayName, date, status, score: `${homeScore ?? 0}-${awayScore ?? 0}`, raw: item };
}

async function fetchISportsSchedule(date: string) {
  const key = getISportsKey();
  if (!key) throw new Error('ISPORTS_API_KEY/ISPORTS_API_KEYS is missing');
  const baseUrl = String(process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com').replace(/\/$/, '');
  const url = new URL(`${baseUrl}/sport/football/schedule`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('date', date);
  const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`iSports request failed with status ${response.status}`);
  const code = payload?.code ?? payload?.status_code ?? payload?.status;
  if (code !== undefined && code !== null && Number(code) !== 0 && Number(code) !== 200 && String(code).toLowerCase() !== 'success') {
    throw new Error(`iSports returned error: ${payload?.message || payload?.msg || JSON.stringify(payload).slice(0, 160)}`);
  }
  return pickArray(payload).map(normalizeItem).filter((item: any) => Number.isFinite(item.fixtureId) && item.homeName && item.awayName);
}

function scoreCandidate(localHome: string, localAway: string, item: any): IMatch {
  const sameOrder = (similarity(localHome, item.homeName) + similarity(localAway, item.awayName)) / 2;
  const swapped = (similarity(localHome, item.awayName) + similarity(localAway, item.homeName)) / 2;
  const best = Math.max(sameOrder, swapped);
  const reasons: string[] = [];
  if (sameOrder >= swapped) reasons.push('same_order'); else reasons.push('swapped_order');
  if (best >= 0.9) reasons.push('strong_name_match');
  else if (best >= 0.7) reasons.push('possible_name_match');
  else reasons.push('weak_name_match');
  return { ...item, confidence: Math.round(best * 100), reasons };
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized', authMethod: auth.method }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || url.searchParams.get('matchId') || '';
    if (!id) return NextResponse.json({ ok: false, error: 'match id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    const match = await prisma.match.findUnique({
      where: { id },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const date = url.searchParams.get('date') || dateOnly(match.matchDate);
    const nearby = url.searchParams.get('nearby') === 'true';
    const dates = nearby
      ? [new Date(match.matchDate.getTime() - 24 * 60 * 60 * 1000), match.matchDate, new Date(match.matchDate.getTime() + 24 * 60 * 60 * 1000)].map(dateOnly)
      : [date];

    const batches = await Promise.all(dates.map(async (day) => ({ day, items: await fetchISportsSchedule(day) })));
    const seen = new Set<number>();
    const scored = batches.flatMap((batch) => batch.items.map((item: any) => ({ ...scoreCandidate(match.homeTeam.name, match.awayTeam.name, item), day: batch.day })))
      .filter((item) => {
        if (seen.has(item.fixtureId)) return false;
        seen.add(item.fixtureId);
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 12);

    return NextResponse.json({
      ok: true,
      authMethod: auth.method,
      provider: 'ISPORTS_ONLY',
      externalRequestsUsed: dates.length,
      searchedDates: dates,
      localMatch: {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        score: `${match.homeScore}-${match.awayScore}`,
        matchDate: match.matchDate.toISOString(),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      candidates: scored,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
