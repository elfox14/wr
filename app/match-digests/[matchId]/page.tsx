import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart3, FileText, Image as ImageIcon, Sparkles, Trophy, Users } from 'lucide-react';
import AdSenseSlot from '@/components/ads/AdSenseSlot';
import prisma from '@/lib/prisma';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DigestRow = {
  id: string;
  matchId: string;
  matchTitle: string;
  scoreLine: string;
  statusLabel: string;
  summary: string;
  turningPoint?: string | null;
  videoScript: string;
  facebookPost?: string | null;
  infographicPoints?: unknown;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type MatchLite = {
  id: string;
  matchDate?: Date | string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  groupPhase?: string | null;
  stage?: string | null;
  homeTeam?: { id: string; name: string; code?: string | null; image?: string | null } | null;
  awayTeam?: { id: string; name: string; code?: string | null; image?: string | null } | null;
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
const articleAdSlot = process.env.NEXT_PUBLIC_ADSENSE_ARTICLE_SLOT;
const sidebarAdSlot = process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT || articleAdSlot;

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function ensureMatchDigestTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchDigest" ("id" TEXT PRIMARY KEY,"matchId" TEXT NOT NULL UNIQUE,"matchTitle" TEXT NOT NULL,"scoreLine" TEXT NOT NULL,"statusLabel" TEXT NOT NULL,"summary" TEXT NOT NULL,"turningPoint" TEXT,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}

function points(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function paragraphs(value?: string | null) {
  return String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeDate(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function formatDate(value?: Date | string | null) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(safeDate(value));
}

function teamName(team?: MatchLite['homeTeam']) {
  return team ? getArabicTeamName(team.code, team.name) : null;
}

function teamFlag(team?: MatchLite['homeTeam']) {
  if (!team) return null;
  return getTeamFlagUrl({ code: team.code, name: teamName(team) || team.name, image: team.image }, 160) || team.image || null;
}

function scoreText(match: MatchLite | null, digest: DigestRow) {
  if (match?.homeScore !== null && match?.homeScore !== undefined && match?.awayScore !== null && match?.awayScore !== undefined) return `${match.homeScore}–${match.awayScore}`;
  return digest.scoreLine;
}

async function readDigest(matchId: string) {
  await ensureMatchDigestTable();
  const rows = await prisma.$queryRawUnsafe<DigestRow[]>(`SELECT * FROM "MatchDigest" WHERE "matchId" = ${quoteSql(matchId)} AND "status" = 'published' LIMIT 1`);
  return rows[0] || null;
}

async function readMatch(matchId: string): Promise<MatchLite | null> {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      matchDate: true,
      homeScore: true,
      awayScore: true,
      groupPhase: true,
      stage: true,
      homeTeam: { select: { id: true, name: true, code: true, image: true } },
      awayTeam: { select: { id: true, name: true, code: true, image: true } },
    },
  }).catch(() => null) as Promise<MatchLite | null>;
}

function articleTitle(digest: DigestRow, match: MatchLite | null) {
  const home = teamName(match?.homeTeam);
  const away = teamName(match?.awayTeam);
  if (home && away) return `تحليل مباراة ${home} ${scoreText(match, digest)} ${away} | كأس العالم 2026`;
  return `${digest.matchTitle} | تحليل مباراة كأس العالم 2026`;
}

function articleDescription(digest: DigestRow, match: MatchLite | null) {
  const home = teamName(match?.homeTeam);
  const away = teamName(match?.awayTeam);
  const teams = home && away ? `${home} و${away}` : digest.matchTitle;
  return `تقرير وتحليل مباراة ${teams} في كأس العالم 2026: النتيجة، أهم الأحداث، مفاتيح التحليل، نقاط الإنفوغرافيك وتأثير الأداء على بورصة المونديال.`.slice(0, 170);
}

export async function generateMetadata({ params }: { params: Promise<{ matchId: string }> }): Promise<Metadata> {
  const { matchId } = await params;
  const [digest, match] = await Promise.all([readDigest(matchId), readMatch(matchId)]);
  if (!digest) return { title: 'تحليل مباراة غير متوفر | بورصة المونديال' };
  const title = articleTitle(digest, match);
  const description = articleDescription(digest, match);
  const canonical = `/match-digests/${matchId}`;
  const image = `/api/og/match-digest?matchId=${encodeURIComponent(matchId)}`;

  return {
    title,
    description,
    keywords: [
      `تحليل مباراة ${teamName(match?.homeTeam) || ''} ${teamName(match?.awayTeam) || ''}`.trim(),
      'تقرير مباراة كأس العالم 2026',
      'إحصائيات المباراة',
      'تقييم اللاعبين',
      'بورصة المونديال',
    ].filter(Boolean),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${baseUrl}${canonical}`,
      siteName: 'بورصة المونديال',
      locale: 'ar_EG',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  };
}

function JsonLd({ digest, match, title, description, url }: { digest: DigestRow; match: MatchLite | null; title: string; description: string; url: string }) {
  const home = teamName(match?.homeTeam) || 'الفريق الأول';
  const away = teamName(match?.awayTeam) || 'الفريق الثاني';
  const published = safeDate(digest.createdAt || match?.matchDate).toISOString();
  const modified = safeDate(digest.updatedAt || digest.createdAt || match?.matchDate).toISOString();

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsArticle',
    headline: title,
    description,
    inLanguage: 'ar-EG',
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'MC PRIME World Cup' },
    publisher: { '@type': 'Organization', name: 'بورصة المونديال' },
    articleSection: ['تحليل مباراة', 'كأس العالم 2026', 'إحصائيات المباراة'],
    about: [
      { '@type': 'SportsTeam', name: home },
      { '@type': 'SportsTeam', name: away },
    ],
  };

  const eventLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${home} ضد ${away}`,
    sport: 'Soccer',
    startDate: match?.matchDate ? safeDate(match.matchDate).toISOString() : published,
    eventStatus: 'https://schema.org/EventCompleted',
    homeTeam: { '@type': 'SportsTeam', name: home, image: teamFlag(match?.homeTeam) || undefined },
    awayTeam: { '@type': 'SportsTeam', name: away, image: teamFlag(match?.awayTeam) || undefined },
    description,
    url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([articleLd, eventLd]).replace(/</g, '\\u003c') }}
    />
  );
}

function TeamChip({ team }: { team?: MatchLite['homeTeam'] }) {
  const image = teamFlag(team);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
      <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
        {image ? <img src={image} alt={`علم ${teamName(team) || 'منتخب'}`} className="h-full w-full object-cover" /> : <span className="text-xs font-black text-[#F8C846]">{team?.code || '—'}</span>}
      </span>
      <span className="truncate text-sm font-black text-white">{teamName(team) || 'منتخب غير معروف'}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-black text-white">{icon}{title}</h2>
      {children}
    </section>
  );
}

export default async function MatchDigestDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const [digest, match] = await Promise.all([readDigest(matchId), readMatch(matchId)]);
  if (!digest) notFound();

  const infographicPoints = points(digest.infographicPoints);
  const title = articleTitle(digest, match);
  const description = articleDescription(digest, match);
  const canonicalUrl = `${baseUrl}/match-digests/${matchId}`;
  const home = teamName(match?.homeTeam) || 'الفريق الأول';
  const away = teamName(match?.awayTeam) || 'الفريق الثاني';
  const summaryParagraphs = paragraphs(digest.summary);
  const scriptParagraphs = paragraphs(digest.videoScript).slice(0, 5);

  return (
    <main className="min-h-screen bg-[#04110D] px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <JsonLd digest={digest} match={match} title={title} description={description} url={canonicalUrl} />

      <article className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Link href={`/match-center/${matchId}`} className="inline-flex items-center gap-2 text-sm font-black text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> العودة إلى مركز المباراة
          </Link>

          <header className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,.24)] sm:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-1 text-xs font-black text-[#18E58F]">تقرير مباراة</span>
              <span className="rounded-full border border-[#F8C846]/25 bg-[#F8C846]/10 px-3 py-1 text-xs font-black text-[#F8C846]">كأس العالم 2026</span>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-slate-400">{match?.groupPhase || match?.stage || 'تحليل نهائي'}</span>
            </div>

            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-4xl text-base font-bold leading-8 text-slate-300">{description}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <TeamChip team={match?.homeTeam} />
              <div className="rounded-2xl border border-white/10 bg-black/35 px-5 py-3 text-center text-3xl font-black tabular-nums">
                {scoreText(match, digest)}
              </div>
              <TeamChip team={match?.awayTeam} />
            </div>

            <p className="mt-4 text-xs font-bold text-slate-500">تاريخ النشر: {formatDate(digest.createdAt || match?.matchDate)}</p>
          </header>

          <section className="rounded-[1.35rem] border border-white/10 bg-black/25 p-4 sm:p-5">
            <p className="text-lg font-bold leading-9 text-slate-200">
              {summaryParagraphs[0] || digest.summary}
            </p>
          </section>

          <AdSenseSlot slot={articleAdSlot} format="auto" minHeight={120} />

          <Section title="انفوغرافيك تحليل المباراة" icon={<ImageIcon size={19} className="text-[#18E58F]" />}>
            {infographicPoints.length ? (
              <figure className="rounded-2xl border border-[#18E58F]/15 bg-[#18E58F]/[0.045] p-4">
                <figcaption className="mb-4 text-sm font-black text-[#18E58F]">نقاط تصلح مباشرة لتوليد صورة إنفوغرافيك للمقال</figcaption>
                <div className="grid gap-3 sm:grid-cols-2">
                  {infographicPoints.map((point, index) => (
                    <div key={`${point}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F8C846] text-xs font-black text-black">{index + 1}</span>
                      <p className="text-sm font-bold leading-7 text-slate-200">{point}</p>
                    </div>
                  ))}
                </div>
              </figure>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-sm font-bold leading-7 text-slate-400">
                لم يتم حفظ نقاط إنفوغرافيك بعد. يمكن توليدها من الإحصائيات النهائية بعد اعتماد المقال.
              </div>
            )}
          </Section>

          <Section title={`قراءة تحليلية: لماذا تفوق ${home} أمام ${away}?`} icon={<Trophy size={19} className="text-[#F8C846]" />}>
            <div className="space-y-4 text-base font-bold leading-9 text-slate-300">
              {(summaryParagraphs.length > 1 ? summaryParagraphs : [digest.summary]).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </Section>

          <Section title="نقطة التحول" icon={<Sparkles size={19} className="text-[#18E58F]" />}>
            <p className="text-base font-bold leading-9 text-slate-300">{digest.turningPoint || 'غير متوفر في المصادر المحفوظة.'}</p>
          </Section>

          {scriptParagraphs.length ? (
            <Section title="الجانب التكتيكي وسيناريو الفيديو" icon={<FileText size={19} className="text-[#F8C846]" />}>
              <div className="space-y-4 text-sm font-bold leading-8 text-slate-300">
                {scriptParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
            </Section>
          ) : null}

          <AdSenseSlot slot={articleAdSlot} format="auto" minHeight={140} />

          <Section title="تأثير المباراة على بورصة المونديال" icon={<BarChart3 size={19} className="text-[#18E58F]" />}>
            <p className="text-base font-bold leading-9 text-slate-300">
              هذا القسم يربط الأداء الفني بالمؤشر الافتراضي للاعبين داخل بورصة المونديال: الأهداف، صناعة الفرص، التقييمات، البطاقات، ونقطة التحول. يتم التعامل معه كتحليل رياضي وترفيهي، وليس توصية مالية أو مراهنة.
            </p>
          </Section>

          <Section title="مقالات وروابط داخلية" icon={<Users size={19} className="text-[#F8C846]" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={`/match-center/${matchId}`} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-black text-white hover:border-[#18E58F]/30">مركز المباراة الكامل</Link>
              <Link href="/match-digests" className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-black text-white hover:border-[#18E58F]/30">أرشيف تحليلات المباريات</Link>
            </div>
          </Section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <h2 className="mb-3 text-sm font-black text-white">ملخص سريع</h2>
              <div className="space-y-2 text-sm font-bold leading-7 text-slate-300">
                <p><span className="text-[#F8C846]">المباراة:</span> {home} ضد {away}</p>
                <p><span className="text-[#F8C846]">النتيجة:</span> {scoreText(match, digest)}</p>
                <p><span className="text-[#F8C846]">الحالة:</span> {digest.statusLabel}</p>
                <p><span className="text-[#F8C846]">القسم:</span> تحليل مباراة</p>
              </div>
            </section>

            <AdSenseSlot slot={sidebarAdSlot} format="rectangle" minHeight={280} className="my-0" />

            <section className="rounded-[1.35rem] border border-[#18E58F]/15 bg-[#18E58F]/[0.045] p-4">
              <h2 className="mb-2 text-sm font-black text-[#18E58F]">SEO checklist</h2>
              <ul className="space-y-2 text-xs font-bold leading-6 text-slate-400">
                <li>H1 واضح بأسماء الفريقين والنتيجة.</li>
                <li>JSON-LD SportsArticle + SportsEvent.</li>
                <li>إعلانات محجوزة الارتفاع لتقليل CLS.</li>
                <li>روابط داخلية لمركز المباراة والأرشيف.</li>
              </ul>
            </section>
          </div>
        </aside>
      </article>
    </main>
  );
}
