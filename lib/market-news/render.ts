// lib/market-news/render.ts
import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import { interpolate, formatNumber } from './formatters';

const dictionaries: Record<string, any> = { ar, en };

function getByPath(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? '';
}

/**
 * Render a MarketNews record into localized title + body.
 * Uses stored titleKey/bodyKey and params to build the final text.
 * Falls back to static titleAr/bodyAr or titleEn/bodyEn if no template key.
 */
export function renderMarketNews(
  news: {
    titleKey?: string | null;
    bodyKey?: string | null;
    titleParams?: any;
    bodyParams?: any;
    titleAr: string;
    bodyAr: string;
    titleEn: string;
    bodyEn: string;
  },
  locale: 'ar' | 'en'
): { title: string; body: string } {
  // If no template keys, fall back to static fields
  if (!news.titleKey || !news.bodyKey) {
    return {
      title: locale === 'ar' ? news.titleAr : news.titleEn,
      body: locale === 'ar' ? news.bodyAr : news.bodyEn,
    };
  }

  const dict = dictionaries[locale] || dictionaries['ar'];
  const titleTemplate = getByPath(dict, news.titleKey);
  const bodyTemplate = getByPath(dict, news.bodyKey);

  // If template not found, fall back to static
  if (!titleTemplate || !bodyTemplate) {
    return {
      title: locale === 'ar' ? news.titleAr : news.titleEn,
      body: locale === 'ar' ? news.bodyAr : news.bodyEn,
    };
  }

  const tp = { ...(news.titleParams ?? {}) };
  const bp = { ...(news.bodyParams ?? {}) };

  // Format numbers for locale
  if (tp.change) tp.change = formatNumber(Number(tp.change), locale);
  if (bp.before) bp.before = formatNumber(Number(bp.before), locale);
  if (bp.after) bp.after = formatNumber(Number(bp.after), locale);
  if (bp.change) bp.change = formatNumber(Number(bp.change), locale);

  return {
    title: interpolate(titleTemplate, tp),
    body: interpolate(bodyTemplate, bp),
  };
}
