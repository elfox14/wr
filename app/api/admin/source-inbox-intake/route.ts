import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

type IntakePayload = {
  from?: string;
  subject?: string;
  body?: string;
  sourceUrl?: string;
  sourceName?: string;
  teamCode?: string;
  teamName?: string;
};

function hasValidSecret(request: Request) {
  const secret = process.env.ADMIN_CRON_SECRET || process.env.SOURCE_INBOX_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';
  const headerToken = request.headers.get('x-source-inbox-secret') || '';

  return bearerToken === secret || queryToken === secret || headerToken === secret;
}

function compactText(value: string, maxLength = 700) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function detectProvider(payload: IntakePayload) {
  const combined = `${payload.from || ''} ${payload.subject || ''} ${payload.sourceName || ''}`.toLowerCase();
  if (combined.includes('athletic')) return { sourceName: 'The Athletic', sourceCategory: 'editorial', provider: 'THE_ATHLETIC_INBOX' };
  if (combined.includes('sports-reference') || combined.includes('stathead') || combined.includes('fbref')) return { sourceName: 'Sports Reference / Stathead / FBref subscription', sourceCategory: 'stats', provider: 'SPORTS_REFERENCE_INBOX' };
  if (combined.includes('reuters')) return { sourceName: 'Reuters', sourceCategory: 'official', provider: 'REUTERS_INBOX' };
  if (combined.includes('fifa')) return { sourceName: 'FIFA', sourceCategory: 'official', provider: 'FIFA_INBOX' };
  return { sourceName: payload.sourceName || 'Inbox Source', sourceCategory: 'analysis', provider: 'SOURCE_INBOX' };
}

function buildBody(sections: Record<string, string>) {
  return CARD_SECTION_TITLES
    .map((title) => `${title}: ${sections[title] || UNAVAILABLE}`)
    .join('\n\n');
}

function getSafeEditorialSummary(payload: IntakePayload, sourceName: string) {
  const subject = compactText(payload.subject || 'تحديث بدون عنوان', 180);
  const url = payload.sourceUrl ? ` الرابط: ${payload.sourceUrl}` : '';

  if (sourceName === 'The Athletic') {
    return `وصل تحديث تحريري من The Athletic بعنوان: ${subject}. لا يتم نقل نص المقال أو النشرة داخل التقرير؛ يستخدم هذا السجل كإشارة مصدرية تحتاج قراءة تحريرية أو ربطًا بمقال محدد قبل إضافة تفاصيل تكتيكية.${url}`;
  }

  const bodySnippet = compactText(payload.body || '', 450);
  return bodySnippet
    ? `وصل تحديث من ${sourceName} بعنوان: ${subject}. ملخص النص المرسل: ${bodySnippet}${url}`
    : `وصل تحديث من ${sourceName} بعنوان: ${subject}.${url}`;
}

async function findMatchingTeam(payload: IntakePayload) {
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  const explicitCode = String(payload.teamCode || '').trim().toLowerCase();
  const explicitName = String(payload.teamName || '').trim().toLowerCase();
  const combined = `${payload.subject || ''} ${payload.body || ''} ${payload.sourceUrl || ''}`.toLowerCase();

  return teams.find((team) => {
    const code = String(team.code || '').toLowerCase();
    const name = team.name.toLowerCase();
    if (explicitCode && code === explicitCode) return true;
    if (explicitName && name === explicitName) return true;
    if (code && combined.includes(code)) return true;
    return combined.includes(name);
  }) || null;
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({})) as IntakePayload;
  const source = detectProvider(payload);
  const team = await findMatchingTeam(payload);

  if (!team) {
    return NextResponse.json({
      success: false,
      status: 'skipped',
      reason: 'No matching team found in payload. Send teamCode or teamName for automatic matching.',
      source,
    }, { status: 202 });
  }

  const summary = getSafeEditorialSummary(payload, source.sourceName);
  const title = `${source.sourceName} inbox update — ${team.name}`;
  const sourceUrl = String(payload.sourceUrl || '').trim() || null;

  const sections = {
    'بطاقة المنتخب': `${team.name}${team.code ? ` — ${team.code}` : ''}.`,
    'ملخص تنفيذي موثق': summary,
    'القوة الهجومية': UNAVAILABLE,
    'القوة الدفاعية': UNAVAILABLE,
    'وسط الملعب والتحكم': UNAVAILABLE,
    'الكرات الثابتة': UNAVAILABLE,
    'أسماء بارزة في القائمة': UNAVAILABLE,
    'معلومات غير متوفرة': 'لم يتم استخراج أرقام أو أسماء فردية تلقائيًا من هذا التحديث. أي تفصيل غير مذكور صراحة يظل: غير متوفر في المصادر.',
    'سجل المصادر': sourceUrl ? `${source.sourceName}: ${sourceUrl}` : source.sourceName,
  };

  const report = await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title,
      summary,
      body: buildBody(sections),
      confidence: source.sourceName === 'The Athletic' ? 'C' : 'B',
      reportType: 'TEAM_PROFILE',
      sourceName: source.sourceName,
      sourceUrl,
      sourceCategory: source.sourceCategory,
      provider: source.provider,
      tacticalTags: ['source inbox', source.sourceName],
      strengths: [],
      weaknesses: ['automatic inbox intake requires source review before adding detailed tactical claims'],
      lastCheckedAt: new Date(),
    },
    include: {
      team: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({
    success: true,
    status: 'imported',
    report,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'POST newsletter/email payloads here from Gmail forwarding, Zapier, Make, or any webhook. Use ADMIN_CRON_SECRET or SOURCE_INBOX_SECRET.',
    requiredAuth: ['Authorization: Bearer <secret>', 'x-source-inbox-secret: <secret>', '?secret=<secret>'],
    payload: {
      from: 'newsletter@example.com',
      subject: 'Mexico World Cup update',
      body: 'Short email body or extracted summary',
      sourceUrl: 'https://example.com/article',
      teamCode: 'MEX',
      teamName: 'Mexico',
    },
  });
}
