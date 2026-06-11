import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getSportsReferenceSourceStatus } from '@/lib/sportsReferenceSource';
import { getLatestSourceAutomationLogs } from '@/lib/sourceAutomationLog';

export const dynamic = 'force-dynamic';

const EXPORT_DIR = path.join(process.cwd(), 'data', 'sports-reference');

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

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

async function getCsvFiles() {
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    const files = await fs.readdir(EXPORT_DIR);
    return files.filter((file) => file.toLowerCase().endsWith('.csv')).sort();
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const csvFiles = await getCsvFiles();
  const sportsReferenceStatus = getSportsReferenceSourceStatus();
  const latestAutomationLogs = await getLatestSourceAutomationLogs(20);

  const latestAutoReports = await prisma.teamIntelligenceReport.findMany({
    where: {
      provider: { in: ['SPORTS_REFERENCE_AUTO_IMPORT', 'SPORTS_REFERENCE_INBOX', 'THE_ATHLETIC_INBOX', 'REUTERS_INBOX', 'FIFA_INBOX', 'SOURCE_INBOX'] },
    },
    orderBy: { lastCheckedAt: 'desc' },
    take: 12,
    select: {
      id: true,
      title: true,
      provider: true,
      sourceName: true,
      sourceCategory: true,
      lastCheckedAt: true,
      team: { select: { id: true, name: true, code: true } },
    },
  });

  const needsReviewCount = await prisma.teamIntelligenceReport.count({
    where: {
      OR: [
        { reportType: 'TEAM_PROFILE_REVIEW' },
        { tacticalTags: { has: 'NEEDS_REVIEW' } },
      ],
    },
  });

  const readinessChecks = [
    {
      key: 'cronSecret',
      label: 'Cron / webhook secret',
      ready: Boolean(process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || process.env.SOURCE_INBOX_SECRET),
      note: process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || process.env.SOURCE_INBOX_SECRET ? 'Secret configured.' : 'Missing ADMIN_CRON_SECRET, CRON_SECRET, or SOURCE_INBOX_SECRET.',
    },
    {
      key: 'csvExportDir',
      label: 'Sports Reference CSV export folder',
      ready: true,
      note: `Using data/sports-reference with ${csvFiles.length} CSV files detected.`,
    },
    {
      key: 'sportsReferenceStatus',
      label: 'Sports Reference source status',
      ready: sportsReferenceStatus.ready,
      note: sportsReferenceStatus.nextAction,
    },
    {
      key: 'autoReports',
      label: 'Automatic reports in database',
      ready: latestAutoReports.length > 0,
      note: latestAutoReports.length ? `${latestAutoReports.length} latest automatic reports found.` : 'No automatic source reports found yet.',
    },
    {
      key: 'automationLogs',
      label: 'Automation run logs',
      ready: latestAutomationLogs.length > 0,
      note: latestAutomationLogs.length ? `${latestAutomationLogs.length} run logs found.` : 'No automation run logs found yet.',
    },
  ];

  return NextResponse.json({
    ok: true,
    ready: readinessChecks.every((check) => check.ready),
    checkedAt: new Date().toISOString(),
    endpoints: {
      sourceAutomationPage: '/admin/source-automation',
      sourceReviewPage: '/admin/source-review',
      sportsReferenceAutoImport: '/api/admin/auto-import-sports-reference',
      sportsReferenceInfo: '/api/admin/auto-import-sports-reference?info=1',
      sourceInboxIntake: '/api/admin/source-inbox-intake',
      sportsReferenceStatus: '/api/admin/sports-reference-status',
      sportsReferenceTemplates: '/api/admin/sports-reference-templates',
      athleticTemplates: '/api/admin/athletic-editorial-templates',
    },
    readinessChecks,
    review: {
      needsReviewCount,
      page: '/admin/source-review',
    },
    csv: {
      exportDir: 'data/sports-reference',
      count: csvFiles.length,
      files: csvFiles.slice(0, 80),
    },
    sportsReferenceStatus,
    latestAutoReports,
    latestAutomationLogs,
  });
}
