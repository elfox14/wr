import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WORLD_CUP_2026_GROUPS, type WorldCup2026GroupKey } from '@/lib/worldCup2026GroupConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TableRow = {
  team: string;
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

function normalizeGroupKey(value?: string | null): WorldCup2026GroupKey | null {
  const group = String(value || '').replace('Group', '').replace('GROUP_', '').replace('المجموعة', '').trim().toUpperCase();
  return group in WORLD_CUP_2026_GROUPS ? group as WorldCup2026GroupKey : null;
}

function normalizeCode(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function isFinished(status?: string | null) {
  const value = String(status || '').toUpperCase();
  return value === 'FINISHED' || value === 'FT';
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function groupForTeamCode(code?: string | null) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  for (const [group, data] of Object.entries(WORLD_CUP_2026_GROUPS) as [WorldCup2026GroupKey, typeof WORLD_CUP_2026_GROUPS[WorldCup2026GroupKey]][]) {
    if (data.teams.some((team) => team.codes.map(normalizeCode).includes(normalized))) return group;
  }

  return null;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      select: {
        id: true,
        status: true,
        groupPhase: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
      },
    });

    const groups = (Object.entries(WORLD_CUP_2026_GROUPS) as [WorldCup2026GroupKey, typeof WORLD_CUP_2026_GROUPS[WorldCup2026GroupKey]][]).map(([group, data]) => {
      const rows = data.teams.map<TableRow>((team) => ({
        team: team.name,
        code: team.codes[0],
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      }));

      const byCode = new Map<string, TableRow>();
      data.teams.forEach((team, index) => {
        team.codes.forEach((code) => byCode.set(normalizeCode(code), rows[index]));
      });

      let finishedMatches = 0;
      let liveMatches = 0;
      let scheduledMatches = 0;

      for (const match of matches) {
        const matchGroup = normalizeGroupKey(match.groupPhase) || groupForTeamCode(match.homeTeam?.code) || groupForTeamCode(match.awayTeam?.code);
        if (matchGroup !== group) continue;

        const status = String(match.status || '').toUpperCase();
        if (status === 'IN_PLAY' || status === 'LIVE' || status === 'HT') liveMatches += 1;
        if (status === 'SCHEDULED' || status === 'TIMED' || status === 'NOT_STARTED') scheduledMatches += 1;
        if (!isFinished(status)) continue;

        const home = byCode.get(normalizeCode(match.homeTeam?.code));
        const away = byCode.get(normalizeCode(match.awayTeam?.code));
        if (!home || !away) continue;

        finishedMatches += 1;
        const homeScore = safeNumber(match.homeScore);
        const awayScore = safeNumber(match.awayScore);

        home.played += 1;
        away.played += 1;
        home.goalsFor += homeScore;
        home.goalsAgainst += awayScore;
        away.goalsFor += awayScore;
        away.goalsAgainst += homeScore;

        if (homeScore > awayScore) {
          home.won += 1;
          away.lost += 1;
          home.points += 3;
        } else if (homeScore < awayScore) {
          away.won += 1;
          home.lost += 1;
          away.points += 3;
        } else {
          home.drawn += 1;
          away.drawn += 1;
          home.points += 1;
          away.points += 1;
        }
      }

      rows.forEach((row) => {
        row.goalDifference = row.goalsFor - row.goalsAgainst;
      });

      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team, 'ar');
      });

      return {
        key: group,
        arName: data.arName,
        finishedMatches,
        liveMatches,
        scheduledMatches,
        standings: rows,
      };
    });

    return NextResponse.json({ ok: true, groups }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('group standings endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
