'use client';

export default function TeamSquadHighlight({ players }: { players: any[] }) {
  // Mock data if no real players are passed
  const displayPlayers = players?.length > 0 ? players : [
    { id: 1, name: 'سالم الدوسري', position: 'جناح أيسر', age: 32, club: 'الهلال', minutes: 270, goals: 2, assists: 1, rating: 8.2, reason: 'الأكثر مساهمة هجومية في التصفيات', image: null },
    { id: 2, name: 'سعود عبدالحميد', position: 'ظهير أيمن', age: 24, club: 'الهلال', minutes: 270, goals: 0, assists: 2, rating: 7.9, reason: 'الأكثر صناعة للفرص الخطيرة', image: null },
    { id: 3, name: 'علي البليهي', position: 'قلب دفاع', age: 34, club: 'الهلال', minutes: 270, tackles: 12, interceptions: 18, rating: 7.5, reason: 'صلابة دفاعية وقيادة الخط الخلفي', image: null },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black mb-2">أسماء بارزة في القائمة</h2>
      <p className="text-gray-400 text-sm mb-6">يتم اختيار الأسماء بناءً على بيانات المشاركة، المساهمات، والتقييم الإحصائي المباشر (ISPORTS).</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayPlayers.map((player: any) => (
          <div key={player.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 hover:border-[#0FF0FC]/50 transition-colors">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex-shrink-0 flex items-center justify-center font-black text-xl">
                {player.image ? <img src={player.image} alt={player.name} className="w-full h-full rounded-full object-cover" /> : player.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg">{player.name}</h3>
                <p className="text-sm text-gray-400">{player.position} • {player.age} سنة • {player.club}</p>
                <div className="mt-2 inline-block px-2 py-1 bg-[#0FF0FC]/10 text-[#0FF0FC] rounded text-xs font-bold border border-[#0FF0FC]/20">
                  تقييم البيانات: {player.rating || 'N/A'}
                </div>
              </div>
            </div>
            
            <div className="bg-black/50 rounded-xl p-3 text-sm text-gray-300 border border-white/5 mb-4">
              <span className="font-bold text-white">سبب الظهور: </span>
              {player.reason || 'تأثير إحصائي عالي في المباريات الأخيرة.'}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-sm border-t border-white/10 pt-4">
              <div>
                <p className="text-gray-500 text-xs">الدقائق</p>
                <p className="font-bold">{player.minutes || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">أهداف</p>
                <p className="font-bold text-green-400">{player.goals || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">صناعة</p>
                <p className="font-bold text-blue-400">{player.assists || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
