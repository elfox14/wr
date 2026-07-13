import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'التحليلات والمقالات الرياضية',
  description: 'تحليلات فنية وإحصائية موثقة لأحدث مباريات كرة القدم، مبنية على بيانات المباراة النهائية.',
  alternates: { canonical: '/articles' },
  openGraph: {
    type: 'website',
    title: 'التحليلات والمقالات الرياضية',
    description: 'قراءات فنية وإحصائية موثقة لأحدث المباريات.',
    url: '/articles',
  },
};

type PublishedArticle = {
  id: string;
  matchId: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: string;
  awayTeam: string;
  competition: string | null;
};

async function loadPublishedArticles() {
  return prisma.$queryRawUnsafe<PublishedArticle[]>(`
    SELECT
      a."id", a."matchId", a."slug", a."title", a."excerpt", a."publishedAt",
      m."homeScore", m."awayScore", m."competition",
      h."name" AS "homeTeam", w."name" AS "awayTeam"
    FROM "MatchArticle" a
    JOIN "Match" m ON m."id" = a."matchId"
    JOIN "Asset" h ON h."id" = m."homeTeamId"
    JOIN "Asset" w ON w."id" = m."awayTeamId"
    WHERE a."status" = 'PUBLISHED' AND a."publishedAt" IS NOT NULL
    ORDER BY a."publishedAt" DESC
    LIMIT 48
  `).catch(() => []);
}

function formatDate(value: Date | string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));
}

function Scoreline({ article }: { article: PublishedArticle }) {
  if (article.homeScore === null || article.awayScore === null) return null;
  return (
    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-200">
      {article.homeTeam} <b className="mx-1 text-[#F8C846]">{article.homeScore}–{article.awayScore}</b> {article.awayTeam}
    </span>
  );
}

export default async function ArticlesPage() {
  const articles = await loadPublishedArticles();
  const [featured, ...rest] = articles;
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'التحليلات والمقالات الرياضية',
    url: `${base}/articles`,
    inLanguage: 'ar',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((article, index) => ({
        '@type': 'ListItem', position: index + 1, url: `${base}/articles/${article.slug}`, name: article.title,
      })),
    },
  };

  return (
    <main className="min-h-screen bg-[#06110d] px-3 py-7 text-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-bl from-[#18E58F]/15 via-white/[0.05] to-[#F8C846]/10 p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-1 text-xs font-black text-[#18E58F]">تحليلات موثقة بعد المباراة</div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">ما وراء النتيجة</h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-8 text-slate-300 sm:text-lg">قراءات فنية وإحصائية مبنية على البيانات النهائية للمباريات، مع مراجعة تحريرية قبل النشر.</p>
          <div className="mt-6 text-sm font-black text-slate-400">{articles.length ? `${articles.length} مقالًا منشورًا` : 'لا توجد مقالات منشورة بعد'}</div>
        </header>

        {featured ? (
          <>
            <section className="mt-7">
              <Link href={`/articles/${featured.slug}`} className="group grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] transition hover:-translate-y-0.5 hover:border-[#18E58F]/30 md:grid-cols-[1.2fr_0.8fr]">
                <div className="p-6 sm:p-9">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#18E58F]/10 px-3 py-1 text-xs font-black text-[#18E58F]">أحدث تحليل</span>
                    {featured.competition && <span className="text-xs font-bold text-slate-500">{featured.competition}</span>}
                  </div>
                  <h2 className="mt-5 text-3xl font-black leading-tight transition group-hover:text-[#18E58F] sm:text-5xl">{featured.title}</h2>
                  <p className="mt-4 line-clamp-3 text-base font-medium leading-8 text-slate-300">{featured.excerpt}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Scoreline article={featured} />
                    <time className="text-xs font-bold text-slate-500" dateTime={new Date(featured.publishedAt!).toISOString()}>{formatDate(featured.publishedAt)}</time>
                  </div>
                </div>
                <div className="flex min-h-52 items-center justify-center bg-gradient-to-br from-[#18E58F]/20 to-[#F8C846]/10 p-8">
                  <div className="text-center"><div className="text-6xl font-black text-white/10 sm:text-8xl">90′</div><span className="mt-4 inline-block text-sm font-black text-[#18E58F]">اقرأ التحليل الكامل ←</span></div>
                </div>
              </Link>
            </section>

            {rest.length > 0 && (
              <section className="mt-10">
                <div className="mb-5"><p className="text-xs font-black text-[#18E58F]">الأرشيف التحليلي</p><h2 className="mt-1 text-3xl font-black">أحدث المقالات</h2></div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {rest.map((article) => (
                    <article key={article.id} className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-[#18E58F]/30">
                      <div className="flex flex-wrap items-center gap-2">
                        {article.competition && <span className="text-xs font-black text-[#18E58F]">{article.competition}</span>}
                        <time className="text-[11px] font-bold text-slate-500" dateTime={new Date(article.publishedAt!).toISOString()}>{formatDate(article.publishedAt)}</time>
                      </div>
                      <h3 className="mt-4 text-xl font-black leading-8 transition group-hover:text-[#18E58F]"><Link href={`/articles/${article.slug}`}>{article.title}</Link></h3>
                      <p className="mt-3 line-clamp-3 flex-1 text-sm font-medium leading-7 text-slate-400">{article.excerpt}</p>
                      <div className="mt-5 border-t border-white/10 pt-4"><Scoreline article={article} /><Link href={`/articles/${article.slug}`} className="mt-4 block text-sm font-black text-[#18E58F]">قراءة المقال ←</Link></div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="mt-7 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-12 text-center">
            <div className="text-5xl">⚽</div><h2 className="mt-4 text-2xl font-black">المقالات قيد الإعداد</h2><p className="mt-2 text-sm font-bold text-slate-400">ستظهر هنا التحليلات التي اكتملت مراجعتها ونشرها.</p>
            <Link href="/match-center" className="mt-6 inline-flex rounded-xl bg-[#18E58F] px-5 py-3 text-sm font-black text-black">استعرض المباريات</Link>
          </section>
        )}
      </div>
    </main>
  );
}
