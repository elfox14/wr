import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ matchId: string }> };

export default async function MatchArticleResolverPage({ params }: Props) {
  const { matchId } = await params;
  await ensurePostMatchContentTables();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT "slug" FROM "MatchArticle" WHERE "matchId" = $1 AND "status" = \'PUBLISHED\' ORDER BY "publishedAt" DESC NULLS LAST, "updatedAt" DESC LIMIT 1',
    matchId,
  );
  if (rows[0]?.slug) redirect(`/articles/${rows[0].slug}`);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  const title = match ? `${match.homeTeam.name} ضد ${match.awayTeam.name}` : 'المباراة';

  return (
    <main className="min-h-screen bg-[#04110D] px-4 py-10 text-white" dir="rtl">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl">
        <p className="mb-3 inline-flex rounded-full border border-[#F8C846]/25 bg-[#F8C846]/10 px-4 py-2 text-xs font-black text-[#F8C846]">المقال التحليلي قيد التجهيز</p>
        <h1 className="text-3xl font-black leading-tight">تحليل {title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-7 text-slate-300">سيظهر هنا المقال الاحترافي بعد تأكيد الإحصائيات النهائية وإنشاء صورة المقال والإنفوجرافيك من البيانات المحفوظة.</p>
        <Link href={`/match-center/${matchId}`} className="mt-6 inline-flex rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-5 py-3 text-sm font-black text-[#18E58F] hover:bg-[#18E58F] hover:text-black">العودة إلى مركز المباراة</Link>
      </section>
    </main>
  );
}
