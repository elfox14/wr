import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

export const revalidate = 300;
const sectionLabels: Record<string, string> = { matchSummary: 'ملخص المباراة', tacticalReading: 'قراءة فنية', statsAnalysis: 'ماذا تقول الأرقام؟', turningPoints: 'نقاط التحول', playerAnalysis: 'أبرز اللاعبين', groupImpact: 'أثر النتيجة', conclusion: 'الخلاصة' };

async function load(slug: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT a.*,m."matchDate",m."homeScore",m."awayScore",h."name" AS "homeTeam",w."name" AS "awayTeam" FROM "MatchArticle" a JOIN "Match" m ON m."id"=a."matchId" JOIN "Asset" h ON h."id"=m."homeTeamId" JOIN "Asset" w ON w."id"=m."awayTeamId" WHERE a."slug"=$1 AND a."status"='PUBLISHED' LIMIT 1`, slug).catch(() => []);
  return rows[0] || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const article = await load(slug);
  if (!article) return { title: 'المقال غير متوفر' };
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  return { title: article.metaTitle, description: article.metaDescription, alternates: { canonical: `${base}/articles/${article.slug}` }, openGraph: { type: 'article', title: article.metaTitle, description: article.metaDescription, url: `${base}/articles/${article.slug}`, publishedTime: article.publishedAt?.toISOString?.() || article.publishedAt } };
}

export default async function PublishedMatchArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const article = await load(slug); if (!article) notFound();
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const sections = article.sections && typeof article.sections === 'object' ? article.sections : {};
  const jsonLd = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: article.title, description: article.metaDescription, datePublished: article.publishedAt, dateModified: article.updatedAt, inLanguage: 'ar', mainEntityOfPage: `${base}/articles/${article.slug}`, about: { '@type': 'SportsEvent', name: `${article.homeTeam} ضد ${article.awayTeam}`, startDate: article.matchDate } };
  return <main className="min-h-screen bg-[#06110d] px-3 py-7 text-white" dir="rtl"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><article className="mx-auto max-w-4xl"><header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 sm:p-9"><div className="flex flex-wrap items-center gap-2 text-xs font-black"><span className="rounded-full bg-[#18E58F]/10 px-3 py-1 text-[#18E58F]">تحليل بعد المباراة</span><span className="text-slate-500">مصدر الأرقام: Snapshot نهائي موثق</span></div><h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{article.title}</h1><p className="mt-5 text-base font-bold leading-8 text-slate-300">{article.excerpt}</p><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm font-black"><span>{article.homeTeam} <b className="text-[#F8C846]">{article.homeScore}–{article.awayScore}</b> {article.awayTeam}</span><Link href={`/match-center/${article.matchId}`} className="text-[#18E58F]">صفحة المباراة ←</Link></div></header><div className="mt-6 space-y-5">{Object.entries(sectionLabels).map(([key, label]) => sections[key] ? <section key={key} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"><h2 className="text-2xl font-black text-[#F8C846]">{label}</h2><p className="mt-4 whitespace-pre-line text-base font-medium leading-9 text-slate-200">{String(sections[key])}</p></section> : null)}</div><footer className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-bold leading-6 text-slate-500">هذا المقال مبني على البيانات النهائية المحفوظة للمباراة، ومرّ بمراجعة تحريرية قبل النشر.</footer></article></main>;
}
