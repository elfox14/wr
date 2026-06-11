import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeSearchText, textMatchesTeamAlias } from '@/lib/teamNameAliases';
import { createSourceAutomationLog } from '@/lib/sourceAutomationLog';

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
  const allowedSecrets = [process.env.ADMIN_CRON_SECRET, process.env.SOURCE_INBOX_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (!allowedSecrets.length) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';
  const headerToken = request.headers.get('x-source-inbox-secret') || '';

  return allowedSecrets.some((secret) => bearerToken === secret || queryToken === secret || headerToken === secret);
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

function buildFingerprint(payload: IntakePayload, teamId: string, provider: string) {
  const sourceUrl = normalizeSearchText(payload.sourceUrl || '');
  const subject = normalizeSearchText(payload.subject || '');
  const from = normalizeSearchText(payload.from || '');
  return [provider, teamId, sourceUrl || subject, from].join('|').slice(0, 900);
}

async function findMatchingTeam(payload: IntakePayload) {
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  const explicitCode = String(payload.teamCode || '').trim().toLowerCase();
  const explicitName = normalizeSearchText(payload.teamName || '');
  const combined = `${payload.subject || ''} ${payload.body || ''} ${payload.sourceUrl || ''} ${payload.teamName || ''}`;

  return teams.find((team) => {
    const code = String(team.code || '').toLowerCase();
    const name = normalizeSearchText(team.name);
    if (explicitCode && code === explicitCode) return true;
    if (explicitName && name === explicitName) return true;
    return textMatchesTeamAlias(combined, team);
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
    await createSourceAutomationLog({
      job: 'source-inbox-intake',
      status: 'skipped',
      imported: 0,
      skipped: 1,
      details: { reason: 'No matching team found', subject: payload.subject || null, source },
    });

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
  const fingerprint = buildFingerprint(payload, team.id, source.provider);

  const duplicate = await prisma.teamIntelligenceReport.findFirst({
    where: {
      teamId: team.id,
      provider: source.provider,
      tacticalTags: { has: `source-fingerprint:${fingerprint}` },
    },
    select: { id: true, title: true, team: { select: { name: true, code: true } } },
  });

  if (duplicate) {
    await createSourceAutomationLog({
      job: 'source-inbox-intake',
      status: 'skipped',
      imported: 0,
      skipped: 1,
      details: { reason: 'Duplicate source payload', duplicateId: duplicate.id, team: duplicate.team, sourceUrl, subject: payload.subject || null },
    });

    return NextResponse.json({
      success: true,
      status: 'duplicate_skipped',
      report: duplicate,
    });
  }

  const needsReview = source.sourceCategory === 'editorial' || source.provider === 'SOURCE_INBOX';
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
      confidence: needsReview ? 'C' : 'B',
      reportType: needsReview ? 'TEAM_PROFILE_REVIEW' : 'TEAM_PROFILE',
      sourceName: source.sourceName,
      sourceUrl,
      sourceCategory: source.sourceCategory,
      provider: source.provider,
      tacticalTags: ['source inbox', source.sourceName, needsReview ? 'NEEDS_REVIEW' : 'AUTO_IMPORTED', `source-fingerprint:${fingerprint}`],
      strengths: [],
      weaknesses: needsReview ? ['NEEDS_REVIEW: automatic inbox intake requires source review before adding detailed tactical claims'] : [],
      metrics: {
        reviewStatus: needsReview ? 'NEEDS_REVIEW' : 'AUTO_IMPORTED',
        sourceFingerprint: fingerprint,
        from: payload.from || null,
        subject: payload.subject || null,
      },
      lastCheckedAt: new Date(),
    },
    include: {
      team: { select: { id: true, name: true, code: true } },
    },
  });

  await createSourceAutomationLog({
    job: 'source-inbox-intake',
    status: 'success',
    imported: 1,
    skipped: 0,
    details: { reportId: report.id, team: report.team, provider: source.provider, needsReview },
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
