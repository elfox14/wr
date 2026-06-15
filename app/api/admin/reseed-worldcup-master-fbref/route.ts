import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { normalizeTeamReportBody } from '@/lib/teamReportFormat';
import {
  buildMasterStrengths,
  buildMasterWeaknesses,
  buildWorldCupMasterMetrics,
  buildWorldCupMasterReportBody,
  getAllWorldCupMasterStandings,
  getTeamLeaderHighlights,
  teamCodeAliases,
  worldCupMasterMeta,
  type WorldCupMasterStanding,
} from '@/lib/worldCupMasterFbrefStats';

export const dynamic = 'force-dynamic';

const PROVIDER = 'FBREF_WORLD_CUP_MASTER_SNAPSHOT';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function hasValidSecret(request: Request) {
  const secret = process.env.ADMIN_CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';

  return bearerToken === secret || queryToken === secret;
}

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function isAuthorized(request: Request) {
  if (hasValidSecret(request)) return true;

  const session = await getServerSession(authOptions as never) as AdminSession;
  return isAdminSession(session);
}

function aliasesFor(row: WorldCupMasterStanding) {
  return [...new Set([row.code, row.fbrefCode, row.team, ...(teamCodeAliases[row.code] || [])].map((item) => item.toUpperCase()))];
}

function buildSummary(row: WorldCupMasterStanding) {
  const goalText = row.gf === null || row.ga === null ? 'الأهداف غير مكتملة' : `${row.gf} له / ${row.ga} عليه`;
  const leaders = getTeamLeaderHighlights(row.team);
  const leaderText = leaders.length ? ` وله ${leaders.length} ظهور في قوائم القادة.` : '';
  return `${row.team}: المجموعة ${row.group}، المركز ${row.rank}، ${row.pts} نقطة، ${goalText}.${leaderText}`;
}

async function findTeam(row: WorldCupMasterStanding) {
  const aliases = aliasesFor(row);
  return prisma.asset.findFirst({
    where: {
      type: 'TEAM',
      OR: [
        { code: { in: aliases } },
        { name: { equals: row.team, mode: 'insensitive' } },
        { name: { contains: row.team, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, code: true, group: true },
  });
}

async function createMasterReport(row: WorldCupMasterStanding) {
  const team = await findTeam(row);
  if (!team) return { status: 'missing_team', code: row.code, team: row.team };

  await prisma.asset.update({
    where: { id: team.id },
    data: { group: row.group },
  });

  const normalized = normalizeTeamReportBody({
    teamName: team.name,
    title: `لقطة Master كأس العالم 2026 — ${team.name}`,
    summary: buildSummary(row),
    body: buildWorldCupMasterReportBody(row),
    sourceName: worldCupMasterMeta.sourceName,
    sourceUrl: worldCupMasterMeta.sourceUrl,
  });

  await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title: `لقطة Master كأس العالم 2026 — ${team.name}`,
      summary: buildSummary(row),
      body: normalized.body,
      reportType: 'WORLD_CUP_MASTER_SNAPSHOT',
      language: 'ar',
      sourceName: worldCupMasterMeta.sourceName,
      sourceUrl: worldCupMasterMeta.sourceUrl,
      sourceCategory: 'stats',
      confidence: 'C',
      provider: PROVIDER,
      metrics: buildWorldCupMasterMetrics(row),
      tacticalTags: normalized.changed
        ? ['FBref Master', `Group ${row.group}`, 'ترتيب المجموعة', 'قادة البطولة', 'normalized-card-format']
        : ['FBref Master', `Group ${row.group}`, 'ترتيب المجموعة', 'قادة البطولة'],
      strengths: buildMasterStrengths(row),
      weaknesses: buildMasterWeaknesses(row),
      lastCheckedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  return { status: 'created', code: row.code, team: team.name, group: row.group };
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = getAllWorldCupMasterStandings();
  return NextResponse.json({
    ok: true,
    provider: PROVIDER,
    source: worldCupMasterMeta,
    message: 'Use POST to delete and reseed FBref World Cup Master snapshot reports into TeamIntelligenceReport.',
    totals: {
      teams: rows.length,
      groups: new Set(rows.map((row) => row.group)).size,
      teamsAlreadyPlayed: rows.filter((row) => row.mp > 0).length,
      teamsNotStarted: rows.filter((row) => row.mp === 0).length,
    },
    sample: rows.slice(0, 6),
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = getAllWorldCupMasterStandings();
    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: { provider: PROVIDER },
    });

    const results = [];
    for (const row of rows) {
      results.push(await createMasterReport(row));
    }

    return NextResponse.json({
      ok: true,
      provider: PROVIDER,
      source: worldCupMasterMeta,
      deletedReports: deleted.count,
      createdReports: results.filter((item) => item.status === 'created').length,
      missingTeams: results.filter((item) => item.status === 'missing_team'),
      results,
    });
  } catch (error) {
    console.error('Failed to reseed World Cup Master FBref snapshot:', error);
    return NextResponse.json({ error: 'Failed to reseed World Cup Master FBref snapshot' }, { status: 500 });
  }
}
