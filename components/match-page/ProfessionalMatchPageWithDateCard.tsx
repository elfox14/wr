import type { MatchEventView, MatchPageData, MatchStatMetric, SourceChecklistItem } from '@/lib/match-page/types';
import { EGYPT_TIME_ZONE_LABEL, formatEgyptDateTime } from '@/lib/match-page/egyptTime';
import { publicSourceViews } from '@/lib/match-page/publicSourceLabels';

const QUICK_STAT_KEYS = ['possession', 'shots', 'shotsOnTarget', 'corners'];
const FEATURED_STAT_KEYS = ['possession', 'xg', 'shots', 'shotsOnTarget', 'corners', 'bigChances', 'yellowCards', 'redCards'];

function value(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${value}${suffix}`;
}

function safeNumber(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);
}

function statShare(metric: MatchStatMetric) {
  const home = safeNumber(metric.home);
  const away = safeNumber(metric.away);
  if (home === null || away === null) return { home: 0, away: 0, available: false };
  const total = Math.abs(home) + Math.abs(away);
  if (!total) return { home: 50, away: 50, available: true };
  return { home: Math.max(6, Math.round((Math.abs(home) / total) * 100)), away: Math.max(6, Math.round((Math.abs(away) / total) * 100)), available: true };
}

function eventKind(event: MatchEventView) {
  const text = `${event.type || ''} ${event.detail || ''}`.toLowerCase();
  if (text.includes('goal') || text.includes('هدف')) return 'goal';
  if (text.includes('red') || text.includes('حمراء')) return 'red';
  if (text.includes('yellow') || text.includes('صفراء')) return 'yellow';
  if (text.includes('sub') || text.includes('تبديل')) return 'substitution';
  if (text.includes('penalty') || text.includes('ركلة')) return 'penalty';
  return 'event';
}

function eventIcon(event: MatchEventView) {
  const kind = eventKind(event);
  if (kind === 'goal') return '⚽';
  if (kind === 'red') return '🟥';
  if (kind === 'yellow') return '🟨';
  if (kind === 'substitution') return '🔁';
  if (kind === 'penalty') return '🎯';
  return event.icon || '•';
}

function eventTone(event: MatchEventView) {
  const kind = eventKind(event);
  if (kind === 'goal') return 'border-[#18E58F]/30 bg-[#18E58F]/10';
  if (kind === 'red') return 'border-red-400/30 bg-red-400/10';
  if (kind === 'yellow') return 'border-[#F8C846]/30 bg-[#F8C846]/10';
  if (kind === 'substitution') return 'border-sky-300/25 bg-sky-300/10';
  return 'border-white/10 bg-black/25';
}

function teamNameForEvent(event: MatchEventView, data: MatchPageData) {
  if (event.teamId === data.homeTeam.id) return data.homeTeam.name;
  if (event.teamId === data.awayTeam.id) return data.awayTeam.name;
  return 'المباراة';
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

function QuickStatCard({ metric, homeName, awayName }: { metric: MatchStatMetric; homeName: string; awayName: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-xs font-black text-slate-400">{metric.label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <b className="block text-xl text-[#F8C846]">{value(metric.home, metric.suffix)}</b>
          <span className="text-[11px] font-bold text-slate-500">{homeName}</span>
        </div>
        <span className="text-xs font-black text-slate-500">ضد</span>
        <div className="text-left">
          <b className="block text-xl text-[#18E58F]">{value(metric.away, metric.suffix)}</b>
          <span className="text-[11px] font-bold text-slate-500">{awayName}</span>
        </div>
      </div>
    </div>
  );
}

function StatRow({ metric, homeName, awayName }: { metric: MatchStatMetric; homeName: string; awayName: string }) {
  const share = statShare(metric);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3 text-center">
        <div className="min-w-16 text-right">
          <b className="block text-lg text-[#F8C846]">{value(metric.home, metric.suffix)}</b>
          <span className="text-[11px] font-bold text-slate-500">{homeName}</span>
        </div>
        <span className="text-sm font-black text-white">{metric.label}</span>
        <div className="min-w-16 text-left">
          <b className="block text-lg text-[#18E58F]">{value(metric.away, metric.suffix)}</b>
          <span className="text-[11px] font-bold text-slate-500">{awayName}</span>
        </div>
      </div>
      {share.available && (
        <div className="grid grid-cols-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-2 bg-[#F8C846]" style={{ width: `${share.home}%` }} />
          <div className="ml-auto h-2 bg-[#18E58F]" style={{ width: `${share.away}%` }} />
        </div>
      )}
    </div>
  );
}

function EventTimelineItem({ event, data }: { event: MatchEventView; data: MatchPageData }) {
  const kind = eventKind(event);
  const isMajor = ['goal', 'red', 'penalty'].includes(kind);

  return (
    <div className="relative grid grid-cols-[70px_1fr] gap-3 md:grid-cols-[90px_1fr]">
      <div className="text-left">
        <span className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black text-[#F8C846]">{event.minuteLabel || '—'}</span>
      </div>
      <div className={`rounded-2xl border p-3 ${eventTone(event)} ${isMajor ? 'shadow-lg shadow-black/20' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg">{eventIcon(event)}</span>
          <b className="text-sm text-white">{event.type || 'حدث'}</b>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-black text-slate-300">{teamNameForEvent(event, data)}</span>
        </div>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-300">{event.detail || event.playerName || 'حدث محفوظ في قاعدة البيانات.'}</p>
        {event.sourceName && <p className="mt-1 text-[11px] font-bold text-slate-500">المصدر المحفوظ: {event.sourceName}</p>}
      </div>
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
  const availableStats = data.stats.filter((metric) => metric.available);
  const quickStats = QUICK_STAT_KEYS.map((key) => availableStats.find((metric) => metric.key === key)).filter(Boolean) as MatchStatMetric[];
  const featuredStats = [
    ...FEATURED_STAT_KEYS.map((key) => availableStats.find((metric) => metric.key === key)).filter(Boolean),
    ...availableStats.filter((metric) => !FEATURED_STAT_KEYS.includes(metric.key)),
  ].slice(0, 16) as MatchStatMetric[];
  const timelineEvents = [...data.events].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999)).slice(0, 45);
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

        {quickStats.length > 0 && (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white">لوحة أرقام سريعة</h2>
              <span className="rounded-full border border-[#18E58F]/20 px-3 py-1 text-[11px] font-black text-[#18E58F]">من Snapshot محفوظ</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {quickStats.map((metric) => <QuickStatCard key={metric.key} metric={metric} homeName={data.homeTeam.name} awayName={data.awayTeam.name} />)}
            </div>
          </section>
        )}

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
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-black text-white">إحصائيات المباراة</h2>
            <span className="text-xs font-bold text-slate-500">مقارنة مباشرة بين الفريقين</span>
          </div>
          {featuredStats.length ? <div className="grid gap-3 md:grid-cols-2">{featuredStats.map((metric) => <StatRow key={metric.key} metric={metric} homeName={data.homeTeam.name} awayName={data.awayTeam.name} />)}</div> : <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center font-bold text-slate-400">الإحصائيات التفصيلية غير متوفرة حاليًا.</p>}
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-black text-white">Timeline أحداث المباراة</h2>
            <span className="text-xs font-bold text-slate-500">{timelineEvents.length} حدث محفوظ</span>
          </div>
          {timelineEvents.length ? <div className="space-y-3">{timelineEvents.map((event) => <EventTimelineItem key={event.id} event={event} data={data} />)}</div> : <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center font-bold text-slate-400">لا توجد أحداث محفوظة لهذه المباراة حتى الآن.</p>}
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
