import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { ArrowRight, Calendar, Clock, ExternalLink, Link2, Newspaper, User } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import AdSenseBanner from '@/components/ads/AdSenseBanner';
import ShareButtons from '@/components/news/ShareButtons';
import { ensureWorldCup2026OpeningNews, getPressNewsMeta } from '@/lib/press-news/world-cup-2026-opening-news';
import { buildExpandedArticleParagraphs } from '@/lib/press-news/article-expansion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MATCH_CENTER_ANALYSIS_CATEGORY = 'تحليل صفحة المباراة';

type Props = {
  params: Promise<{ id: string }>;
};

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function canViewUnpublished() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  return isAdmin(session);
}

function isPublished(newsItem: any) {
  return String(newsItem?.status || 'published') === 'published';
}

async function ensurePressNewsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PressNews" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
      "sourceName" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceType" TEXT NOT NULL DEFAULT 'newsletter',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "status" TEXT NOT NULL DEFAULT 'published',
      "importance" INTEGER NOT NULL DEFAULT 50,
      "tags" JSONB,
      "relatedTeamId" TEXT,
      "relatedPlayerId" TEXT,
      "relatedMatchId" TEXT,
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedTeamId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedPlayerId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_relatedMatchId_idx" ON "PressNews" ("relatedMatchId")');
}

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveImageUrl(baseUrl: string, image?: string) {
  if (!image) return `${baseUrl}/og-image.jpg`;
  if (/^https?:\/\//i.test(image)) return image;
  return `${baseUrl}${image.startsWith('/') ? image : `/${image}`}`;
}

function bodyParagraphs(newsItem: any) {
  return newsItem.body
    ? String(newsItem.body).split(/\r?\n/).filter((p: string) => p.trim().length > 0)
    : [];
}

function isMatchCenterArticle(newsItem: any) {
  return String(newsItem.category || '') === MATCH_CENTER_ANALYSIS_CATEGORY
    || String(newsItem.sourceType || '') === 'match_center'
    || String(newsItem.id || '').startsWith('match-center-');
}

function articleParagraphs(newsItem: any) {
  if (isMatchCenterArticle(newsItem)) return bodyParagraphs(newsItem);
  return buildExpandedArticleParagraphs(newsItem);
}

function resolveMatchCenterUrl(newsItem: any) {
  const relatedMatchId = String(newsItem.relatedMatchId || '').trim();
  if (relatedMatchId) return `/match-center/${relatedMatchId}`;
  const sourceUrl = String(newsItem.sourceUrl || '').trim();
  if (sourceUrl.startsWith('/match-center/')) return sourceUrl;
  return '';
}

async function getNewsArticle(id: string) {
  try {
    await ensurePressNewsTable();
    await ensureWorldCup2026OpeningNews(prisma);
    const items = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "PressNews" WHERE "id" = $1 LIMIT 1',
      id
    );
    return items[0] || null;
  } catch (err) {
    console.error('Error fetching news article:', err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const newsItem = await getNewsArticle(id);
  const allowUnpublished = await canViewUnpublished();

  if (!newsItem || (!isPublished(newsItem) && !allowUnpublished)) {
    return {
      title: 'مقال غير موجود | بورصة المونديال',
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const articleMeta = getPressNewsMeta(newsItem.tags, newsItem.title);
  const paragraphs = articleParagraphs(newsItem);
  const shortDescription = paragraphs.join(' ').slice(0, 158).trim() + '...';
  const imageUrl = resolveImageUrl(baseUrl, articleMeta.image);
  const draftRobots = isPublished(newsItem) ? undefined : { index: false, follow: false };

  return {
    title: `${newsItem.title} | بورصة المونديال`,
    description: shortDescription,
    keywords: [newsItem.category, 'أخبار كأس العالم', 'كأس العالم 2026', 'تحليل كروي', ...articleMeta.keywords],
    alternates: { canonical: `/news/${newsItem.id}` },
    robots: draftRobots,
    openGraph: {
      title: newsItem.title,
      description: shortDescription,
      url: `${baseUrl}/news/${newsItem.id}`,
      type: 'article',
      publishedTime: newsItem.publishedAt,
      modifiedTime: newsItem.updatedAt || newsItem.publishedAt,
      section: newsItem.category,
      tags: articleMeta.keywords,
      images: [{ url: imageUrl, width: 1200, height: 675, alt: articleMeta.imageAlt || newsItem.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: newsItem.title,
      description: shortDescription,
      images: [imageUrl],
    },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const { id } = await params;
  const newsItem = await getNewsArticle(id);
  const allowUnpublished = await canViewUnpublished();

  if (!newsItem || (!isPublished(newsItem) && !allowUnpublished)) notFound();

  const isDraft = !isPublished(newsItem);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const pageUrl = `${baseUrl}/news/${newsItem.id}`;
  const articleMeta = getPressNewsMeta(newsItem.tags, newsItem.title);
  const paragraphs = articleParagraphs(newsItem);
  const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(words / 180));
  const matchCenterUrl = resolveMatchCenterUrl(newsItem);

  let relatedArticles: any[] = [];
  try {
    relatedArticles = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "PressNews" WHERE "status" = \'published\' AND "category" = $1 AND "id" != $2 ORDER BY "publishedAt" DESC, "importance" DESC LIMIT 3',
      newsItem.category,
      newsItem.id
    );
  } catch (err) {
    console.error('Error loading related news:', err);
  }

  const imageUrl = resolveImageUrl(baseUrl, articleMeta.image);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: newsItem.title,
      description: paragraphs.join(' ').slice(0, 160).trim() + '...',
      datePublished: newsItem.publishedAt,
      dateModified: newsItem.updatedAt || newsItem.publishedAt,
      mainEntityOfPage: pageUrl,
      image: [imageUrl],
      articleSection: newsItem.category,
      keywords: articleMeta.keywords.join(', '),
      author: { '@type': 'Organization', name: 'بورصة المونديال', url: baseUrl },
      publisher: {
        '@type': 'Organization',
        name: 'MC PRIME Sports Exchange',
        logo: { '@type': 'ImageObject', url: `${baseUrl}/brand/borsa-mondial-sport-logo-icon.svg` },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: newsItem.title,
      sport: 'Football',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventCompleted',
      organizer: { '@type': 'Organization', name: 'FIFA World Cup 2026' },
      image: [imageUrl],
      description: paragraphs[0] || newsItem.title,
      ...(matchCenterUrl ? { url: `${baseUrl}${matchCenterUrl}` } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'الأخبار والتحليلات', item: `${baseUrl}/news` },
        { '@type': 'ListItem', position: 3, name: newsItem.title, item: pageUrl },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white px-4 py-8 sm:px-6 lg:px-8" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
          <Link href="/" className="transition-colors hover:text-white">الرئيسية</Link>
          <span>/</span>
          <Link href="/news" className="transition-colors hover:text-white">الأخبار والتحليلات</Link>
          <span>/</span>
          <span className="line-clamp-1 text-gray-300">{newsItem.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          <article className="space-y-6">
            {isDraft && (
              <div className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 p-4 text-sm font-black leading-7 text-[#FFD700]">
                معاينة إدارية فقط: هذا المقال حالته {newsItem.status} ولن يظهر للزوار أو في صفحة الأخبار حتى يتم نشره.
              </div>
            )}

            <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-[#0FF0FC]/10 border border-[#0FF0FC]/20 px-3.5 py-1 text-xs font-black text-[#0FF0FC]">
                  {newsItem.category}
                </span>
                {isDraft && (
                  <span className="rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3.5 py-1 text-xs font-black text-[#FFD700]">
                    غير منشور
                  </span>
                )}
                <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                  <Calendar size={13} /> {formatDate(newsItem.publishedAt)}
                </span>
                <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                  <Clock size={13} /> وقت القراءة: {readingTime} د
                </span>
              </div>
              <h1 className="text-2xl font-black leading-tight text-white md:text-4xl">
                {newsItem.title}
              </h1>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#FFD700]">
                    <User size={14} />
                  </div>
                  <span className="text-xs font-bold text-gray-400">
                    رصد وتحرير: <span className="text-white">{newsItem.sourceName}</span>
                  </span>
                </div>
                <ShareButtons title={newsItem.title} url={pageUrl} />
              </div>
            </header>

            {articleMeta.image && (
              <figure className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                <img
                  src={articleMeta.image}
                  alt={articleMeta.imageAlt || newsItem.title}
                  width={1200}
                  height={675}
                  className="w-full object-cover"
                  loading="eager"
                />
                <figcaption className="border-t border-white/5 px-5 py-3 text-xs font-bold leading-6 text-gray-400">
                  {articleMeta.imageAlt || newsItem.title}
                </figcaption>
              </figure>
            )}

            <AdSenseBanner slot="5678901234" format="horizontal" className="my-2" />

            {matchCenterUrl && (
              <section className="rounded-3xl border border-[#FFD700]/15 bg-[#FFD700]/5 p-5 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-[#FFD700]">مصدر المقال التفاعلي</div>
                    <h2 className="mt-2 text-lg font-black text-white">هذا المقال مرتبط بصفحة مباراة مباشرة</h2>
                    <p className="mt-1 text-sm font-bold leading-7 text-gray-400">
                      راجع الإحصائيات، الأحداث، والزخم الذي بُني عليه هذا التحليل من صفحة المباراة الأصلية.
                    </p>
                  </div>
                  <Link
                    href={matchCenterUrl}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 text-sm font-black text-black transition hover:bg-[#0FF0FC]"
                  >
                    العودة إلى صفحة المباراة <ExternalLink size={15} />
                  </Link>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-white/5 bg-black/20 p-6 md:p-8 space-y-6">
              {paragraphs.map((p: string, idx: number) => (
                <p key={idx} className="text-base md:text-lg leading-8 text-gray-300 font-medium text-justify">
                  {p}
                </p>
              ))}

              <div className="rounded-2xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-4 text-sm font-bold leading-7 text-gray-300">
                اقرأ أيضًا: <Link href="/news" className="text-[#0FF0FC] hover:underline">آخر أخبار كأس العالم</Link>
                <span className="px-2 text-gray-600">|</span>
                <Link href="/matches" className="text-[#0FF0FC] hover:underline">جدول المباريات</Link>
                <span className="px-2 text-gray-600">|</span>
                <Link href="/teams" className="text-[#0FF0FC] hover:underline">صفحات المنتخبات</Link>
                <span className="px-2 text-gray-600">|</span>
                <Link href="/players" className="text-[#0FF0FC] hover:underline">اللاعبون</Link>
              </div>

              {articleMeta.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  {articleMeta.keywords.slice(0, 8).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-gray-300">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {newsItem.sourceUrl && (
                <div className="mt-8 border-t border-white/5 pt-4 text-xs font-bold text-gray-500">
                  لقراءة المصدر المرجعي:
                  <a
                    href={newsItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0FF0FC] hover:underline inline-flex items-center gap-1 mr-1"
                  >
                    رابط المصدر <Link2 size={12} />
                  </a>
                </div>
              )}
            </section>

            <AdSenseBanner slot="3456789012" format="auto" className="my-4" />

            <div className="flex">
              <Link
                href="/news"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black text-white transition-colors hover:bg-white/10"
              >
                <ArrowRight size={14} /> العودة لغرفة الأخبار
              </Link>
            </div>
          </article>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <h3 className="text-sm font-black text-[#FFD700] flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                <Newspaper size={14} /> مقالات مرتبطة
              </h3>
              {relatedArticles.length > 0 ? (
                <div className="space-y-3">
                  {relatedArticles.map((item) => {
                    const itemMeta = getPressNewsMeta(item.tags, item.title);
                    return (
                      <Link key={item.id} href={`/news/${item.id}`} className="block rounded-2xl border border-white/5 bg-black/20 p-3 hover:border-[#0FF0FC]/30">
                        {itemMeta.image && (
                          <img src={itemMeta.image} alt={itemMeta.imageAlt || item.title} className="mb-3 h-24 w-full rounded-xl object-cover" loading="lazy" />
                        )}
                        <div className="text-[10px] font-bold text-gray-500">{formatDate(item.publishedAt)}</div>
                        <div className="mt-1 line-clamp-2 text-xs font-black leading-6 text-white">{item.title}</div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-bold leading-6 text-gray-500">لا توجد مقالات مرتبطة بعد.</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
