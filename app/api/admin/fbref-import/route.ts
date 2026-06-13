import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { buildFbrefTeamReportDrafts, buildImportPreview, FbrefExportPayload, getCodeAliases, getNameAliases, normalizeFbrefName } from '@/lib/fbref/importer';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

type TeamAsset = {
  id: string;
  name: string;
  code: string;
};

type TeamMatch = {
  team: TeamAsset;
  matchMethod: string;
};

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function buildTeamIndexes(teams: TeamAsset[]) {
  const nameIndex = new Map<string, TeamAsset>();
  const codeIndex = new Map<string, TeamAsset>();

  for (const team of teams) {
    for (const alias of getNameAliases(team.name)) {
      if (!nameIndex.has(alias)) nameIndex.set(alias, team);
    }

    const code = String(team.code || '').trim().toLowerCase();
    if (code && !codeIndex.has(code)) codeIndex.set(code, team);
  }

  return { nameIndex, codeIndex };
}

function findTeamAsset(draft: { teamName: string; normalizedTeamName: string; teamCode?: string | null }, teams: TeamAsset[], indexes: ReturnType<typeof buildTeamIndexes>): TeamMatch | null {
  for (const alias of getNameAliases(draft.teamName)) {
    const byName = indexes.nameIndex.get(alias);
    if (byName) return { team: byName, matchMethod: `name:${alias}` };
  }

  for (const code of getCodeAliases(draft.teamCode)) {
    const byCode = indexes.codeIndex.get(code);
    if (byCode) return { team: byCode, matchMethod: `code:${code}` };
  }

  const fallbackByLooseName = teams.find((team) => {
    const assetName = normalizeFbrefName(team.name);
    return assetName.includes(draft.normalizedTeamName) || draft.normalizedTeamName.includes(assetName);
  });

  if (fallbackByLooseName) return { team: fallbackByLooseName, matchMethod: 'loose-name' };

  return null;
}

async function readPayloadFromRequest(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') throw new Error('JSON file is required');

    const text = await file.text();
    return {
      payload: JSON.parse(text) as FbrefExportPayload,
      dryRun: formData.get('dryRun') === 'true',
      replaceExisting: formData.get('replaceExisting') !== 'false',
    };
  }

  const body = await req.json().catch(() => ({})) as { payload?: FbrefExportPayload; dryRun?: boolean; replaceExisting?: boolean };
  if (!body.payload) throw new Error('payload is required');
  return {
    payload: body.payload,
    dryRun: Boolean(body.dryRun),
    replaceExisting: body.replaceExisting !== false,
  };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  let parsed: Awaited<ReturnType<typeof readPayloadFromRequest>>;
  try {
    parsed = await readPayloadFromRequest(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid FBref JSON payload' }, { status: 400 });
  }

  const drafts = buildFbrefTeamReportDrafts(parsed.payload);
  if (!drafts.length) {
    return NextResponse.json({ error: 'No successful squad pages found in the FBref export.' }, { status: 400 });
  }

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const indexes = buildTeamIndexes(teams);
  const matched = drafts.map((draft) => ({ draft, match: findTeamAsset(draft, teams, indexes) }));
  const unmatched = matched.filter((item) => !item.match).map((item) => item.draft.teamName);
  const matchedItems = matched.flatMap((item) => (item.match ? [{ draft: item.draft, match: item.match }] : []));

  if (parsed.dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      preview: buildImportPreview(parsed.payload),
      matchedCount: matchedItems.length,
      unmatchedCount: unmatched.length,
      unmatched,
      matchedTeams: matchedItems.map((item) => ({ fbrefTeam: item.draft.teamName, assetId: item.match.team.id, assetName: item.match.team.name, method: item.match.matchMethod })),
    });
  }

  let deletedExisting = 0;
  let created = 0;
  const reports: { id: string; teamName: string; assetName: string }[] = [];

  for (const item of matchedItems) {
    const { draft, match } = item;

    if (parsed.replaceExisting) {
      const deleted = await prisma.teamIntelligenceReport.deleteMany({
        where: {
          teamId: match.team.id,
          provider: 'FBREF_STATHEAD_IMPORT',
          sourceName: 'FBref / Stathead',
          sourceCategory: 'stats',
        },
      });
      deletedExisting += deleted.count;
    }

    const report = await prisma.teamIntelligenceReport.create({
      data: {
        teamId: match.team.id,
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        reportType: 'TEAM_PROFILE',
        language: 'ar',
        sourceName: 'FBref / Stathead',
        sourceUrl: draft.sourceUrl,
        sourceCategory: 'stats',
        confidence: draft.confidence,
        provider: 'FBREF_STATHEAD_IMPORT',
        metrics: draft.metrics as Prisma.InputJsonValue,
        tacticalTags: draft.tacticalTags,
        strengths: draft.strengths,
        weaknesses: draft.weaknesses,
        lastCheckedAt: new Date(),
      },
      include: { team: { select: { id: true, name: true, code: true } } },
    });

    created += 1;
    reports.push({ id: report.id, teamName: draft.teamName, assetName: report.team.name });
  }

  return NextResponse.json({
    success: true,
    dryRun: false,
    created,
    deletedExisting,
    matchedCount: matchedItems.length,
    unmatchedCount: unmatched.length,
    unmatched,
    reports,
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    message: 'Upload the merged FBref/Stathead browser JSON export. Use dryRun=true first, then import with replaceExisting=true.',
    accepted: ['multipart/form-data file field named file', 'application/json with { payload, dryRun, replaceExisting }'],
    provider: 'FBREF_STATHEAD_IMPORT',
  });
}
