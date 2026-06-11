import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

const UNAVAILABLE = 'غير متوفر في المصادر';

const CARD_SECTION_TITLES = [
  'بطاقة المنتخب',
  'ملخص تنفيذي موثق',
  'القوة الهجومية',
  'القوة الدفاعية',
  'وسط الملعب والتحكم',
  'الكرات الثابتة',
  'أسماء بارزة في القائمة',
  'معلومات غير متوفرة',
  'سجل المصادر',
] as const;

type CardSectionTitle = typeof CARD_SECTION_TITLES[number];

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

type CardSourcePayload = {
  teamId?: string;
  title?: string;
  summary?: string;
  confidence?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceCategory?: string;
  provider?: string;
  sections?: Partial<Record<CardSectionTitle, string>>;
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
  const confidence = String(value || 'B').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(confidence) ? confidence : 'B';
}

function cleanSourceCategory(value?: string) {
  const category = String(value || 'analysis').trim().toLowerCase();
  if (['official', 'stats', 'analysis', 'editorial', 'manual'].includes(category)) return category;
  return 'analysis';
}

function buildCardBody(sections?: Partial<Record<CardSectionTitle, string>>) {
  return CARD_SECTION_TITLES
    .map((title) => {
      const value = String(sections?.[title] || '').trim() || UNAVAILABLE;
      return `${title}: ${value}`;
    })
    .join('\n\n');
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const payload = await req.json().catch(() => ({})) as CardSourcePayload;
  const teamId = String(payload.teamId || '').trim();
  const title = String(payload.title || '').trim();
  const summary = String(payload.summary || '').trim();

  if (!teamId || !title || !summary) {
    return NextResponse.json({ error: 'teamId, title, and summary are required' }, { status: 400 });
  }

  const team = await prisma.asset.findFirst({
    where: { id: teamId, type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const sourceName = String(payload.sourceName || 'MC PRIME Source Intake').trim() || 'MC PRIME Source Intake';
  const sourceUrl = String(payload.sourceUrl || '').trim() || null;
  const sourceCategory = cleanSourceCategory(payload.sourceCategory);

  const report = await prisma.teamIntelligenceReport.create({
    data: {
      teamId,
      title,
      summary,
      body: buildCardBody(payload.sections),
      confidence: cleanConfidence(payload.confidence),
      reportType: 'TEAM_PROFILE',
      sourceName,
      sourceUrl,
      sourceCategory,
      tacticalTags: toList(payload.tacticalTags),
      strengths: toList(payload.strengths),
      weaknesses: toList(payload.weaknesses),
      provider: String(payload.provider || 'MC_PRIME_SOURCE_INTAKE').trim() || 'MC_PRIME_SOURCE_INTAKE',
      lastCheckedAt: new Date(),
    },
    include: {
      team: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({
    success: true,
    report,
    cardSections: CARD_SECTION_TITLES,
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    message: 'POST a sourced card report. Empty card sections will be saved as غير متوفر في المصادر.',
    required: ['teamId', 'title', 'summary'],
    cardSections: CARD_SECTION_TITLES,
    example: {
      teamId: 'TEAM_ID_HERE',
      title: 'Sports Reference update — Mexico',
      summary: 'Short sourced summary.',
      sourceName: 'Sports Reference / Stathead / FBref subscription',
      sourceUrl: 'https://www.sports-reference.com/',
      sourceCategory: 'stats',
      sections: {
        'القوة الهجومية': 'أدخل الرقم الموثق هنا أو اتركه فارغًا.',
        'سجل المصادر': 'Sports Reference / Stathead / FBref subscription.',
      },
    },
  });
}
