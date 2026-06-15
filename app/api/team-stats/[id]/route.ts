import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findGroupAFbrefStats, toTeamFBRefStats as toGroupATeamFBRefStats } from '@/lib/groupAFbrefStats';
import { findGroupBFbrefStats, toTeamFBRefStats as toGroupBTeamFBRefStats } from '@/lib/groupBFbrefStats';
import { findGroupCFbrefStats, toTeamFBRefStats as toGroupCTeamFBRefStats } from '@/lib/groupCFbrefStats';
import { findGroupDFbrefStats, toTeamFBRefStats as toGroupDTeamFBRefStats } from '@/lib/groupDFbrefStats';
import { findGroupGHIFbrefStats, toTeamFBRefStats as toGroupGHITeamFBRefStats } from '@/lib/groupGHIFbrefStats';

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

type RouteContext = {
  params: Promise<{ id: string }>;
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

const unavailableStats: TeamFBRefStats = {
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
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const identifier = String(id || '').trim();

  const team = await prisma.asset.findFirst({
    where: {
      type: 'TEAM',
      OR: [
        { id: identifier },
        { code: identifier.toUpperCase() },
      ],
    },
    select: { id: true, code: true, name: true },
  });

  const lookupKey = team?.code || identifier;
  const fallbackKey = team?.name || identifier;
  const groupAStats = findGroupAFbrefStats(lookupKey) || findGroupAFbrefStats(fallbackKey);
  const groupBStats = groupAStats ? null : findGroupBFbrefStats(lookupKey) || findGroupBFbrefStats(fallbackKey);
  const groupCStats = groupAStats || groupBStats ? null : findGroupCFbrefStats(lookupKey) || findGroupCFbrefStats(fallbackKey);
  const groupDStats = groupAStats || groupBStats || groupCStats ? null : findGroupDFbrefStats(lookupKey) || findGroupDFbrefStats(fallbackKey);
  const groupGHIStats = groupAStats || groupBStats || groupCStats || groupDStats ? null : findGroupGHIFbrefStats(lookupKey) || findGroupGHIFbrefStats(fallbackKey);
  const response: TeamFBRefStats = groupAStats
    ? toGroupATeamFBRefStats(groupAStats)
    : groupBStats
      ? toGroupBTeamFBRefStats(groupBStats)
      : groupCStats
        ? toGroupCTeamFBRefStats(groupCStats)
        : groupDStats
          ? toGroupDTeamFBRefStats(groupDStats)
          : groupGHIStats
            ? toGroupGHITeamFBRefStats(groupGHIStats)
            : unavailableStats;

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
  });
}
