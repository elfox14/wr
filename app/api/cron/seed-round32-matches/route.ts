import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GROUP_KEYS = 'ABCDEFGHIJKL'.split('');
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

const ROUND32_FIXTURES = [
  { no: 1, date: '2026-06-28T19:00:00.000Z', home: '2A', away: '2B' },
  { no: 2, date: '2026-06-29T17:00:00.000Z', home: '1C', away: '2F' },
  { no: 3, date: '2026-06-29T20:30:00.000Z', home: '1E', away: '3ABCDF' },
  { no: 4, date: '2026-06-30T01:00:00.000Z', home: '1F', away: '2C' },
  { no: 5, date: '2026-06-30T17:00:00.000Z', home: '2E', away: '2I' },
  { no: 6, date: '2026-06-30T21:00:00.000Z', home: '1I', away: '3CDFGH' },
  { no: 7, date: '2026-07-01T01:00:00.000Z', home: '1A', away: '3CEFHI' },
  { no: 8, date: '2026-07-01T16:00:00.000Z', home: '1L', away: '3EHIJK' },
  { no: 9, date: '2026-07-01T20:00:00.000Z', home: '1G', away: '3AEHIJ' },
  { no: 10, date: '2026-07-02T00:00:00.000Z', home: '1D', away: '3BEFIJ' },
  { no: 11, date: '2026-07-02T19:00:00.000Z', home: '1H', away: '2J' },
  { no: 12, date: '2026-07-02T23:00:00.000Z', home: '2K', away: '2L' },
  { no: 13, date: '2026-07-03T03:00:00.000Z', home: '1B', away: '3EFGIJ' },
  { no: 14, date: '2026-07-03T18:00:00.000Z', home: '2D', away: '2G' },
  { no: 15, date: '2026-07-03T22:00:00.000Z', home: '1J', away: '2H' },
  { no: 16, date: '2026-07-04T01:30:00.000Z', home: '1K', away: '3DEIJL' },
] as const;

type TeamLite = { id: string; name: string; code: string | null; group: string | null };
type StandingRow = TeamLite & { groupKey: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; rank: number };

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } });
}

function boolParam(req: NextRequest, name: string, fallback = false) {
  const raw = req.nextUrl.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function normalizeGroupKey(value: unknown) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  const cleaned = raw
    .replace('GROUP_', '')
    .replace('GROUP ', '')
    .replace('المجموعة ', '')
    .replace('دور المجموعات', '')
    .replace(/[^A-L]/g, '');
  const key = cleaned.slice(0, 1);
  return GROUP_KEYS.includes(key) ? key : null;
}

function statusIsFinished(status: unknown) {
  return FINISHED_STATUSES.includes(String(status || '').trim().toUpperCase());
}

function emptyStanding(team: TeamLite, groupKey: string): StandingRow {
  return { ...team, groupKey, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, rank: 0 };
}

function applyResult(row: StandingRow, goalsFor: number, goalsAgainst: number) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsFor > goalsAgainst) { row.won += 1; row.points += 3; }
  else if (goalsFor === goalsAgainst) { row.drawn += 1; row.points += 1; }
  else row.lost += 1;
}

function sortStandings(rows: StandingRow[]) {
  return rows
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, 'ar'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function sideLabel(side: string) {
  const fixed = side.match(/^([12])([A-L])$/);
  if (fixed) return `${fixed[1]}${fixed[2]}`;
  const third = side.match(/^3([A-L]+)$/);
  if (third) return `أفضل ثالث من ${third[1].split('').join('/')}`;
  return side;
}

function thirdSlotGroups(side: string) {
  const third = side.match(/^3([A-L]+)$/);
  return third ? third[1].split('') : [];
}

function resolveRankSide(side: string, standings: Map<string, StandingRow[]>, thirdAssignments: Map<number, string>, fixtureNo: number): StandingRow | null {
  const fixed = side.match(/^([12])([A-L])$/);
  if (fixed) return standings.get(fixed[2])?.[Number(fixed[1]) - 1] || null;

  if (side.startsWith('3')) {
    const group = thirdAssignments.get(fixtureNo);
    return group ? standings.get(group)?.[2] || null : null;
  }

  return null;
}

function assignThirds(thirdRows: StandingRow[]) {
  const qualifiedGroups = new Set(thirdRows.map((row) => row.groupKey));
  const slots = ROUND32_FIXTURES
    .filter((fixture) => fixture.home.startsWith('3') || fixture.away.startsWith('3'))
    .map((fixture) => {
      const side = fixture.home.startsWith('3') ? fixture.home : fixture.away;
      const candidates = thirdSlotGroups(side).filter((group) => qualifiedGroups.has(group));
      return { fixtureNo: fixture.no, side, candidates };
    })
    .sort((a, b) => a.candidates.length - b.candidates.length || a.fixtureNo - b.fixtureNo);

  const rankByGroup = new Map(thirdRows.map((row, index) => [row.groupKey, index]));
  const used = new Set<string>();
  const assignment = new Map<number, string>();

  function backtrack(index: number): boolean {
    if (index >= slots.length) return true;
    const slot = slots[index];
    const candidates = [...slot.candidates]
      .filter((group) => !used.has(group))
      .sort((a, b) => (rankByGroup.get(a) ?? 99) - (rankByGroup.get(b) ?? 99));

    for (const group of candidates) {
      used.add(group);
      assignment.set(slot.fixtureNo, group);
      if (backtrack(index + 1)) return true;
      assignment.delete(slot.fixtureNo);
      used.delete(group);
    }

    return false;
  }

  return backtrack(0) ? assignment : null;
}

export async function GET(req: NextRequest) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const apply = boolParam(req, 'apply', false);
  const force = boolParam(req, 'force', false);

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM', group: { in: GROUP_KEYS } },
    select: { id: true, name: true, code: true, group: true },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });

  const standings = new Map<string, StandingRow[]>();
  for (const group of GROUP_KEYS) {
    const rows = teams
      .filter((team) => normalizeGroupKey(team.group) === group)
      .map((team) => emptyStanding(team, group));
    standings.set(group, rows);
  }

  const groupMatches = await prisma.match.findMany({
    where: {
      status: { in: FINISHED_STATUSES },
      OR: [
        { stage: { in: ['group', 'GROUP', 'GROUP_STAGE', 'Group Stage', 'دور المجموعات'] } },
        { groupPhase: { in: GROUP_KEYS.flatMap((group) => [group, `Group ${group}`, `GROUP ${group}`, `GROUP_${group}`, `المجموعة ${group}`]) } },
      ],
    },
    select: {
      id: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      groupPhase: true,
      stage: true,
      homeTeam: { select: { id: true, name: true, code: true, group: true } },
      awayTeam: { select: { id: true, name: true, code: true, group: true } },
    },
  });

  for (const match of groupMatches) {
    if (!statusIsFinished(match.status)) continue;
    const groupKey = normalizeGroupKey(match.groupPhase) || normalizeGroupKey(match.homeTeam.group) || normalizeGroupKey(match.awayTeam.group);
    if (!groupKey) continue;

    const rows = standings.get(groupKey) || [];
    const home = rows.find((row) => row.id === match.homeTeamId);
    const away = rows.find((row) => row.id === match.awayTeamId);
    if (!home || !away) continue;

    applyResult(home, Number(match.homeScore || 0), Number(match.awayScore || 0));
    applyResult(away, Number(match.awayScore || 0), Number(match.homeScore || 0));
  }

  for (const group of GROUP_KEYS) standings.set(group, sortStandings(standings.get(group) || []));

  const incompleteGroups = GROUP_KEYS
    .map((group) => ({ group, teams: standings.get(group)?.length || 0, completedMatches: (standings.get(group) || []).reduce((sum, row) => sum + row.played, 0) / 2 }))
    .filter((item) => item.teams < 4 || item.completedMatches < 6);

  const thirdRows = GROUP_KEYS
    .map((group) => standings.get(group)?.[2] || null)
    .filter(Boolean) as StandingRow[];

  const bestThirds = [...thirdRows]
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, 'ar'))
    .slice(0, 8);

  const thirdAssignments = assignThirds(bestThirds);
  if (!thirdAssignments) {
    return json({
      ok: false,
      mode: 'seed_round32_matches_v1_from_group_standings',
      ready: false,
      reason: 'Could not assign the best third-placed teams to the official Round of 32 slots.',
      bestThirdGroups: bestThirds.map((row) => row.groupKey),
      incompleteGroups,
    }, 200);
  }

  const fixtures = ROUND32_FIXTURES.map((fixture) => {
    const home = resolveRankSide(fixture.home, standings, thirdAssignments, fixture.no);
    const away = resolveRankSide(fixture.away, standings, thirdAssignments, fixture.no);
    return {
      no: fixture.no,
      externalId: `wc2026-r32-m${String(fixture.no).padStart(2, '0')}`,
      matchDate: fixture.date,
      homeSlot: sideLabel(fixture.home),
      awaySlot: sideLabel(fixture.away),
      homeTeam: home ? { id: home.id, name: home.name, code: home.code, group: home.groupKey, rank: home.rank } : null,
      awayTeam: away ? { id: away.id, name: away.name, code: away.code, group: away.groupKey, rank: away.rank } : null,
    };
  });

  const unresolved = fixtures.filter((fixture) => !fixture.homeTeam || !fixture.awayTeam);
  const processed: any[] = [];

  if (unresolved.length === 0 && apply) {
    for (const fixture of fixtures) {
      const existing = await prisma.match.findUnique({ where: { externalId: fixture.externalId } });
      const data = {
        homeTeamId: fixture.homeTeam!.id,
        awayTeamId: fixture.awayTeam!.id,
        matchDate: new Date(fixture.matchDate),
        status: 'SCHEDULED',
        homeScore: 0,
        awayScore: 0,
        stage: 'round_of_32',
        groupPhase: 'دور الـ32',
        competition: 'WC',
        season: '2026',
        syncSource: 'LOCAL_ROUND32_SEED',
      };

      if (existing) {
        if (!force && !SCHEDULED_STATUSES.includes(String(existing.status || '').toUpperCase())) {
          processed.push({ ...fixture, status: 'skipped_existing_not_scheduled', existingStatus: existing.status });
          continue;
        }
        const updated = await prisma.match.update({ where: { id: existing.id }, data, select: { id: true } });
        processed.push({ ...fixture, matchId: updated.id, status: 'updated' });
      } else {
        const created = await prisma.match.create({ data: { externalId: fixture.externalId, ...data }, select: { id: true } });
        processed.push({ ...fixture, matchId: created.id, status: 'created' });
      }
    }
  }

  return json({
    ok: true,
    mode: 'seed_round32_matches_v1_from_group_standings',
    dryRun: !apply,
    ready: unresolved.length === 0,
    applied: apply && unresolved.length === 0,
    incompleteGroups,
    bestThirds: bestThirds.map((row, index) => ({ rank: index + 1, group: row.groupKey, team: row.name, points: row.points, goalDifference: row.goalDifference, goalsFor: row.goalsFor })),
    thirdAssignments: Array.from(thirdAssignments.entries()).sort((a, b) => a[0] - b[0]).map(([fixtureNo, group]) => ({ fixtureNo, group })),
    unresolved,
    fixtures,
    processed,
    next: apply ? '/matches?filter=round32' : 'Run again with apply=true after reviewing fixtures.',
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
