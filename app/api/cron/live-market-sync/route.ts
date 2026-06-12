import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiFootballFetch, footballFetchFromProvider, normalizeName } from '@/lib/apiFootball';
import { applyVolatilityCap } from '@/lib/liveEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'FINISHED', 'ENDED', '-1']);
const UPCOMING_STATUSES = new Set(['NS', 'TBD', 'SCHEDULED', '0']);

const TEAM_SELECT = {
  id: true,
  name: true,
  code: true,
  current_price: true,
  high_price: true,
  low_price: true,
  marketPrice: true,
  volatilityScore: true,
  apiFootballId: true,
  isportsId: true,
};

const MATCH_SELECT = { id: true, externalId: true, animationMatchId: true, homeTeamId: true, awayTeamId: true, matchDate: true, status: true, homeScore: true, awayScore: true, groupPhase: true, stage: true };

function normalizeStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (LIVE_STATUSES.has(value)) return 'IN_PLAY';
  if (FINISHED_STATUSES.has(value)) return 'FINISHED';
  if (UPCOMING_STATUSES.has(value)) return 'SCHEDULED';
  return value || 'SCHEDULED';
}

function validSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function getCronAuth(req: Request) {
  const expected = validSecrets();
  if (expected.length === 0) return { valid: true, method: 'no_secret_configured' };
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret')?.trim() || '';
  const adminHeader = req.headers.get('x-admin-secret')?.trim() || '';
  const { searchParams } = new URL(req.url);
  const cronQuery = searchParams.get('cronSecret')?.trim() || '';
  const adminQuery = searchParams.get('adminSecret')?.trim() || '';
  const keyQuery = searchParams.get('key')?.trim() || '';
  const matched = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'cronSecret_query', value: cronQuery },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'key_query', value: keyQuery },
  ].find((item) => item.value && expected.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function aliasTeamName(value: string) {
  if (value === 'south korea' || value === 'korea republic' || value === 'republic of korea') return 'korea republic';
  if (value === 'czech republic' || value === 'czechia') return 'czechia';
  if (value === 'bosnia h' || value === 'bosnia herzegovina' || value === 'bosnia and herzegovina' || value === 'bosnia & herzegovina') return 'bosnia h';
  if (value === 'united states' || value === 'united states of america' || value === 'usa') return 'usa';
  if (value === 'turkiye') return 'turkey';
  return value;
}

function normalizeTeamName(name?: string | null) {
  const normalized = normalizeName(name || '')
    .replace(/&/g, ' and ')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/\bu20\b/g, '')
    .replace(/\bu19\b/g, '')
    .replace(/\bu23\b/g, '')
    .replace(/\bw\b/g, '')
    .replace(/\(w\)/g, '')
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return aliasTeamName(normalized);
}

function toScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function parseProviderDate(value: any) {
  if (!value) return new Date();
  const numeric = Number(value);
  const normalized = Number.isFinite(numeric) && numeric > 100000 ? (numeric < 10000000000 ? numeric * 1000 : numeric) : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function shouldAllowApiFootballFallback(url: URL) {
  if (url.searchParams.get('allowApiFootballFallback') === 'true') return true;
  if (url.searchParams.get('providerFallback') === 'true') return true;
  return process.env.ALLOW_API_FOOTBALL_LIVE_FALLBACK === 'true';
}

async function fetchLiveScores(url: URL, date: string) {
  if (shouldAllowApiFootballFallback(url)) return apiFootballFetch('/livescores', { date, live: 'all' });
  return footballFetchFromProvider('ISPORTS', '/livescores', { date, live: 'all' });
}

async function hasPotentialLiveWindow() {
  const now = new Date();
  const from = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const { start, end } = todayRange();
  const count = await prisma.match.count({
    where: {
      OR: [
        { status: 'IN_PLAY' },
        { status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY', 'FINISHED'] }, matchDate: { gte: from, lte: to } },
        { status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY', 'FINISHED'] }, matchDate: { gte: start, lt: end } },
      ],
    },
  });
  return count > 0;
}

async function findTeamAsset(providerId?: number | string | null, name?: string | null) {
  const providerNumber = providerId == null ? null : Number(providerId);
  if (providerNumber && Number.isFinite(providerNumber)) {
    const byIsportsId = await prisma.asset.findFirst({ where: { type: 'TEAM', isportsId: providerNumber }, select: TEAM_SELECT });
    if (byIsportsId) return byIsportsId;
    const byApiId = await prisma.asset.findFirst({ where: { type: 'TEAM', apiFootballId: providerNumber }, select: TEAM_SELECT });
    if (byApiId) return byApiId;
  }
  const normalizedName = normalizeTeamName(name);
  if (!normalizedName || normalizedName.length < 3) return null;
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: TEAM_SELECT, take: 500 });
  return teams.find((team) => normalizeTeamName(team.name) === normalizedName) || teams.find((team) => normalizeTeamName(team.code) === normalizedName) || null;
}

async function applyLiveTeamPriceEvent(params: { assetId: string; fixtureId: number; localeGroupKey: string; eventType: string; multiplier: number; titleAr: string; bodyAr: string }) {
  const existingNews = await prisma.marketNews.findFirst({ where: { localeGroupKey: params.localeGroupKey }, select: { id: true } });
  if (existingNews) return { status: 'already_processed', localeGroupKey: params.localeGroupKey };
  const asset = await prisma.asset.findUnique({ where: { id: params.assetId }, select: TEAM_SELECT });
  if (!asset) return { status: 'asset_not_found', assetId: params.assetId };
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
    await prisma.asset.update({ where: { id: asset.id }, data: { current_price: nextPrice, marketPrice: nextPrice, change: changePercent, high_price: Math.max(asset.high_price || nextPrice, nextPrice), low_price: Math.min(asset.low_price || nextPrice, nextPrice), priceHistory: { create: { price: nextPrice } } } });
  }
  await prisma.marketNews.create({ data: { assetId: asset.id, eventType: params.eventType, severity: Math.abs(changePercent) >= 5 ? 'high' : 'normal', localeGroupKey: params.localeGroupKey, priceBefore: currentPrice, priceAfter: nextPrice, changePercent, titleAr: params.titleAr, bodyAr: nextPrice === currentPrice ? `${params.bodyAr} لم يتغير السعر بسبب حدود التذبذب الحالية.` : `${params.bodyAr} السعر الجديد: ${nextPrice}¢ (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%).`, titleEn: params.titleAr, bodyEn: params.bodyAr, context: { fixtureId: params.fixtureId, multiplier: params.multiplier, capped: nextPrice !== requestedPrice } as any } });
  return { status: nextPrice === currentPrice ? 'capped_no_change' : 'price_updated', assetId: asset.id, name: asset.name, priceBefore: currentPrice, priceAfter: nextPrice, changePercent: Math.round(changePercent * 10) / 10 };
}

async function findExistingMatch(externalId: string, animationMatchId?: number) {
  if (animationMatchId) {
    const byAnimation = await prisma.match.findFirst({ where: { animationMatchId }, select: MATCH_SELECT });
    if (byAnimation) return byAnimation;
  }
  return prisma.match.findUnique({ where: { externalId }, select: MATCH_SELECT });
}

async function findExistingMatchByTeams(homeTeamId: string, awayTeamId: string, matchDate: Date) {
  const from = new Date(matchDate.getTime() - 8 * 60 * 60 * 1000);
  const to = new Date(matchDate.getTime() + 8 * 60 * 60 * 1000);
  return prisma.match.findFirst({
    where: {
      homeTeamId,
      awayTeamId,
      matchDate: { gte: from, lte: to },
      status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY', 'FINISHED'] },
    },
    orderBy: { matchDate: 'asc' },
    select: MATCH_SELECT,
  });
}

async function getLinkedMatchTeams(previousMatch: any) {
  if (!previousMatch?.homeTeamId || !previousMatch?.awayTeamId) return { homeTeam: null, awayTeam: null };
  const [homeTeam, awayTeam] = await Promise.all([
    prisma.asset.findUnique({ where: { id: previousMatch.homeTeamId }, select: TEAM_SELECT }),
    prisma.asset.findUnique({ where: { id: previousMatch.awayTeamId }, select: TEAM_SELECT }),
  ]);
  return { homeTeam, awayTeam };
}

async function saveProviderMatch(params: { previousMatch: any; externalId: string; animationMatchId?: number; homeTeamId: string; awayTeamId: string; matchDate: Date; status: string; homeScore: number; awayScore: number; groupPhase?: string | null }) {
  if (params.previousMatch) {
    return prisma.match.update({
      where: { id: params.previousMatch.id },
      data: { externalId: params.externalId, ...(params.animationMatchId ? { animationMatchId: params.animationMatchId } : {}), homeTeamId: params.homeTeamId, awayTeamId: params.awayTeamId, matchDate: params.matchDate, status: params.status, homeScore: params.homeScore, awayScore: params.awayScore, groupPhase: params.groupPhase || null },
    });
  }
  return prisma.match.create({ data: { externalId: params.externalId, animationMatchId: params.animationMatchId, homeTeamId: params.homeTeamId, awayTeamId: params.awayTeamId, matchDate: params.matchDate, status: params.status, homeScore: params.homeScore, awayScore: params.awayScore, groupPhase: params.groupPhase || null, stage: 'group' } });
}

async function processGoalEvents(params: { fixtureId: number; homeScore: number; awayScore: number; homeTeam: any; awayTeam: any }) {
  const priceUpdates: any[] = [];
  for (let goalNumber = 1; goalNumber <= params.homeScore; goalNumber += 1) {
    priceUpdates.push(await applyLiveTeamPriceEvent({ assetId: params.homeTeam.id, fixtureId: params.fixtureId, localeGroupKey: `${params.fixtureId}:live_goal:home:${goalNumber}`, eventType: 'live_goal_for', multiplier: 1.03, titleAr: `⚽ هدف لـ ${params.homeTeam.name}`, bodyAr: `تحرك سعر ${params.homeTeam.name} صعودًا بعد تسجيل هدف أمام ${params.awayTeam.name}.` }));
    priceUpdates.push(await applyLiveTeamPriceEvent({ assetId: params.awayTeam.id, fixtureId: params.fixtureId, localeGroupKey: `${params.fixtureId}:live_goal_against:away:${goalNumber}`, eventType: 'live_goal_against', multiplier: 0.98, titleAr: `📉 هدف مستقبَل على ${params.awayTeam.name}`, bodyAr: `تحرك سعر ${params.awayTeam.name} هبوطًا بعد استقبال هدف من ${params.homeTeam.name}.` }));
  }
  for (let goalNumber = 1; goalNumber <= params.awayScore; goalNumber += 1) {
    priceUpdates.push(await applyLiveTeamPriceEvent({ assetId: params.awayTeam.id, fixtureId: params.fixtureId, localeGroupKey: `${params.fixtureId}:live_goal:away:${goalNumber}`, eventType: 'live_goal_for', multiplier: 1.03, titleAr: `⚽ هدف لـ ${params.awayTeam.name}`, bodyAr: `تحرك سعر ${params.awayTeam.name} صعودًا بعد تسجيل هدف أمام ${params.homeTeam.name}.` }));
    priceUpdates.push(await applyLiveTeamPriceEvent({ assetId: params.homeTeam.id, fixtureId: params.fixtureId, localeGroupKey: `${params.fixtureId}:live_goal_against:home:${goalNumber}`, eventType: 'live_goal_against', multiplier: 0.98, titleAr: `📉 هدف مستقبَل على ${params.homeTeam.name}`, bodyAr: `تحرك سعر ${params.homeTeam.name} هبوطًا بعد استقبال هدف من ${params.awayTeam.name}.` }));
  }
  return priceUpdates;
}

async function processLiveFixture(fixture: any, providerSource?: string) {
  const fixtureId = Number(fixture.fixture?.id);
  const home = fixture.teams?.home || {};
  const away = fixture.teams?.away || {};
  if (!fixtureId || !home.name || !away.name) return { status: 'skipped_missing_fixture_data', fixtureId, providerSource };

  const externalId = String(fixtureId);
  const isISports = providerSource === 'ISPORTS';
  const animationMatchId = isISports && Number.isFinite(fixtureId) ? fixtureId : undefined;
  const matchDate = parseProviderDate(fixture.fixture?.date || fixture.fixture?.timestamp);

  const [providerHomeTeam, providerAwayTeam] = await Promise.all([findTeamAsset(home.id, home.name), findTeamAsset(away.id, away.name)]);
  if (!providerHomeTeam || !providerAwayTeam) return { status: 'skipped_unmatched_teams', fixtureId, animationMatchId, providerSource, providerHome: home.name, providerAway: away.name, homeMatched: Boolean(providerHomeTeam), awayMatched: Boolean(providerAwayTeam), usedManualLink: false };

  const previousMatchById = await findExistingMatch(externalId, animationMatchId);
  const previousMatchByTeams = previousMatchById ? null : await findExistingMatchByTeams(providerHomeTeam.id, providerAwayTeam.id, matchDate);
  const previousMatch = previousMatchById || previousMatchByTeams;
  const linkedTeams = await getLinkedMatchTeams(previousMatch);
  const homeTeam = linkedTeams.homeTeam || providerHomeTeam;
  const awayTeam = linkedTeams.awayTeam || providerAwayTeam;

  const status = normalizeStatus(fixture.fixture?.status?.short || fixture.fixture?.status?.long);
  const homeScore = toScore(fixture.goals?.home);
  const awayScore = toScore(fixture.goals?.away);
  await saveProviderMatch({ previousMatch, externalId, animationMatchId, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, matchDate, status, homeScore, awayScore, groupPhase: fixture.league?.round || fixture.league?.name || null });

  const priceUpdates = status === 'IN_PLAY' || status === 'FINISHED' ? await processGoalEvents({ fixtureId, homeScore, awayScore, homeTeam, awayTeam }) : [];
  return { status: 'live_fixture_processed', fixtureId, animationMatchId, providerSource, matchedBy: previousMatchById ? 'id' : (previousMatchByTeams ? 'teams_time_window' : 'created'), existingAnimationMatchId: previousMatch?.animationMatchId || null, matchStatus: status, homeTeam: homeTeam.name, awayTeam: awayTeam.name, usedManualLink: Boolean(linkedTeams.homeTeam || linkedTeams.awayTeam), score: `${homeScore}-${awayScore}`, priceUpdates };
}

function pickFixtures(payload: any) {
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload)) return payload;
  return [];
}

export async function GET(req: Request) {
  const auth = getCronAuth(req);
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const startedAt = new Date();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true' || url.searchParams.get('forceLive') === 'true';
  const allowApiFootballFallback = shouldAllowApiFootballFallback(url);
  const shouldFetch = force || await hasPotentialLiveWindow();
  const processed: any[] = [];
  const errors: any[] = [];

  if (!shouldFetch) {
    return NextResponse.json({ success: true, skippedProviderFetch: true, reason: 'No local live/today/nearby matches found; protected external API budget.', processed, errors, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const date = url.searchParams.get('date') || dateKey();
    const data: any = await fetchLiveScores(url, date);
    const fixtures = pickFixtures(data);
    for (const fixture of fixtures) {
      processed.push(await processLiveFixture(fixture, data?._provider));
    }
    return NextResponse.json({ success: true, mode: 'isports_only_live_market_sync', authMethod: auth.method, providerPriority: allowApiFootballFallback ? ['ISPORTS', 'API_FOOTBALL'] : ['ISPORTS'], providerFallbackAllowed: allowApiFootballFallback, providerUsed: data?._provider, externalRequestsUsed: 1, skippedProviderFetch: false, fixturesFetched: fixtures.length, processed, errors, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  } catch (error: any) {
    errors.push({ message: error?.message || 'live sync failed', status: error?.status, provider: error?.provider, payload: error?.payload, apiFootballFallbackAllowed: allowApiFootballFallback });
    return NextResponse.json({ success: false, mode: 'isports_only_live_market_sync', providerFallbackAllowed: allowApiFootballFallback, errors, processed, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
