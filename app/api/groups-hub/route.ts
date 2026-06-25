import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const GROUPS = 'ABCDEFGHIJKL'.split('');
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const LIVE = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET', 'BT', 'P'];
const SCHEDULED = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function norm(value?: string | null) {
  return String(value || '').toUpperCase();
}

function groupLabel(group: string) {
  return [group, `Group ${group}`, `GROUP ${group}`, `GROUP_${group}`, `المجموعة ${group}`];
}

function groupWhere(group: string) {
  const labels = groupLabel(group);
  return {
    OR: [
      { homeTeam: { group } },
      { awayTeam: { group } },
      { groupPhase: { in: labels } },
      { stage: { in: labels } },
    ],
  };
}

function groupKeyOf(teamGroup?: string | null, fallback?: string | null) {
  const raw = String(teamGroup || fallback || '').replace('Group', '').replace('GROUP_', '').replace('المجموعة', '').trim().toUpperCase();
  return GROUPS.includes(raw) ? raw : null;
}

function isFinished(status?: string | null) {
  return FINISHED.includes(norm(status));
}

function isLive(status?: string | null) {
  return LIVE.includes(norm(status));
}

function statusLabel(status?: string | null) {
  if (isFinished(status)) return 'انتهت';
  if (isLive(status)) return 'مباشر';
  if (SCHEDULED.includes(norm(status))) return 'قادمة';
  return status || 'مباراة';
}

function initStanding(team: any) {
  return { teamId: team.id, name: team.name, code: team.code, image: team.image, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

function matchKey(match: any) {
  return [match.homeTeamId, match.awayTeamId].sort().join('|');
}

function dedupe(matches: any[]) {
  const map = new Map<string, any>();
  for (const match of matches) {
    const key = matchKey(match);
    const old = map.get(key);
    if (!old || new Date(match.matchDate).getTime() < new Date(old.matchDate).getTime()) map.set(key, match);
  }
  return [...map.values()].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
}

function buildStandings(teams: any[], matches: any[]) {
  const rows = teams.map(initStanding);
  const byId = new Map(rows.map((row) => [row.teamId, row]));
  for (const match of dedupe(matches).filter((item) => isFinished(item.status))) {
    const home = byId.get(match.homeTeamId);
    const away = byId.get(match.awayTeamId);
    if (!home || !away) continue;
    const hs = Number(match.homeScore || 0);
    const as = Number(match.awayScore || 0);
    home.played += 1;
    away.played += 1;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;
    if (hs > as) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (hs < as) {
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
  for (const row of rows) row.goalDifference = row.goalsFor - row.goalsAgainst;
  return rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name));
}

function publicMatch(match: any) {
  return {
    id: match.id,
    href: `/match-center/${match.id}`,
    liveHref: `/live-animation/${match.id}`,
    matchDate: match.matchDate,
    status: match.status,
    statusLabel: statusLabel(match.status),
    isFinished: isFinished(match.status),
    isLive: isLive(match.status),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    hasLiveAnimation: Boolean(match.animationMatchId || match._count?.events),
    hasStats: Boolean(match._count?.statsSnapshots),
  };
}

export async function GET() {
  try {
    const [teams, matches] = await Promise.all([
      prisma.asset.findMany({
        where: { type: 'TEAM', group: { in: GROUPS } },
        select: { id: true, name: true, code: true, image: true, group: true, fifaRank: true, score: true },
        orderBy: [{ group: 'asc' }, { fifaRank: 'asc' }],
      }),
      prisma.match.findMany({
        where: { OR: GROUPS.flatMap((group) => groupWhere(group).OR) },
        select: {
          id: true,
          matchDate: true,
          status: true,
          homeScore: true,
          awayScore: true,
          homeTeamId: true,
          awayTeamId: true,
          groupPhase: true,
          stage: true,
          animationMatchId: true,
          homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
          awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
          _count: { select: { events: true, statsSnapshots: true } },
        },
        orderBy: { matchDate: 'asc' },
        take: 180,
      }),
    ]);

    const groups = GROUPS.map((group) => {
      const groupTeams = teams.filter((team) => groupKeyOf(team.group) === group);
      const ids = new Set(groupTeams.map((team) => team.id));
      const groupMatches = dedupe(matches.filter((match) => ids.has(match.homeTeamId) || ids.has(match.awayTeamId) || groupKeyOf(match.groupPhase, match.stage) === group));
      const results = groupMatches.filter((match) => isFinished(match.status)).slice().sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()).map(publicMatch);
      const upcoming = groupMatches.filter((match) => !isFinished(match.status)).slice(0, 6).map(publicMatch);
      const standings = buildStandings(groupTeams, groupMatches);
      const totalGoals = results.reduce((sum, match: any) => sum + Number(match.homeScore || 0) + Number(match.awayScore || 0), 0);
      return {
        key: group,
        name: `المجموعة ${group}`,
        teams: groupTeams,
        standings,
        results,
        upcoming,
        stats: {
          teams: groupTeams.length,
          matches: groupMatches.length,
          finished: results.length,
          live: groupMatches.filter((match) => isLive(match.status)).length,
          upcoming: upcoming.length,
          goals: totalGoals,
        },
      };
    });

    const thirdPlace = groups
      .map((group) => group.standings[2] ? { ...group.standings[2], groupKey: group.key } : null)
      .filter(Boolean)
      .sort((a: any, b: any) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
      .slice(0, 8);

    return NextResponse.json({ ok: true, mode: 'groups_hub_v1', groups, thirdPlace }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('groups hub error', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
