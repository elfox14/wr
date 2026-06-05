// lib/market-news/generator.ts
import prisma from '@/lib/prisma';
import { interpolate } from './formatters';
import { inferEventType } from './infer-event';
import ar from '../../messages/ar.json';
import en from '../../messages/en.json';

function getByPath(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? '';
}

type GenerateNewsInput = {
  assetId: string;
  before: number;
  after: number;
  eventType?: string | null; // Override auto-inference
  context?: {
    reason?: string;
    stage?: string;
    opponent?: string;
    qualified?: boolean;
    eliminated?: boolean;
    upsetWin?: boolean;
  };
};

/**
 * Generate a MarketNews entry with:
 * - Template-based i18n (titleKey/bodyKey + params)
 * - Static rendered text (titleAr/bodyAr/titleEn/bodyEn) for backward compatibility
 * - 30-minute deduplication window
 * - Smart event inference
 */
export async function generateMarketNews(input: GenerateNewsInput) {
  if (input.before <= 0) return null;

  const change = ((input.after - input.before) / input.before) * 100;
  const absChange = Math.abs(change);
  const changeRounded = Math.round(change * 100) / 100;

  // Infer or use provided event type
  const eventType = input.eventType || inferEventType({
    changePercent: change,
    qualified: input.context?.qualified,
    eliminated: input.context?.eliminated,
    upsetWin: input.context?.upsetWin,
  });

  if (!eventType) return null; // Change too small, no news

  // --- DEDUPLICATION ---
  const dedupeKey = `${input.assetId}:${eventType}`;
  const dedupeWindowStart = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

  const existing = await prisma.marketNews.findFirst({
    where: {
      assetId: input.assetId,
      eventType,
      publishedAt: { gte: dedupeWindowStart },
    },
    orderBy: { publishedAt: 'desc' },
  });

  if (existing) {
    const existingChange = existing.changePercent;
    if (Math.abs(existingChange - change) < 1) {
      return null; // Too similar to recent news, skip
    }
  }

  // --- FETCH ASSET ---
  const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
  if (!asset) return null;

  const teamName = asset.name;
  const severity = absChange >= 5 ? 'high' : absChange >= 3 ? 'normal' : 'low';

  // --- TEMPLATE KEYS ---
  const titleKey = `marketNews.${eventType}.title`;
  const bodyKey = `marketNews.${eventType}.body`;

  const titleParams: Record<string, string> = {
    team: teamName,
    change: absChange.toFixed(2),
  };

  const bodyParams: Record<string, string> = {
    team: teamName,
    before: String(input.before),
    after: String(input.after),
    change: absChange.toFixed(2),
    reason: input.context?.reason ?? 'تحديث نتائج المباريات',
    stage: input.context?.stage ?? 'group',
    opponent: input.context?.opponent ?? '',
  };

  // --- RENDER STATIC TEXT (backward compatible) ---
  const titleTemplateAr = getByPath(ar, titleKey);
  const bodyTemplateAr = getByPath(ar, bodyKey);
  const titleTemplateEn = getByPath(en, titleKey);
  const bodyTemplateEn = getByPath(en, bodyKey);

  const titleAr = titleTemplateAr ? interpolate(titleTemplateAr, titleParams) : `${teamName}: تغير ${changeRounded}%`;
  const bodyAr = bodyTemplateAr ? interpolate(bodyTemplateAr, bodyParams) : `سعر ${teamName} تغير من ${input.before} إلى ${input.after}.`;
  const titleEn = titleTemplateEn ? interpolate(titleTemplateEn, titleParams) : `${teamName}: ${changeRounded}% change`;
  const bodyEn = bodyTemplateEn ? interpolate(bodyTemplateEn, bodyParams) : `${teamName} moved from ${input.before} to ${input.after}.`;

  // --- SAVE ---
  return prisma.marketNews.create({
    data: {
      assetId: input.assetId,
      eventType,
      severity,
      localeGroupKey: dedupeKey,
      priceBefore: input.before,
      priceAfter: input.after,
      changePercent: changeRounded,
      titleAr,
      bodyAr,
      titleEn,
      bodyEn,
      titleKey,
      bodyKey,
      titleParams,
      bodyParams,
      context: input.context ?? {},
      publishedAt: new Date(),
    },
  });
}
