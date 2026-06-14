'use client';

function isFinished(match: any) {
  return String(match?.status || '').toUpperCase() === 'FINISHED';
}

function getTeamSide(teamId: string, match: any) {
  if (match?.homeTeam?.id === teamId) return 'home';
  if (match?.awayTeam?.id === teamId) return 'away';
  return null;
}

function getResult(teamId: string, match: any) {
  const side = getTeamSide(teamId, match);
  if (!side || !isFinished(match)) return null;
  const own = side === 'home' ? Number(match.homeScore || 0) : Number(match.awayScore || 0);
  const against = side === 'home' ? Number(match.awayScore || 0) : Number(match.homeScore || 0);
  return { own, against, label: own > against ? 'فوز' : own < against ? 'خسارة' : 'تعادل' };
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => Number.isFinite(Number(value))).map(Number);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function latestSnapshot(match: any) {
  return Array.isArray(match?.statsSnapshots) ? match.statsSnapshots[0] : null;
}

function ownStat(teamId: string, match: any, homeKey: string, awayKey: string) {
  const side = getTeamSide(teamId, match);
  const snapshot = latestSnapshot(match);
  if (!side || !snapshot) return null;
  return Number(snapshot[side === 'home' ? homeKey : awayKey]);
}

export default function TeamOverviewPanel({ team, matches = [], players = [], report }: { team: any; matches?: any[]; players?: any[]; report?: any }) {
  const finishedMatches = matches.filter(isFinished);
  const results = finishedMatches.map((match) => getResult(team.id, match)).filter(Boolean) as Array<{ own: number; against: number; label: string }>;
  const goalsFor = results.reduce((sum, item) => sum + item.own, 0);
  const goalsAgainst = results.reduce((sum, item) => sum + item.against, 0);
  const wins = results.filter((item) => item.label === 'فوز').length;
  const draws = results.filter((item) => item.label === 'تعادل').length;
  const losses = results.filter((item) => item.label === 'خسارة').length;
  const avgPossession = average(matches.map((match) => ownStat(team.id, match, 'homePossession', 'awayPossession')));
  const keyPoints = [
    ...(Array.isArray(report?.strengths) ? report.strengths.slice(0, 2) : []),
    ...(Array.isArray(report?.weaknesses) ? report.weaknesses.slice(0, 1) : []),
    ...(Array.isArray(report?.tacticalTags) ? report.tacticalTags.slice(0, 3) : []),
  ].filter(Boolean).slice(0, 3);
  const recentFinished = [...finishedMatches]
    .sort((a, b) => new Date(b.matchDate || 0).getTime() - new Date(a.matchDate || 0).getTime())
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-[#0FF0FC] rounded-full"></span>
            نظرة عامة على المنتخب
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {report?.summary || team.dataNotice || 'غير متوفر في المصادر: لا يوجد تقرير تحليلي موثق لهذا المنتخب حتى الآن.'}
          </p>
          <div className="mt-3 text-xs text-gray-500">
            المصدر: {report?.sourceName || 'قاعدة البيانات الحالية'} {report?.confidence ? `• درجة الثقة ${report.confidence}` : ''}
          </div>
          
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="مباريات موثقة" value={matches.length || 'غير متوفر'} />
            <MetricCard label="لاعبون مسجلون" value={players.length || 'غير متوفر'} />
            <MetricCard label="متوسط الاستحواذ" value={avgPossession == null ? 'غير متوفر' : `${avgPossession}%`} />
            <MetricCard label="سجل النتائج" value={results.length ? `${wins}ف / ${draws}ت / ${losses}خ` : 'غير متوفر'} />
            <MetricCard label="الأهداف المسجلة" value={results.length ? goalsFor : 'غير متوفر'} />
            <MetricCard label="الأهداف المستقبلة" value={results.length ? goalsAgainst : 'غير متوفر'} />
          </div>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-yellow-500 rounded-full"></span>
            أهم نقاط فنية للمراقبة
          </h2>
          {keyPoints.length > 0 ? (
            <ul className="space-y-4">
              {keyPoints.map((point, index) => (
                <li key={`${point}-${index}`} className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold">{index + 1}</div>
                  <div>
                    <h3 className="font-bold mb-1">{point}</h3>
                    <p className="text-sm text-gray-400">مأخوذة من التقرير الفني أو الوسوم التكتيكية المتاحة لهذا المنتخب.</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="غير متوفر في المصادر: لم يتم إدخال نقاط فنية موثقة لهذا المنتخب بعد." />
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-black mb-4 border-b border-white/10 pb-2">وضع المجموعة</h2>
          <EmptyState text="ترتيب المجموعة الكامل يحتاج بيانات Standings موثقة. سيتم عرضه هنا عند توفرها من ISPORTS أو مصدر رسمي." />
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-black mb-4 border-b border-white/10 pb-2">آخر النتائج</h2>
          {recentFinished.length > 0 ? (
            <div className="space-y-3">
              {recentFinished.map((match) => {
                const result = getResult(team.id, match);
                const opponent = match.homeTeam?.id === team.id ? match.awayTeam?.name : match.homeTeam?.name;
                return (
                  <div key={match.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                    <span className="truncate w-24 text-right">{team.name}</span>
                    <span className="font-bold bg-black px-2 py-1 rounded">{result?.own ?? 0} - {result?.against ?? 0}</span>
                    <span className="truncate w-24 text-left text-gray-400">{opponent || 'غير متوفر'}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="لا توجد نتائج منتهية موثقة لهذا المنتخب في قاعدة البيانات الحالية." />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm leading-relaxed text-gray-400">{text}</p>;
}
