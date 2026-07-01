'use client';
// ============================================================
// components/analytics/TopMomentsCard.tsx
// Displays top ranked match moments — goals, big chances,
// momentum surges, red cards, late drama.
// Clicking a moment fires onSelect(minute) to sync the
// timeline and MinuteContextDrawer.
// ============================================================

import type { RankedMoment } from '@/lib/analytics/match-analytics.types';

// ── type → icon + colour ─────────────────────────────────────
const TYPE_CONFIG = {
  goal: {
    icon: '⚽',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/25 text-emerald-300',
    label: 'Goal',
  },
  'late-drama': {
    icon: '🔥',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/25 text-rose-300',
    label: 'Late Drama',
  },
  chance: {
    icon: '🎯',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/25 text-blue-300',
    label: 'Big Chance',
  },
  pressure: {
    icon: '📈',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/25 text-amber-300',
    label: 'Momentum',
  },
  'turning-point': {
    icon: '🔴',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    badge: 'bg-red-500/25 text-red-300',
    label: 'Turning Point',
  },
} as const;

// ── score bar ─────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  return (
    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-white/30 transition-all duration-500"
        style={{ width: `${pct}%` }}
        aria-label={`Impact score ${score}`}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

// ── skeleton ──────────────────────────────────────────────────
export function TopMomentsCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3 animate-pulse">
      <div className="h-4 w-32 rounded bg-white/10" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-white/8" />
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────
interface Props {
  moments: RankedMoment[] | undefined | null;
  /** Fires when user clicks a moment row */
  onSelect?: (minute: number) => void;
  /** Currently selected minute — highlights the matching row */
  selectedMinute?: number | null;
  /** Max items to display (default 5) */
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
    <div
      className={`rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3 ${className}`}
      role="region"
      aria-label="Top match moments"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Top Moments</h3>
        <span className="text-xs text-white/40">{displayed.length} moments</span>
      </div>

      {/* Empty state */}
      {displayed.length === 0 && (
        <p className="text-xs text-white/35 italic py-4 text-center">
          No significant moments detected.
        </p>
      )}

      {/* Moment rows */}
      <ul className="space-y-2" role="list">
        {displayed.map((m) => {
          const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG['chance'];
          const isSelected = selectedMinute === m.minute;

          return (
            <li key={`${m.minute}-${m.type}`} role="listitem">
              <button
                type="button"
                onClick={() => onSelect?.(m.minute)}
                className={`
                  w-full text-left rounded-xl px-3 py-2.5 border
                  transition-all duration-150 group
                  ${cfg.bg} ${cfg.border}
                  ${isSelected
                    ? 'ring-1 ring-white/30 brightness-110'
                    : 'hover:brightness-110 hover:ring-1 hover:ring-white/20'
                  }
                `}
                aria-pressed={isSelected}
                aria-label={`${m.title} at minute ${m.minute}`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Icon */}
                  <span className="text-lg leading-none mt-0.5 flex-shrink-0" aria-hidden="true">
                    {cfg.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Title row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {m.title}
                      </span>
                      {/* Minute badge */}
                      <span className="text-xs text-white/50 flex-shrink-0 font-mono">
                        {m.minute}&apos;
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-white/55 leading-snug line-clamp-1">
                      {m.description}
                    </p>

                    {/* Score bar */}
                    <ScoreBar score={m.score} />
                  </div>
                </div>

                {/* Type badge */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-white/35 capitalize">
                    {m.team === 'home' ? '🏠' : m.team === 'away' ? '✈️' : ''}
                    {' '}{m.team}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TopMomentsCard;
