// ============================================================
// lib/api/get-match-insights-input.ts
// Server-side fetcher: loads extras-snapshot from the API
// and maps it to MatchInsightsInput for use in Server Components.
// ============================================================
import { mapMatchExtrasToInsightsInput } from './map-match-extras-to-insights';
import type { MatchInsightsInput } from '@/lib/analytics/match-analytics.types';
import type { RawMatchExtrasSnapshot } from './match-extras.types';

/**
 * Fetches match extras snapshot from the internal API and maps
 * it to MatchInsightsInput. Throws on network failure.
 * Use inside Next.js Server Components or route handlers.
 */
export async function getMatchInsightsInput(
  matchId: string,
): Promise<MatchInsightsInput> {
  const url = `https://worldcup.mcprim.com/api/admin/matches/${matchId}/extras-snapshot`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `[getMatchInsightsInput] Failed to fetch extras-snapshot for matchId=${matchId} (${response.status})`,
    );
  }

  const raw = (await response.json()) as RawMatchExtrasSnapshot;
  return mapMatchExtrasToInsightsInput(raw);
}

/**
 * Safe variant: returns null instead of throwing on failure.
 * Useful when analytics are optional (e.g. pre-match pages).
 */
export async function getMatchInsightsInputSafe(
  matchId: string,
): Promise<MatchInsightsInput | null> {
  try {
    return await getMatchInsightsInput(matchId);
  } catch (err) {
    console.warn('[getMatchInsightsInputSafe]', err);
    return null;
  }
}
