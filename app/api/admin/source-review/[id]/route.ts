import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createSourceAutomationLog } from '@/lib/sourceAutomationLog';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReviewActionPayload = {
  action?: 'approve' | 'dismiss';
  note?: string;
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

function cleanTags(tags: string[]) {
  return tags.filter((tag) => tag !== 'NEEDS_REVIEW').filter((tag) => !tag.startsWith('review-status:'));
}

function cleanWeaknesses(weaknesses: string[]) {
  return weaknesses.filter((item) => !item.startsWith('NEEDS_REVIEW'));
}

function mergeMetrics(
  metrics: Prisma.JsonValue | null,
  values: Prisma.InputJsonObject,
): Prisma.InputJsonObject {
  if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) {
    return {
      ...(metrics as Prisma.InputJsonObject),
      ...values,
    };
  }

  return values;
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await context.params;
  const payload = await request.json().catch(() => ({})) as ReviewActionPayload;
  const action = payload.action || 'approve';
  const note = String(payload.note || '').trim();

  const report = await prisma.teamIntelligenceReport.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true, code: true } } },
  });

  if (!report) {
    return NextResponse.json({ error: 'Review report not found' }, { status: 404 });
  }

  if (action === 'dismiss') {
    await prisma.teamIntelligenceReport.delete({ where: { id: report.id } });
    await createSourceAutomationLog({
      job: 'source-review-dismiss',
      status: 'skipped',
      imported: 0,
      skipped: 1,
      details: {
        dismissedReportId: report.id,
        team: report.team,
        title: report.title,
        note: note || null,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'dismissed',
      dismissedReportId: report.id,
    });
  }

  const approvalMetrics: Prisma.InputJsonObject = {
    reviewStatus: 'APPROVED',
    reviewedAt: new Date().toISOString(),
    reviewNote: note || null,
  };

  const updated = await prisma.teamIntelligenceReport.update({
    where: { id: report.id },
    data: {
      reportType: 'TEAM_PROFILE',
      confidence: report.confidence === 'D' ? 'C' : report.confidence,
      tacticalTags: [...cleanTags(report.tacticalTags), 'AUTO_REVIEW_APPROVED', 'review-status:approved'],
      weaknesses: cleanWeaknesses(report.weaknesses),
      metrics: mergeMetrics(report.metrics, approvalMetrics),
      lastCheckedAt: new Date(),
    },
  });

  await createSourceAutomationLog({
    job: 'source-review-approve',
    status: 'success',
    imported: 1,
    skipped: 0,
    details: {
      approvedReportId: updated.id,
      team: report.team,
      title: updated.title,
      note: note || null,
    },
  });

  return NextResponse.json({
    success: true,
    status: 'approved',
    report: {
      ...updated,
      team: report.team,
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await context.params;
  const report = await prisma.teamIntelligenceReport.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true, code: true } } },
  });

  if (!report) {
    return NextResponse.json({ error: 'Review report not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
