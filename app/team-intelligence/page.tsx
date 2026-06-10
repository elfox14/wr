import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, Brain, Database, ExternalLink, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'AI Team Intelligence | MC PRIME Exchange',
  description: 'مركز تقارير المنتخبات الذكية: ملفات فنية، نقاط قوة وضعف، ومؤشرات جاهزية للمنتخبات في كأس العالم.',
};

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function confidenceLabel(value?: string | null) {
  if (value === 'A') return 'موثوقية عالية';
  if (value === 'B') return 'موثوقية جيدة';
  if (value === 'C') return 'بحاجة لمراجعة';
  return 'تقدير افتتاحي';
}

export default async function TeamIntelligencePage() {
  const [reports, teamsCount] = await Promise.all([
    prisma.teamIntelligenceReport.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 24,
      include: { team: true },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
  ]);

  const coveredTeams = new Set(reports.map((report) => report.teamId)).size;
  const highConfidence = reports.filter((report) => ['A', 'B'].includes(report.confidence)).length;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <PageHeader
          title="AI Team Intelligence"
          description="مركز تقارير المنتخبات: قراءة فنية، نقاط قوة وضعف، وملفات افتتاحية قابلة للتحديث بالمصادر الرسمية والإحصائية."
          icon={<Brain size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        >
          <Link href="/market" className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-surface px-6 py-2.5 font-bold text-primary shadow-sm transition-all hover:bg-primary/10 md:w-auto">
            العودة للسوق <ArrowRight size={16} />
          </Link>
        </PageHeader>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-primary"><Trophy size={18} /> المنتخبات</div>
            <div className="text-3xl font-black text-white">{teamsCount}</div>
            <p className="mt-1 text-xs text-gray-500">إجمالي المنتخبات داخل قاعدة البيانات.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-accent"><Database size={18} /> تقارير منشورة</div>
            <div className="text-3xl font-black text-white">{reports.length}</div>
            <p className="mt-1 text-xs text-gray-500">أحدث تقارير الذكاء الفني المتاحة.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-300"><ShieldCheck size={18} /> تغطية حالية</div>
            <div className="text-3xl font-black text-white">{coveredTeams}</div>
            <p className="mt-1 text-xs text-gray-500">منتخبات لديها تقرير واحد على الأقل. عالي الثقة: {highConfidence}</p>
          </div>
        </section>

        {reports.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/10 bg-surface p-8 text-center shadow-card">
            <Sparkles className="mx-auto mb-3 text-primary" size={34} />
            <h2 className="text-2xl font-black text-white">لا توجد تقارير بعد</h2>
            <p className="mt-2 text-sm leading-7 text-gray-400">شغّل seed تقارير المنتخبات ثم ارجع لهذه الصفحة.</p>
            <code className="mt-4 inline-block rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-xs text-primary">npm run seed:team-intelligence</code>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => (
              <article key={report.id} className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card transition hover:border-primary/30">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <Link href={`/asset/${report.team.id}`} className="flex min-w-0 items-center gap-3">
                    <AssetImage image={report.team.image} type="TEAM" name={report.team.name} width={54} height={54} className="h-14 w-14 rounded-2xl border border-white/10 bg-background/60 object-cover" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-primary">{report.team.code}</div>
                      <h2 className="truncate text-lg font-black text-white">{report.team.name}</h2>
                      <p className="text-xs text-gray-500">{formatDate(report.publishedAt)}</p>
                    </div>
                  </Link>
                  <span className="shrink-0 rounded-xl border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-gray-300">{confidenceLabel(report.confidence)}</span>
                </div>

                <h3 className="text-base font-black leading-7 text-white">{report.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-7 text-gray-400">{report.summary}</p>

                {!!report.tacticalTags.length && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {report.tacticalTags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid gap-2 text-xs">
                  {!!report.strengths.length && (
                    <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.045] p-3">
                      <div className="mb-1 flex items-center gap-1 font-black text-emerald-300"><Target size={13} /> قوة</div>
                      <p className="leading-5 text-emerald-100">{report.strengths[0]}</p>
                    </div>
                  )}
                  {!!report.weaknesses.length && (
                    <div className="rounded-2xl border border-yellow-400/10 bg-yellow-400/[0.045] p-3">
                      <div className="mb-1 font-black text-yellow-300">نقطة متابعة</div>
                      <p className="leading-5 text-yellow-100">{report.weaknesses[0]}</p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Link href={`/asset/${report.team.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black transition hover:bg-primary/90">
                    فتح المنتخب <ArrowRight size={15} />
                  </Link>
                  {report.sourceUrl && (
                    <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                      المصدر <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
