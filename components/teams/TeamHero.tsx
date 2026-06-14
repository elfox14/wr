'use client';

export default function TeamHero({ team }: { team: any }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-8">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          {team.image ? (
            <img src={team.image} alt={team.name} className="h-24 w-24 rounded-full border-2 border-white/20 object-cover" />
          ) : (
            <div className="h-24 w-24 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center text-3xl font-black">
              {team.name.charAt(0)}
            </div>
          )}
        </div>
        
        <div className="text-center md:text-right flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-black">{team.name}</h1>
            <span className="px-3 py-1 text-sm font-bold bg-white/10 rounded-full border border-white/10 text-gray-300">
              {team.group ? `المجموعة ${team.group.replace('Group ', '')}` : 'لم يحدد'}
            </span>
            <span className="px-3 py-1 text-sm font-bold bg-[#0FF0FC]/10 text-[#0FF0FC] rounded-full border border-[#0FF0FC]/20">
              تصنيف فيفا: {team.fifaRank || 'غير متاح'}
            </span>
          </div>
          <p className="text-gray-400 font-medium">المدرب: {team.coach || 'غير معروف'} • القارة: {team.continent || 'غير محدد'} • المشاركات: {team.participations || 0}</p>
        </div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">المباراة القادمة</p>
          <p className="font-bold text-sm">ضد المكسيك (قريباً)</p>
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">المركز في المجموعة</p>
          <p className="font-bold text-sm">المركز الأول (مؤقت)</p>
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">نسبة اكتمال البيانات</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-[95%]" />
            </div>
            <span className="text-xs font-bold text-green-400">95%</span>
          </div>
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">تحديث البيانات</p>
          <p className="font-bold text-sm text-[#0FF0FC]">ISPORTS LIVE (الآن)</p>
        </div>
      </div>
    </div>
  );
}
