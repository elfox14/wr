'use client';

function getMetrics(report: any) {
  return report?.metrics && typeof report.metrics === 'object' ? report.metrics : {};
}

function getOpponents(teamId: string, matches: any[]) {
  const opponents = new Map<string, any>();
  for (const match of matches || []) {
    const opponent = match?.homeTeam?.id === teamId ? match?.awayTeam : match?.awayTeam?.id === teamId ? match?.homeTeam : null;
    if (opponent?.id) opponents.set(opponent.id, opponent);
  }
  return [...opponents.values()];
}

export default function TeamHistoryPanel({ team, matches = [], report }: { team: any; matches?: any[]; report?: any }) {
  const metrics = getMetrics(report);
  const opponents = getOpponents(team.id, matches);
  const h2hItems = Array.isArray(metrics?.h2h) ? metrics.h2h : [];
  const timeline = Array.isArray(metrics?.worldCupTimeline) ? metrics.worldCupTimeline : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 className="text-2xl font-black mb-6">المواجهات مع فرق المجموعة</h2>
        <div className="space-y-4">
          {opponents.length === 0 && <Empty text="غير متوفر في المصادر: لا توجد مباريات مجموعة مرتبطة بهذا المنتخب حتى الآن." />}
          {opponents.map((opponent) => {
            const item = h2hItems.find((candidate: any) => {
              const name = String(candidate?.opponent || candidate?.opponentName || '').toLowerCase();
              return name && name === String(opponent.name || '').toLowerCase();
            });
            return item ? (
              <H2HCard
                key={opponent.id}
                opponent={opponent.name}
                played={item.played}
                won={item.won}
                drawn={item.drawn}
                lost={item.lost}
                goalsFor={item.goalsFor}
                goalsAgainst={item.goalsAgainst}
                lastMatch={item.lastMatch}
                source={item.sourceName || report?.sourceName}
              />
            ) : (
              <div key={opponent.id} className="bg-[#111] border border-white/10 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                  <h3 className="font-bold text-lg">ضد {opponent.name}</h3>
                  <span className="text-xs text-gray-500">غير موثق</span>
                </div>
                <p className="text-sm text-gray-500">غير متوفر في المصادر: لم يتم إدخال سجل مواجهات تاريخية موثق لهذا الخصم بعد.</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black mb-6">تاريخ كأس العالم</h2>
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#111] p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="عدد المشاركات" value={team.participations ?? 'غير متوفر في المصادر'} />
            <Info label="أفضل إنجاز" value={metrics?.bestWorldCupFinish || 'غير متوفر في المصادر'} />
            <Info label="أول مشاركة" value={metrics?.firstWorldCup || 'غير متوفر في المصادر'} />
            <Info label="آخر مشاركة" value={metrics?.lastWorldCup || 'غير متوفر في المصادر'} />
          </div>
          <p className="mt-4 text-xs text-gray-500">المصدر: {report?.sourceName || 'غير متوفر'}</p>
        </div>

        <div className="relative border-r-2 border-white/10 pr-6 space-y-8 max-h-[500px] overflow-y-auto hide-scrollbar">
          {timeline.length > 0 ? (
            timeline.map((item: any) => (
              <TimelineItem key={`${item.year}-${item.title}`} year={String(item.year || '—')} title={item.title || 'مشاركة'} desc={item.desc || item.description || 'غير متوفر في المصادر'} />
            ))
          ) : (
            <Empty text="غير متوفر في المصادر: لم يتم إدخال خط زمني موثق لمشاركات المنتخب في كأس العالم بعد." />
          )}
        </div>
      </div>
    </div>
  );
}

function H2HCard({ opponent, played, won, drawn, lost, goalsFor, goalsAgainst, lastMatch, source }: any) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
        <h3 className="font-bold text-lg">ضد {opponent}</h3>
        <span className="text-xs text-gray-400">آخر مواجهة: {lastMatch || 'غير متوفر'}</span>
      </div>
      <div className="grid grid-cols-6 gap-2 text-center text-sm">
        <Small label="لعب" value={played} />
        <Small label="فاز" value={won} />
        <Small label="تعادل" value={drawn} />
        <Small label="خسر" value={lost} />
        <Small label="له" value={goalsFor} />
        <Small label="عليه" value={goalsAgainst} />
      </div>
      <p className="mt-4 text-xs text-gray-500">المصدر: {source || 'غير متوفر'}</p>
    </div>
  );
}

function TimelineItem({ year, title, desc }: { year: string; title: string; desc: string }) {
  return (
    <div className="relative">
      <div className="absolute w-4 h-4 bg-[#0FF0FC] rounded-full -right-[33px] top-1 border-4 border-black"></div>
      <h3 className="font-black text-xl text-[#0FF0FC] mb-1">{year} — {title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p className="font-bold text-gray-100">{value}</p>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-gray-500 text-[10px]">{label}</p>
      <p className="font-bold">{value ?? 'غير متوفر'}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-[#111] p-5 text-sm text-gray-500">{text}</p>;
}
