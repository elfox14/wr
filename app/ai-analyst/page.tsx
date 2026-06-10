import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, BookOpen, Brain, FileText, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import { MarketAnalysisBadge } from '@/features/analysis/components/MarketAnalysisBadge';
import { SmartTradeAlerts } from '@/features/analysis/components/SmartTradeAlerts';
import { analyzeFootballAsset } from '@/features/analysis/lib/analysis-adapter';
import { buildAIAnalystGroups, type NormalizedAIAnalystAsset } from '@/features/analysis/lib/ai-analyst-ranking';
import { buildSmartTradeAlerts } from '@/features/analysis/lib/smart-alerts';
import { formatVirtualCoins, getFairValue, getMarketPrice, getValueGapPercent } from '@/features/analysis/lib/value-fit';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Intelligence Hub | MC PRIME Exchange',
  description: 'مركز ذكاء كروي يربط بين تقارير المنتخبات، منهجية التسعير، السعر الافتراضي، القيمة العادلة، والتحليل الفني داخل الملعب.',
};

type ReportBackedTeam = {
  id: string;
  name: string;
  code: string;
  image: string;
  current_price: number;
  marketPrice?: number | null;
  fairValue?: number | null;
  score?: number | null;
};

type ReportBackedSignal = {
  id: string;
  title: string;
  summary: string;
  confidence?: string | null;
  publishedAt?: Date | string | null;
  team: ReportBackedTeam;
  marketGap: number;
  signal: 'opportunity' | 'watch' | 'risk';
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-center text-sm font-bold leading-7 text-gray-500">
      {text}
    </div>
  );
}

function confidenceLabel(value?: string | null) {
  if (value === 'A') return 'رسمي / عالٍ';
  if (value === 'B') return 'إحصائي موثوق';
  if (value === 'C') return 'بحاجة مراجعة';
  return 'تقدير داخلي';
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
  });
}

function getTeamMarketGap(team: ReportBackedTeam) {
  const marketPrice = Number(team.marketPrice ?? team.current_price ?? 0);
  const fairValue = Number(team.fairValue ?? team.current_price ?? 0);
  if (!marketPrice || !fairValue) return 0;
  return ((fairValue - marketPrice) / marketPrice) * 100;
}

function getReportSignal(report: { confidence?: string | null; team: ReportBackedTeam }) {
  const gap = getTeamMarketGap(report.team);
  const confidence = report.confidence || 'D';
  if ((confidence === 'A' || confidence === 'B') && gap >= 8) return 'opportunity';
  if (gap <= -10) return 'risk';
  return 'watch';
}

function ReportSignalCard({ signal }: { signal: ReportBackedSignal }) {
  const toneClass = signal.signal === 'opportunity'
    ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300'
    : signal.signal === 'risk'
      ? 'border-red-400/15 bg-red-400/5 text-red-300'
      : 'border-[#FFD700]/15 bg-[#FFD700]/5 text-[#FFD700]';
  const label = signal.signal === 'opportunity' ? 'فرصة مدعومة بتقرير' : signal.signal === 'risk' ? 'مراقبة مخاطر' : 'قائمة متابعة';

  return (
    <Link href={`/asset/${signal.team.id}`} className="group block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-primary/30 hover:bg-white/[0.04]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AssetImage image={signal.team.image || ''} type="TEAM" name={signal.team.name} width={42} height={42} className="h-11 w-11 rounded-xl border border-white/10 object-cover" />
          <div className="min-w-0">
            <div className="text-[10px] font-black text-primary">{signal.team.code} · {formatDate(signal.publishedAt)}</div>
            <h3 className="truncate font-black text-white group-hover:text-primary">{signal.team.name}</h3>
          </div>
        </div>
        <span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black ${toneClass}`}>{label}</span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black">
        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-gray-300">{confidenceLabel(signal.confidence)}</span>
        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-gray-300">Gap {signal.marketGap > 0 ? '+' : ''}{signal.marketGap.toFixed(1)}%</span>
      </div>
      <h4 className="line-clamp-2 text-sm font-black leading-6 text-white">{signal.title}</h4>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{signal.summary}</p>
    </Link>
  );
}

function AssetRow({ asset, danger = false }: { asset: NormalizedAIAnalystAsset; danger?: boolean }) {
  const analysis = analyzeFootballAsset(asset);
  const gap = getValueGapPercent(asset);
  const typeLabel = asset.type === 'TEAM' ? 'منتخب' : 'لاعب';
  const assetType = asset.type === 'TEAM' ? 'TEAM' : 'PLAYER';

  return (
    <Link href={`/asset/${asset.id}`} className="group block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <AssetImage image={asset.image || ''} type={assetType} name={asset.name || 'Asset'} width={46} height={46} className="h-12 w-12 rounded-xl border border-white/10 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-black text-white group-hover:text-[#0FF0FC]">{asset.name}</h3>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-300">{typeLabel}</span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${danger ? 'bg-red-400/10 text-red-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
              {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">السوق {formatVirtualCoins(getMarketPrice(asset))} · العادلة {formatVirtualCoins(getFairValue(asset))} · Technical {analysis.weightedScore}</p>
        </div>
        <ArrowRight size={16} className="text-gray-500 transition group-hover:text-[#0FF0FC]" />
      </div>
      <div className="mt-3">
        <MarketAnalysisBadge asset={asset} />
      </div>
    </Link>
  );
}

function Section({ title, description, icon, children, tone = 'cyan' }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode; tone?: 'cyan' | 'green' | 'red' | 'gold' }) {
  const toneClass = tone === 'green'
    ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300'
    : tone === 'red'
      ? 'border-red-400/15 bg-red-400/5 text-red-300'
      : tone === 'gold'
        ? 'border-[#FFD700]/15 bg-[#FFD700]/5 text-[#FFD700]'
        : 'border-[#0FF0FC]/15 bg-[#0FF0FC]/5 text-[#0FF0FC]';

  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-[#101217] p-4 shadow-card lg:rounded-3xl lg:p-6">
      <div className={`mb-4 inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-black ${toneClass}`}>{icon}{title}</div>
      <p className="mb-4 text-sm leading-7 text-gray-400">{description}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default async function AIAnalystPage() {
  const [rawAssets, latestTeamReports, teamReportsCount, coveredTeamsCount] = await Promise.all([
    prisma.asset.findMany({
      orderBy: [
        { score: 'desc' },
        { marketPrice: 'desc' },
      ],
      take: 120,
    }),
    prisma.teamIntelligenceReport.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 6,
      include: { team: true },
    }),
    prisma.teamIntelligenceReport.count(),
    prisma.teamIntelligenceReport.findMany({
      distinct: ['teamId'],
      select: { teamId: true },
    }),
  ]);

  const { assets, opportunities, warnings, highTechnical } = buildAIAnalystGroups(rawAssets, 6);
  const alerts = buildSmartTradeAlerts(rawAssets, 8);
  const reportSignals: ReportBackedSignal[] = latestTeamReports.map((report) => ({
    id: report.id,
    title: report.title,
    summary: report.summary,
    confidence: report.confidence,
    publishedAt: report.publishedAt,
    team: report.team,
    marketGap: getTeamMarketGap(report.team),
    signal: getReportSignal(report),
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          title="Intelligence Hub"
          description="مركز ذكي يربط بين تقارير المنتخبات، منهجية التسعير، السعر الحالي، القيمة العادلة، والتحليل الفني داخل الملعب."
          icon={<Brain size={48} />}
          glowColor="bg-[#0FF0FC]/10"
          textColor="text-[#0FF0FC]"
        />

        <section className="mb-8 rounded-[1.6rem] border border-[#FFD700]/15 bg-[#FFD700]/[0.055] p-4 shadow-card lg:rounded-3xl lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]">
                <Sparkles size={15} /> مسار القرار الذكي
              </p>
              <h2 className="text-2xl font-black text-white">حلّل أولًا، افهم التسعير، ثم افتح السوق</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-300">
                هذه الصفحة تحتفظ بقراءات الذكاء السريعة، لكن المسار الأساسي للمستخدم أصبح: مركز التحليل، منهجية التسعير، ثم السوق.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/team-intelligence" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black transition hover:bg-primary/90">
                مركز التحليل <ArrowRight size={15} />
              </Link>
              <Link href="/methodology" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">
                منهجية التسعير <BookOpen size={15} />
              </Link>
              <Link href="/market" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15">
                السوق <TrendingUp size={15} />
              </Link>
            </div>
          </div>
        </section>

        <SmartTradeAlerts alerts={alerts} />

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-5">
            <Sparkles className="mb-3 text-[#0FF0FC]" size={24} />
            <p className="text-sm text-gray-400">عدد الأصول المقروءة</p>
            <p className="mt-1 text-3xl font-black text-white">{assets.length}</p>
          </div>
          <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-5">
            <TrendingUp className="mb-3 text-emerald-300" size={24} />
            <p className="text-sm text-gray-400">أفضل فرصة فنية</p>
            <p className="mt-1 truncate text-2xl font-black text-white">{opportunities[0]?.name || 'غير متاح'}</p>
          </div>
          <div className="rounded-3xl border border-red-400/15 bg-red-400/5 p-5">
            <ShieldAlert className="mb-3 text-red-300" size={24} />
            <p className="text-sm text-gray-400">أعلى تحذير سعري</p>
            <p className="mt-1 truncate text-2xl font-black text-white">{warnings[0]?.name || 'غير متاح'}</p>
          </div>
        </div>

        <section className="mb-8 rounded-[1.6rem] border border-primary/10 bg-primary/[0.035] p-4 shadow-card lg:rounded-3xl lg:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                <FileText size={15} /> Team Intelligence Reports
              </div>
              <h2 className="text-2xl font-black text-white">تقارير المنتخبات داخل مركز الذكاء</h2>
              <p className="mt-1 text-sm leading-7 text-gray-400">
                اربط القراءة السعرية والفنية بأحدث تقارير المنتخبات الموثقة: {teamReportsCount} تقرير تغطي {coveredTeamsCount.length} منتخب.
              </p>
            </div>
            <Link href="/team-intelligence" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-black transition hover:bg-primary/90">
              فتح مركز التحليل <ArrowRight size={15} />
            </Link>
          </div>

          {reportSignals.length ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {reportSignals.slice(0, 6).map((signal) => <ReportSignalCard key={signal.id} signal={signal} />)}
            </div>
          ) : (
            <EmptyState text="لا توجد تقارير منتخبات مرتبطة بعد. شغّل seed:team-intelligence أو أضف تقريرًا يدويًا من لوحة الإدارة." />
          )}
        </section>

        {assets.length === 0 ? (
          <EmptyState text="لا توجد أصول كافية للتحليل بعد. بعد إضافة المنتخبات واللاعبين ستظهر قراءات مركز الذكاء تلقائيًا." />
        ) : (
          <div className="grid gap-5 xl:grid-cols-3">
            <Section title="فرص فنية" tone="green" icon={<TrendingUp size={16} />} description="أصول تجمع بين Technical Score جيد وسعر أقل أو قريب من القيمة العادلة.">
              {opportunities.length ? opportunities.map((asset) => <AssetRow key={asset.id} asset={asset} />) : <EmptyState text="لا توجد فرص فنية واضحة الآن." />}
            </Section>

            <Section title="تحذيرات سعرية" tone="red" icon={<TrendingDown size={16} />} description="أصول قد يكون السعر الحالي أعلى من المبرر الفني أو أكثر تقلبًا من اللازم.">
              {warnings.length ? warnings.map((asset) => <AssetRow key={asset.id} asset={asset} danger />) : <EmptyState text="لا توجد تحذيرات سعرية واضحة الآن." />}
            </Section>

            <Section title="أعلى جودة فنية" tone="cyan" icon={<Brain size={16} />} description="أفضل اللاعبين والمنتخبات من ناحية القراءة الفنية، بغض النظر عن السعر الحالي.">
              {highTechnical.length ? highTechnical.map((asset) => <AssetRow key={asset.id} asset={asset} />) : <EmptyState text="لا توجد قراءة فنية كافية الآن." />}
            </Section>
          </div>
        )}
      </div>
    </main>
  );
}
