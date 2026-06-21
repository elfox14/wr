import Link from 'next/link';
import prisma from '@/lib/prisma';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import { Activity, ArrowRight, BarChart3, Flame, ShieldAlert, Sparkles, Target, Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getTodayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(value: Date) {
  return value.toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function MetricCard({ label, value, icon, accent = 'text-primary', hint }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
      <div className={`mb-3 flex items-center gap-2 text-sm font-bold ${accent}`}>{icon}{label}</div>
      <div className="text-3xl font-black text-white tabular-nums">{value}</div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default async function DailyPerformancePage() {
  const todayStart = getTodayStart();
  const performances = await prisma.playerPerformance.findMany({
    where: {
      createdAt: { gte: todayStart },
    },
    orderBy: { internalRating: 'desc' },
    take: 50,
    include: {
      asset: {
        include: { team: true },
      },
    },
  });

  const totalSynced = performances.length;
  const fixturesSynced = new Set(performances.map((item) => item.providerFixtureId).filter(Boolean)).size;
  const averageRating = totalSynced > 0
    ? Math.round((performances.reduce((sum, item) => sum + item.internalRating, 0) / totalSynced) * 10) / 10
    : 0;
  const positiveMomentum = performances.filter((item) => item.momentumImpact > 0).length;
  const negativeMomentum = performances.filter((item) => item.momentumImpact < 0).length;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="تقييمات الأداء اليومية"
          description="أفضل أداء للاعبين بعد آخر مزامنة من API-Football. هذه البيانات محفوظة في قاعدة البيانات ولا تستهلك طلبات API عند تصفح المستخدمين."
          icon={<Activity size={22} />}
        >
          <Link href="/market" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-black text-primary hover:bg-primary hover:text-black">
            افتح السوق
          </Link>
        </PageHeader>

        <div className="mb-6 rounded-3xl border border-yellow-400/10 bg-yellow-400/5 p-4 text-sm text-yellow-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} />
            <p>
              تظهر هنا نتائج الأداء التي تمت مزامنتها اليوم فقط. لو لم تظهر بيانات، فهذا يعني أن الأدمن لم يزامن مباريات اليوم بعد أو أن البطولة لم تبدأ.
            </p>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="لاعبون محدثون" value={totalSynced} icon={<Trophy size={18} />} hint="من سجلات اليوم" />
          <MetricCard label="مباريات مزامنة" value={fixturesSynced} icon={<BarChart3 size={18} />} accent="text-accent" hint="كل مباراة = طلب API واحد تقريبًا" />
          <MetricCard label="متوسط التقييم" value={averageRating ? `${averageRating}/100` : '—'} icon={<Target size={18} />} accent="text-success" />
          <MetricCard label="زخم إيجابي" value={positiveMomentum} icon={<Flame size={18} />} accent="text-primary" />
          <MetricCard label="زخم سلبي" value={negativeMomentum} icon={<ShieldAlert size={18} />} accent="text-danger" />
        </section>

        <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">أفضل أداء اليوم</h2>
              <p className="mt-1 text-sm text-gray-500">{formatDate(todayStart)}</p>
            </div>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">
              لا توجد بيانات وهمية
            </span>
          </div>

          {performances.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-background/40 p-10 text-center">
              <Sparkles className="mx-auto mb-4 text-gray-500" size={38} />
              <h3 className="mb-2 text-xl font-black text-white">لا توجد تقييمات أداء اليوم</h3>
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-gray-500">
                بعد انتهاء أي مباراة، استخدم لوحة الإدارة لمزامنة أدائها عبر fixtureId. بعدها ستظهر تقييمات اللاعبين هنا للمستخدمين بدون استهلاك أي طلبات API إضافية.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="w-full whitespace-nowrap text-right text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="p-4 text-center">#</th>
                    <th className="p-4">اللاعب</th>
                    <th className="p-4 text-center">المنتخب</th>
                    <th className="p-4 text-center">تقييم الأداء</th>
                    <th className="p-4 text-center">دقائق</th>
                    <th className="p-4 text-center">أهداف</th>
                    <th className="p-4 text-center">أسيست</th>
                    <th className="p-4 text-center">زخم</th>
                    <th className="p-4 text-center">السوق</th>
                    <th className="p-4 text-left">تحليل</th>
                  </tr>
                </thead>
                <tbody>
                  {performances.map((item, index) => (
                    <tr key={item.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-4 text-center font-black text-gray-400">{index + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <AssetImage image={item.asset.image} type="PLAYER" name={item.asset.name} width={42} height={42} className="h-11 w-11 rounded-xl border border-white/10 object-cover" />
                          <div>
                            <div className="font-black text-white">{item.asset.name}</div>
                            <div className="text-xs text-gray-500">{item.asset.position || 'PLAYER'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-300">{item.asset.team?.name || item.teamName || '-'}</td>
                      <td className="p-4 text-center text-lg font-black text-primary tabular-nums">{item.internalRating.toFixed(1)}</td>
                      <td className="p-4 text-center font-bold text-white tabular-nums">{item.minutes}</td>
                      <td className="p-4 text-center font-bold text-success tabular-nums">{item.goals}</td>
                      <td className="p-4 text-center font-bold text-accent tabular-nums">{item.assists}</td>
                      <td className={`p-4 text-center font-black tabular-nums ${item.momentumImpact >= 0 ? 'text-success' : 'text-danger'}`}>{item.momentumImpact > 0 ? '+' : ''}{item.momentumImpact}</td>
                      <td className={`p-4 text-center font-black tabular-nums ${item.marketImpact >= 0 ? 'text-success' : 'text-danger'}`}>{item.marketImpact > 0 ? '+' : ''}{item.marketImpact}</td>
                      <td className="p-4 text-left">
                        <Link href={`/asset/${item.assetId}`} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:bg-primary/20">
                          فتح <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
