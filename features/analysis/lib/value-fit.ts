export type ValueFitSignal = 'UNDERVALUED' | 'OVERVALUED' | 'TECH_SUPPORTED' | 'BALANCED';

export type ValueFitResult = {
  signal: ValueFitSignal;
  label: string;
  shortLabel: string;
  reason: string;
  tone: string;
  marketPrice: number;
  fairValue: number;
  gapPercent: number;
};

export function getMarketPrice(asset: any) {
  return Number(asset?.marketPrice ?? asset?.current_price ?? 0);
}

export function getFairValue(asset: any) {
  const marketPrice = getMarketPrice(asset);
  return Number(asset?.fairValue ?? asset?.current_price ?? marketPrice ?? 0);
}

export function getValueGapPercent(asset: any) {
  const fairValue = getFairValue(asset);
  if (!Number.isFinite(fairValue) || fairValue <= 0) return 0;
  return ((getMarketPrice(asset) - fairValue) / fairValue) * 100;
}

export function formatVirtualCoins(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString()}¢`;
}

export function analyzeValueFit(asset: any, technicalScore: number): ValueFitResult {
  const marketPrice = getMarketPrice(asset);
  const fairValue = getFairValue(asset);
  const gapPercent = getValueGapPercent(asset);

  if (gapPercent <= -8 && technicalScore >= 65) {
    return {
      signal: 'UNDERVALUED',
      label: 'فرصة أقل من قيمتها فنيًا',
      shortLabel: 'فرصة فنية',
      reason: 'السعر أقل من القيمة العادلة مع وجود مؤشر فني جيد، لذلك يستحق المتابعة.',
      tone: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      marketPrice,
      fairValue,
      gapPercent,
    };
  }

  if (gapPercent >= 12 && technicalScore < 72) {
    return {
      signal: 'OVERVALUED',
      label: 'السعر أعلى من المبرر الفني',
      shortLabel: 'مبالغ فنيًا',
      reason: 'السعر الحالي مرتفع مقارنة بالقيمة العادلة، بينما التحليل الفني لا يعطي دعمًا كافيًا لهذا الارتفاع.',
      tone: 'border-red-400/25 bg-red-400/10 text-red-300',
      marketPrice,
      fairValue,
      gapPercent,
    };
  }

  if (technicalScore >= 78) {
    return {
      signal: 'TECH_SUPPORTED',
      label: 'السعر مدعوم فنيًا',
      shortLabel: 'مدعوم فنيًا',
      reason: 'التحليل الفني قوي بما يكفي ليبرر اهتمام السوق بهذا الأصل، مع ضرورة مراقبة الطلب والزخم.',
      tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]',
      marketPrice,
      fairValue,
      gapPercent,
    };
  }

  return {
    signal: 'BALANCED',
    label: 'تقييم متوازن',
    shortLabel: 'متوازن',
    reason: 'السعر لا يظهر انحرافًا حادًا عن القراءة الفنية الحالية، والتغير القادم يعتمد على الأداء والزخم.',
    tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]',
    marketPrice,
    fairValue,
    gapPercent,
  };
}
