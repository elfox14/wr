import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { ensureStatsTable } from '@/lib/live-match-stats';

const DETAILED_STAT_KEYS = [
  'homePossession',
  'awayPossession',
  'homeAttacks',
  'awayAttacks',
  'homeDangerousAttacks',
  'awayDangerousAttacks',
  'homeShots',
  'awayShots',
  'homeShotsOnTarget',
  'awayShotsOnTarget',
  'homeShotsOffTarget',
  'awayShotsOffTarget',
  'homeCorners',
  'awayCorners',
  'homeYellowCards',
  'awayYellowCards',
  'homeRedCards',
  'awayRedCards',
];

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

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
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "MatchStatsSnapshot"
    WHERE "matchId" = ${quoteSql(matchId)}
    ORDER BY "capturedAt" DESC
    LIMIT 1
  `);
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
  const latestHasDetailedStats = hasDetailedStats(latest);

  if (latestHasDetailedStats && !String(latest.provider || '').startsWith('FOOTBALL_DATA')) {
    return { status: 'skipped_existing_detailed_snapshot', snapshotId: latest.id, provider: latest.provider };
  }

  const homeScore = safeScore(params.homeScore);
  const awayScore = safeScore(params.awayScore);
  const status = String(params.status || '').toUpperCase() || null;
  const minIntervalMinutes = Math.max(0, Number(params.minIntervalMinutes ?? 60));
  const ageMinutes = snapshotAgeMinutes(latest);
  const latestRawStatus = String(latest?.rawData?.status || latest?.rawData?.providerStatus || '').toUpperCase();
  const sameFallbackState = latest
    && String(latest.provider || '').startsWith('FOOTBALL_DATA')
    && safeScore(latest.homeScore) === homeScore
    && safeScore(latest.awayScore) === awayScore
    && (!status || latestRawStatus === status);

  if (sameFallbackState && ageMinutes < minIntervalMinutes) {
    return {
      status: 'skipped_recent_same_football_data_snapshot',
      snapshotId: latest.id,
      ageMinutes: Math.round(ageMinutes * 10) / 10,
      minIntervalMinutes,
    };
  }

  const id = randomUUID();
  const provider = params.provider || 'FOOTBALL_DATA';
  const rawData = {
    provider,
    status,
    note: 'Football-Data score/status snapshot only. Detailed statistics remain null unless a provider supplies them.',
    ...(params.rawData || {}),
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO "MatchStatsSnapshot" (
      "id", "matchId", "provider", "providerMatchId", "minute",
      "homePossession", "awayPossession", "homeAttacks", "awayAttacks",
      "homeDangerousAttacks", "awayDangerousAttacks", "homeShots", "awayShots",
      "homeShotsOnTarget", "awayShotsOnTarget", "homeShotsOffTarget", "awayShotsOffTarget",
      "homeCorners", "awayCorners", "homeYellowCards", "awayYellowCards", "homeRedCards", "awayRedCards",
      "homeScore", "awayScore", "rawData"
    ) VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$6,$7,$8::jsonb)`,
    id,
    params.matchId,
    provider,
    providerMatchId,
    inferMinute(status),
    homeScore,
    awayScore,
    JSON.stringify(rawData),
  );

  return { status: 'saved_football_data_score_snapshot', snapshotId: id, provider, hasDetailedStats: false };
}
