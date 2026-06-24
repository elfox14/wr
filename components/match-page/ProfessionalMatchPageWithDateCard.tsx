import type { MatchPageData, MatchStatMetric, SourceChecklistItem } from '@/lib/match-page/types';
import { EGYPT_TIME_ZONE_LABEL, formatEgyptDateTime } from '@/lib/match-page/egyptTime';
import { publicSourceViews } from '@/lib/match-page/publicSourceLabels';

function value(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${value}${suffix}`;
}

function TeamCard({ team }: { team: MatchPageData['homeTeam'] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
      <div className="mx-auto mb-3 flex h-20 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {team.image ? <img src={team.image} alt={team.name} className="h-full w-full object-cover" /> : <b className="text-xl text-[#F8C846]">{team.code || team.name.slice(0, 3)}</b>}
      </div>
      <h2 className="text-xl font-black text-white">{team.name}</h2>
      <p className="mt-1 text-sm font-bold text-slate-400">{team.code || '—'}{team.fifaRank ? ` · FIFA ${team.fifaRank}` : ''}</p>
    </div>
  );
}

function StatRow({ metric }: { metric: MatchStatMetric }) {
  return (
    <div className="grid grid-cols-[70px_1fr_70px] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
      <b className="text-[#F8C846]">{value(metric.home, metric.suffix)}</b>
      <span className="text-sm font-black text-white">{metric.label}</span>
      <b className="text-[#18E58F]">{value(metric.away, metric.suffix)}</b>
    </div>
  );
}

function ChecklistBadge({ item }: { item: SourceChecklistItem }) {
  const label = item.status === 'ready' ? 'جاهز' : item.status === 'optional' ? 'اختياري' : 'ناقص';
  const tone = item.status === 'ready'
    ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]'
    : item.status === 'optional'
      ? 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]'
      : 'border-red-400/25 bg-red-400/10 text-red-200';

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <b className="text-sm text-white">{item.label}</b>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${tone}`}>{label}</span>
      </div>
      <p className="text-xs font-bold leading-6 text-slate-400">{item.note}</p>
    </div>
  );
}

export default function ProfessionalMatchPageWithDateCard({ data }: { data: MatchPageData }) {
  const availableStats = data.stats.filter((metric) => metric.available).slice(0, 10);
  const latestEvents = data.events.slice(-12).reverse();
  const shouldShowArticleCta = data.status.isFinished || String(data.status.raw || '').toUpperCase() === 'FINAL_VERIFIED';
  const matchDateEgypt = formatEgyptDateTime(data.matchDate);
  const lastUpdatedEgypt = data.lastUpdatedAt ? formatEgyptDateTime(data.lastUpdatedAt) : 'غير متوفر';
  const readyChecks = data.sourceChecklist.filter((item) => item.status === 'ready').length;
  const publicSources = publicSourceViews(data.sources);

  return (
    <main className="min-h-screen bg-[#04110D] px-3 py-5 text-white" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-4 shadow-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-300">
            <span>{data.competition}</span>
            <span>{data.groupLabel || data.stageLabel || 'مباراة'}</span>
            <span>{data.status.label || data.status.shortLabel}</span>
          </div>

          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <TeamCard team={data.homeTeam} />
            <div className="rounded-3xl border border-[#18E58F]/20 bg-black/35 px-8 py-6 text-center">
              <p className="mb-2 text-xs font-black text-slate-400">النتيجة</p>
              <div className="text-5xl font-black text-white">
                {value(data.score.home)} <span className="text-[#18E58F]">-</span> {value(data.score.away)}
              </div>
              <p className="mt-3 text-sm font-black text-[#F8C846]">{matchDateEgypt}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">الموعد معتمد على {EGYPT_TIME_ZONE_LABEL}</p>
            </div>
            <TeamCard team={data.awayTeam} />
          </div>
        </section>

        <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2">
          <div><b className="text-[#18E58F]">الملعب:</b> {data.venue || 'غير متوفر'}</div>
          <div><b className="text-[#18E58F]">المدينة:</b> {data.city || 'غير متوفر'}</div>
          <div><b className="text-[#18E58F]">الحكم:</b> {data.referee || 'غير متوفر'}</div>
          <div><b className="text-[#18E58F]">آخر تحديث:</b> {lastUpdatedEgypt} <span className="text-slate-400">({EGYPT_TIME_ZONE_LABEL})</span></div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">فحص بيانات صفحة المباراة</h2>
              <p className="mt-1 text-sm font-bold text-slate-400">الصفحة تقرأ البيانات المحفوظة في قاعدة البيانات فقط، بدون جلب مباشر من مزود خارجي أثناء فتح الصفحة.</p>
            </div>
            <span className="rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-4 py-2 text-xs font-black text-[#18E58F]">
              {readyChecks}/{data.sourceChecklist.length} عناصر جاهزة
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {data.sourceChecklist.map((item) => <ChecklistBadge key={item.label} item={item} />)}
          </div>
          {publicSources.length > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
              <b className="text-sm text-[#F8C846]">مصادر البيانات المحفوظة:</b>
              <p className="mt-2 text-xs font-bold leading-6 text-slate-400">
                {publicSources.map((source) => `${source.name}${source.lastCheckedAt ? ` (${formatEgyptDateTime(source.lastCheckedAt)})` : ''}`).join(' · ')}
              </p>
            </div>
          )}
        </section>

        {shouldShowArticleCta && (
          <section className="rounded-[1.5rem] border border-[#F8C846]/20 bg-[#F8C846]/[0.055] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">التحليل النهائي للمباراة</h2>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-300">بعد تأكيد الإحصائيات النهائية، يتم إنشاء مقال SEO احترافي مع صورة رئيسية وإنفوجرافيك من بيانات المباراة المحفوظة.</p>
              </div>
              <a href={`/articles/match/${data.id}`} className="inline-flex items-center justify-center rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-5 py-3 text-sm font-black text-[#F8C846] transition hover:bg-[#F8C846] hover:text-black">
                فتح المقال التحليلي
              </a>
            </div>
          </section>
        )}

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-4 text-2xl font-black text-white">إحصائيات المباراة</h2>
          {availableStats.length ? <div className="grid gap-3 md:grid-cols-2">{availableStats.map((metric) => <StatRow key={metric.key} metric={metric} />)}</div> : <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center font-bold text-slate-400">الإحصائيات التفصيلية غير متوفرة حاليًا.</p>}
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-4 text-2xl font-black text-white">أحداث المباراة</h2>
          {latestEvents.length ? <div className="space-y-2">{latestEvents.map((event) => <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><b className="text-[#F8C846]">{event.minuteLabel || ''}</b> <span className="font-bold">{event.type}</span> <span className="text-slate-300">{event.detail || event.playerName || ''}</span></div>)}</div> : <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center font-bold text-slate-400">لا توجد أحداث محفوظة لهذه المباراة حتى الآن.</p>}
        </section>

        {data.relatedArticles.length > 0 && (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-4 text-2xl font-black text-white">محتوى مرتبط</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.relatedArticles.map((article) => (
                <a key={article.id} href={article.href} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-[#18E58F]/30 hover:bg-[#18E58F]/10">
                  <span className="mb-2 inline-flex rounded-full border border-[#18E58F]/20 px-3 py-1 text-[11px] font-black text-[#18E58F]">{article.label}</span>
                  <h3 className="font-black text-white">{article.title}</h3>
                  <p className="mt-2 text-xs font-bold leading-6 text-slate-400">{article.summary}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
