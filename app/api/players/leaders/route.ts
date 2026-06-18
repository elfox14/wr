import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LeaderMetric = 'goals' | 'assists';

type PublicTeam = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
} | null;

type LeaderRow = {
  player: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    teamId: string | null;
    team: PublicTeam;
  };
  value: number;
  sourceName?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
  sourceCount?: number;
};

type GoalLeaderRow = {
  key: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
  value: number;
  sourceName: string;
  sourceUrl: string | null;
  source: string;
  sourceCount: number;
  examples: string[];
};

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function topLeader(rows: any[], metric: LeaderMetric): LeaderRow | null {
  const map = new Map<string, LeaderRow>();

  rows.forEach((row) => {
    if (!row?.asset?.id) return;
    const value = Number(row?.[metric] || 0);
    if (!Number.isFinite(value) || value <= 0) return;

    const current = map.get(row.asset.id) || { player: row.asset, value: 0, sourceName: 'PlayerPerformance', source: 'database_player_performance' };
    current.value += value;
    map.set(row.asset.id, current);
  });

  return Array.from(map.values()).sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'ar'))[0] || null;
}

function publicLeader(row: LeaderRow | null) {
  if (!row) return null;
  return {
    id: row.player.id,
    name: row.player.name,
    code: row.player.code,
    image: row.player.image,
    teamId: row.player.teamId,
    team: row.player.team,
    value: row.value,
    sourceName: row.sourceName || null,
    sourceUrl: row.sourceUrl || null,
    source: row.source || null,
    sourceCount: row.sourceCount || null,
  };
}

function scorerName(goal: any) {
  return String(goal?.scorer?.name || goal?.player?.name || goal?.playerName || goal?.name || '').trim();
}

function isOwnGoal(goal: any) {
  const value = String(goal?.type || goal?.detail || '').toLowerCase();
  return value.includes('own');
}

function goalTeamName(goal: any, rawData?: any) {
  const direct = goal?.team?.name || goal?.teamName || goal?.team_name || null;
  if (direct) return String(direct);
  const teamId = Number(goal?.team?.id || goal?.teamId || goal?.team_id);
  const homeProviderId = Number(rawData?.teams?.home?.provider?.id || rawData?.homeTeam?.id);
  const awayProviderId = Number(rawData?.teams?.away?.provider?.id || rawData?.awayTeam?.id);
  if (teamId && homeProviderId && teamId === homeProviderId) return rawData?.teams?.home?.localName || rawData?.teams?.home?.provider?.name || null;
  if (teamId && awayProviderId && teamId === awayProviderId) return rawData?.teams?.away?.localName || rawData?.teams?.away?.provider?.name || null;
  return null;
}

function goalTeamId(goal: any, rawData?: any) {
  const teamId = Number(goal?.team?.id || goal?.teamId || goal?.team_id);
  const homeProviderId = Number(rawData?.teams?.home?.provider?.id || rawData?.homeTeam?.id);
  const awayProviderId = Number(rawData?.teams?.away?.provider?.id || rawData?.awayTeam?.id);
  if (teamId && homeProviderId && teamId === homeProviderId) return rawData?.teams?.home?.localId || null;
  if (teamId && awayProviderId && teamId === awayProviderId) return rawData?.teams?.away?.localId || null;
  return null;
}

function addGoal(map: Map<string, GoalLeaderRow>, params: {
  name: string;
  teamId?: string | null;
  teamName?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  source: string;
  example: string;
}) {
  const name = params.name.trim();
  if (!name) return;
  const key = `${normalizeText(name)}|${params.teamId || normalizeText(params.teamName) || 'unknown-team'}`;
  const current = map.get(key) || {
    key,
    name,
    teamId: params.teamId || null,
    teamName: params.teamName || null,
    value: 0,
    sourceName: params.sourceName,
    sourceUrl: params.sourceUrl || null,
    source: params.source,
    sourceCount: 0,
    examples: [],
  };
  current.value += 1;
  current.sourceCount += 1;
  if (!current.teamId && params.teamId) current.teamId = params.teamId;
  if (!current.teamName && params.teamName) current.teamName = params.teamName;
  if (current.examples.length < 5) current.examples.push(params.example);
  map.set(key, current);
}

async function buildFootballDataGoalLeaders() {
  const byPlayer = new Map<string, GoalLeaderRow>();
  const latestSnapshots = await prisma.matchStatsSnapshot.findMany({
    where: { provider: 'FOOTBALL_DATA_FULL' },
    select: { matchId: true, rawData: true, capturedAt: true },
    orderBy: { capturedAt: 'desc' },
    take: 400,
  });

  const seenSnapshotMatches = new Set<string>();
  const matchesWithRawGoals = new Set<string>();

  for (const snapshot of latestSnapshots) {
    if (seenSnapshotMatches.has(snapshot.matchId)) continue;
    seenSnapshotMatches.add(snapshot.matchId);
    const rawData = snapshot.rawData as any;
    const goals = Array.isArray(rawData?.goals) ? rawData.goals : [];
    if (!goals.length) continue;
    matchesWithRawGoals.add(snapshot.matchId);

    for (const goal of goals) {
      if (isOwnGoal(goal)) continue;
      const name = scorerName(goal);
      if (!name) continue;
      addGoal(byPlayer, {
        name,
        teamId: goalTeamId(goal, rawData),
        teamName: goalTeamName(goal, rawData),
        sourceName: 'FOOTBALL_DATA_FULL',
        sourceUrl: 'https://www.football-data.org/',
        source: 'MatchStatsSnapshot.rawData.goals',
        example: `${snapshot.matchId}:${goal?.minute || ''}:${name}`,
      });
    }
  }

  const events = await prisma.matchEvent.findMany({
    where: {
      type: { in: ['goal', 'penalty_goal', 'penalty_scored'] },
      playerName: { not: null },
      matchId: { notIn: Array.from(matchesWithRawGoals) },
    },
    select: {
      matchId: true,
      minute: true,
      type: true,
      teamId: true,
      playerName: true,
      sourceName: true,
      sourceUrl: true,
    },
    orderBy: [{ matchId: 'asc' }, { minute: 'asc' }],
    take: 500,
  });

  const eventTeamIds = Array.from(new Set(events.map((event) => event.teamId).filter(Boolean) as string[]));
  const teams = eventTeamIds.length
    ? await prisma.asset.findMany({ where: { id: { in: eventTeamIds } }, select: { id: true, name: true, code: true, image: true } })
    : [];
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const seenEvents = new Set<string>();

  for (const event of events) {
    const name = String(event.playerName || '').trim();
    if (!name) continue;
    const duplicateKey = `${event.matchId}:${event.minute || ''}:${normalizeText(event.type)}:${normalizeText(name)}`;
    if (seenEvents.has(duplicateKey)) continue;
    seenEvents.add(duplicateKey);
    const team = event.teamId ? teamMap.get(event.teamId) : null;
    addGoal(byPlayer, {
      name,
      teamId: event.teamId || null,
      teamName: team?.name || null,
      sourceName: event.sourceName || 'MatchEvent',
      sourceUrl: event.sourceUrl || null,
      source: 'MatchEvent.goal_events',
      example: duplicateKey,
    });
  }

  const leaders = Array.from(byPlayer.values()).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ar'));
  const top = leaders[0] || null;
  if (!top) return null;

  const playerAssets = await prisma.asset.findMany({
    where: { type: 'PLAYER' },
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      teamId: true,
      team: { select: { id: true, name: true, code: true, image: true } },
    },
    take: 2500,
  });
  const normalizedTopName = normalizeText(top.name);
  const matchedAsset = playerAssets.find((asset) => normalizeText(asset.name) === normalizedTopName)
    || playerAssets.find((asset) => normalizeText(asset.name).includes(normalizedTopName) || normalizedTopName.includes(normalizeText(asset.name)));

  const team = matchedAsset?.team || (top.teamId ? await prisma.asset.findFirst({ where: { id: top.teamId }, select: { id: true, name: true, code: true, image: true } }) : null);

  return {
    player: matchedAsset || {
      id: `provider-scorer:${top.key}`,
      name: top.name,
      code: null,
      image: null,
      teamId: top.teamId,
      team,
    },
    value: top.value,
    sourceName: top.sourceName,
    sourceUrl: top.sourceUrl,
    source: top.source,
    sourceCount: top.sourceCount,
  } as LeaderRow;
}

export async function GET() {
  try {
    const [performanceRows, footballDataTopScorer] = await Promise.all([
      prisma.playerPerformance.findMany({
        where: { OR: [{ goals: { gt: 0 } }, { assists: { gt: 0 } }] },
        select: {
          goals: true,
          assists: true,
          asset: {
            select: {
              id: true,
              name: true,
              code: true,
              image: true,
              teamId: true,
              team: { select: { id: true, name: true, code: true, image: true } },
            },
          },
        },
      }),
      buildFootballDataGoalLeaders(),
    ]);

    const performanceTopScorer = topLeader(performanceRows, 'goals');
    const topAssister = topLeader(performanceRows, 'assists');
    const topScorer = footballDataTopScorer || performanceTopScorer;

    return NextResponse.json({
      ok: true,
      source: footballDataTopScorer ? 'football_data_full_goals_events' : 'database_player_performance',
      refreshSeconds: 60,
      updatedAt: new Date().toISOString(),
      sources: {
        topScorer: footballDataTopScorer ? {
          provider: footballDataTopScorer.sourceName,
          source: footballDataTopScorer.source,
          sourceUrl: footballDataTopScorer.sourceUrl,
          sourceCount: footballDataTopScorer.sourceCount,
        } : {
          provider: 'PlayerPerformance',
          source: 'database_player_performance',
          sourceUrl: null,
          sourceCount: performanceTopScorer?.value || 0,
        },
      },
      leaders: {
        topScorer: publicLeader(topScorer),
        topAssister: publicLeader(topAssister),
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('players leaders endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
