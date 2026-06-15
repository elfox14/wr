'use client';

function formatDate(value?: string | null) {
  if (!value) return 'موعد غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'موعد غير محدد';
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'IN_PLAY') return 'مباشرة';
  if (value === 'FINISHED') return 'انتهت';
  if (value === 'SCHEDULED') return 'لم تبدأ';
  return status || 'غير متوفر';
}

function scoreLabel(match: any) {
  const status = String(match?.status || '').toUpperCase();
  if (status === 'SCHEDULED') return '- - -';
  const home = Number.isFinite(Number(match?.homeScore)) ? Number(match.homeScore) : 0;
  const away = Number.isFinite(Number(match?.awayScore)) ? Number(match.awayScore) : 0;
  return `${home} - ${away}`;
}

function latestSnapshot(match: any) {
  return Array.isArray(match?.statsSnapshots) ? match.statsSnapshots[0] : null;
}

export default function TeamMatchesList({ team, matches = [] }: { team?: any; matches: any[] }) {
  if (!matches.length) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-black mb-6">مباريات كأس العالم 2026</h2>
        <div className="rounded-2xl border border-white/10 bg-[#111] p-6 text-sm text-gray-400">
          لا توجد مباريات مجدولة لهذا المنتخب في الوقت الحالي.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-black mb-6">مباريات كأس العالم 2026</h2>
      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-white/5 text-gray-400 border-b border-white/10">
              <tr>
                <th className="p-4 font-normal">الحالة</th>
                <th className="p-4 font-normal">المباراة</th>
                <th className="p-4 font-normal">التاريخ</th>
                <th className="p-4 font-normal">الملعب</th>
                <th className="p-4 font-normal">الجولة</th>
                <th className="p-4 font-normal text-center">النتيجة</th>
                <th className="p-4 font-normal text-center">إحصائيات</th>
                <th className="p-4 font-normal text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {matches.map((match: any) => {
                const snapshot = latestSnapshot(match);
                const label = statusLabel(match.status);
                return (
                  <tr key={match.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${label === 'مباشرة' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-gray-400'}`}>
                        {label}
                      </span>
                    </td>
                    <td className="p-4 font-bold">
                      {match.homeTeam?.name || 'غير متوفر'} × {match.awayTeam?.name || 'غير متوفر'}
                    </td>
                    <td className="p-4 text-gray-400">{formatDate(match.matchDate)}</td>
                    <td className="p-4 text-gray-400">يُحدد لاحقاً</td>
                    <td className="p-4 text-gray-400">{match.groupPhase || match.stage || 'غير متوفر'}</td>
                    <td className="p-4 text-center font-black text-lg">{scoreLabel(match)}</td>
                    <td className="p-4 text-center text-xs text-gray-400">
                      {snapshot ? (
                        <span>
                          استحواذ {snapshot.homePossession ?? '-'}% / {snapshot.awayPossession ?? '-'}%
                        </span>
                      ) : (
                        'لم تتوفر إحصائيات'
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <a
                        href={`/match-center/${match.id}`}
                        className="inline-block px-4 py-2 bg-white/10 hover:bg-[#0FF0FC] hover:text-black transition-colors rounded-lg font-bold text-xs opacity-80 group-hover:opacity-100"
                      >
                        تحليل المباراة
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {team?.isDemo && <p className="text-xs text-yellow-200/80">نسخة تجريبية: بيانات المباريات الحقيقية غير متاحة.</p>}
    </div>
  );
}
