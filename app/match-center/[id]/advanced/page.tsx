import Link from 'next/link';
import { getMatchAdvancedVisualsData } from '@/lib/match-page/advancedVisualsData';
import { formatEgyptDateTime } from '@/lib/match-page/egyptTime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };

type AdvancedVisualsData = NonNullable<Awaited<ReturnType<typeof getMatchAdvancedVisualsData>>>;

function number(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <b className="mt-2 block text-2xl text-white">{value}</b>
      {hint && <span className="mt-1 block text-[11px] font-bold text-slate-500">{hint}</span>}
    </div>
  );
}

function QualityPill({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'neutral' }) {
  const toneClass = tone === 'good'
    ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]'
    : tone === 'warn'
      ? 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]'
      : 'border-white/10 bg-black/25 text-slate-300';

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-[11px] font-black opacity-80">{label}</p>
      <b className="mt-1 block text-sm text-white">{value}</b>
    </div>
  );
}

function DataQualityPanel({ data }: { data: AdvancedVisualsData }) {
  const duplicatesRemoved = Number((data.summary as any).duplicatesRemoved || 0);
  const hasShotmap = data.shotmap.length > 0;
  const qualityLabel = hasShotmap ? 'Verified Snapshot' : 'Waiting Snapshot';

  return (
    <section className="rounded-[2rem] border border-[#18E58F]/15 bg-[#18E58F]/[0.045] p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">جودة بيانات التحليل المتقدم</h2>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-300">
            هذه البطاقة تشرح حالة الـ Snapshot المستخدم في خريطة التسديدات، حتى لا تحتاج لفتح JSON للتأكد من جودة البيانات.
          </p>
        </div>
        <span className={`rounded-full border px-4 py-2 text-xs font-black ${hasShotmap ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]' : 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]'}`}>
          {qualityLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <QualityPill label="مصدر البيانات" value={data.source || 'Snapshot محفوظ'} tone={hasShotmap ? 'good' : 'warn'} />
        <QualityPill label="آخر تحديث" value={formatEgyptDateTime(data.lastUpdatedAt)} />
        <QualityPill label="تسديدات بعد التنظيف" value={data.shotmap.length} tone={hasShotmap ? 'good' : 'warn'} />
        <QualityPill label="تكرارات محذوفة" value={duplicatesRemoved} tone={duplicatesRemoved > 0 ? 'warn' : 'neutral'} />
        <QualityPill label="DB-only" value="لا يوجد جلب مباشر" tone="good" />
      </div>

      {duplicatesRemoved > 0 && (
        <p className="mt-3 rounded-2xl border border-[#F8C846]/20 bg-[#F8C846]/10 p-3 text-xs font-bold leading-6 text-[#F8C846]">
          تم حذف {duplicatesRemoved} تسديدة مكررة من العرض والملخص حتى لا تتضاعف أرقام xG أو إجمالي التسديدات بسبب تكرار نفس اللقطة في أكثر من Snapshot.
        </p>
      )}
    </section>
  );
}

function ShotMap({ data }: { data: AdvancedVisualsData }) {
  const shots = data.shotmap.slice(0, 80);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#072017] p-4 shadow-2xl">
      <div className="relative mx-auto aspect-[16/10] max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#0b3b25]">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
        <div className="absolute inset-x-6 top-1/2 h-px bg-white/30" />
        <div className="absolute left-[8%] top-[24%] h-[52%] w-[18%] rounded-r-2xl border border-white/25" />
        <div className="absolute right-[8%] top-[24%] h-[52%] w-[18%] rounded-l-2xl border border-white/25" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />

        {shots.map((shot, index) => {
          const size = Math.max(9, Math.min(26, 8 + Number(shot.xg || 0) * 36));
          const isHome = shot.teamId === data.homeTeam.id;
          const color = shot.isGoal ? 'bg-[#F8C846] ring-[#F8C846]/40' : isHome ? 'bg-white ring-white/30' : 'bg-[#18E58F] ring-[#18E58F]/30';
          return (
            <div
              key={`${shot.id || index}-${index}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ${color}`}
              style={{ left: `${shot.x ?? 50}%`, top: `${shot.y ?? 50}%`, width: size, height: size }}
              title={`${shot.playerName || 'تسديدة'} · xG ${number(shot.xg, 2)}`}
            />
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
        <span><i className="ml-1 inline-block h-3 w-3 rounded-full bg-white" />{data.homeTeam.name}</span>
        <span><i className="ml-1 inline-block h-3 w-3 rounded-full bg-[#18E58F]" />{data.awayTeam.name}</span>
        <span><i className="ml-1 inline-block h-3 w-3 rounded-full bg-[#F8C846]" />هدف</span>
      </div>
    </div>
  );
}

export default async function MatchAdvancedVisualsPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getMatchAdvancedVisualsData(id);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#04110D] p-6 text-white" dir="rtl">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="text-2xl font-black">المباراة غير موجودة</h1>
          <Link href="/matches" className="mt-4 inline-flex rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold">العودة للمباريات</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#04110D] px-3 py-5 text-white" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5">
          <Link href={`/match-center/${data.matchId}`} className="mb-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">العودة لصفحة المباراة</Link>
          <h1 className="text-3xl font-black">خريطة التسديدات وأخطر الفرص</h1>
          <p className="mt-2 text-sm font-bold text-slate-400">{data.title} · {formatEgyptDateTime(data.matchDate)} · مصدر محفوظ: {data.source}</p>
          <p className="mt-2 text-xs font-bold text-[#18E58F]">هذه الصفحة تقرأ من قاعدة البيانات فقط ولا تجلب من أي API خارجي أثناء فتحها.</p>
        </section>

        <DataQualityPanel data={data} />

        <section className="grid gap-3 md:grid-cols-6">
          <StatCard label="إجمالي التسديدات" value={data.summary.shots} />
          <StatCard label={`تسديدات ${data.homeTeam.name}`} value={data.summary.homeShots} />
          <StatCard label={`تسديدات ${data.awayTeam.name}`} value={data.summary.awayShots} />
          <StatCard label={`xG ${data.homeTeam.name}`} value={number(data.summary.homeXg, 2)} />
          <StatCard label={`xG ${data.awayTeam.name}`} value={number(data.summary.awayXg, 2)} />
          <StatCard label="على المرمى" value={data.summary.onTarget} />
        </section>

        {data.shotmap.length > 0 ? (
          <ShotMap data={data} />
        ) : (
          <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
            <h2 className="text-2xl font-black">خريطة التسديدات غير متوفرة بعد</h2>
            <p className="mt-2 font-bold text-slate-400">لا توجد بيانات shotmap محفوظة لهذه المباراة في قاعدة البيانات. عند وصول Snapshot موثق ستظهر تلقائيًا هنا.</p>
          </section>
        )}

        {data.topChances.length > 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="mb-4 text-2xl font-black">أخطر الفرص حسب xG</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.topChances.map((shot, index) => (
                <div key={`${shot.id || index}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="mb-2 inline-flex rounded-full border border-[#F8C846]/20 px-2 py-1 text-[10px] font-black text-[#F8C846]">#{index + 1}</span>
                      <h3 className="font-black text-white">{shot.playerName || 'لاعب غير محدد'}</h3>
                      <p className="text-xs font-bold text-slate-500">{shot.teamName || '—'} · الدقيقة {shot.minute || '—'} · {shot.outcome || 'تسديدة'}</p>
                    </div>
                    <span className="rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-2 text-lg font-black text-[#18E58F]">{number(shot.xg, 2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
