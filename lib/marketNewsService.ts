import { PrismaClient, Asset } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateMarketNews(asset: Asset, priceBefore: number, priceAfter: number, context: { reason?: string, stage?: string } = {}) {
  if (priceBefore <= 0) return null;

  const change = ((priceAfter - priceBefore) / priceBefore) * 100;
  const changePercent = Math.round(change * 100) / 100; // 2 decimal places
  const absChange = Math.abs(changePercent);

  let eventType = null;
  
  if (changePercent >= 2) eventType = 'price_spike';
  else if (changePercent <= -2) eventType = 'price_drop';

  if (!eventType) return null; // No significant change, no news generated

  const severity = absChange >= 5 ? 'high' : 'normal';
  const reasonAr = context.reason ? ` ${context.reason}` : ' بعد آخر تحديث لنتائج المباريات';
  const reasonEn = context.reason ? ` ${context.reason}` : ' after the latest match results update';

  let titleAr = '';
  let bodyAr = '';
  let titleEn = '';
  let bodyEn = '';

  if (eventType === 'price_spike') {
    titleAr = `منتخب ${asset.name} يرتفع بنسبة ${absChange}%`;
    bodyAr = `سعر ${asset.name} صعد من ${priceBefore} إلى ${priceAfter}${reasonAr}.`;
    
    titleEn = `${asset.name} jumps by ${absChange}%`;
    bodyEn = `${asset.name} moved from ${priceBefore} to ${priceAfter}${reasonEn}.`;
  } else if (eventType === 'price_drop') {
    titleAr = `منتخب ${asset.name} يتراجع بنسبة ${absChange}%`;
    bodyAr = `سعر ${asset.name} انخفض من ${priceBefore} إلى ${priceAfter}${reasonAr}.`;
    
    titleEn = `${asset.name} falls by ${absChange}%`;
    bodyEn = `${asset.name} slipped from ${priceBefore} to ${priceAfter}${reasonEn}.`;
  }

  const news = await prisma.marketNews.create({
    data: {
      assetId: asset.id,
      eventType,
      severity,
      priceBefore,
      priceAfter,
      changePercent,
      titleAr,
      bodyAr,
      titleEn,
      bodyEn,
      publishedAt: new Date()
    }
  });

  return news;
}
