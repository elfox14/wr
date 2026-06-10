import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

type ReportPayload = {
  teamId?: string;
  title?: string;
  summary?: string;
  body?: string;
  confidence?: string;
  reportType?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceCategory?: string;
  tacticalTags?: string | string[];
  strengths?: string | string[];
  weaknesses?: string | string[];
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

function toList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanConfidence(value?: string) {
  const confidence = String(value || 'C').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(confidence) ? confidence : 'C';
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const payload = await req.json().catch(() => ({})) as ReportPayload;
  const teamId = String(payload.teamId || '').trim();
  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();

  if (!teamId || !title || !summary) {
    return NextResponse.json({ error: 'teamId, title, and summary are required' }, { status: 400 });
  }

  const team = await prisma.asset.findFirst({
    where: { id: teamId, type: 'TEAM' },
    select: { id: true, name: true },
  });

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const report = await prisma.teamIntelligenceReport.create({
    data: {
      teamId,
      title,
      summary,
      body: String(payload.body || '').trim() || null,
      confidence: cleanConfidence(payload.confidence),
      reportType: String(payload.reportType || 'TEAM_PROFILE').trim() || 'TEAM_PROFILE',
      sourceName: String(payload.sourceName || 'MC PRIME Manual Desk').trim() || 'MC PRIME Manual Desk',
      sourceUrl: String(payload.sourceUrl || '').trim() || null,
      sourceCategory: String(payload.sourceCategory || 'manual').trim() || 'manual',
      tacticalTags: toList(payload.tacticalTags),
      strengths: toList(payload.strengths),
      weaknesses: toList(payload.weaknesses),
      provider: 'manual-admin',
      lastCheckedAt: new Date(),
    },
    include: {
      team: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({ success: true, report });
}
