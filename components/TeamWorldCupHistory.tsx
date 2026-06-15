import { Trophy, CalendarDays, BarChart3, Medal } from 'lucide-react';

type WorldCupHistoryProps = {
  teamName: string;
  historyText: string;
  structuredData?: {
    appearances?: number;
    bestFinish?: string;
    totalMatches?: number;
    wins?: number;
    draws?: number;
    losses?: number;
  } | null;
};

export default function TeamWorldCupHistory({ teamName, historyText, structuredData }: WorldCupHistoryProps) {
  const appearances = structuredData?.appearances ?? '—';
  const bestFinish = structuredData?.bestFinish ?? '—';
  const w = structuredData?.wins ?? '-';
  const d = structuredData?.draws ?? '-';
  const l = structuredData?.losses ?? '-';

  return (
    <div className="py-12 border-b-[3px] border-white/10">
      <div className="flex items-center gap-4 mb-10">
        <Trophy size={40} className="text-white" />
        <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">التاريخ المونديالي</h3>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 xl:gap-8">
        
        {/* Massive Stats - 5 columns */}
        <div className="xl:col-span-5 grid grid-cols-2 gap-8 md:gap-12">
          <div className="flex flex-col">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
              <CalendarDays size={14} /> المشاركات
            </div>
            <div className="text-7xl md:text-[100px] font-black text-white leading-none tracking-tighter">
              {appearances}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
              <BarChart3 size={14} /> ف / ت / خ
            </div>
            <div className="text-4xl md:text-6xl font-black text-white leading-none tracking-tighter mt-auto pb-2">
              {w}-{d}-{l}
            </div>
          </div>

          <div className="flex flex-col col-span-2 pt-8 border-t-[3px] border-white/10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
              <Medal size={14} /> أفضل إنجاز
            </div>
            <div className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tighter uppercase">
              {bestFinish}
            </div>
          </div>
        </div>

        {/* Editorial Text - 7 columns */}
        <div className="xl:col-span-7 xl:pl-12 xl:border-l-[3px] border-white/10 pt-8 xl:pt-0">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">
            سجل إرث {teamName}
          </h4>
          {historyText ? (
            <p className="text-2xl md:text-3xl font-bold leading-relaxed text-white/90">
              {historyText}
            </p>
          ) : (
            <p className="text-2xl md:text-3xl font-bold leading-relaxed text-white/30 italic">
              لا يتوفر سجل تاريخي نصي في الوقت الحالي.
            </p>
          )}

          {!structuredData && (
            <div className="mt-8 inline-flex items-center gap-3 bg-white px-4 py-3 text-xs font-black text-black">
              <BarChart3 size={16} />
              <span>البيانات الهيكلية بانتظار استيراد ملف FBRef.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
