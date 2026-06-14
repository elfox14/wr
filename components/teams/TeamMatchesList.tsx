'use client';

export default function TeamMatchesList({ matches }: { matches: any[] }) {
  // If there are no actual matches, show mock data matching the requested UI
  const displayMatches = matches?.length > 0 ? matches : [
    { id: 1, status: 'مباشرة', date: 'اليوم 20:00', stadium: 'ملعب أزتيكا', stage: 'دور المجموعات', home: 'المنتخب الحالي', away: 'المكسيك', score: '0 - 0' },
    { id: 2, status: 'لم تبدأ', date: '18 يونيو', stadium: 'ملعب لوس أنجلوس', stage: 'دور المجموعات', home: 'المنتخب الحالي', away: 'كرواتيا', score: '- - -' },
    { id: 3, status: 'لم تبدأ', date: '22 يونيو', stadium: 'ملعب ميتلايف', stage: 'دور المجموعات', home: 'المنتخب الحالي', away: 'نيجيريا', score: '- - -' },
  ];

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
                <th className="p-4 font-normal text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayMatches.map((match: any) => (
                <tr key={match.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${match.status === 'مباشرة' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-gray-400'}`}>
                      {match.status}
                    </span>
                  </td>
                  <td className="p-4 font-bold">{match.home} × {match.away}</td>
                  <td className="p-4 text-gray-400">{match.date}</td>
                  <td className="p-4 text-gray-400">{match.stadium || 'غير محدد'}</td>
                  <td className="p-4 text-gray-400">{match.stage}</td>
                  <td className="p-4 text-center font-black text-lg">{match.score}</td>
                  <td className="p-4 text-center">
                    <button className="px-4 py-2 bg-white/10 hover:bg-[#0FF0FC] hover:text-black transition-colors rounded-lg font-bold text-xs opacity-80 group-hover:opacity-100">
                      تحليل المباراة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
