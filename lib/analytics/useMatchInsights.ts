'use client';
// ============================================================
// lib/analytics/useMatchInsights.ts
// React hook that wires the analytics engine to a React
// component. Handles:
//   - Extracting embedded match data from the page
//   - Mapping raw data to MatchInsightsInput
//   - Running createMatchInsights()
//   - Managing selectedMinute / selectedRange state
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  MatchInsightsInput,
  MatchInsightsOutput,
  SelectedRange,
  NarrativeSummary,
} from './match-analytics.types';
import { createMatchInsights } from './match-insights';
import { mapEmbeddedMatchToInsightsInput } from './mapEmbeddedMatchToInsightsInput';
import {
  extractEmbeddedMatchDataFromDocument,
} from './extractEmbeddedMatchDataFromHtml';

// ─── types ───────────────────────────────────────────────────

export interface UseMatchInsightsOptions {
  /**
   * Provide pre-fetched input directly (e.g. from a server
   * component). When provided, extraction from the document
   * is skipped.
   */
  input?: MatchInsightsInput;
}

export interface UseMatchInsightsReturn {
  /** Full insights output — null while loading or on error */
  insights: MatchInsightsOutput | null;
  /** Currently selected minute (from timeline/momentum click) */
  selectedMinute: number | null;
  /** Currently selected range (from TopMoments or drag) */
  selectedRange: SelectedRange;
  /** Context for the currently selected minute */
  minuteContext: NarrativeSummary | null;
  /** Select a single minute */
  setSelectedMinute: (minute: number | null) => void;
  /** Update the selected range */
  setSelectedRange: (range: Partial<SelectedRange>) => void;
  /** Reset all selections */
  clearSelection: () => void;
  /** True while extracting / computing */
  loading: boolean;
  /** Error message if extraction failed */
  error: string | null;
  /** Where the data came from */
  dataSource: 'provided' | 'next-data' | 'rsc-flight' | 'json-ld' | 'none';
}

// ─── default range ───────────────────────────────────────────

const DEFAULT_RANGE: SelectedRange = {
  centerMinute: null,
  startMinute: null,
  endMinute: null,
  source: null,
};

// ─── hook ────────────────────────────────────────────────────

export function useMatchInsights(
  options: UseMatchInsightsOptions = {},
): UseMatchInsightsReturn {
  const { input: providedInput } = options;

  // ── extraction state ──
  const [extractedInput, setExtractedInput] =
    useState<MatchInsightsInput | null>(null);
  const [loading, setLoading] = useState(!providedInput);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] =
    useState<UseMatchInsightsReturn['dataSource']>('none');

  // ── selection state ──
  const [selectedMinute, setSelectedMinuteState] = useState<number | null>(
    null,
  );
  const [selectedRange, setSelectedRangeState] =
    useState<SelectedRange>(DEFAULT_RANGE);

  // ── extract from document when no input provided ──
  useEffect(() => {
    if (providedInput) {
      setDataSource('provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Defer to next tick so the DOM is fully hydrated
    const timer = setTimeout(() => {
      try {
        const result = extractEmbeddedMatchDataFromDocument();
        if (result.data) {
          const mapped = mapEmbeddedMatchToInsightsInput(result.data);
          setExtractedInput(mapped);
          setDataSource(result.source as UseMatchInsightsReturn['dataSource']);
        } else {
          setError(
            result.error ?? 'Could not find embedded match data in the page.',
          );
          setDataSource('none');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setDataSource('none');
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [providedInput]);

  // ── compute insights ──
  const activeInput = providedInput ?? extractedInput;

  const insights = useMemo<MatchInsightsOutput | null>(() => {
    if (!activeInput) return null;
    try {
      return createMatchInsights(activeInput);
    } catch (err) {
      console.error('[useMatchInsights] createMatchInsights threw:', err);
      return null;
    }
  }, [activeInput]);

  // ── minute context ──
  const minuteContext = useMemo<NarrativeSummary | null>(() => {
    if (!insights || selectedMinute === null) return null;
    return insights.getMinuteContext(selectedMinute);
  }, [insights, selectedMinute]);

  // ── selection handlers ──
  const setSelectedMinute = useCallback((minute: number | null) => {
    setSelectedMinuteState(minute);
    // Sync center minute on range
    setSelectedRangeState((prev) => ({
      ...prev,
      centerMinute: minute,
    }));
  }, []);

  const setSelectedRange = useCallback(
    (partial: Partial<SelectedRange>) => {
      setSelectedRangeState((prev) => ({ ...prev, ...partial }));
      // Sync selectedMinute if centerMinute provided
      if (partial.centerMinute !== undefined) {
        setSelectedMinuteState(partial.centerMinute);
      }
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedMinuteState(null);
    setSelectedRangeState(DEFAULT_RANGE);
  }, []);

  return {
    insights,
    selectedMinute,
    selectedRange,
    minuteContext,
    setSelectedMinute,
    setSelectedRange,
    clearSelection,
    loading,
    error,
    dataSource,
  };
}
