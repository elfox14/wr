'use client';
// ============================================================
// components/analytics/AutoSummaryHeader.tsx
// Displays the match narrative summary: title, subtitle,
// and NarrativeChips (xG dominance, possession, late pressure).
// ============================================================

import type { MatchNarrativeSummary } from '@/lib/analytics/match-analytics.types';

// ── chip tone colours ────────────────────────────────────────
const TONE_STYLES = {
  info: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  positive: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
} as const;

// ── skeleton ─────────────────────────────────────────────────
export function AutoSummaryHeaderSkeleton() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3 animate-pulse">
      <div className="h-5 w-2/3 rounded bg-white/10" />
      <div className="h-3.5 w-4/5 rounded bg-white/8" />
      <div className="flex gap-2 pt-1">
        <div className="h-6 w-28 rounded-full bg-white/10" />
        <div className="h-6 w-24 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────
interface Props {
  summary: MatchNarrativeSummary | undefined | null;
  /** Show a compact version without subtitle */
  compact?: boolean;
  className?: string;
}

export function AutoSummaryHeader({ summary, compact = false, className = '' }: Props) {
  if (!summary) return <AutoSummaryHeaderSkeleton />;

  return (
    <div
      className={`rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2.5 ${className}`}
      role="region"
      aria-label="Match narrative summary"
    >
      {/* Title */}
      <h2 className="text-base font-semibold text-white leading-snug">
        {summary.title}
      </h2>

      {/* Subtitle */}
      {!compact && summary.subtitle && (
        <p className="text-sm text-white/60 leading-relaxed">
          {summary.subtitle}
        </p>
      )}

      {/* Narrative Chips */}
      {summary.chips.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1" role="list" aria-label="Narrative highlights">
          {summary.chips.map((chip) => (
            <div
              key={chip.id}
              role="listitem"
              title={chip.description}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                text-xs font-medium cursor-default select-none
                transition-opacity hover:opacity-80
                ${TONE_STYLES[chip.tone ?? 'info']}
              `}
            >
              {/* Tone indicator dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  chip.tone === 'warning'
                    ? 'bg-amber-400'
                    : chip.tone === 'positive'
                    ? 'bg-emerald-400'
                    : 'bg-blue-400'
                }`}
                aria-hidden="true"
              />
              {chip.label}
              {chip.minute != null && (
                <span className="opacity-60">{chip.minute}&apos;</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {summary.chips.length === 0 && !compact && (
        <p className="text-xs text-white/35 italic">
          No narrative highlights detected for this match.
        </p>
      )}
    </div>
  );
}

export default AutoSummaryHeader;
