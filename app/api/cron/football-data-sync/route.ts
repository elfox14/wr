import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeName } from '@/lib/apiFootball';
import { applyVolatilityCap } from '@/lib/liveEngine';
import { saveFootballDataScoreSnapshot } from '@/lib/football-data-snapshot';
import { blockProviderForHours, blockProviderUntil, getProviderQuotaBlock, isProviderQuotaError } from '@/lib/provider-quota-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamAsset = {
  id: string;
  name: string;
  code: string;
  current_price: number;
  high_price: number;
  low_price: number;
  marketPrice: number | null;
  volatilityScore: number | null;
};

const TEAM_SELECT = {
  id: true,
  name: true,
  code: true,
  current_price: true,
  high_price: true,
  low_price: true,
  marketPrice: true,
  volatilityScore: true,
};

const MATCH_SELECT = {
  id: true,
  externalId: true,
  animationMatchId: true,
  homeTeamId: true,
  awayTeamId: true,
  matchDate: true,
  status: true,
  homeScore: true,
  awayScore: true,
  groupPhase: true,
  stage: true,
};

function validSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function getAuth(req: Request) {
  const valid = validSecrets();
  if (valid.length === 0) return { valid: false, method: 'missing_server_secret' };
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: req.headers.get('x-cron-secret')?.trim() || '' },
    { method: 'x-admin-secret', value: req.headers.get('x-admin-secret')?.trim() || '' },
    { method: 'cronSecret_query', value: url.searchParams.get('cronSecret')?.trim() || '' },
    { method: 'adminSecret_query', value: url.searchParams.get('adminSecret')?.trim() || '' },
    { method: 'key_query', value: url.searchParams.get('key')?.trim() || '' },
  ];
  const match = candidates.find((item) => item.value && valid.includes(item.value));
  return match ? { valid: true, method: match.method } : { valid: false, method: null };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeTeamName(name?: string | null) {
  const value = normalizeName(name || '')
    .replace(/&/g, ' and ')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (value === 'south korea' || value === 'korea republic' || value === 'republic of korea') return 'korea republic';
  if (value === 'czech republic' || value === 'czechia') return 'czechia';
  if (value === 'bosnia and herzegovina' || value === 'bosnia herzegovina' || value === 'bosnia h') return 'bosnia h';
  if (value === 'united states' || value === 'united states of america') return 'usa';
  return value;
}

function normalizeFootballDataStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(value)) return 'IN_PLAY';
  if (value === 'FINISHED') return 'FINISHED';
  if (['TIMED', 'SCHEDULED'].includes(value)) return 'SCHEDULED';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(value)) return value;
  return value || 'SCHEDULED';
}

function safeScore(...values: unknown[]) {
  for (const value of values) {
    const score = Number(value);
    if (Number.isFinite(score)) return Math.max(0, Math.min(99, Math.floor(score)));
  }
  return null;
}

function extractScore(match: any) {
  const fullTime = match?.score?.fullTime || {};
  const regular = match?.score?.regularTime || {};
  const halfTime = match?.score?.halfTime || {};
  return {
    homeScore: safeScore(fullTime.home, regular.home, halfTime.home),
    awayScore: safeScore(fullTime.away, regular.away, halfTime.away),
  };
}

async function footballDataFetch(path: string, params: Record<string, string>) {
  const token = String(process.env.FOOTBALL_DATA_API_TOKEN || '').trim();
  if (!token) throw Object.assign(new Error('FOOTBALL_DATA_API_TOKEN is missing'), { status: 400, provider: 'FOOTBALL_DATA' });
  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4').replace(/\/$/, '');
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'X-Auth-Token': token,
      accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.message || `football-data returned HTTP ${response.status}`), { status: response.status, payload, provider: 'FOOTBALL_DATA' });
  }
  return payload;
}

async function findTeamAsset(team: any): Promise<TeamAsset | null> {
  const candidates = [team?.tla, team?.shortName, team?.name].map(normalizeTeamName).filter(Boolean);
  if (candidates.length === 0) return null;
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: TEAM_SELECT, take: 500 });
  return (teams.find((asset) => candidates.includes(normalizeTeamName(asset.code))) || teams.find((asset) => candidates.includes(normalizeTeamName(asset.name))) || null) as TeamAsset | null;
}

async function findExistingLocalMatch(homeTeamId: string, awayTeamId: string, matchDate: Date) {
  const from = new Date(matchDate.getTime() - 18 * 60 * 60 * 1000);
  const to = new Date(matchDate.getTime() + 18 * 60 * 60 * 1000);
  return prisma.match.findFirst({
    where: {
      homeTeamId,
      awayTeamId,
      matchDate: { gte: from, lte: to },
      status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY', 'FINISHED', 'TIMED', 'PAUSED'] },
    },
    orderBy: { matchDate: 'asc' },
    select: MATCH_SELECT,
  });
}

async function applyPriceEvent(params: { asset: TeamAsset; localeGroupKey: string; eventType: string; multiplier: number; titleAr: string; bodyAr: string }) {
  const existingNews = await prisma.marketNews.findFirst({ where: { localeGroupKey: params.localeGroupKey }, select: { id: true } });
  if (existingNews) return { status: 'already_processed', localeGroupKey: params.localeGroupKey };
  const asset = await prisma.asset.findUnique({ where: { id: params.asset.id }, select: TEAM_SELECT });
  if (!asset) return { status: 'asset_not_found', assetId: params.asset.id };

  const currentPrice = Math.max(1, Math.round(Number(asset.marketPrice || asset.current_price || 1)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstPriceToday = await prisma.priceHistory.findFirst({ where: { assetId: asset.id, timestamp: { gte: today } }, orderBy: { timestamp: 'asc' }, select: { price: true } });
  const startPrice = firstPriceToday?.price || currentPrice;
  const risk = Math.max(0, Math.min(100, Number(asset.volatilityScore ?? 50))) / 100;
  const requestedPrice = Math.max(1, Math.round(currentPrice * params.multiplier));
  const nextPrice = applyVolatilityCap(startPrice, requestedPrice, risk);
  const changePercent = currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;

  if (nextPrice !== currentPrice) {
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        current_price: nextPrice,
        marketPrice: nextPrice,
        change: changePercent,
        high_price: Math.max(asset.high_price || nextPrice, nextPrice),
        low_price: Math.min(asset.low_price || nextPrice, nextPrice),
        priceHistory: { create: { price: nextPrice } },
      },
    });
  }

  await prisma.marketNews.create({
    data: {
      assetId: asset.id,
      eventType: params.eventType,
      severity: Math.abs(changePercent) >= 5 ? 'high' : 'normal',
      localeGroupKey: params.localeGroupKey,
      priceBefore: currentPrice,
      priceAfter: nextPrice,
      changePercent,
      titleAr: params.titleAr,
      bodyAr: nextPrice === currentPrice ? `${params.bodyAr} لم يتغير السعر بسبب حدود التذبذب الحالية.` : `${params.bodyAr} السعر الجديد: ${nextPrice}¢ (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%).`,
      titleEn: params.titleAr,
      bodyEn: params.bodyAr,
      context: { provider: 'FOOTBALL_DATA', multiplier: params.multiplier } as any,
    },
  });

  return { status: nextPrice === currentPrice ? 'capped_no_change' : 'price_updated', assetId: asset.id, name: asset.name, priceBefore: currentPrice, priceAfter: nextPrice, changePercent: Math.round(changePercent * 10) / 10 };
}

async function processGoalEvents(params: { providerMatchId: number; previousMatch: any; homeScore: number; awayScore: number; homeTeam: TeamAsset; awayTeam: TeamAsset }) {
  const updates: any[] = [];
  const oldHomeScore = Number(params.previousMatch.homeScore || 0);
  const oldAwayScore = Number(params.previousMatch.awayScore || 0);
  for (let goalNumber = oldHomeScore + 1; goalNumber <= params.homeScore; goalNumber += 1) {
    updates.push(await applyPriceEvent({ asset: params.homeTeam, localeGroupKey: `football-data:${params.providerMatchId}:goal:home:${goalNumber}`, eventType: 'football_data_goal_for', multiplier: 1.03, titleAr: `⚽ هدف مؤكد لـ ${params.homeTeam.name}`, bodyAr: `football-data أكد هدف ${params.homeTeam.name} أمام ${params.awayTeam.name}.` }));
    updates.push(await applyPriceEvent({ asset: params.awayTeam, localeGroupKey: `football-data:${params.providerMatchId}:goal_against:away:${goalNumber}`, eventType: 'football_data_goal_against', multiplier: 0.98, titleAr: `📉 هدف مستقبَل على ${params.awayTeam.name}`, bodyAr: `football-data أكد استقبال ${params.awayTeam.name} هدفًا من ${params.homeTeam.name}.` }));
  }
  for (let goalNumber = oldAwayScore + 1; goalNumber <= params.awayScore; goalNumber += 1) {
    updates.push(await applyPriceEvent({ asset: params.awayTeam, localeGroupKey: `football-data:${params.providerMatchId}:goal:away:${goalNumber}`, eventType: 'football_data_goal_for', multiplier: 1.03, titleAr: `⚽ هدف مؤكد لـ ${params.awayTeam.name}`, bodyAr: `football-data أكد هدف ${params.awayTeam.name} أمام ${params.homeTeam.name}.` }));
    updates.push(await applyPriceEvent({ asset: params.homeTeam, localeGroupKey: `football-data:${params.providerMatchId}:goal_against:home:${goalNumber}`, eventType: 'football_data_goal_against', multiplier: 0.98, titleAr: `📉 هدف مستقبَل على ${params.homeTeam.name}`, bodyAr: `football-data أكد استقبال ${params.homeTeam.name} هدفًا من ${params.awayTeam.name}.` }));
  }
  return updates;
}

async function processFootballDataMatch(providerMatch: any, options: { applyMarketEvents: boolean; createMissing: boolean; dryRun: boolean }) {
  const providerMatchId = Number(providerMatch?.id);
  const matchDate = new Date(providerMatch?.utcDate || Date.now());
  const status = normalizeFootballDataStatus(providerMatch?.status);
  const [homeTeam, awayTeam] = await Promise.all([findTeamAsset(providerMatch?.homeTeam), findTeamAsset(providerMatch?.awayTeam)]);

  if (!providerMatchId || !homeTeam || !awayTeam || !Number.isFinite(matchDate.getTime())) {
    return { status: 'skipped_unmatched', providerMatchId, providerHome: providerMatch?.homeTeam?.name, providerAway: providerMatch?.awayTeam?.name, homeMatched: Boolean(homeTeam), awayMatched: Boolean(awayTeam) };
  }

  const existing = await findExistingLocalMatch(homeTeam.id, awayTeam.id, matchDate);
  const { homeScore, awayScore } = extractScore(providerMatch);
  const nextHomeScore = homeScore ?? existing?.homeScore ?? 0;
  const nextAwayScore = awayScore ?? existing?.awayScore ?? 0;
  const data = {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    matchDate,
    status,
    homeScore: nextHomeScore,
    awayScore: nextAwayScore,
    groupPhase: providerMatch?.group || providerMatch?.stage || providerMatch?.competition?.name || null,
    stage: String(providerMatch?.stage || existing?.stage || 'group').toLowerCase(),
  };

  if (!existing && !options.createMissing) {
    return { status: 'skipped_no_local_match', providerMatchId, providerStatus: status, homeTeam: homeTeam.name, awayTeam: awayTeam.name, score: `${nextHomeScore}-${nextAwayScore}`, hint: 'Pass createMissing=true if you want football-data to create missing local matches.' };
  }

  const priceUpdates = existing && options.applyMarketEvents && (nextHomeScore > Number(existing.homeScore || 0) || nextAwayScore > Number(existing.awayScore || 0))
    ? await processGoalEvents({ providerMatchId, previousMatch: existing, homeScore: nextHomeScore, awayScore: nextAwayScore, homeTeam, awayTeam })
    : [];

  if (options.dryRun) {
    return { status: existing ? 'dry_run_would_update' : 'dry_run_would_create', providerMatchId, localMatchId: existing?.id || null, providerStatus: status, homeTeam: homeTeam.name, awayTeam: awayTeam.name, score: `${nextHomeScore}-${nextAwayScore}`, priceUpdates };
  }

  const saved = existing
    ? await prisma.match.update({ where: { id: existing.id }, data })
    : await prisma.match.create({ data });

  const snapshot = await saveFootballDataScoreSnapshot({
    matchId: saved.id,
    providerMatchId,
    status,
    homeScore: saved.homeScore,
    awayScore: saved.awayScore,
    provider: 'FOOTBALL_DATA',
    minIntervalMinutes: status === 'FINISHED' ? 720 : 10,
    rawData: {
      providerStatus: providerMatch?.status,
      utcDate: providerMatch?.utcDate,
      score: providerMatch?.score,
      competition: providerMatch?.competition?.code || providerMatch?.competition?.name || null,
      stage: providerMatch?.stage || null,
    },
  });

  return { status: existing ? 'updated_existing_match' : 'created_missing_match', providerMatchId, localMatchId: saved.id, providerStatus: status, homeTeam: homeTeam.name, awayTeam: awayTeam.name, previousScore: existing ? `${existing.homeScore}-${existing.awayScore}` : null, score: `${saved.homeScore}-${saved.awayScore}`, snapshot, priceUpdates };
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized', authMethod: auth.method }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const startedAt = new Date();
  const url = new URL(req.url);
  const now = new Date();
  const date = url.searchParams.get('date') || '';
  const dateFrom = url.searchParams.get('dateFrom') || date || dateKey(new Date(now.getTime() - Number(url.searchParams.get('daysBack') || 0) * 24 * 60 * 60 * 1000));
  const dateTo = url.searchParams.get('dateTo') || date || dateKey(new Date(now.getTime() + Number(url.searchParams.get('daysAhead') || 0) * 24 * 60 * 60 * 1000));
  const competition = (url.searchParams.get('competition') || process.env.FOOTBALL_DATA_COMPETITION || 'WC').trim();
  const createMissing = url.searchParams.get('createMissing') === 'true';
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const applyMarketEvents = url.searchParams.get('applyMarketEvents') === 'true';
  const force = url.searchParams.get('force') === 'true';
  const minIntervalMinutes = Math.max(0, Number(url.searchParams.get('minIntervalMinutes') || process.env.FOOTBALL_DATA_MIN_INTERVAL_MINUTES || 5));
  const processed: any[] = [];
  const errors: any[] = [];

  try {
    const guard = force ? null : await getProviderQuotaBlock('FOOTBALL_DATA');
    if (guard) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        mode: 'football_data_backup_match_sync',
        provider: 'FOOTBALL_DATA',
        reason: 'provider_guard_or_cooldown_active',
        guard: { blockedUntil: guard.blockedUntil, reason: guard.reason },
        dateFrom,
        dateTo,
        externalRequestsUsed: 0,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const payload = await footballDataFetch(`/competitions/${encodeURIComponent(competition)}/matches`, { dateFrom, dateTo });
    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    for (const match of matches) {
      processed.push(await processFootballDataMatch(match, { applyMarketEvents, createMissing, dryRun }));
    }

    if (!dryRun && minIntervalMinutes > 0) {
      await blockProviderUntil('FOOTBALL_DATA', new Date(Date.now() + minIntervalMinutes * 60 * 1000), `cooldown after successful sync (${dateFrom}..${dateTo})`);
    }

    return NextResponse.json({
      ok: true,
      mode: 'football_data_backup_match_sync',
      authMethod: auth.method,
      provider: 'FOOTBALL_DATA',
      competition,
      dateFrom,
      dateTo,
      dryRun,
      createMissing,
      applyMarketEvents,
      minIntervalMinutes,
      externalRequestsUsed: 1,
      fixturesFetched: matches.length,
      processed,
      errors,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  } catch (error: any) {
    if (isProviderQuotaError(error)) {
      await blockProviderForHours('FOOTBALL_DATA', 24, error?.message || 'football-data quota or rate limit reached');
    }
    errors.push({ message: error?.message || 'football-data sync failed', status: error?.status, provider: error?.provider || 'FOOTBALL_DATA', payload: error?.payload });
    return NextResponse.json({ ok: false, mode: 'football_data_backup_match_sync', provider: 'FOOTBALL_DATA', competition, dateFrom, dateTo, externalRequestsUsed: error?.status === 429 ? 1 : 0, processed, errors, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() }, { status: error?.status || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
