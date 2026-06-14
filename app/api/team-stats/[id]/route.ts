import { NextResponse } from 'next/server';

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

export async function GET() {
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
