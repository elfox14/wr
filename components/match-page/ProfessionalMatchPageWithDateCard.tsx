import type { MatchPageData, MatchStatMetric } from '@/lib/match-page/types';

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

export default function ProfessionalMatchPageWithDateCard({ data }: { data: MatchPageData }) {
  const availableStats = data.stats.filter((metric) => metric.available).slice(0, 10);
  const latestEvents = data.events.slice(-12).reverse();

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
              <p className="mt-3 text-sm font-bold text-slate-400">{new Date(data.matchDate).toISOString().replace('T', ' ').slice(0, 16)} UTC</p>
            </div>
            <TeamCard team={data.awayTeam} />
          </div>
        </section>

        <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2">
          <div><b className="text-[#18E58F]">الملعب:</b> {data.venue || 'غير متوفر'}</div>
          <div><b className="text-[#18E58F]">المدينة:</b> {data.city || 'غير متوفر'}</div>
          <div><b className="text-[#18E58F]">الحكم:</b> {data.referee || 'غير متوفر'}</div>
          <div><b className="text-[#18E58F]">آخر تحديث:</b> {data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toISOString().replace('T', ' ').slice(0, 16) : 'غير متوفر'} UTC</div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-4 text-2xl font-black text-white">إحصائيات المباراة</h2>
          {availableStats.length ? <div className="grid gap-3 md:grid-cols-2">{availableStats.map((metric) => <StatRow key={metric.key} metric={metric} />)}</div> : <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center font-bold text-slate-400">الإحصائيات التفصيلية غير متوفرة حاليًا.</p>}
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-4 text-2xl font-black text-white">أحداث المباراة</h2>
          {latestEvents.length ? <div className="space-y-2">{latestEvents.map((event) => <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><b className="text-[#F8C846]">{event.minuteLabel || ''}</b> <span className="font-bold">{event.type}</span> <span className="text-slate-300">{event.detail || event.playerName || ''}</span></div>)}</div> : <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center font-bold text-slate-400">لا توجد أحداث محفوظة لهذه المباراة حتى الآن.</p>}
        </section>
      </div>
    </main>
  );
}
