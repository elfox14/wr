import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProviderFixture = {
  providerMatchId: number;
  homeName: string;
  awayName: string;
  homeCode?: string | null;
  awayCode?: string | null;
  matchDate: Date;
  status: string;
  stage: string;
  raw: unknown;
};

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  if (!secret) return true;
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('key') || url.searchParams.get('secret') || url.searchParams.get('token') || '';
  const auth = req.headers.get('authorization') || '';
  const bearerToken = auth.replace(/^Bearer\s+/i, '').trim();
  return bearerToken === secret || queryToken === secret;
}

function splitKeys(value?: string) {
  return value?.split(',').map((key) => key.trim()).filter(Boolean) || [];
}

function getIsportsKeys() {
  const pool = splitKeys(process.env.ISPORTS_API_KEYS);
  if (pool.length > 0) return pool;
  return [process.env.ISPORTS_API_KEY].filter(Boolean) as string[];
}

function dateOnly(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function datesBetween(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);
  const days: string[] = [];
  for (let current = start; current <= end && days.length < 31; current = addDays(current, 1)) {
    days.push(dateOnly(current));
  }
  return days;
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

function mapStage(stage: string): string {
  const value = String(stage || '').toUpperCase();
  if (value.includes('32')) return 'round_of_32';
  if (value.includes('16')) return 'round_of_16';
  if (value.includes('QUARTER')) return 'quarter_final';
  if (value.includes('SEMI')) return 'semi_final';
  if (value.includes('FINAL')) return 'final';
  if (value.includes('GROUP')) return 'group';
  return 'round_of_32';
}

function mapStatus(status: string): string {
  const value = String(status || '').toUpperCase();
  if (['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'].includes(value)) return 'FINISHED';
  if (['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'PAUSED'].includes(value)) return 'IN_PLAY';
  return 'SCHEDULED';
}

function getArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}

function normalizeFixture(item: any, fallbackStage: string): ProviderFixture | null {
  const providerMatchId = Number(item.matchId ?? item.match_id ?? item.id ?? item.fixtureId ?? item.fixture_id);
  if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) return null;

  const homeName = String(item.homeName || item.home_name || item.homeTeamName || item.home_team_name || item.homeTeam?.name || item.home?.name || '').trim();
  const awayName = String(item.awayName || item.away_name || item.awayTeamName || item.away_team_name || item.awayTeam?.name || item.away?.name || '').trim();
  if (!homeName || !awayName) return null;

  const rawDate = item.matchTime || item.match_time || item.date || item.time || item.kickoffTime || item.startTime || item.start_time;
  const matchDate = rawDate ? new Date(rawDate) : new Date();
  if (!Number.isFinite(matchDate.getTime())) return null;

  return {
    providerMatchId,
    homeName,
    awayName,
    homeCode: item.homeCode || item.home_code || item.homeTeam?.code || item.home?.code || null,
    awayCode: item.awayCode || item.away_code || item.awayTeam?.code || item.away?.code || null,
    matchDate,
    status: mapStatus(String(item.status || item.state || item.matchStatus || 'SCHEDULED')),
    stage: mapStage(String(item.stage || item.round || item.phase || fallbackStage)),
    raw: item,
  };
}

function teamScore(team: { name: string; code: string }, fixtureName: string, fixtureCode?: string | null) {
  let score = 0;
  const teamCode = String(team.code || '').trim().toUpperCase();
  const providerCode = String(fixtureCode || '').trim().toUpperCase();
  if (teamCode && providerCode && teamCode === providerCode) score += 70;

  const teamName = normalizeName(team.name || team.code);
  const providerName = normalizeName(fixtureName);
  if (teamName && providerName) {
    if (teamName === providerName) score += 80;
    else if (teamName.includes(providerName) || providerName.includes(teamName)) score += 45;
  }
  return score;
}

function findTeam(teams: Array<{ id: string; name: string; code: string }>, fixtureName: string, fixtureCode?: string | null) {
  const ranked = teams.map((team) => ({ team, score: teamScore(team, fixtureName, fixtureCode) })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 45 ? ranked[0].team : null;
}

async function fetchSchedule(date: string) {
  const keys = getIsportsKeys();
  if (keys.length === 0) throw new Error('ISPORTS_API_KEY is missing');
  const baseUrl = (process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com').replace(/\/$/, '');
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
      return getArrayPayload(payload);
    } catch (error: any) {
      errors.push(error.message || 'iSports request failed');
    }
  }

  throw new Error(errors.join(' | ') || 'iSports schedule request failed');
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get('dateFrom') || url.searchParams.get('date_from') || dateOnly(new Date());
    const dateTo = url.searchParams.get('dateTo') || url.searchParams.get('date_to') || dateOnly(addDays(new Date(), 14));
    const stage = mapStage(url.searchParams.get('stage') || 'round_of_32');
    const dryRun = ['1', 'true', 'yes'].includes(String(url.searchParams.get('dryRun') || '').toLowerCase());
    const days = datesBetween(dateFrom, dateTo);

    const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: { id: true, name: true, code: true } });
    const skipped: any[] = [];
    const saved: any[] = [];
    let scanned = 0;

    for (const day of days) {
      const payload = await fetchSchedule(day);
      const fixtures = payload.map((item: any) => normalizeFixture(item, stage)).filter(Boolean) as ProviderFixture[];
      scanned += fixtures.length;

      for (const fixture of fixtures) {
        const homeTeam = findTeam(teams, fixture.homeName, fixture.homeCode);
        const awayTeam = findTeam(teams, fixture.awayName, fixture.awayCode);

        if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) {
          skipped.push({ providerMatchId: fixture.providerMatchId, homeName: fixture.homeName, awayName: fixture.awayName, reason: !homeTeam || !awayTeam ? 'team_not_found' : 'same_team_match' });
          continue;
        }

        const externalId = `isports:${fixture.providerMatchId}`;
        if (!dryRun) {
          const existing = await prisma.match.findFirst({
            where: { OR: [{ externalId }, { animationMatchId: fixture.providerMatchId }] },
            select: { id: true },
          });

          const jsonExternalIds = { isports: fixture.providerMatchId } as Prisma.InputJsonObject;
          const jsonSyncState = { source: 'isports_schedule', raw: fixture.raw as Prisma.InputJsonValue } as Prisma.InputJsonObject;
          const updateData: Prisma.MatchUncheckedUpdateInput = {
            externalId,
            animationMatchId: fixture.providerMatchId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchDate: fixture.matchDate,
            kickoffAt: fixture.matchDate,
            homeScore: 0,
            awayScore: 0,
            status: fixture.status,
            stage: fixture.stage,
            groupPhase: fixture.stage,
            competition: 'WC',
            syncSource: 'isports',
            externalIds: jsonExternalIds,
            syncState: jsonSyncState,
            lastSyncedAt: new Date(),
          };
          const createData: Prisma.MatchUncheckedCreateInput = {
            externalId,
            animationMatchId: fixture.providerMatchId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchDate: fixture.matchDate,
            kickoffAt: fixture.matchDate,
            homeScore: 0,
            awayScore: 0,
            status: fixture.status,
            stage: fixture.stage,
            groupPhase: fixture.stage,
            competition: 'WC',
            syncSource: 'isports',
            externalIds: jsonExternalIds,
            syncState: jsonSyncState,
            lastSyncedAt: new Date(),
          };

          if (existing?.id) await prisma.match.update({ where: { id: existing.id }, data: updateData });
          else await prisma.match.create({ data: createData });
        }

        saved.push({ providerMatchId: fixture.providerMatchId, home: homeTeam.name, away: awayTeam.name, matchDate: fixture.matchDate, stage: fixture.stage });
      }
    }

    return NextResponse.json({ ok: true, mode: 'sync_isports_matches_v1', dryRun, dateFrom, dateTo, stage, days: days.length, scanned, saved: saved.length, skipped: skipped.length, savedPreview: saved.slice(0, 30), skippedPreview: skipped.slice(0, 30) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'sync-isports-matches failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
