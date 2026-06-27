import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

type ArticleRow = {
  id: string;
  matchId: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  body: string;
  sections: any;
  statsSummary: any;
  status: string;
  seoScore: number;
  heroImageUrl: string | null;
  infographicImageUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  matchDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  groupPhase: string | null;
  stage: string | null;
};

function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://worldcup.mcprim.com').replace(/\/$/, '');
}

function absoluteUrl(path?: string | null) {
  if (!path) return `${baseUrl()}/news-image/world-cup-2026`;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

async function getArticle(slug: string, isAdmin: boolean) {
  await ensurePostMatchContentTables();
  const statusCondition = isAdmin ? '' : `AND article."status" = 'PUBLISHED'`;
  const rows = await prisma.$queryRawUnsafe<ArticleRow[]>(`
    SELECT
      article.*,
      home."name" AS "homeTeamName",
      away."name" AS "awayTeamName",
      home."code" AS "homeTeamCode",
      away."code" AS "awayTeamCode",
      match."matchDate" AS "matchDate",
      match."homeScore" AS "homeScore",
      match."awayScore" AS "awayScore",
      match."groupPhase" AS "groupPhase",
      match."stage" AS "stage"
    FROM "MatchArticle" article
    JOIN "Match" match ON match."id" = article."matchId"
    JOIN "Asset" home ON home."id" = match."homeTeamId"
    JOIN "Asset" away ON away."id" = match."awayTeamId"
    WHERE article."slug" = $1 ${statusCondition}
    LIMIT 1
  `, slug);
  return rows[0] || null;
}

function asArray(value: any) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject(value: any) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function metricValue(value: unknown, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${value}${suffix}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug, false);
  if (!article) return { title: 'تحليل مباراة غير متوفر' };

  const image = absoluteUrl(article.heroImageUrl || `/match-article-image/${article.slug}`);
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    alternates: { canonical: `${baseUrl()}/articles/${article.slug}` },
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      type: 'article',
      url: `${baseUrl()}/articles/${article.slug}`,
      images: [{ url: image, width: 1200, height: 675, alt: article.title }],
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDescription,
      images: [image],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';
  
  const article = await getArticle(slug, isAdmin);
  if (!article) notFound();

  const sections = asArray(article.sections);
  const stats = asObject(article.statsSummary);
  const metrics = asArray(stats.metrics).slice(0, 8);
  const published = article.publishedAt || article.updatedAt;
  const imageUrl = article.heroImageUrl || `/match-article-image/${article.slug}`;
  const infographicUrl = article.infographicImageUrl || null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    image: [absoluteUrl(imageUrl)],
    datePublished: published?.toISOString(),
    dateModified: article.updatedAt?.toISOString(),
    inLanguage: 'ar',
    mainEntityOfPage: `${baseUrl()}/articles/${article.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'MC PRIME World Cup',
    },
    about: {
      '@type': 'SportsEvent',
      name: `${article.homeTeamName} ضد ${article.awayTeamName}`,
      startDate: article.matchDate?.toISOString(),
    },
  };

  return (
    <main className="min-h-screen bg-[#04110D] px-3 py-6 text-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-5xl space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-400">
          <Link href="/" className="hover:text-white">الرئيسية</Link>
          <span>/</span>
          <Link href={`/match-center/${article.matchId}`} className="hover:text-white">مركز المباراة</Link>
          <span>/</span>
          <span className="text-[#18E58F]">تحليل المباراة</span>
        </nav>

        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] shadow-2xl">
          <img src={imageUrl} alt={article.title} className="h-auto w-full border-b border-white/10 object-cover" />
          <div className="space-y-4 p-5 md:p-7">
            <p className="inline-flex rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-4 py-2 text-xs font-black text-[#18E58F]">
              تحليل بعد تأكيد البيانات · SEO Score {article.seoScore}
            </p>
            <h1 className="text-3xl font-black leading-tight md:text-5xl">{article.title}</h1>
            <p className="max-w-3xl text-sm font-bold leading-7 text-slate-300 md:text-base">{article.excerpt}</p>
            <div className="flex flex-wrap gap-3 text-xs font-black text-slate-400">
              <span>{article.homeTeamName} ضد {article.awayTeamName}</span>
              <span>·</span>
              <span>{new Date(article.matchDate).toISOString().slice(0, 10)}</span>
              <span>·</span>
              <span>{article.groupPhase ? `المجموعة ${article.groupPhase}` : article.stage || 'كأس العالم 2026'}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
            <p className="text-xs font-black text-slate-400">النتيجة النهائية</p>
            <b className="mt-2 block text-3xl text-white">{article.homeScore ?? 0} - {article.awayScore ?? 0}</b>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
            <p className="text-xs font-black text-slate-400">مصدر المقال</p>
            <b className="mt-2 block text-sm text-[#18E58F]">Final DB Snapshot</b>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
            <p className="text-xs font-black text-slate-400">آخر تحديث</p>
            <b className="mt-2 block text-sm text-[#F8C846]">{new Date(article.updatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</b>
          </div>
        </section>

        {metrics.length > 0 && (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-4 text-2xl font-black">الإحصائيات النهائية</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {metrics.map((metric: any) => (
                <div key={metric.key || metric.label} className="grid grid-cols-[75px_1fr_75px] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
                  <b className="text-[#F8C846]">{metricValue(metric.home, metric.suffix)}</b>
                  <span className="text-sm font-black text-white">{metric.label}</span>
                  <b className="text-[#18E58F]">{metricValue(metric.away, metric.suffix)}</b>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 md:p-7">
          {sections.length ? sections.map((section: any) => {
            if (section.type === 'SOCIAL_THREAD') {
              return (
                <section key={section.type} className="mt-8 rounded-2xl border border-[#1DA1F2]/20 bg-[#1DA1F2]/5 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <svg className="h-6 w-6 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                    <h2 className="text-xl font-black text-white">ثريد تويتر المقترح</h2>
                  </div>
                  <div className="space-y-3">
                    {section.content.split(/\n{2,}/).map((tweet: string, i: number) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <p className="whitespace-pre-wrap text-sm font-bold text-slate-300">{tweet.trim()}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            return (
              <section key={section.type || section.heading} className="border-b border-white/10 pb-5 last:border-b-0 last:pb-0">
                <h2 className="mb-3 text-2xl font-black text-white">{section.heading}</h2>
                <p className="whitespace-pre-wrap text-sm font-bold leading-8 text-slate-300 md:text-base">{section.content}</p>
              </section>
            );
          }) : (
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-slate-300">{article.body}</div>
          )}
        </section>

        {infographicUrl && (
          <section className="rounded-[1.5rem] border border-[#18E58F]/15 bg-[#18E58F]/[0.035] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black">إنفوجرافيك الإحصائيات</h2>
              <a href={infographicUrl} className="rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-4 py-2 text-xs font-black text-[#18E58F] hover:bg-[#18E58F] hover:text-black">
                فتح الصورة
              </a>
            </div>
            <img src={infographicUrl} alt={`إنفوجرافيك ${article.title}`} className="w-full rounded-2xl border border-white/10" />
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-bold leading-6 text-slate-400">هذا المقال مبني على البيانات المحفوظة في قاعدة البيانات بعد مرحلة التحقق. لا يتم جلب أي بيانات خارجية عند فتح الصفحة.</p>
          <Link href={`/match-center/${article.matchId}`} className="rounded-2xl border border-[#F8C846]/25 bg-[#F8C846]/10 px-4 py-3 text-xs font-black text-[#F8C846] hover:bg-[#F8C846] hover:text-black">
            العودة إلى مركز المباراة
          </Link>
        </footer>
      </article>
    </main>
  );
}
