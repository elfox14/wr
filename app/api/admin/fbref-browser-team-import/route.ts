import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { buildFbrefBrowserTeamDraft, FbrefBrowserTeamPayload } from '@/lib/fbref/browserTeamDraft';
import { normalizeSearchText, textMatchesTeamAlias } from '@/lib/teamNameAliases';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

type ImportBody = {
  payload?: FbrefBrowserTeamPayload;
  dryRun?: boolean;
  replaceExisting?: boolean;
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

async function readPayload(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') throw new Error('JSON file is required');
    const payload = JSON.parse(await file.text()) as FbrefBrowserTeamPayload;
    return {
      payload,
      dryRun: formData.get('dryRun') === 'true',
      replaceExisting: formData.get('replaceExisting') !== 'false',
    };
  }

  const body = await req.json().catch(() => ({})) as ImportBody | FbrefBrowserTeamPayload;
  const wrapped = body as ImportBody;
  const payload = wrapped.payload || body as FbrefBrowserTeamPayload;
  return {
    payload,
    dryRun: Boolean(wrapped.dryRun),
    replaceExisting: wrapped.replaceExisting !== false,
  };
}

async function findTeam(payload: FbrefBrowserTeamPayload) {
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const code = String(payload.teamCode || '').trim().toUpperCase();
  if (code) {
    const byCode = teams.find((team) => String(team.code || '').trim().toUpperCase() === code);
    if (byCode) return { team: byCode, matchMethod: `code:${code}` };
  }

  const name = normalizeSearchText(payload.teamName || '');
  const byName = teams.find((team) => normalizeSearchText(team.name) === name || textMatchesTeamAlias(payload.teamName || '', team));
  if (byName) return { team: byName, matchMethod: 'name-or-alias' };

  const loose = teams.find((team) => {
    const assetName = normalizeSearchText(team.name);
    return Boolean(name && (assetName.includes(name) || name.includes(assetName)));
  });
  if (loose) return { team: loose, matchMethod: 'loose-name' };

  return null;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  let parsed: Awaited<ReturnType<typeof readPayload>>;
  try {
    parsed = await readPayload(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid FBref browser JSON payload' }, { status: 400 });
  }

  if (!parsed.payload?.teamName && !parsed.payload?.teamCode) {
    return NextResponse.json({ error: 'payload.teamName or payload.teamCode is required' }, { status: 400 });
  }

  const match = await findTeam(parsed.payload);
  if (!match) {
    return NextResponse.json({ error: 'No matching team found', teamName: parsed.payload.teamName, teamCode: parsed.payload.teamCode }, { status: 404 });
  }

  const draft = buildFbrefBrowserTeamDraft(parsed.payload);

  if (parsed.dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      matchedTeam: match.team,
      matchMethod: match.matchMethod,
      draft: {
        title: draft.title,
        summary: draft.summary,
        tableAvailability: draft.metrics.tableAvailability,
        metrics: {
          standing: draft.metrics.standing,
          matchContext: draft.metrics.matchContext,
          roster: draft.metrics.roster,
          missing: draft.metrics.missing,
        },
      },
    });
  }

  let deletedExisting = 0;
  if (parsed.replaceExisting) {
    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: {
        teamId: match.team.id,
        provider: 'FBREF_BROWSER_EXTRACT',
      },
    });
    deletedExisting = deleted.count;
  }

  const report = await prisma.teamIntelligenceReport.create({
    data: {
      teamId: match.team.id,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      reportType: 'TEAM_PROFILE',
      language: 'ar',
      sourceName: parsed.payload.sourceName || 'FBref Browser Extract',
      sourceUrl: parsed.payload.sourceUrl || null,
      sourceCategory: 'stats',
      confidence: draft.confidence,
      provider: 'FBREF_BROWSER_EXTRACT',
      metrics: draft.metrics as Prisma.InputJsonValue,
      tacticalTags: draft.tacticalTags,
      strengths: draft.strengths,
      weaknesses: draft.weaknesses,
      lastCheckedAt: new Date(),
    },
    include: { team: { select: { id: true, name: true, code: true } } },
  });

  return NextResponse.json({
    success: true,
    dryRun: false,
    created: 1,
    deletedExisting,
    report: { id: report.id, title: report.title, team: report.team },
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    message: 'POST the single-team FBref browser JSON extract. Use dryRun=true first, then import with replaceExisting=true.',
    accepted: ['multipart/form-data file field named file', 'application/json with { payload, dryRun, replaceExisting }', 'raw application/json payload'],
    provider: 'FBREF_BROWSER_EXTRACT',
  });
}
