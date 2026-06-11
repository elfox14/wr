import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { buildSportsReferenceCsvDraft } from '@/lib/sportsReferenceCsvDraft';

export const dynamic = 'force-dynamic';

const EXPORT_DIR = path.join(process.cwd(), 'data', 'sports-reference');

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

type ImportResult = { team: string; code: string | null; status: string; file?: string; reportId?: string; warning?: string; detectedRows?: number };

function hasValidSecret(request: Request) {
  const allowedSecrets = [process.env.ADMIN_CRON_SECRET, process.env.CRON_SECRET, process.env.SOURCE_INBOX_SECRET].filter(Boolean);
  if (!allowedSecrets.length) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';
  const headerToken = request.headers.get('x-source-inbox-secret') || '';

  return allowedSecrets.some((secret) => bearerToken === secret || queryToken === secret || headerToken === secret);
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

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildBody(sections: Record<string, string>) {
  return Object.entries(sections)
    .map(([title, content]) => `${title}: ${content}`)
    .join('\n\n');
}

async function findCsvForTeam(team: { code: string | null; name: string }) {
  const files = await fs.readdir(EXPORT_DIR);
  const csvFiles = files.filter((file) => file.toLowerCase().endsWith('.csv'));
  const candidates = [team.code, team.name, safeName(team.name)].filter(Boolean).map((value) => String(value).toLowerCase());

  const match = csvFiles.find((file) => {
    const normalized = file.toLowerCase();
    return candidates.some((candidate) => normalized === `${candidate}.csv` || normalized.includes(candidate));
  });

  return match ? path.join(EXPORT_DIR, match) : null;
}

async function runAutoImport() {
  await fs.mkdir(EXPORT_DIR, { recursive: true });

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const results: ImportResult[] = [];

  for (const team of teams) {
    const csvPath = await findCsvForTeam(team);
    if (!csvPath) {
      results.push({ team: team.name, code: team.code, status: 'skipped', warning: 'No matching CSV export found.' });
      continue;
    }

    const csvText = await fs.readFile(csvPath, 'utf8');
    const draft = buildSportsReferenceCsvDraft({
      teamName: team.name,
      sourceName: 'Sports Reference / Stathead / FBref subscription',
      sourceUrl: 'https://www.sports-reference.com/',
      csvText,
    });

    if (!draft.detectedRows || draft.warnings.length) {
      results.push({ team: team.name, code: team.code, status: 'skipped', file: path.basename(csvPath), warning: draft.warnings.join(' | '), detectedRows: draft.detectedRows });
      continue;
    }

    await prisma.teamIntelligenceReport.deleteMany({
      where: {
        teamId: team.id,
        provider: 'SPORTS_REFERENCE_AUTO_IMPORT',
      },
    });

    const report = await prisma.teamIntelligenceReport.create({
      data: {
        teamId: team.id,
        title: `Sports Reference / FBref export — ${team.name}`,
        summary: draft.summary,
        body: buildBody(draft.sections),
        confidence: 'B',
        reportType: 'TEAM_PROFILE',
        sourceName: 'Sports Reference / Stathead / FBref subscription',
        sourceUrl: 'https://www.sports-reference.com/',
        sourceCategory: 'stats',
        provider: 'SPORTS_REFERENCE_AUTO_IMPORT',
        tacticalTags: ['Sports Reference', 'FBref', 'stats export'],
        strengths: [],
        weaknesses: draft.warnings,
        lastCheckedAt: new Date(),
      },
      select: { id: true },
    });

    results.push({ team: team.name, code: team.code, status: 'imported', file: path.basename(csvPath), reportId: report.id, detectedRows: draft.detectedRows });
  }

  return {
    success: true,
    exportDir: 'data/sports-reference',
    imported: results.filter((item) => item.status === 'imported').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    results,
  };
}

async function handleImportRequest(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await runAutoImport());
  } catch (error) {
    console.error('Failed to auto-import Sports Reference exports:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to auto-import Sports Reference exports.',
      details: error instanceof Error ? error.message : 'Unknown error',
      exportDir: 'data/sports-reference',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleImportRequest(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('info') === '1') {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      message: 'GET or POST this endpoint to automatically import Sports Reference / FBref CSV exports from data/sports-reference.',
      fileNaming: 'Name CSV files by team code or team name, for example MEX.csv, Mexico.csv, GER.csv.',
      exportDir: 'data/sports-reference',
    });
  }

  return handleImportRequest(request);
}
