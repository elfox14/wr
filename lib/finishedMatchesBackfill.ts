import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras } from '@/lib/theStatsMatchExtras';
import { runLiveAnimationSync } from '@/lib/liveAnimationSync';

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];

export type FinishedMatchesBackfillOptions = {
  matchId?: string | null;
  limit?: number;
  lookbackDays?: number;
  freshnessHours?: number;
  timeoutMs?: number;
  force?: boolean;
  dryRun?: boolean;
  includeRaw?: boolean;
  stopOnRateLimit?: boolean;
  syncAnimation?: boolean;
  markVerified?: boolean;
};

type BackfillMatch = {
  id: string;
  externalId: string | null;
  matchDate: Date;
  status: string;
  homeScore: number;
  awayScore: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: any;
  awayTeam?: any;
};

function numberFrom(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value: unknown) {
  return normalizeText(value).split(' ').filter((word) => word.length > 1);
}

function similarity(a: unknown, b: unknown) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 88;
  const aw = new Set(words(aa));
  const bw = new Set(words(bb));
  if (!aw.size || !bw.size) return 0;
  const hits = Array.from(aw).filter((word) => bw.has(word)).length;
  return Math.round((hits / Math.max(aw.size, bw.size)) * 75);
}

function providerFixtureNumber(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  const number = Number(digits);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRateLimitResult(result: any) {
  return Boolean(result?.rateLimited) || JSON.stringify(result?.endpointsFailed || '').toLowerCase().includes('429');
}

function snapshotHasFullExtras(snapshot: any) {
  const raw = snapshot?.rawData || {};
  const normalized = raw.normalized || {};
  const counts = raw.counts || {};
  const shots = Array.isArray(normalized.shotmap) ? normalized.shotmap.length : Number(counts.shots || 0);
  const playerStats = Array.isArray(normalized.playerStats) ? normalized.playerStats.length : Number(counts.playerStats || 0);
  const lineups = normalized.lineups ? Number(counts.lineups || 1) : Number(counts.lineups || 0);
  const detailedEvents = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all.length : Number(counts.detailedEvents || 0);
  return shots > 0 || playerStats > 0 || lineups > 0 || detailedEvents > 0;
}

async function alreadyHasRecentFullExtras(matchId: string, freshnessHours: number) {
  const since = new Date(Date.now() - freshnessHours * 60 * 60 * 1000);
  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      matchId,
      provider: { startsWith: 'THE_STATS_API' },
      capturedAt: { gte: since },
    },
    orderBy: { capturedAt: 'desc' },
    take: 10,
    select: { rawData: true, capturedAt: true, provider: true },
  }).catch(() => []);

  return snapshots.some(snapshotHasFullExtras);
}

function teamIdFromProviderName(match: BackfillMatch, providerTeamName?: string | null) {
  if (!providerTeamName) return null;
  const homeScore = Math.max(similarity(providerTeamName, match.homeTeam?.name), similarity(providerTeamName, match.homeTeam?.code));
  const awayScore = Math.max(similarity(providerTeamName, match.awayTeam?.name), similarity(providerTeamName, match.awayTeam?.code));
  if (homeScore < 45 && awayScore < 45) return null;
  return homeScore >= awayScore ? match.homeTeamId : match.awayTeamId;
}

function normalizeEventType(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  if (/goal|هدف/.test(text)) return 'goal';
  if (/yellow|صفراء|انذار|إنذار/.test(text)) return 'yellow_card';
  if (/red|حمراء|طرد/.test(text)) return 'red_card';
  if (/sub|تبديل/.test(text)) return 'substitution';
  if (/shot|تسديدة|save|blocked|on target/.test(text)) return 'shot';
  if (/corner|ركنية/.test(text)) return 'corner';
  if (/penalty|جزاء/.test(text)) return 'penalty';
  if (/var/.test(text)) return 'var';
  if (/foul|خطأ/.test(text)) return 'foul';
  if (/offside|تسلل/.test(text)) return 'offside';
  return type || 'note';
}

function eventDetail(event: any) {
  const label = event?.detail || event?.type || 'حدث';
  const player = event?.playerName ? ` - ${event.playerName}` : '';
  return `${label}${player}`.trim();
}

async function saveFinalEvents(match: BackfillMatch, normalized: any, dryRun: boolean) {
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shotmap = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const compactEvents = [
    ...events.map((event: any) => ({
      minute: nullableNumber(event.minute),
      type: normalizeEventType(event.type, event.detail),
      teamId: teamIdFromProviderName(match, event.teamName),
      playerId: event.playerId ? String(event.playerId) : null,
      playerName: event.playerName || null,
      detail: eventDetail(event),
      sourceName: 'THE_STATS_API_FINAL_TIMELINE',
    })),
    ...shotmap.map((shot: any) => ({
      minute: nullableNumber(shot.minute),
      type: shot.isGoal ? 'goal' : 'shot',
      teamId: teamIdFromProviderName(match, shot.teamName),
      playerId: null,
      playerName: shot.playerName || null,
      detail: `${shot.isGoal ? 'هدف' : 'تسديدة'}${shot.xg !== null && shot.xg !== undefined ? ` | xG ${shot.xg}` : ''}${shot.outcome ? ` | ${shot.outcome}` : ''}`,
      sourceName: 'THE_STATS_API_FINAL_SHOTMAP',
    })),
  ].filter((event) => event.minute !== null || event.type !== 'note');

  let inserted = 0;
  let skipped = 0;

  for (const event of compactEvents) {
    const existing = await prisma.matchEvent.findFirst({
      where: {
        matchId: match.id,
        minute: event.minute,
        type: event.type,
        teamId: event.teamId,
        playerName: event.playerName,
        sourceName: event.sourceName,
      },
      select: { id: true },
    }).catch(() => null);

    if (existing) {
      skipped += 1;
      continue;
    }

    inserted += 1;
    if (!dryRun) {
      await prisma.matchEvent.create({
        data: {
          id: randomUUID(),
          matchId: match.id,
          minute: event.minute,
          type: event.type,
          teamId: event.teamId,
          playerId: event.playerId,
          playerName: event.playerName,
          detail: event.detail || event.type,
          sourceName: event.sourceName,
          sourceUrl: null,
        },
      });
    }
  }

  return { input: compactEvents.length, inserted, skipped };
}

function internalRating(player: any) {
  if (player.rating !== null && player.rating !== undefined) return Math.max(0, Math.min(100, Number(player.rating) * 10));
  const minutes = safeNumber(player.minutes, 0);
  const goals = safeNumber(player.goals, 0);
  const assists = safeNumber(player.assists, 0);
  const shotsOnTarget = safeNumber(player.shotsOnTarget, 0);
  const keyPasses = safeNumber(player.keyPasses, 0);
  const tackles = safeNumber(player.tackles, 0);
  const saves = safeNumber(player.saves, 0);
  return Math.max(0, Math.min(100, 50 + goals * 12 + assists * 8 + shotsOnTarget * 2 + keyPasses * 1.5 + tackles * 1.2 + saves * 1.5 + Math.min(minutes, 90) / 9));
}

async function savePlayerPerformances(match: BackfillMatch, normalized: any, fixtureId: number | null, dryRun: boolean) {
  if (!fixtureId) return { input: 0, upserted: 0, skipped: 0, unmatched: [] as any[] };
  const playerStats = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  if (!playerStats.length) return { input: 0, upserted: 0, skipped: 0, unmatched: [] as any[] };

  const playerAssets = await prisma.asset.findMany({
    where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { id: true, name: true, teamId: true, position: true },
  });

  let upserted = 0;
  let skipped = 0;
  const unmatched: any[] = [];

  for (const stat of playerStats) {
    const teamId = teamIdFromProviderName(match, stat.teamName);
    const candidates = playerAssets
      .filter((asset) => !teamId || asset.teamId === teamId)
      .map((asset) => ({ asset, score: similarity(stat.playerName, asset.name) }))
      .sort((a, b) => b.score - a.score);
    const selected = candidates[0];

    if (!selected || selected.score < 65) {
      skipped += 1;
      unmatched.push({ playerName: stat.playerName, teamName: stat.teamName, bestScore: selected?.score || 0 });
      continue;
    }

    upserted += 1;
    if (!dryRun) {
      const rating = internalRating(stat);
      await prisma.playerPerformance.upsert({
        where: { assetId_providerFixtureId: { assetId: selected.asset.id, providerFixtureId: fixtureId } },
        create: {
          assetId: selected.asset.id,
          provider: 'THE_STATS_API_FINAL',
          providerPlayerId: providerFixtureNumber(stat.playerId),
          providerFixtureId: fixtureId,
          competition: 'FIFA World Cup',
          teamName: stat.teamName || null,
          opponentName: selected.asset.teamId === match.homeTeamId ? match.awayTeam?.name : match.homeTeam?.name,
          minutes: safeNumber(stat.minutes, 0),
          started: safeNumber(stat.minutes, 0) >= 45,
          goals: safeNumber(stat.goals, 0),
          assists: safeNumber(stat.assists, 0),
          shotsTotal: safeNumber(stat.shots, 0),
          shotsOnTarget: safeNumber(stat.shotsOnTarget, 0),
          passes: safeNumber(stat.passes, 0),
          keyPasses: safeNumber(stat.keyPasses, 0),
          passAccuracy: 0,
          tackles: safeNumber(stat.tackles, 0),
          interceptions: safeNumber(stat.interceptions, 0),
          saves: safeNumber(stat.saves, 0),
          yellowCards: 0,
          redCards: 0,
          apiRating: stat.rating ?? null,
          internalRating: rating,
          momentumImpact: Math.round((rating - 50) * 10) / 10,
          marketImpact: Math.round((rating - 50) * 6) / 10,
          rawData: stat,
          matchDate: match.matchDate,
        },
        update: {
          provider: 'THE_STATS_API_FINAL',
          providerPlayerId: providerFixtureNumber(stat.playerId),
          competition: 'FIFA World Cup',
          teamName: stat.teamName || null,
          opponentName: selected.asset.teamId === match.homeTeamId ? match.awayTeam?.name : match.homeTeam?.name,
          minutes: safeNumber(stat.minutes, 0),
          started: safeNumber(stat.minutes, 0) >= 45,
          goals: safeNumber(stat.goals, 0),
          assists: safeNumber(stat.assists, 0),
          shotsTotal: safeNumber(stat.shots, 0),
          shotsOnTarget: safeNumber(stat.shotsOnTarget, 0),
          passes: safeNumber(stat.passes, 0),
          keyPasses: safeNumber(stat.keyPasses, 0),
          tackles: safeNumber(stat.tackles, 0),
          interceptions: safeNumber(stat.interceptions, 0),
          saves: safeNumber(stat.saves, 0),
          apiRating: stat.rating ?? null,
          internalRating: rating,
          momentumImpact: Math.round((rating - 50) * 10) / 10,
          marketImpact: Math.round((rating - 50) * 6) / 10,
          rawData: stat,
          matchDate: match.matchDate,
        },
      });
      await prisma.asset.update({
        where: { id: selected.asset.id },
        data: { lastPerformanceRating: rating, lastPerformanceSyncAt: new Date() },
      }).catch(() => null);
    }
  }

  return { input: playerStats.length, upserted, skipped, unmatched: unmatched.slice(0, 12) };
}

async function saveQualitySnapshot(match: BackfillMatch, fixtureId: number | null, result: any, projections: any, dryRun: boolean) {
  const counts = result?.counts || {};
  const dataQuality = counts.playerStats || counts.lineups || counts.shots || counts.detailedEvents ? (counts.playerStats && counts.lineups ? 'complete' : 'partial') : 'missing';
  if (dryRun) return { dataQuality, saved: false };

  await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId: match.id,
      provider: 'FINISHED_MATCHES_BACKFILL_SUMMARY',
      providerMatchId: fixtureId || providerFixtureNumber(match.externalId) || 0,
      minute: null,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      rawData: {
        mode: 'finished_matches_backfill_summary_v1',
        importedAt: new Date().toISOString(),
        dataQuality,
        counts,
        projections,
        resolvedProviderMatchId: result?.resolvedProviderMatchId || null,
        endpointsOk: result?.endpointsOk || [],
        endpointsFailed: result?.endpointsFailed || [],
      },
    },
  });

  return { dataQuality, saved: true };
}

async function processMatch(match: BackfillMatch, options: Required<Omit<FinishedMatchesBackfillOptions, 'matchId'>>) {
  if (match.status === 'FINAL_VERIFIED' && !options.force) {
    return { matchId: match.id, title: `${match.homeTeam?.name} ضد ${match.awayTeam?.name}`, skipped: true, reason: 'already_final_verified' };
  }

  if (!options.force) {
    const hasRecent = await alreadyHasRecentFullExtras(match.id, options.freshnessHours);
    if (hasRecent) return { matchId: match.id, title: `${match.homeTeam?.name} ضد ${match.awayTeam?.name}`, skipped: true, reason: 'recent_full_the_stats_snapshot_exists' };
  }

  const result = await collectTheStatsMatchExtras(match, {
    dryRun: options.dryRun,
    save: !options.dryRun,
    includeRaw: options.includeRaw,
    endpointMode: 'full',
    timeoutMs: options.timeoutMs,
  });

  const normalized = result?.debug?.normalizedPreview || {};
  const fixtureId = providerFixtureNumber(result?.resolvedProviderMatchId);
  const eventsProjection = await saveFinalEvents(match, normalized, options.dryRun);
  const playersProjection = await savePlayerPerformances(match, normalized, fixtureId, options.dryRun);
  const quality = await saveQualitySnapshot(match, fixtureId, result, { events: eventsProjection, players: playersProjection }, options.dryRun);

  let animationSync: any = null;
  if (options.syncAnimation && !options.dryRun) {
    animationSync = await runLiveAnimationSync({ matchId: match.id, allowFinished: true, dryRun: false, limit: 1 });
  }

  if (options.markVerified && !options.dryRun && result.ok && quality.dataQuality !== 'missing') {
    await prisma.match.update({ where: { id: match.id }, data: { status: 'FINAL_VERIFIED' } });
  }

  return {
    matchId: match.id,
    title: `${match.homeTeam?.name} ضد ${match.awayTeam?.name}`,
    ok: result.ok,
    savedSnapshot: result.saved,
    snapshotId: result.snapshotId,
    rateLimited: result.rateLimited,
    endpointsOk: result.endpointsOk,
    endpointsFailed: result.endpointsFailed,
    counts: result.counts,
    quality,
    projections: { events: eventsProjection, players: playersProjection },
    animationSync: animationSync ? { ok: animationSync.ok, results: animationSync.results } : null,
    markedFinalVerified: Boolean(options.markVerified && !options.dryRun && result.ok && quality.dataQuality !== 'missing'),
  };
}

export async function runFinishedMatchesBackfill(options: FinishedMatchesBackfillOptions = {}) {
  const limit = numberFrom(options.limit, 5, 1, 20);
  const lookbackDays = numberFrom(options.lookbackDays, 14, 1, 120);
  const freshnessHours = numberFrom(options.freshnessHours, 24, 1, 720);
  const timeoutMs = numberFrom(options.timeoutMs, 30000, 3000, 60000);
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);
  const includeRaw = Boolean(options.includeRaw);
  const stopOnRateLimit = options.stopOnRateLimit !== false;
  const syncAnimation = options.syncAnimation !== false;
  const markVerified = options.markVerified !== false;

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: options.matchId
      ? { id: String(options.matchId) }
      : {
          matchDate: { gte: since, lte: new Date() },
          status: { in: FINISHED_STATUSES },
        },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'desc' },
    take: options.matchId ? 1 : limit * 3,
  }) as BackfillMatch[];

  const processed: any[] = [];
  let stoppedEarly: string | null = null;

  for (const match of matches) {
    if (processed.filter((item) => !item.skipped).length >= limit) break;
    if (stoppedEarly) break;

    try {
      const result = await processMatch(match, { limit, lookbackDays, freshnessHours, timeoutMs, force, dryRun, includeRaw, stopOnRateLimit, syncAnimation, markVerified });
      processed.push(result);
      if (stopOnRateLimit && isRateLimitResult(result)) stoppedEarly = 'rate_limited';
    } catch (error: any) {
      const message = String(error?.message || error);
      const rateLimited = message.includes('429') || message.toLowerCase().includes('rate limit');
      processed.push({ matchId: match.id, ok: false, rateLimited, error: message });
      if (stopOnRateLimit && rateLimited) stoppedEarly = 'rate_limited_exception';
    }
  }

  return {
    ok: true,
    mode: 'finished_matches_backfill_worker_v1',
    sourcePriority: ['TheStats final extras', 'saved timeline fallback', 'live animation sync from DB'],
    limit,
    lookbackDays,
    freshnessHours,
    timeoutMs,
    force,
    dryRun,
    includeRaw,
    stopOnRateLimit,
    syncAnimation,
    markVerified,
    candidates: matches.length,
    processed,
    stoppedEarly,
    note: 'This worker fetches final match data server-side, saves database snapshots/events/player performances, and public pages continue to read DB only.',
  };
}
