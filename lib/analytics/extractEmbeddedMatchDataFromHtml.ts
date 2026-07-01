// ============================================================
// lib/analytics/extractEmbeddedMatchDataFromHtml.ts
// Extracts embedded match data from Next.js Flight payload
// embedded in the HTML of a match-center page.
//
// Next.js App Router serialises server component props into
// <script> tags with id="__NEXT_DATA__" (pages router) or as
// self-closing <script> tags containing RSC Flight chunks.
// This extractor handles both formats and returns a
// RawEmbeddedMatchData object ready for the mapper.
// ============================================================

import type { RawEmbeddedMatchData } from './mapEmbeddedMatchToInsightsInput';

// ─── extraction result ───────────────────────────────────────

export interface ExtractionResult {
  data: RawEmbeddedMatchData | null;
  /** Human-readable description of how the data was found */
  source: 'next-data' | 'rsc-flight' | 'json-ld' | 'none';
  error?: string;
}

// ─── helpers ────────────────────────────────────────────────

/**
 * Safely parses a JSON string, returning null on failure.
 */
function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Recursively searches a parsed JSON tree for an object that
 * looks like RawEmbeddedMatchData (has home_team and away_team).
 */
function findMatchDataInTree(node: unknown, depth = 0): RawEmbeddedMatchData | null {
  if (depth > 10) return null;
  if (!node || typeof node !== 'object') return null;

  const obj = node as Record<string, unknown>;

  // Direct match — object has home_team and away_team strings
  if (typeof obj['home_team'] === 'string' && typeof obj['away_team'] === 'string') {
    return obj as unknown as RawEmbeddedMatchData;
  }

  // Recurse into values
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findMatchDataInTree(item, depth + 1);
        if (found) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = findMatchDataInTree(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

// ─── strategy 1: __NEXT_DATA__ ──────────────────────────────

function tryExtractFromNextData(html: string): RawEmbeddedMatchData | null {
  const match = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) return null;

  const parsed = safeJsonParse<Record<string, unknown>>(match[1]);
  if (!parsed) return null;

  // Walk props.pageProps tree
  const pageProps =
    (parsed['props'] as Record<string, unknown>)?.['pageProps'] ??
    parsed['props'] ??
    parsed;

  return findMatchDataInTree(pageProps);
}

// ─── strategy 2: RSC Flight inline script ───────────────────
// Next.js 13+ App Router emits multiple <script> tags with
// self-pushing arrays: self.__next_f.push([...])
// Each chunk is a line-separated JSON stream.

function tryExtractFromRscFlight(html: string): RawEmbeddedMatchData | null {
  // Find all RSC flight push calls
  const chunkPattern = /self\.__next_f\.push\(\[[\d,"]+,\s*"((?:[^"\\]|\\.)*)"\]\)/g;
  let match: RegExpExecArray | null;

  while ((match = chunkPattern.exec(html)) !== null) {
    const raw = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    // RSC chunks can be line-delimited JSON; try each line
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
      const parsed = safeJsonParse(trimmed);
      if (!parsed) continue;
      const found = findMatchDataInTree(parsed);
      if (found) return found;
    }
  }

  return null;
}

// ─── strategy 3: JSON-LD embedded ───────────────────────────

function tryExtractFromJsonLd(html: string): RawEmbeddedMatchData | null {
  const pattern = /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const parsed = safeJsonParse(match[1]);
    if (!parsed) continue;
    const found = findMatchDataInTree(parsed);
    if (found) return found;
  }

  return null;
}

// ─── public API ──────────────────────────────────────────────

/**
 * Attempts to extract embedded RawEmbeddedMatchData from the
 * full HTML string of a match-center page.
 *
 * Tries three strategies in order:
 * 1. `__NEXT_DATA__` (Pages Router)
 * 2. RSC Flight inline scripts (App Router)
 * 3. `application/json` script tags
 *
 * Returns ExtractionResult with the found data or null.
 */
export function extractEmbeddedMatchDataFromHtml(
  html: string,
): ExtractionResult {
  try {
    const fromNextData = tryExtractFromNextData(html);
    if (fromNextData) {
      return { data: fromNextData, source: 'next-data' };
    }

    const fromFlight = tryExtractFromRscFlight(html);
    if (fromFlight) {
      return { data: fromFlight, source: 'rsc-flight' };
    }

    const fromJsonLd = tryExtractFromJsonLd(html);
    if (fromJsonLd) {
      return { data: fromJsonLd, source: 'json-ld' };
    }

    return { data: null, source: 'none' };
  } catch (err) {
    return {
      data: null,
      source: 'none',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Browser-side variant: reads embedded data from the current
 * document instead of an HTML string. Safe to call from a
 * React component or hook after hydration.
 */
export function extractEmbeddedMatchDataFromDocument(): ExtractionResult {
  if (typeof document === 'undefined') {
    return { data: null, source: 'none', error: 'Not in browser environment' };
  }
  return extractEmbeddedMatchDataFromHtml(document.documentElement.outerHTML);
}
