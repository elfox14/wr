import Link from 'next/link';
import { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { ArrowRight, Brain, Database, ExternalLink, Filter, Search, ShieldCheck, Sparkles, Target, Trophy, XCircle } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'AI Team Intelligence | MC PRIME Exchange',
  description: 'مركز تقارير المنتخبات الذكية: ملفات فنية، نقاط قوة وضعف، ومؤشرات جاهزية للمنتخبات في كأس العالم.',
};

type TeamIntelligencePageProps = {
  searchParams?: Promise<{
    q?: string | string[];
    confidence?: string | string[];
  }>;
};

const CONFIDENCE_OPTIONS = [
  { value: 'A', label: 'A - موثوقية عالية' },
  { value: 'B', label: 'B - موثوقية جيدة' },
  { value: 'C', label: 'C - بحاجة لمراجعة' },
  { value: 'D', label: 'D - تقدير افتتاحي' },
];

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

function confidenceTone(value?: string | null) {
  if (value === 'A') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (value === 'B') return 'border-primary/20 bg-primary/10 text-primary';
  if (value === 'C') return 'border-yellow-400/20 bg-yellow-400/10 text-yellow-300';
  return 'border-white/10 bg-white/5 text-gray-300';
}

function getFirstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function getValidConfidence(value: string) {
  return CONFIDENCE_OPTIONS.some((option) => option.value === value) ? value : '';
}

function buildTeamIntelligenceHref(query: string, confidence: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (confidence) params.set('confidence', confidence);
  const queryString = params.toString();
  return queryString ? `/team-intelligence?${queryString}` : '/team-intelligence';
}

export default async function TeamIntelligencePage({ searchParams }: TeamIntelligencePageProps) {
  const params = await searchParams;
  const query = getFirstParam(params?.q).trim();
  const confidence = getValidConfidence(getFirstParam(params?.confidence));
  const hasFilters = Boolean(query || confidence);

  const reportWhere: Prisma.TeamIntelligenceReportWhereInput = {
    ...(confidence ? { confidence } : {}),
    ...(query ? {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
        { sourceName: { contains: query, mode: 'insensitive' } },
        { tacticalTags: { has: query } },
        {
          team: {
            is: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
                { group: { contains: query, mode: 'insensitive' } },
                { continent: { contains: query, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    } : {}),
  };

  const [reports, teamsCount, reportStats] = await Promise.all([
    prisma.teamIntelligenceReport.findMany({
      where: reportWhere,
      orderBy: { publishedAt: 'desc' },
      take: 24,
      include: { team: true },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.teamIntelligenceReport.findMany({
      select: { teamId: true, confidence: true, sourceUrl: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    }),
  ]);

  const coveredTeams = new Set(reportStats.map((report) => report.teamId)).size;
  const highConfidence = reportStats.filter((report) => ['A', 'B'].includes(report.confidence)).length;
  const sourcedReports = reportStats.filter((report) => Boolean(report.sourceUrl)).length;
  const latestReportDate = reportStats[0]?.publishedAt;
  const coveragePercent = teamsCount > 0 ? Math.round((coveredTeams / teamsCount) * 100) : 0;
  const highConfidencePercent = reportStats.length > 0 ? Math.round((highConfidence / reportStats.length) * 100) : 0;
  const sourcedPercent = reportStats.length > 0 ? Math.round((sourcedReports / reportStats.length) * 100) : 0;
  const confidenceCounts = reportStats.reduce<Record<string, number>>((counts, report) => ({
    ...counts,
    [report.confidence]: (counts[report.confidence] || 0) + 1,
  }), {});

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

        <section className="mb-8 overflow-hidden rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-5 shadow-anti-gravity lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                <Sparkles size={14} /> INTELLIGENCE COMMAND CENTER
              </p>
              <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">
                التقارير هنا هي أساس قرار السوق، وليست محتوى جانبي
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
                كل بطاقة تقرير تجمع ملخصًا فنيًا، درجة ثقة، مصدرًا عند توفره، ونقاط قوة ومتابعة تساعد المستخدم على فهم المنتخب قبل فتح ملفه أو اتخاذ أي قرار افتراضي.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/team-intelligence?confidence=A" className="rounded-2xl bg-primary px-5 py-3 text-sm font-black text-black transition hover:bg-primary/90">
                  عرض أعلى موثوقية
                </Link>
                <Link href="/market" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15">
                  اربط التحليل بالسوق
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-primary"><Trophy size={18} /> تغطية المنتخبات</div>
                <div className="text-3xl font-black text-white">{coveragePercent}%</div>
                <p className="mt-1 text-xs text-gray-500">{coveredTeams} من {teamsCount} منتخب لديهم تقارير.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-300"><ShieldCheck size={18} /> ثقة عالية</div>
                <div className="text-3xl font-black text-white">{highConfidencePercent}%</div>
                <p className="mt-1 text-xs text-gray-500">تقارير A/B من إجمالي التقارير.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-accent"><Database size={18} /> مصادر</div>
                <div className="text-3xl font-black text-white">{sourcedPercent}%</div>
                <p className="mt-1 text-xs text-gray-500">تقارير تحتوي رابط مصدر خارجي.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 text-sm font-black text-gray-300">آخر تحديث</div>
                <div className="text-2xl font-black text-white">{formatDate(latestReportDate)}</div>
                <p className="mt-1 text-xs text-gray-500">حسب أحدث تقرير منشور.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-primary"><Trophy size={18} /> المنتخبات</div>
            <div className="text-3xl font-black text-white">{teamsCount}</div>
            <p className="mt-1 text-xs text-gray-500">إجمالي المنتخبات داخل قاعدة البيانات.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-accent"><Database size={18} /> تقارير منشورة</div>
            <div className="text-3xl font-black text-white">{reportStats.length}</div>
            <p className="mt-1 text-xs text-gray-500">المعروض الآن: {reports.length}</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-300"><ShieldCheck size={18} /> تغطية حالية</div>
            <div className="text-3xl font-black text-white">{coveredTeams}</div>
            <p className="mt-1 text-xs text-gray-500">منتخبات لديها تقرير واحد على الأقل.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-yellow-300"><Target size={18} /> عالي الثقة</div>
            <div className="text-3xl font-black text-white">{highConfidence}</div>
            <p className="mt-1 text-xs text-gray-500">تقارير بدرجة A أو B.</p>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Filter size={20} className="text-primary" /> فلترة التقارير
          </div>
          <form action="/team-intelligence" className="grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]">
            <label htmlFor="team-intelligence-search" className="sr-only">ابحث عن منتخب أو تقرير</label>
            <div className="relative">
              <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                id="team-intelligence-search"
                name="q"
                defaultValue={query}
                placeholder="ابحث باسم المنتخب، الكود، المجموعة، المصدر، أو عنوان التقرير..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 pr-11 pl-4 text-sm font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-primary/50"
              />
            </div>
            <label htmlFor="team-intelligence-confidence" className="sr-only">مستوى الثقة</label>
            <select
              id="team-intelligence-confidence"
              name="confidence"
              defaultValue={confidence}
              className="h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-black text-white outline-none transition focus:border-primary/50"
            >
              <option value="">كل مستويات الثقة</option>
              {CONFIDENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-black transition hover:bg-primary/90">
              تطبيق الفلترة <Search size={15} />
            </button>
            {hasFilters && (
              <Link href="/team-intelligence" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-white transition hover:bg-white/10">
                مسح <XCircle size={15} />
              </Link>
            )}
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={buildTeamIntelligenceHref(query, '')} className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${confidence ? 'border-white/10 bg-white/5 text-gray-300 hover:border-primary/30 hover:text-primary' : 'border-primary/30 bg-primary/10 text-primary'}`}>
              كل التقارير · {reportStats.length}
            </Link>
            {CONFIDENCE_OPTIONS.map((option) => {
              const isActive = confidence === option.value;
              return (
                <Link key={option.value} href={buildTeamIntelligenceHref(query, option.value)} className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-gray-300 hover:border-primary/30 hover:text-primary'}`}>
                  {option.label} · {confidenceCounts[option.value] || 0}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-6 text-gray-500">
            {hasFilters ? `تم العثور على ${reports.length} تقرير مطابق للفلترة الحالية.` : 'استخدم البحث للوصول بسرعة لتقارير منتخب، مصدر، مجموعة، أو مستوى ثقة محدد.'}
          </p>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-primary/15 bg-primary/10 p-5 shadow-card">
            <p className="mb-2 text-xs font-black text-primary">منهجية القراءة</p>
            <h2 className="text-xl font-black text-white">ابدأ بالثقة ثم المصدر</h2>
            <p className="mt-2 text-sm leading-7 text-gray-300">درجة الثقة ليست حكمًا نهائيًا، لكنها تخبرك هل التقرير مبني على مصادر قوية أو يحتاج تحديثًا قبل القرار.</p>
          </div>
          <div className="rounded-3xl border border-accent/15 bg-accent/10 p-5 shadow-card">
            <p className="mb-2 text-xs font-black text-accent">قراءة السوق</p>
            <h2 className="text-xl font-black text-white">التقرير يسبق السعر</h2>
            <p className="mt-2 text-sm leading-7 text-gray-300">افتح المنتخب من التقرير ثم قارن التحليل الفني مع السعر والقيمة العادلة داخل صفحة الأصل.</p>
          </div>
          <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/10 p-5 shadow-card">
            <p className="mb-2 text-xs font-black text-emerald-300">تحديث مستمر</p>
            <h2 className="text-xl font-black text-white">Living Reports</h2>
            <p className="mt-2 text-sm leading-7 text-gray-300">التقارير قابلة للتحديث مع الأخبار، التشكيلات، الإصابات، والمباريات الرسمية.</p>
          </div>
        </section>

        {reports.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/10 bg-surface p-8 text-center shadow-card">
            <Sparkles className="mx-auto mb-3 text-primary" size={34} />
            <h2 className="text-2xl font-black text-white">{hasFilters ? 'لا توجد نتائج مطابقة' : 'لا توجد تقارير بعد'}</h2>
            <p className="mt-2 text-sm leading-7 text-gray-400">
              {hasFilters ? 'جرّب تغيير كلمة البحث أو مستوى الثقة لعرض تقارير أخرى.' : 'شغّل seed تقارير المنتخبات ثم ارجع لهذه الصفحة.'}
            </p>
            {hasFilters ? (
              <Link href="/team-intelligence" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-primary hover:bg-white/10">
                عرض كل التقارير <ArrowRight size={14} />
              </Link>
            ) : (
              <code className="mt-4 inline-block rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-xs text-primary">npm run seed:team-intelligence</code>
            )}
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
                  <span className={`shrink-0 rounded-xl border px-2 py-1 text-[10px] font-black ${confidenceTone(report.confidence)}`}>{confidenceLabel(report.confidence)}</span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-black">
                  <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-gray-400">{report.sourceName || 'مصدر غير محدد'}</span>
                  <span className={`rounded-full border px-2 py-1 ${report.sourceUrl ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-yellow-400/20 bg-yellow-400/10 text-yellow-300'}`}>
                    {report.sourceUrl ? 'مصدر قابل للفتح' : 'بدون رابط مصدر'}
                  </span>
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
