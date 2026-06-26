import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { collectTheStatsMatchExtras, defaultTheStatsQuery, type TheStatsExtrasEndpointMode } from '@/lib/theStatsMatchExtras';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
type DeletedProviderData = { snapshots: number; events: number; essentialSnapshots: number };

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function boolParam(url: URL, name: string, fallback = false) { const raw = url.searchParams.get(name); if (raw === null) return fallback; return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase()); }
function numberParam(url: URL, name: string, fallback: number, min: number, max: number) { const value = Number(url.searchParams.get(name) ?? fallback); if (!Number.isFinite(value)) return fallback; return Math.max(min, Math.min(max, Math.floor(value))); }
function endpointModeParam(url: URL): TheStatsExtrasEndpointMode {
  const raw = String(url.searchParams.get('endpointMode') || url.searchParams.get('mode') || '').trim().toLowerCase();
  if (raw === 'full' || raw === 'all') return 'full';
  if (raw === 'events' || raw === 'shots' || raw === 'players' || raw === 'lineups' || raw === 'info' || raw === 'stats') return raw;
  return 'essential';
}
function statPair(stats: Record<string, any>, key: string) { const pair = stats?.[key] || {}; const home = Number(pair.home); const away = Number(pair.away); return { home: Number.isFinite(home) ? Math.round(home) : null, away: Number.isFinite(away) ? Math.round(away) : null }; }
function snapshotStatColumns(normalized: any) {
  const stats = normalized?.liveStats?.stats || {};
  const possession = statPair(stats, 'possession'); const shots = statPair(stats, 'shots'); const shotsOnTarget = statPair(stats, 'shotsOnTarget'); const shotsOffTarget = statPair(stats, 'shotsOffTarget'); const corners = statPair(stats, 'corners'); const yellowCards = statPair(stats, 'yellowCards'); const redCards = statPair(stats, 'redCards');
  return { homePossession: possession.home, awayPossession: possession.away, homeShots: shots.home, awayShots: shots.away, homeShotsOnTarget: shotsOnTarget.home, awayShotsOnTarget: shotsOnTarget.away, homeShotsOffTarget: shotsOffTarget.home, awayShotsOffTarget: shotsOffTarget.away, homeCorners: corners.home, awayCorners: corners.away, homeYellowCards: yellowCards.home, awayYellowCards: yellowCards.away, homeRedCards: redCards.home, awayRedCards: redCards.away };
}
function providerMatchNumber(value: unknown) { const n = Number(String(value || '').replace(/\D/g, '')); return Number.isFinite(n) ? n : 0; }
async function deleteOldProviderData(matchId: string, options: { purgeISportsEvents: boolean; purgeISportsSnapshots: boolean; purgeFootballDataEvents: boolean; replaceTheStatsFinal: boolean; purgeTheStatsMatchEvents: boolean; replaceEssential: boolean }): Promise<DeletedProviderData> {
  const deleted: DeletedProviderData = { snapshots: 0, events: 0, essentialSnapshots: 0 };
  if (options.replaceEssential) { const stats = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, provider: 'THE_STATS_API_ESSENTIAL' } }); deleted.essentialSnapshots += stats.count; }
  if (options.replaceTheStatsFinal) { const stats = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, provider: { in: ['THE_STATS_API_EXTRAS', 'THE_STATS_API_FINAL_CANONICAL', 'THE_STATS_API_MANUAL_FINAL'] } } }); deleted.snapshots += stats.count; }
  if (options.purgeTheStatsMatchEvents) { const events = await prisma.matchEvent.deleteMany({ where: { matchId, OR: [{ sourceName: { startsWith: 'THE_STATS_API_FINAL' } }, { sourceName: { startsWith: 'THE_STATS_API_MANUAL' } }, { sourceName: 'THE_STATS_API_MANUAL_FINAL' }, { sourceName: 'THE_STATS_API_FINAL_CANONICAL' }, { sourceName: 'THE_STATS_API_FINAL_TIMELINE' }, { sourceName: 'THE_STATS_API_FINAL_SHOTMAP' }, { sourceName: 'TheStats' }] } }); deleted.events += events.count; }
  if (options.purgeISportsSnapshots) { const stats = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, OR: [{ provider: { contains: 'ISPORTS' } }, { provider: { contains: 'WORKER_ISPORTS' } }, { provider: { contains: 'AUTOMATED_LIVE_INGEST' } }] } }); deleted.snapshots += stats.count; }
  if (options.purgeISportsEvents) { const events = await prisma.matchEvent.deleteMany({ where: { matchId, OR: [{ sourceName: { contains: 'iSports' } }, { sourceName: { contains: 'ISPORTS' } }, { sourceName: { contains: 'Automated Live Ingest' } }, { sourceName: { contains: 'Live Ingest' } }] } }); deleted.events += events.count; }
  if (options.purgeFootballDataEvents) { const events = await prisma.matchEvent.deleteMany({ where: { matchId, OR: [{ sourceName: { contains: 'Football-Data' } }, { sourceName: { contains: 'FOOTBALL_DATA' } }] } }); deleted.events += events.count; }
  return deleted;
}
function localMatchWhere(since: Date, matchId?: string | null) { if (matchId) return { id: matchId } as any; return { status: { in: FINISHED_STATUSES }, matchDate: { gte: since } } as any; }
function modeHasHeavyDetails(endpointMode: TheStatsExtrasEndpointMode, counts: { events: number; shots: number; players: number }) { return endpointMode === 'full' || endpointMode === 'events' || endpointMode === 'shots' || endpointMode === 'players' || counts.events > 0 || counts.shots > 0 || counts.players > 0; }

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const url = new URL(req.url);
  const dryRun = boolParam(url, 'dryRun', true) && !boolParam(url, 'apply', false);
  const limit = numberParam(url, 'limit', 1, 1, 6);
  const days = numberParam(url, 'days', 3, 1, 60);
  const timeoutMs = numberParam(url, 'timeoutMs', 18000, 3000, 60000);
  const requestsPerMinute = numberParam(url, 'requestsPerMinute', 45, 10, 90);
  const delayMs = Math.max(numberParam(url, 'delayMs', 0, 0, 15000), Math.ceil(60000 / requestsPerMinute));
  const endpointMode = endpointModeParam(url);
  const includeRaw = boolParam(url, 'includeRaw', false);
  const purgeISportsEvents = boolParam(url, 'purgeISportsEvents', true);
  const purgeISportsSnapshots = boolParam(url, 'purgeISportsSnapshots', false);
  const purgeFootballDataEvents = boolParam(url, 'purgeFootballDataEvents', true);
  const purgeTheStatsMatchEvents = boolParam(url, 'purgeTheStatsMatchEvents', true);
  const replaceTheStatsFinal = boolParam(url, 'replaceTheStatsFinal', true);
  const writeMatchEvents = boolParam(url, 'writeMatchEvents', false);
  const matchId = url.searchParams.get('matchId');
  const since = new Date(Date.now() - days * 864e5);
  const providerQuery = defaultTheStatsQuery(url.searchParams);

  const matches = await prisma.match.findMany({ where: localMatchWhere(since, matchId), include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'desc' }, take: matchId ? 1 : limit });
  const processed = [];
  let wroteFinalSnapshots = false;
  let providerRequestsBudgetApprox = 0;

  for (const match of matches) {
    try {
      const collected = await collectTheStatsMatchExtras(match, { dryRun: true, save: false, includeRaw, endpointMode, timeoutMs, delayMs, query: providerQuery });
      providerRequestsBudgetApprox += endpointMode === 'full' ? 6 : 3;
      const normalized = (collected as any)?.debug?.normalizedPreview;
      const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
      const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
      const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
      const statsCount = Object.keys(normalized?.liveStats?.stats || {}).length;
      const counts = { events: events.length, shots: shots.length, players: players.length };
      const hasUsefulData = Boolean(normalized) && (statsCount > 0 || counts.events > 0 || counts.shots > 0 || counts.players > 0 || Boolean(normalized?.lineups));
      if (!collected.ok || !hasUsefulData) { processed.push({ matchId: match.id, status: 'skipped_no_final_the_stats_data', endpointMode, collected }); if (delayMs > 0) await sleep(delayMs); continue; }

      const providerMatchId = (collected as any).resolvedProviderMatchId;
      const hasHeavyDetails = modeHasHeavyDetails(endpointMode, counts);
      const snapshotProvider = hasHeavyDetails ? 'THE_STATS_API_EXTRAS' : 'THE_STATS_API_ESSENTIAL';
      const safeReplaceFinal = hasHeavyDetails && replaceTheStatsFinal;
      const safePurgeEvents = hasHeavyDetails && writeMatchEvents;
      let deleted: DeletedProviderData = { snapshots: 0, events: 0, essentialSnapshots: 0 };
      let snapshotId: string | null = null;
      let insertedEvents = 0;

      if (!dryRun) {
        deleted = await deleteOldProviderData(match.id, { purgeISportsEvents: safePurgeEvents && purgeISportsEvents, purgeISportsSnapshots: hasHeavyDetails && purgeISportsSnapshots, purgeFootballDataEvents: safePurgeEvents && purgeFootballDataEvents, replaceTheStatsFinal: safeReplaceFinal, purgeTheStatsMatchEvents: safePurgeEvents && purgeTheStatsMatchEvents, replaceEssential: !hasHeavyDetails });
        const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: snapshotProvider, providerMatchId: providerMatchNumber(providerMatchId), homeScore: match.homeScore, awayScore: match.awayScore, ...snapshotStatColumns(normalized), rawData: { provider: 'THE_STATS_API', mode: hasHeavyDetails ? 'final_canonical_after_match_snapshot_only' : 'essential_stats_lineups_non_destructive', endpointMode, importedAt: new Date().toISOString(), resolvedProviderMatchId: providerMatchId, resolvedBy: (collected as any).resolvedBy, rateLimitPolicy: { requestsPerMinute, delayMs, note: endpointMode === 'full' ? 'Full mode is explicit and should be used sparingly.' : 'Essential mode is non-destructive and avoids heavy shotmap/player-stats endpoints.' }, displayPolicy: { eventsSource: hasHeavyDetails ? 'snapshot.normalized.eventsDetailed.all' : 'not available in essential mode', writeMatchEvents, fallbackMetrics: 'iSports snapshots may be kept for attacks/dangerous attacks only.', nonDestructive: !hasHeavyDetails }, normalized } }, select: { id: true } });
        snapshotId = snapshot.id; insertedEvents = 0; wroteFinalSnapshots = true;
      }

      processed.push({ matchId: match.id, teams: `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`, status: dryRun ? 'dry_run_ok' : 'finalized_from_the_stats_snapshot_only', endpointMode, snapshotProvider, providerMatchId, resolvedBy: (collected as any).resolvedBy, counts: { stats: statsCount, events: counts.events, shots: counts.shots, playerStats: counts.players, lineups: normalized?.lineups ? 1 : 0 }, safeMode: { hasHeavyDetails, safeReplaceFinal, safePurgeEvents, essentialIsNonDestructive: !hasHeavyDetails }, deleted, snapshotId, insertedEvents, writeMatchEvents });
    } catch (error: any) {
      processed.push({ matchId: match.id, status: 'failed', endpointMode, error: error?.message || String(error), code: error?.code || null, providerStatus: error?.status || null });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const revalidated = wroteFinalSnapshots ? revalidateStatsViews('the-stats-finalize-matches') : null;
  return NextResponse.json({ ok: true, mode: 'the_stats_finalize_matches_v4_non_destructive_essential', dryRun, endpointMode, note: dryRun ? 'Add apply=true or dryRun=false to write final snapshot.' : 'Essential mode now writes THE_STATS_API_ESSENTIAL and does not replace final details or purge events. Use endpointMode=full for events, shotmap and player stats.', policy: { sourceOfTruth: 'THE_STATS_API for final post-match events and statistics when full mode is used', essentialMode: 'stats + lineups only, non-destructive', fullMode: 'Use endpointMode=full manually when events, shotmap/player-stats are needed.', requestsPerMinute, delayMs, theStatsLimitSafety: requestsPerMinute <= 90 }, cleanup: { purgeISportsEvents, purgeISportsSnapshots, purgeFootballDataEvents, purgeTheStatsMatchEvents, replaceTheStatsFinal, note: 'Cleanup is gated by full/detail data and writeMatchEvents to avoid deleting visible events after essential runs.' }, scope: { matchId, limit: matchId ? 1 : limit, days, localMatches: matches.length }, providerRequestsBudgetApprox, processed, revalidated }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
