import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, Link2, Newspaper, Radio, Sparkles, TrendingUp, User } from 'lucide-react';
import prisma from '@/lib/prisma';
import AdSenseBanner from '@/components/ads/AdSenseBanner';
import ShareButtons from '@/components/news/ShareButtons';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

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

async function getNewsArticle(id: string) {
  try {
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
    return {
      title: 'مقال غير موجود | بورصة المونديال',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const shortDescription = newsItem.body ? newsItem.body.slice(0, 160).trim() + '...' : '';

  // Safe tag extraction
  let tagList: string[] = [];
  if (Array.isArray(newsItem.tags)) {
    tagList = newsItem.tags;
  } else if (typeof newsItem.tags === 'string') {
    try {
      const parsed = JSON.parse(newsItem.tags);
      if (Array.isArray(parsed)) tagList = parsed;
    } catch {
      tagList = newsItem.tags.split(',').map((t: string) => t.trim());
    }
  }

  return {
    title: `${newsItem.title} | بورصة المونديال`,
    description: shortDescription,
    keywords: [newsItem.category, 'أخبار كأس العالم', 'تحليل كروي', ...tagList],
    alternates: {
      canonical: `/news/${newsItem.id}`,
    },
    openGraph: {
      title: newsItem.title,
      description: shortDescription,
      url: `${baseUrl}/news/${newsItem.id}`,
      type: 'article',
      publishedTime: newsItem.publishedAt,
      modifiedTime: newsItem.updatedAt || newsItem.publishedAt,
      section: newsItem.category,
      tags: tagList,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: newsItem.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: newsItem.title,
      description: shortDescription,
      images: ['/og-image.jpg'],
    },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const { id } = await params;
  const newsItem = await getNewsArticle(id);

  if (!newsItem) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const pageUrl = `${baseUrl}/news/${newsItem.id}`;

  // Estimate reading time
  const words = newsItem.body ? newsItem.body.split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(words / 180)); // ~180 words per minute for Arabic reading

  // Fetch related news (same category, excluding current)
  let relatedArticles: any[] = [];
  try {
    relatedArticles = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "PressNews" WHERE "status" = \'published\' AND "category" = $1 AND "id" != $2 ORDER BY "publishedAt" DESC LIMIT 3',
      newsItem.category,
      newsItem.id
    );
  } catch {}

  // Fetch linked entities
  let relatedTeam: any = null;
  let relatedPlayer: any = null;
  let relatedMatch: any = null;

  try {
    if (newsItem.relatedTeamId) {
      const teams = await prisma.$queryRawUnsafe<any[]>(
        'SELECT "id", "name", "code", "image" FROM "Asset" WHERE "id" = $1 LIMIT 1',
        newsItem.relatedTeamId
      );
      relatedTeam = teams[0] || null;
    }
    if (newsItem.relatedPlayerId) {
      const players = await prisma.$queryRawUnsafe<any[]>(
        'SELECT "id", "name", "image" FROM "Asset" WHERE "id" = $1 LIMIT 1',
        newsItem.relatedPlayerId
      );
      relatedPlayer = players[0] || null;
    }
    if (newsItem.relatedMatchId) {
      const matches = await prisma.$queryRawUnsafe<any[]>(
        `SELECT m."id", m."matchDate", m."status", m."homeScore", m."awayScore",
                h."name" as "homeTeamName", h."image" as "homeTeamImage",
                a."name" as "awayTeamName", a."image" as "awayTeamImage",
                m."animationMatchId"
         FROM "Match" m
         LEFT JOIN "Asset" h ON m."homeTeamId" = h."id"
         LEFT JOIN "Asset" a ON m."awayTeamId" = a."id"
         WHERE m."id" = $1 LIMIT 1`,
        newsItem.relatedMatchId
      );
      relatedMatch = matches[0] || null;
    }
  } catch (err) {
    console.error('Error loading relationships:', err);
  }

  // Split body text by newlines and format nicely
  const paragraphs = newsItem.body
    ? newsItem.body.split(/\r?\n/).filter((p: string) => p.trim().length > 0)
    : [];

  // Schema.org Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'headline': newsItem.title,
    'description': newsItem.body ? newsItem.body.slice(0, 160).trim() + '...' : '',
    'datePublished': newsItem.publishedAt,
    'dateModified': newsItem.updatedAt || newsItem.publishedAt,
    'mainEntityOfPage': pageUrl,
    'author': {
      '@type': 'Organization',
      'name': 'بورصة المونديال',
      'url': baseUrl,
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'MC PRIME Sports Exchange',
      'logo': {
        '@type': 'ImageObject',
        'url': `${baseUrl}/brand/borsa-mondial-sport-logo-icon.svg`,
      },
    },
    'about': [
      relatedTeam && { '@type': 'SportsTeam', 'name': relatedTeam.name, 'identifier': relatedTeam.id },
      relatedPlayer && { '@type': 'Person', 'name': relatedPlayer.name, 'identifier': relatedPlayer.id },
    ].filter(Boolean),
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white px-4 py-8 sm:px-6 lg:px-8" dir="rtl">
      {/* Schema Markup for search engine crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-7xl">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">الرئيسية</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-white transition-colors">الأخبار والتحليلات</Link>
          <span>/</span>
          <span className="text-gray-300 line-clamp-1">{newsItem.title}</span>
        </nav>

        {/* Content Layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          
          {/* Main Article Column */}
          <article className="space-y-6">
            
            {/* Header Block */}
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
                {/* Share component */}
                <ShareButtons title={newsItem.title} url={pageUrl} />
              </div>
            </header>

            {/* AdSense Placement 1 */}
            <AdSenseBanner slot="5678901234" format="horizontal" className="my-2" />

            {/* Paragraph Content */}
            <section className="rounded-3xl border border-white/5 bg-black/20 p-6 md:p-8 space-y-6">
              {paragraphs.map((p: string, idx: number) => (
                <p
                  key={idx}
                  className="text-base md:text-lg leading-8 text-gray-300 font-medium text-justify"
                >
                  {p}
                </p>
              ))}

              {newsItem.sourceUrl && (
                <div className="mt-8 border-t border-white/5 pt-4 text-xs font-bold text-gray-500">
                  لقراءة الخبر الأصلي من مصدره: 
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

            {/* AdSense Placement 2 */}
            <AdSenseBanner slot="3456789012" format="auto" className="my-4" />

            {/* Back Button */}
            <div className="flex">
              <Link
                href="/news"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black text-white hover:bg-white/10 transition-colors"
              >
                <ArrowRight size={14} /> العودة لغرفة الأخبار
              </Link>
            </div>

          </article>

          {/* Sidebar / Related Info Column */}
          <aside className="space-y-6">
            
            {/* Linked Entities widgets (Teams/Players/Matches) */}
            {(relatedTeam || relatedPlayer || relatedMatch) && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <h3 className="text-sm font-black text-[#FFD700] flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                  <Sparkles size={14} /> عناصر مرتبطة بالتحليل
                </h3>
                <div className="space-y-3">
                  
                  {/* Linked Team */}
                  {relatedTeam && (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {relatedTeam.image ? (
                          <img src={relatedTeam.image} alt={relatedTeam.name} className="h-8 w-8 object-contain rounded-md" />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-white/5 flex items-center justify-center font-bold text-[#0FF0FC] text-[10px]">
                            {relatedTeam.code || 'TEAM'}
                          </div>
                        )}
                        <div>
                          <span className="block text-xs font-black text-white">{relatedTeam.name}</span>
                          <span className="block text-[10px] font-bold text-gray-500">منتخب كأس العالم</span>
                        </div>
                      </div>
                      <Link
                        href={`/teams/${relatedTeam.id}`}
                        className="rounded-xl bg-[#0FF0FC]/10 px-3 py-1.5 text-[10px] font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black transition-colors"
                      >
                        الملف
                      </Link>
                    </div>
                  )}

                  {/* Linked Player */}
                  {relatedPlayer && (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {relatedPlayer.image ? (
                          <img src={relatedPlayer.image} alt={relatedPlayer.name} className="h-8 w-8 object-cover rounded-full" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-[#FFD700]">
                            <User size={14} />
                          </div>
                        )}
                        <div>
                          <span className="block text-xs font-black text-white">{relatedPlayer.name}</span>
                          <span className="block text-[10px] font-bold text-gray-500">لاعب مرتبط</span>
                        </div>
                      </div>
                      <Link
                        href={`/asset/${relatedPlayer.id}`}
                        className="rounded-xl bg-[#FFD700]/10 px-3 py-1.5 text-[10px] font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-colors"
                      >
                        البورصة
                      </Link>
                    </div>
                  )}

                  {/* Linked Match */}
                  {relatedMatch && (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3 space-y-2">
                      <div className="text-[10px] font-bold text-gray-500">مباراة المونديال المرتبطة</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-gray-200">{relatedMatch.homeTeamName}</span>
                        <span className="px-2 py-0.5 rounded bg-white/5 font-mono text-xs text-white">
                          {['FINISHED', 'IN_PLAY', 'LIVE', 'HT'].includes(String(relatedMatch.status).toUpperCase())
                            ? `${relatedMatch.homeScore} - ${relatedMatch.awayScore}`
                            : 'VS'}
                        </span>
                        <span className="text-xs font-black text-gray-200">{relatedMatch.awayTeamName}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Link
                          href={`/match-center/${relatedMatch.id}`}
                          className="w-full text-center rounded-xl bg-white/5 py-1.5 text-[10px] font-black text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          مركز المباراة
                        </Link>
                        {relatedMatch.animationMatchId && (
                          <Link
                            href={`/animation-live/player?matchId=${relatedMatch.animationMatchId}&lang=en&statsPanel=simple&teamPanel=1`}
                            className="w-full text-center rounded-xl bg-[#FFD700]/10 py-1.5 text-[10px] font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-colors flex items-center justify-center gap-1"
                          >
                            <Radio size={11} /> أنيميشن
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </section>
            )}

            {/* Sidebar AdSense Placement */}
            <AdSenseBanner slot="7890123456" format="rectangle" className="my-2" />

            {/* Stock Market Warning */}
            <section className="rounded-3xl border border-[#FFD700]/20 bg-[#FFD700]/[0.02] p-5 space-y-2">
              <h4 className="text-xs font-black text-[#FFD700] flex items-center gap-1">
                <TrendingUp size={14} /> تنويه التداول الافتراضي
              </h4>
              <p className="text-[11px] font-bold leading-5 text-gray-400">
                هذا المحتوى مقدم بغرض الرصد الصحفي والتحليل الكروي فقط. لا تمثل هذه البيانات أي نصائح مالية أو توصيات تداول مباشرة لشراء أو بيع أسهم المنتخبات واللاعبين داخل بورصة المونديال الافتراضية.
              </p>
            </section>

          </aside>
        </div>

        {/* Bottom Related Articles Section */}
        {relatedArticles.length > 0 && (
          <section className="mt-12 border-t border-white/5 pt-8 space-y-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Newspaper size={20} className="text-[#0FF0FC]" /> تحليلات أخرى قد تهمك
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedArticles.map((article) => (
                <article
                  key={article.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 flex flex-col justify-between hover:bg-white/[0.04] hover:border-[#0FF0FC]/20 transition-all"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-500">
                      {formatDate(article.publishedAt)}
                    </span>
                    <h4 className="line-clamp-2 font-black text-sm leading-6 text-white hover:text-[#0FF0FC]">
                      <Link href={`/news/${article.id}`}>{article.title}</Link>
                    </h4>
                  </div>
                  <Link
                    href={`/news/${article.id}`}
                    className="mt-4 text-[11px] font-black text-[#0FF0FC] hover:underline block"
                  >
                    قراءة التحليل ←
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
