import prisma from '@/lib/prisma';

type MatchForPlayerSync = {
  id: string;
  matchDate: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: { id?: string; name?: string | null; code?: string | null } | null;
  awayTeam?: { id?: string; name?: string | null; code?: string | null } | null;
};

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
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

function safeNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableRating(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerFixtureNumber(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  const number = Number(digits);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function teamIdFromProviderName(match: MatchForPlayerSync, providerTeamName?: string | null) {
  if (!providerTeamName) return null;
  const homeScore = Math.max(similarity(providerTeamName, match.homeTeam?.name), similarity(providerTeamName, match.homeTeam?.code));
  const awayScore = Math.max(similarity(providerTeamName, match.awayTeam?.name), similarity(providerTeamName, match.awayTeam?.code));
  if (homeScore < 45 && awayScore < 45) return null;
  return homeScore >= awayScore ? match.homeTeamId : match.awayTeamId;
}

function internalRating(player: any) {
  const rating = nullableRating(player.rating);
  if (rating !== null) return Math.max(0, Math.min(100, rating * 10));
  const minutes = safeNumber(player.minutes, 0);
  const goals = safeNumber(player.goals, 0);
  const assists = safeNumber(player.assists, 0);
  const shotsOnTarget = safeNumber(player.shotsOnTarget, 0);
  const keyPasses = safeNumber(player.keyPasses, 0);
  const tackles = safeNumber(player.tackles, 0);
  const saves = safeNumber(player.saves, 0);
  return Math.max(0, Math.min(100, 50 + goals * 12 + assists * 8 + shotsOnTarget * 2 + keyPasses * 1.5 + tackles * 1.2 + saves * 1.5 + Math.min(minutes, 90) / 9));
}

export async function syncTheStatsPlayerPerformances(options: {
  match: MatchForPlayerSync;
  normalized: any;
  providerMatchId: unknown;
  dryRun?: boolean;
}) {
  const { match, normalized, providerMatchId, dryRun = false } = options;
  const fixtureId = providerFixtureNumber(providerMatchId);
  if (!fixtureId) return { input: 0, upserted: 0, skipped: 0, reason: 'missing_provider_fixture_id', unmatched: [] as any[] };

  const playerStats = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  if (!playerStats.length) return { input: 0, upserted: 0, skipped: 0, reason: 'missing_player_stats', unmatched: [] as any[] };

  const playerAssets = await prisma.asset.findMany({
    where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { id: true, name: true, teamId: true, position: true },
  });

  let upserted = 0;
  let skipped = 0;
  const unmatched: any[] = [];

  for (const stat of playerStats) {
    const teamId = stat.teamId && [match.homeTeamId, match.awayTeamId].includes(String(stat.teamId))
      ? String(stat.teamId)
      : teamIdFromProviderName(match, stat.teamName);
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
    if (dryRun) continue;

    const rating = internalRating(stat);
    const apiRating = nullableRating(stat.rating);
    const payload = {
      provider: 'THE_STATS_API_EXTRAS',
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
      passAccuracy: safeNumber(stat.passAccuracy, 0),
      tackles: safeNumber(stat.tackles, 0),
      interceptions: safeNumber(stat.interceptions, 0),
      saves: safeNumber(stat.saves, 0),
      goalsConceded: safeNumber(stat.goalsConceded, 0),
      yellowCards: safeNumber(stat.yellowCards, 0),
      redCards: safeNumber(stat.redCards, 0),
      apiRating,
      internalRating: rating,
      momentumImpact: Math.round((rating - 50) * 10) / 10,
      marketImpact: Math.round((rating - 50) * 6) / 10,
      rawData: stat,
      matchDate: match.matchDate,
    };

    await prisma.playerPerformance.upsert({
      where: { assetId_providerFixtureId: { assetId: selected.asset.id, providerFixtureId: fixtureId } },
      create: { assetId: selected.asset.id, ...payload },
      update: payload,
    });
    await prisma.asset.update({
      where: { id: selected.asset.id },
      data: { lastPerformanceRating: rating, lastPerformanceSyncAt: new Date() },
    }).catch(() => null);
  }

  return { input: playerStats.length, upserted, skipped, unmatched: unmatched.slice(0, 12) };
}
