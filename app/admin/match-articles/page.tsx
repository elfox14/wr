import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureMatchArticleTables } from '@/lib/match-analysis/verified-article-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tone(status: string) {
  if (status === 'PUBLISHED') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (status === 'REVIEW_REQUIRED') return 'border-red-400/25 bg-red-400/10 text-red-200';
  return 'border-amber-300/25 bg-amber-300/10 text-amber-200';
}

export default async function MatchArticlesAdminPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/login');
  await ensureMatchArticleTables();
  const articles = await prisma.$queryRawUnsafe<any[]>(`SELECT a."id",a."matchId",a."title",a."slug",a."status",a."sourceSnapshotId",a."updatedAt",a."publishedAt",m."homeScore",m."awayScore",h."name" AS "homeTeam",w."name" AS "awayTeam" FROM "MatchArticle" a JOIN "Match" m ON m."id"=a."matchId" JOIN "Asset" h ON h."id"=m."homeTeamId" JOIN "Asset" w ON w."id"=m."awayTeamId" ORDER BY a."updatedAt" DESC LIMIT 100`);
  return <main className="min-h-screen bg-[#06110d] px-3 py-6 text-white" dir="rtl"><div className="mx-auto max-w-7xl space-y-5"><header className="rounded-3xl border border-white/10 bg-white/[0.05] p-6"><h1 className="text-3xl font-black">مراجعة مقالات المباريات</h1><p className="mt-2 text-sm font-bold text-slate-400">لا يُنشر أي مقال قبل المراجعة واعتماد المحرر.</p></header><section className="grid gap-3">{articles.map((article) => <article key={article.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${tone(article.status)}`}>{article.status}</span>{!article.sourceSnapshotId && <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] text-red-200">بدون Snapshot</span>}</div><h2 className="mt-3 text-lg font-black">{article.title}</h2><p className="mt-1 text-xs font-bold text-slate-400">{article.homeTeam} {article.homeScore}–{article.awayScore} {article.awayTeam}</p></div><div className="flex gap-2"><Link href={`/admin/match-articles/${article.id}`} className="rounded-xl bg-[#18E58F] px-4 py-2 text-xs font-black text-black">مراجعة وتعديل</Link>{article.status === 'PUBLISHED' && <Link href={`/articles/${article.slug}`} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black">فتح المقال</Link>}</div></article>)}{!articles.length && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-400">لا توجد مقالات مولدة بعد.</div>}</section></div></main>;
}
