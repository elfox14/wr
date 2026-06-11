import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AlertTriangle, ArrowRight, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = {
  title: 'مراجعة المصادر | MC PRIME Exchange',
};

export default async function SourceReviewPage() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  const reviewReports = await prisma.teamIntelligenceReport.findMany({
    where: {
      OR: [
        { reportType: 'TEAM_PROFILE_REVIEW' },
        { tacticalTags: { has: 'NEEDS_REVIEW' } },
        { weaknesses: { has: 'NEEDS_REVIEW: automatic inbox intake requires source review before adding detailed tactical claims' } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      summary: true,
      sourceName: true,
      sourceUrl: true,
      sourceCategory: true,
      provider: true,
      confidence: true,
      publishedAt: true,
      lastCheckedAt: true,
      tacticalTags: true,
      team: { select: { id: true, name: true, code: true } },
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary"><FileText size={16} /> SOURCE REVIEW</div>
              <h1 className="text-2xl font-black text-white md:text-3xl">مصادر تحتاج مراجعة</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">هذه الصفحة تعرض تقارير النشرات والمصادر التحريرية التي تم استقبالها تلقائيًا ولكن تحتاج مراجعة قبل إضافة ادعاءات تكتيكية أو أرقام.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/source-automation" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">أتمتة المصادر <ArrowRight size={15} /></Link>
              <Link href="/admin/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">إدارة التقارير <ShieldCheck size={15} /></Link>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">لا تعتمد تفاصيل The Athletic أو أي مصدر تحريري إلا بعد قراءة المصدر. إذا لم توجد أرقام صريحة، اتركها “غير متوفر في المصادر”.</div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><AlertTriangle size={20} className="text-yellow-300" /> قائمة المراجعة</h2>
            <span className="rounded-xl bg-yellow-300/10 px-3 py-1 text-xs font-black text-yellow-100">{reviewReports.length} عنصر</span>
          </div>

          {reviewReports.length ? (
            <div className="grid gap-4">
              {reviewReports.map((report) => (
                <article key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-xl bg-yellow-300/10 px-3 py-1 text-xs font-black text-yellow-100">NEEDS_REVIEW</span>
                        <span className="rounded-xl bg-white/5 px-3 py-1 text-xs font-black text-gray-300">ثقة {report.confidence}</span>
                        <span className="rounded-xl bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{report.sourceCategory}</span>
                      </div>
                      <h3 className="font-black text-white">{report.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-gray-400">{report.summary}</p>
                      <div className="mt-3 text-xs leading-6 text-gray-500">{report.team?.name || '—'} · {report.team?.code || '—'} · {report.provider || '—'} · {report.sourceName}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {report.team?.id && <Link href={`/asset/${report.team.id}`} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-primary/40 hover:text-primary">فتح المنتخب <ExternalLink size={12} /></Link>}
                      {report.sourceUrl && <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:border-primary/50">فتح المصدر <ExternalLink size={12} /></a>}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-600">تاريخ الإضافة: {new Date(report.publishedAt).toLocaleString('ar-EG')}</div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success">لا توجد مصادر تحتاج مراجعة حاليًا.</div>
          )}
        </section>
      </main>
    </div>
  );
}
