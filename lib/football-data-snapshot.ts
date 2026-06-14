import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { ensureStatsTable, normalizeStats } from '@/lib/live-match-stats';

const DETAILED_STAT_KEYS = [
  'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
] as const;

function hasDetailedStats(row: any) {
  if (!row) return false;
  return DETAILED_STAT_KEYS.some((key) => row[key] !== null && row[key] !== undefined);
}

function snapshotAgeMinutes(row: any) {
  if (!row?.capturedAt) return Number.POSITIVE_INFINITY;
  const capturedAt = new Date(row.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return Number.POSITIVE_INFINITY;
  return (Date.now() - capturedAt) / 60_000;
}

function safeScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(99, Math.floor(score))) : null;
}

function inferMinute(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'FINISHED' || value === 'FT') return 90;
  if (value === 'PAUSED' || value === 'HT') return 45;
  return null;
}

async function getLatestSnapshot(matchId: string) {
  await ensureStatsTable();
  const rows = await prisma.matchStatsSnapshot.findMany({
    where: { matchId },
    orderBy: { capturedAt: 'desc' },
    take: 1,
  });
  return rows[0] || null;
}

export async function saveFootballDataScoreSnapshot(params: {
  matchId: string;
  providerMatchId: number;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  rawData?: any;
  provider?: 'FOOTBALL_DATA' | 'FOOTBALL_DATA_FALLBACK';
  minIntervalMinutes?: number;
}) {
  if (!params.matchId) return { status: 'missing_match_id', snapshotId: null };
  const providerMatchId = Number(params.providerMatchId);
  if (!providerMatchId || !Number.isFinite(providerMatchId)) return { status: 'missing_provider_match_id', snapshotId: null };

  await ensureStatsTable();
  const latest = await getLatestSnapshot(params.matchId);
  if (hasDetailedStats(latest) && !String(latest.provider || '').startsWith('FOOTBALL_DATA')) {
    return { status: 'skipped_existing_detailed_snapshot', snapshotId: latest.id, provider: latest.provider };
  }

  const normalized = normalizeStats(params.rawData || {});
  const homeScore = safeScore(params.homeScore) ?? safeScore(normalized.homeScore);
  const awayScore = safeScore(params.awayScore) ?? safeScore(normalized.awayScore);
  const status = String(params.status || '').toUpperCase() || null;
  const minute = normalized.minute ?? inferMinute(status);
  const minIntervalMinutes = Math.max(0, Number(params.minIntervalMinutes ?? 60));
  const ageMinutes = snapshotAgeMinutes(latest);
  const latestRawStatus = String((latest?.rawData as any)?.status || (latest?.rawData as any)?.providerStatus || '').toUpperCase();
  const mappedDetailedStats = hasDetailedStats(normalized);
  const sameFallbackState = latest
    && String(latest.provider || '').startsWith('FOOTBALL_DATA')
    && safeScore(latest.homeScore) === homeScore
    && safeScore(latest.awayScore) === awayScore
    && (!status || latestRawStatus === status)
    && hasDetailedStats(latest) === mappedDetailedStats;

  if (sameFallbackState && ageMinutes < minIntervalMinutes) {
    return { status: 'skipped_recent_same_football_data_snapshot', snapshotId: latest.id, ageMinutes: Math.round(ageMinutes * 10) / 10, minIntervalMinutes, mappedDetailedStats };
  }

  const provider = params.provider || 'FOOTBALL_DATA';
  const rawData = {
    provider,
    status,
    note: mappedDetailedStats
      ? 'Football-Data snapshot includes only detailed statistics explicitly present in the provider payload.'
      : 'Football-Data score/status snapshot only. Detailed statistics remain null unless the provider payload supplies them.',
    ...(params.rawData || {}),
  };

  const row = await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId: params.matchId,
      provider,
      providerMatchId,
      minute,
      homePossession: normalized.homePossession,
      awayPossession: normalized.awayPossession,
      homeAttacks: normalized.homeAttacks,
      awayAttacks: normalized.awayAttacks,
      homeDangerousAttacks: normalized.homeDangerousAttacks,
      awayDangerousAttacks: normalized.awayDangerousAttacks,
      homeShots: normalized.homeShots,
      awayShots: normalized.awayShots,
      homeShotsOnTarget: normalized.homeShotsOnTarget,
      awayShotsOnTarget: normalized.awayShotsOnTarget,
      homeShotsOffTarget: normalized.homeShotsOffTarget,
      awayShotsOffTarget: normalized.awayShotsOffTarget,
      homeCorners: normalized.homeCorners,
      awayCorners: normalized.awayCorners,
      homeYellowCards: normalized.homeYellowCards,
      awayYellowCards: normalized.awayYellowCards,
      homeRedCards: normalized.homeRedCards,
      awayRedCards: normalized.awayRedCards,
      homeScore,
      awayScore,
      rawData,
    },
  });

  return { status: 'saved_football_data_score_snapshot', snapshotId: row.id, provider, hasDetailedStats: mappedDetailedStats };
}
