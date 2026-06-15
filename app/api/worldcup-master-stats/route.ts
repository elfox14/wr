import { NextResponse } from 'next/server';
import {
  getAllWorldCupMasterStandings,
  getWorldCupMasterTeam,
  groupStandings,
  leaderboards,
  thirdPlacedRanking,
  worldCupMasterMeta,
} from '@/lib/worldCupMasterFbrefStats';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get('group')?.trim().toUpperCase();
  const team = searchParams.get('team')?.trim();
  const scope = searchParams.get('scope')?.trim().toLowerCase();

  if (team) {
    const row = getWorldCupMasterTeam(team);
    return NextResponse.json({
      available: Boolean(row),
      meta: worldCupMasterMeta,
      team: row,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    });
  }

  if (group && group in groupStandings) {
    return NextResponse.json({
      available: true,
      meta: worldCupMasterMeta,
      group,
      standings: groupStandings[group],
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    });
  }

  if (scope === 'leaders') {
    return NextResponse.json({ available: true, meta: worldCupMasterMeta, leaderboards }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    });
  }

  if (scope === 'third-place') {
    return NextResponse.json({ available: true, meta: worldCupMasterMeta, thirdPlacedRanking }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    });
  }

  return NextResponse.json({
    available: true,
    meta: worldCupMasterMeta,
    standings: groupStandings,
    thirdPlacedRanking,
    leaderboards,
    teams: getAllWorldCupMasterStandings(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
  });
}
