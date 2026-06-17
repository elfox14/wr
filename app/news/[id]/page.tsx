import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, Link2, Newspaper, User } from 'lucide-react';
import prisma from '@/lib/prisma';
import AdSenseBanner from '@/components/ads/AdSenseBanner';
import ShareButtons from '@/components/news/ShareButtons';
import { ensureWorldCup2026OpeningNews, getPressNewsMeta } from '@/lib/press-news/world-cup-2026-opening-news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

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
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
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

  if (!newsItem) {
    return { title: 'مقال غير موجود | بورصة المونديال' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const articleMeta = getPressNewsMeta(newsItem.tags, newsItem.title);
  const shortDescription = newsItem.body ? newsItem.body.slice(0, 160).trim() + '...' : '';
  const imageUrl = resolveImageUrl(baseUrl, articleMeta.image);

  return {
    title: `${newsItem.title} | بورصة المونديال`,
    description: shortDescription,
    keywords: [newsItem.category, 'أخبار كأس العالم', 'كأس العالم 2026', 'تحليل كروي', ...articleMeta.keywords],
    alternates: { canonical: `/news/${newsItem.id}` },
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

  if (!newsItem) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const pageUrl = `${baseUrl}/news/${newsItem.id}`;
  const articleMeta = getPressNewsMeta(newsItem.tags, newsItem.title);
  const words = newsItem.body ? newsItem.body.split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(words / 180));
  const paragraphs = newsItem.body
    ? newsItem.body.split(/\r?\n/).filter((p: string) => p.trim().length > 0)
    : [];

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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: newsItem.title,
    description: newsItem.body ? newsItem.body.slice(0, 160).trim() + '...' : '',
    datePublished: newsItem.publishedAt,
    dateModified: newsItem.updatedAt || newsItem.publishedAt,
    mainEntityOfPage: pageUrl,
    image: [imageUrl],
    author: { '@type': 'Organization', name: 'بورصة المونديال', url: baseUrl },
    publisher: {
      '@type': 'Organization',
      name: 'MC PRIME Sports Exchange',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/brand/borsa-mondial-sport-logo-icon.svg` },
    },
  };

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
            <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-[#0FF0FC]/10 border border-[#0FF0FC]/20 px-3.5 py-1 text-xs font-black text-[#0FF0FC]">
                  {newsItem.category}
                </span>
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

            <section className="rounded-3xl border border-white/5 bg-black/20 p-6 md:p-8 space-y-6">
              {paragraphs.map((p: string, idx: number) => (
                <p key={idx} className="text-base md:text-lg leading-8 text-gray-300 font-medium text-justify">
                  {p}
                </p>
              ))}

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
