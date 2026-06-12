import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ArrowRight, ExternalLink, PlayCircle } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import MatchMediaSourceForm from '@/components/admin/MatchMediaSourceForm';

export const dynamic = 'force-dynamic';

type AdminSession = { user?: { role?: string | null; email?: string | null } } | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = { title: 'مصادر فيديو المباريات | MC PRIME Exchange' };

export default async function AdminMatchMediaPage() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  const matches = await prisma.match.findMany({
    orderBy: { matchDate: 'asc' },
    take: 120,
    include: {
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
    },
  });

  const reports = await prisma.teamIntelligenceReport.findMany({
    where: { reportType: 'MATCH_MEDIA_SOURCE', provider: 'OFFICIAL_MATCH_MEDIA' },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: { id: true, title: true, sourceName: true, sourceUrl: true, tacticalTags: true, publishedAt: true, metrics: true },
  });

  const matchOptions = matches.map((match) => ({
    id: match.id,
    label: `${match.homeTeam.name} × ${match.awayTeam.name}`,
    matchDate: match.matchDate.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary"><PlayCircle size={16} /> MATCH MEDIA SOURCES</div>
              <h1 className="text-2xl font-black text-white md:text-3xl">مصادر فيديو المباريات الرسمية</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">أضف روابط الملخصات والأهداف والمؤتمرات الصحفية من مصادر رسمية أو قابلة للمراجعة. المنصة تعرض رابطًا أو تضمينًا فقط.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">إدارة التقارير <ArrowRight size={15} /></Link>
              <a href="/api/admin/match-media-sources" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">JSON <ExternalLink size={15} /></a>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">قاعدة التشغيل: استخدم المصدر الرسمي فقط. إذا لم يتوفر فيديو رسمي، اجعل الحالة “غير متوفر رسميًا” واكتب ملخصًا نصيًا منفصلًا.</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <MatchMediaSourceForm matches={matchOptions} />

          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><PlayCircle size={20} className="text-primary" /> آخر المصادر المحفوظة</h2>
            {reports.length ? (
              <div className="grid gap-3">
                {reports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="font-black text-white">{report.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{report.sourceName} · {report.tacticalTags.join(' · ')}</div>
                    <a href={report.sourceUrl || '#'} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-primary/40 hover:text-primary">فتح المصدر <ExternalLink size={12} /></a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-bold leading-7 text-yellow-100">لا توجد مصادر فيديو محفوظة بعد.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
