import { Trophy, CalendarDays, BarChart3, Medal } from 'lucide-react';

type WorldCupHistoryProps = {
  teamName: string;
  historyText: string;
  // In the future, this will come from FBRef data
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
  // If we don't have structured data yet, we can attempt to parse it from text, 
  // or just show a placeholder "بانتظار مزامنة FBRef" for the structured part, while showing the text.
  
  const appearances = structuredData?.appearances ?? '—';
  const bestFinish = structuredData?.bestFinish ?? '—';
  const w = structuredData?.wins ?? '-';
  const d = structuredData?.draws ?? '-';
  const l = structuredData?.losses ?? '-';

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD700]/10">
          <Trophy size={20} className="text-[#FFD700]" />
        </div>
        <h3 className="text-xl font-black text-white">السجل في كأس العالم</h3>
      </div>

      {/* Structured Stats Grid */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-white/5 bg-black/40 p-4 transition hover:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400">
            <CalendarDays size={14} className="text-primary" /> المشاركات السابقة
          </div>
          <div className="text-2xl font-black text-white">{appearances}</div>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/5 bg-black/40 p-4 transition hover:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400">
            <Medal size={14} className="text-[#FFD700]" /> أفضل إنجاز
          </div>
          <div className="text-2xl font-black text-[#FFD700] truncate">{bestFinish}</div>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/5 bg-black/40 p-4 transition hover:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400">
            <BarChart3 size={14} className="text-emerald-400" /> الإحصاء الكلي (ف/ت/خ)
          </div>
          <div className="text-2xl font-black text-white tracking-widest">{w}/{d}/{l}</div>
        </div>
      </div>

      {/* Textual AI Summary */}
      {historyText ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h4 className="mb-2 text-xs font-black text-gray-500">ملخص السجل التاريخي</h4>
          <p className="text-sm leading-relaxed text-gray-300">
            {historyText}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-sm text-gray-500">
          لا يتوفر سجل تاريخي نصي لهذا المنتخب في الوقت الحالي.
        </div>
      )}

      {!structuredData && (
        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-[#0FF0FC]/60">
          <BarChart3 size={12} />
          <span>البيانات الهيكلية (الإحصاء الكلي وأفضل إنجاز) بانتظار استيراد ملف FBRef History الخاص بمنتخب {teamName}.</span>
        </div>
      )}
    </div>
  );
}
