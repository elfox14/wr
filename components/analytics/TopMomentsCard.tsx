'use client';
// ============================================================
// components/analytics/TopMomentsCard.tsx
// يعرض أبرز لحظات المباراة مرتبة حسب الثقل: أهداف، فرص كبيرة،
// اندفاعات، بطاقات حمراء، دراما متأخر.
// النقر على لحظة يطلق onSelect(minute) لمزامنة الجدول الزمني.
// ============================================================
import type { RankedMoment } from '@/lib/analytics/match-analytics.types';

// ── type → icon + colour + label (AR) ───────────────────────────
const TYPE_CONFIG = {
  goal: {
    icon: '⚽',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/25 text-emerald-300',
    label: 'هدف',
  },
  'late-drama': {
    icon: '🔥',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/25 text-rose-300',
    label: 'دراما متأخرة',
  },
  chance: {
    icon: '🎯',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/25 text-blue-300',
    label: 'فرصة كبيرة',
  },
  pressure: {
    icon: '📈',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/25 text-amber-300',
    label: 'اندفاع',
  },
  'turning-point': {
    icon: '🔴',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    badge: 'bg-red-500/25 text-red-300',
    label: 'نقطة تحول',
  },
} as const;

// ── score bar ────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  return (
    <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-white/30 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── skeleton ────────────────────────────────────────────────
export function TopMomentsCardSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/10" />
      ))}
    </div>
  );
}

// ── main component ──────────────────────────────────────────
interface Props {
  moments: RankedMoment[] | undefined | null;
  /** يُطلق عند النقر على لحظة */
  onSelect?: (minute: number) => void;
  /** الدقيقة المختارة حالياً — تظليل الصف المطابق */
  selectedMinute?: number | null;
  /** أقصى عدد عناصر معروضة (افتراضي 5) */
  limit?: number;
  className?: string;
}

export function TopMomentsCard({
  moments,
  onSelect,
  selectedMinute,
  limit = 5,
  className = '',
}: Props) {
  if (!moments) return <TopMomentsCardSkeleton />;

  const displayed = moments.slice(0, limit);

  return (
    <div className={`space-y-2 ${className}`} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80">أبرز اللحظات</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
          {displayed.length} لحظة
        </span>
      </div>

      {/* Empty state */}
      {displayed.length === 0 && (
        <p className="text-xs text-white/40 text-center py-4">لا توجد لحظات بارزة مرصودة.</p>
      )}

      {/* Moment rows */}
      <div className="space-y-1.5">
        {displayed.map((m) => {
          const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG['chance'];
          const isSelected = selectedMinute === m.minute;
          return (
            <button
              key={`${m.minute}-${m.type}`}
              type="button"
              onClick={() => onSelect?.(m.minute)}
              className={`
                w-full text-right rounded-xl px-3 py-2.5 border transition-all duration-150 group
                ${cfg.bg} ${cfg.border}
                ${
                  isSelected
                    ? 'ring-1 ring-white/30 brightness-110'
                    : 'hover:brightness-110 hover:ring-1 hover:ring-white/20'
                }
              `}
              aria-pressed={isSelected}
              aria-label={`${m.title} في الدقيقة ${m.minute}`}
            >
              <div className="flex items-start gap-2">
                {/* Icon */}
                <span className="text-base mt-0.5 shrink-0">{cfg.icon}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-white/90 truncate">{m.title}</span>
                    {/* Minute badge */}
                    <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                      {m.minute}&apos;
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">{m.description}</p>

                  {/* Score bar */}
                  <div className="mt-1.5">
                    <ScoreBar score={m.score} />
                  </div>

                  {/* Type badge + team */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {m.team !== 'neutral' && (
                      <span className="text-[10px] text-white/40">
                        {m.team === 'home' ? 'محلي' : 'ضيف'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TopMomentsCard;
