'use client';
// ============================================================
// components/analytics/FairnessIndex.tsx
// يعرض حكم عدالة المباراة المحسوب بالذكاء الاصطناعي:
// شارة ملونة، تسمية قصيرة، ونص تفسيري.
// يعرض هيكلًا أثناء تحميل البيانات.
// ============================================================
import type { FairnessInsight } from '@/lib/analytics/match-analytics.types';

// ── tone config ─────────────────────────────────────────────
const TONE_CONFIG = {
  positive: {
    icon: '✅',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/25 text-emerald-300',
    text: 'text-emerald-200',
    dot: 'bg-emerald-400',
  },
  info: {
    icon: 'ℹ️',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/25 text-blue-300',
    text: 'text-blue-200',
    dot: 'bg-blue-400',
  },
  warning: {
    icon: '⚠️',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/25 text-amber-300',
    text: 'text-amber-200',
    dot: 'bg-amber-400',
  },
} as const;

// ── labels map (AR) ─────────────────────────────────────────
const AR_LABELS: Record<string, string> = {
  'Fair Result': 'نتيجة عادلة',
  Fortunate: 'محظوظ',
};

function arLabel(label: string): string {
  for (const [en, ar] of Object.entries(AR_LABELS)) {
    if (label.includes(en)) return label.replace(en, ar);
  }
  return label;
}

// ── skeleton ────────────────────────────────────────────────
export function FairnessIndexSkeleton() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3 animate-pulse">
      <div className="h-4 w-28 rounded bg-white/10" />
      <div className="h-8 w-24 rounded-full bg-white/10" />
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-5/6 rounded bg-white/10" />
      </div>
    </div>
  );
}

// ── null state ──────────────────────────────────────────────
function FairnessNull() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-1">
      <h3 className="text-sm font-semibold text-white/70">مؤشر العدالة</h3>
      <p className="text-xs text-white/40">لا توجد بيانات كافية لتقييم عدالة المباراة.</p>
    </div>
  );
}

// ── main component ──────────────────────────────────────────
interface Props {
  fairness: FairnessInsight | null | undefined;
  className?: string;
}

export function FairnessIndex({ fairness, className = '' }: Props) {
  if (fairness === undefined) return <FairnessIndexSkeleton />;
  if (fairness === null) return <FairnessNull />;

  const cfg = TONE_CONFIG[fairness.tone] ?? TONE_CONFIG['info'];

  return (
    <div
      className={`rounded-2xl border p-5 space-y-3 ${cfg.bg} ${cfg.border} ${className}`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">مؤشر العدالة</h3>
        {/* Pulse dot */}
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} animate-pulse`} />
      </div>

      {/* Verdict badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${cfg.badge}`}
        >
          {cfg.icon}&nbsp;&nbsp;{arLabel(fairness.label)}
        </span>
      </div>

      {/* Explanation text */}
      <p className={`text-xs leading-relaxed ${cfg.text}`}>{fairness.text}</p>
    </div>
  );
}

export default FairnessIndex;
