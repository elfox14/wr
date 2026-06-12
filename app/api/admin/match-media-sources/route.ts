import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminSession = { user?: { role?: string | null; email?: string | null } } | null;

type Payload = {
  matchId?: string;
  sourceName?: string;
  sourceUrl?: string;
  videoId?: string;
  mediaType?: string;
  licenseStatus?: string;
  region?: string;
  language?: string;
  title?: string;
  notes?: string;
};

const LICENSE_VALUES = ['official_embed', 'official_link', 'unavailable', 'needs_review'];
const MEDIA_VALUES = ['official_highlight', 'official_goal', 'replay', 'press_conference', 'shorts', 'behind_the_scenes'];

async function isAdmin() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function getVideoId(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{8,20}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '').trim();
    const id = url.searchParams.get('v');
    if (id) return id;
    const parts = url.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex((part) => part === 'shorts' || part === 'embed');
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  } catch {}
  return '';
}

function buildBody(data: Required<Pick<Payload, 'sourceName' | 'sourceUrl' | 'mediaType' | 'licenseStatus'>> & Payload) {
  const displayMode = data.licenseStatus === 'official_embed'
    ? 'تضمين من المصدر الرسمي.'
    : data.licenseStatus === 'official_link'
      ? 'رابط خارجي للمصدر الرسمي.'
      : data.licenseStatus === 'unavailable'
        ? 'غير متوفر من مصدر رسمي.'
        : 'يحتاج مراجعة قبل العرض.';

  return `مصدر فيديو المباراة: ${data.title || data.sourceName}.

حالة المصدر: ${data.licenseStatus}.

طريقة العرض: ${displayMode}

نوع المحتوى: ${data.mediaType}.

المنطقة: ${data.region || 'غير محدد'}.

اللغة: ${data.language || 'غير محدد'}.

ملاحظات: ${data.notes || 'غير متوفر في المصادر'}.`;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await request.json().catch(() => ({})) as Payload;
  const matchId = String(payload.matchId || '').trim();
  const sourceName = String(payload.sourceName || '').trim();
  const sourceUrl = String(payload.sourceUrl || '').trim();
  const mediaType = MEDIA_VALUES.includes(String(payload.mediaType)) ? String(payload.mediaType) : 'official_highlight';
  const licenseStatus = LICENSE_VALUES.includes(String(payload.licenseStatus)) ? String(payload.licenseStatus) : 'needs_review';
  const videoId = getVideoId(payload.videoId || payload.sourceUrl);

  if (!matchId || !sourceName || !sourceUrl) {
    return NextResponse.json({ success: false, error: 'matchId, sourceName and sourceUrl are required.' }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
  });

  if (!match) return NextResponse.json({ success: false, error: 'Match not found.' }, { status: 404 });

  const existing = await prisma.teamIntelligenceReport.findFirst({
    where: {
      teamId: match.homeTeamId,
      reportType: 'MATCH_MEDIA_SOURCE',
      provider: 'OFFICIAL_MATCH_MEDIA',
      metrics: { path: ['matchId'], equals: matchId },
      sourceUrl,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ success: true, skipped: true, reportId: existing.id });
  }

  const title = payload.title || `ملخص رسمي — ${match.homeTeam.name} × ${match.awayTeam.name}`;
  const report = await prisma.teamIntelligenceReport.create({
    data: {
      teamId: match.homeTeamId,
      title,
      summary: `مصدر فيديو رسمي أو رابط مرخص لمباراة ${match.homeTeam.name} × ${match.awayTeam.name}.`,
      body: buildBody({ ...payload, sourceName, sourceUrl, mediaType, licenseStatus }),
      reportType: 'MATCH_MEDIA_SOURCE',
      language: 'ar',
      sourceName,
      sourceUrl,
      sourceCategory: 'official',
      confidence: licenseStatus === 'needs_review' ? 'C' : 'B',
      provider: 'OFFICIAL_MATCH_MEDIA',
      tacticalTags: ['match-media', mediaType, licenseStatus],
      strengths: ['مصدر خارجي رسمي أو قابل للمراجعة', 'لا يتم تخزين ملف الفيديو داخل المنصة'],
      weaknesses: licenseStatus === 'needs_review' ? ['يحتاج مراجعة قبل العرض العام'] : [],
      metrics: {
        matchId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeamCode: match.homeTeam.code,
        awayTeamCode: match.awayTeam.code,
        mediaType,
        licenseStatus,
        videoId,
        region: payload.region || null,
        language: payload.language || null,
      },
      lastCheckedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, report });
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const matchId = url.searchParams.get('matchId');

  const reports = await prisma.teamIntelligenceReport.findMany({
    where: {
      reportType: 'MATCH_MEDIA_SOURCE',
      provider: 'OFFICIAL_MATCH_MEDIA',
      ...(matchId ? { metrics: { path: ['matchId'], equals: matchId } } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, sourceName: true, sourceUrl: true, confidence: true, tacticalTags: true, metrics: true, publishedAt: true },
  });

  return NextResponse.json({ ok: true, reports });
}
