'use client';
// ============================================================
// components/match-center/MatchAnalyticsPanel.tsx
// Client wrapper يستقبل بيانات المباراة من Server Component
// ويحسب مخرجات التحليل ثم يعرضها عبر ثلاثة مكونات:
//   - AutoSummaryHeader  — الخلاصة السردية
//   - TopMomentsCard     — أبرز اللحظات
//   - FairnessIndex      — مؤشر العدالة
// ============================================================
import { useMemo, useState } from 'react';
import type { MatchInsightsInput } from '@/lib/analytics/match-analytics.types';
import { createMatchInsights } from '@/lib/analytics/match-insights';
import { AutoSummaryHeader, AutoSummaryHeaderSkeleton } from '@/components/analytics/AutoSummaryHeader';
import { TopMomentsCard, TopMomentsCardSkeleton } from '@/components/analytics/TopMomentsCard';
import { FairnessIndex, FairnessIndexSkeleton } from '@/components/analytics/FairnessIndex';

interface Props {
  /** بيانات التحليل المحسوبة على السيرفر */
  input: MatchInsightsInput | null;
  className?: string;
}

export function MatchAnalyticsPanel({ input, className = '' }: Props) {
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);

  // حساب التحليل مرة واحدة فقط
  const insights = useMemo(() => {
    if (!input) return null;
    try {
      return createMatchInsights(input);
    } catch (e) {
      console.error('[MatchAnalyticsPanel] createMatchInsights error:', e);
      return null;
    }
  }, [input]);

  // هيكل أثناء التحميل أو عدم وجود بيانات
  if (!insights) {
    return (
      <section
        className={`space-y-4 ${className}`}
        dir="rtl"
        aria-label="لوحة تحليل المباراة"
      >
        <AutoSummaryHeaderSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TopMomentsCardSkeleton />
          <FairnessIndexSkeleton />
        </div>
      </section>
    );
  }

  return (
    <section
      className={`space-y-4 ${className}`}
      dir="rtl"
      aria-label="لوحة تحليل المباراة"
    >
      {/* خلاصة سردية */}
      <AutoSummaryHeader
        summary={insights.summary}
        className="w-full"
      />

      {/* بطاقةتان جنباً إلى جنب */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* أبرز اللحظات */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <TopMomentsCard
            moments={insights.topMoments}
            selectedMinute={selectedMinute}
            onSelect={(min) =>
              setSelectedMinute((prev) => (prev === min ? null : min))
            }
            limit={6}
          />
        </div>

        {/* معلومات الدقيقة المختارة + مؤشر العدالة */}
        <div className="space-y-3">
          <FairnessIndex fairness={insights.fairness} />

          {/* معلومات سياق الدقيقة */}
          {selectedMinute !== null && (() => {
            const ctx = insights.getMinuteContext(selectedMinute);
            if (!ctx) return null;
            return (
              <div
                className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2"
                dir="rtl"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white/70">
                    تحليل الدقيقة {selectedMinute}&apos;
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedMinute(null)}
                    className="text-[10px] text-white/40 hover:text-white/70 transition"
                    aria-label="إغلاق"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">{ctx.narrative}</p>
                <div className="flex gap-4 text-[11px] text-white/50">
                  <span>تسديدات: {ctx.nearbyShotsCount}</span>
                  <span>xG محلي: {ctx.homeXg.toFixed(2)}</span>
                  <span>xG ضيف: {ctx.awayXg.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}

export default MatchAnalyticsPanel;
