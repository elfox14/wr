import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyVolatilityCap } from '@/lib/liveEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function toScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(99, Math.floor(score)));
}

function normalizeStatus(value?: string | null) {
  const status = String(value || 'IN_PLAY').toUpperCase();
  if (['SCHEDULED', 'IN_PLAY', 'LIVE', 'FINISHED'].includes(status)) return status === 'LIVE' ? 'IN_PLAY' : status;
  return 'IN_PLAY';
}

async function findMatch(url: URL) {
  const id = url.searchParams.get('id') || url.searchParams.get('matchId') || '';
  const animationMatchId = Number(url.searchParams.get('animationMatchId') || 0);
  const externalId = url.searchParams.get('externalId') || '';

  if (id) return prisma.match.findUnique({ where: { id }, include: { homeTeam: { select: TEAM_SELECT }, awayTeam: { select: TEAM_SELECT } } });
  if (Number.isFinite(animationMatchId) && animationMatchId > 0) return prisma.match.findFirst({ where: { animationMatchId }, include: { homeTeam: { select: TEAM_SELECT }, awayTeam: { select: TEAM_SELECT } } });
  if (externalId) return prisma.match.findUnique({ where: { externalId }, include: { homeTeam: { select: TEAM_SELECT }, awayTeam: { select: TEAM_SELECT } } });
  return null;
}

async function applyPriceEvent(params: { asset: any; fixtureKey: string; eventType: string; multiplier: number; titleAr: string; bodyAr: string }) {
  const existingNews = await prisma.marketNews.findFirst({ where: { localeGroupKey: params.fixtureKey }, select: { id: true } });
  if (existingNews) return { status: 'already_processed', localeGroupKey: params.fixtureKey };

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
      localeGroupKey: params.fixtureKey,
      priceBefore: currentPrice,
      priceAfter: nextPrice,
      changePercent,
      titleAr: params.titleAr,
      bodyAr: nextPrice === currentPrice ? `${params.bodyAr} لم يتغير السعر بسبب حدود التذبذب الحالية.` : `${params.bodyAr} السعر الجديد: ${nextPrice}¢ (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%).`,
      titleEn: params.titleAr,
      bodyEn: params.bodyAr,
      context: { manual: true, multiplier: params.multiplier } as any,
    },
  });

  return { status: nextPrice === currentPrice ? 'capped_no_change' : 'price_updated', assetId: asset.id, name: asset.name, priceBefore: currentPrice, priceAfter: nextPrice, changePercent: Math.round(changePercent * 10) / 10 };
}

async function processManualGoals(match: any, newHomeScore: number, newAwayScore: number) {
  const updates: any[] = [];
  const oldHomeScore = Number(match.homeScore || 0);
  const oldAwayScore = Number(match.awayScore || 0);
  const fixtureKey = `manual:${match.id}`;

  for (let goalNumber = oldHomeScore + 1; goalNumber <= newHomeScore; goalNumber += 1) {
    updates.push(await applyPriceEvent({ asset: match.homeTeam, fixtureKey: `${fixtureKey}:goal:home:${goalNumber}`, eventType: 'manual_live_goal_for', multiplier: 1.03, titleAr: `⚽ هدف لـ ${match.homeTeam.name}`, bodyAr: `تحديث يدوي: تحرك سعر ${match.homeTeam.name} صعودًا بعد تسجيل هدف أمام ${match.awayTeam.name}.` }));
    updates.push(await applyPriceEvent({ asset: match.awayTeam, fixtureKey: `${fixtureKey}:goal_against:away:${goalNumber}`, eventType: 'manual_live_goal_against', multiplier: 0.98, titleAr: `📉 هدف مستقبَل على ${match.awayTeam.name}`, bodyAr: `تحديث يدوي: تحرك سعر ${match.awayTeam.name} هبوطًا بعد استقبال هدف من ${match.homeTeam.name}.` }));
  }

  for (let goalNumber = oldAwayScore + 1; goalNumber <= newAwayScore; goalNumber += 1) {
    updates.push(await applyPriceEvent({ asset: match.awayTeam, fixtureKey: `${fixtureKey}:goal:away:${goalNumber}`, eventType: 'manual_live_goal_for', multiplier: 1.03, titleAr: `⚽ هدف لـ ${match.awayTeam.name}`, bodyAr: `تحديث يدوي: تحرك سعر ${match.awayTeam.name} صعودًا بعد تسجيل هدف أمام ${match.homeTeam.name}.` }));
    updates.push(await applyPriceEvent({ asset: match.homeTeam, fixtureKey: `${fixtureKey}:goal_against:home:${goalNumber}`, eventType: 'manual_live_goal_against', multiplier: 0.98, titleAr: `📉 هدف مستقبَل على ${match.homeTeam.name}`, bodyAr: `تحديث يدوي: تحرك سعر ${match.homeTeam.name} هبوطًا بعد استقبال هدف من ${match.awayTeam.name}.` }));
  }

  return updates;
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized', authMethod: auth.method }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    const url = new URL(req.url);
    const match = await findMatch(url);
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found. Pass id, matchId, animationMatchId, or externalId.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (!match.homeTeam || !match.awayTeam) return NextResponse.json({ ok: false, error: 'Match teams are missing.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    const homeScore = toScore(url.searchParams.get('homeScore'));
    const awayScore = toScore(url.searchParams.get('awayScore'));
    const status = normalizeStatus(url.searchParams.get('status'));

    if (homeScore < Number(match.homeScore || 0) || awayScore < Number(match.awayScore || 0)) {
      return NextResponse.json({ ok: false, error: 'Score rollback is blocked to avoid duplicate/manual price reversal. Use a repair endpoint if correction is needed.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    const priceUpdates = await processManualGoals(match, homeScore, awayScore);
    const updated = await prisma.match.update({
      where: { id: match.id },
      data: { homeScore, awayScore, status },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });

    return NextResponse.json({
      ok: true,
      mode: 'manual_live_score_emergency_update',
      authMethod: auth.method,
      match: {
        id: updated.id,
        externalId: updated.externalId,
        animationMatchId: updated.animationMatchId,
        status: updated.status,
        score: `${updated.homeScore}-${updated.awayScore}`,
        homeTeam: updated.homeTeam?.name,
        awayTeam: updated.awayTeam?.name,
      },
      priceUpdates,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
