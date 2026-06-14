import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const FBREF_PROVIDERS = new Set(['FBREF_STATHEAD_IMPORT', 'FBREF_STATHEAD_SNAPSHOT']);
const FBREF_BROWSER_PROVIDERS = new Set(['FBREF_BROWSER_EXTRACT']);

type StandingMetrics = {
  group?: string | null;
  rank?: string | null;
  mp?: number | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  gf?: number | null;
  ga?: number | null;
  gd?: string | null;
  pts?: number | null;
};

type ShootingMetrics = {
  shots?: number | null;
  shotsOnTarget?: number | null;
  goals?: number | null;
  shotAccuracy?: number | null;
  activeShooters?: string[];
};

type GoalkeepingMetrics = {
  goalkeeper?: string | null;
  saves?: number | null;
  shotsOnTargetAgainst?: number | null;
  goalsAgainst?: number | null;
  savePercentage?: string | null;
};

type MiscMetrics = {
  yellowCards?: number | null;
  redCards?: number | null;
  fouls?: number | null;
  fouled?: number | null;
  interceptions?: number | null;
  tacklesWon?: number | null;
  crosses?: number | null;
};

type MatchContextMetrics = {
  completedCount?: number | null;
  upcomingCount?: number | null;
  formations?: string[];
  averagePossession?: number | null;
};

type RosterMetrics = {
  count?: number | null;
  averageAge?: number | null;
  topClubs?: string[];
};

type StandardMetrics = {
  usedPlayers?: number | null;
  scorers?: string[];
  assisters?: string[];
  minutesLeaders?: string[];
};

export type TeamFBRefStats = {
  available: boolean;
  exportedAt: string | null;
  sourceUrl: string | null;
  standing: StandingMetrics | null;
  shooting: ShootingMetrics | null;
  goalkeeping: GoalkeepingMetrics | null;
  misc: MiscMetrics | null;
  matchContext: MatchContextMetrics | null;
  roster: RosterMetrics | null;
  standard: StandardMetrics | null;
};

function safeJson<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null;
  return value as T;
}

async function findStatsReport(id: string) {
  const primary = await prisma.teamIntelligenceReport.findFirst({
    where: {
      teamId: id,
      provider: { in: Array.from(FBREF_PROVIDERS) },
    },
    orderBy: { publishedAt: 'desc' },
    select: { metrics: true, publishedAt: true, sourceUrl: true },
  });

  if (primary?.metrics) return primary;

  return prisma.teamIntelligenceReport.findFirst({
    where: {
      teamId: id,
      provider: { in: Array.from(FBREF_BROWSER_PROVIDERS) },
    },
    orderBy: { publishedAt: 'desc' },
    select: { metrics: true, publishedAt: true, sourceUrl: true },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const report = await findStatsReport(id);

    if (!report || !report.metrics) {
      return NextResponse.json({
        available: false,
        exportedAt: null,
        sourceUrl: null,
        standing: null,
        shooting: null,
        goalkeeping: null,
        misc: null,
        matchContext: null,
        roster: null,
        standard: null,
      } satisfies TeamFBRefStats, {
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
      });
    }

    const m = report.metrics as Record<string, unknown>;

    const result: TeamFBRefStats = {
      available: true,
      exportedAt: (m.exportedAt as string) || (m.importedAt as string) || report.publishedAt?.toISOString() || null,
      sourceUrl: (m.pageUrl as string) || report.sourceUrl || null,
      standing: safeJson<StandingMetrics>(m.standing),
      shooting: safeJson<ShootingMetrics>(m.shooting),
      goalkeeping: safeJson<GoalkeepingMetrics>(m.goalkeeping),
      misc: safeJson<MiscMetrics>(m.misc),
      matchContext: safeJson<MatchContextMetrics>(m.matchContext),
      roster: safeJson<RosterMetrics>(m.roster),
      standard: safeJson<StandardMetrics>(m.standard),
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('team-stats API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
