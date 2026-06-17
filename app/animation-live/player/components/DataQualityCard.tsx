import type { DataQuality } from '../types';
import { ar } from '../formatters';

type DataQualityCardProps = {
  quality: DataQuality;
};

export default function DataQualityCard({ quality }: DataQualityCardProps) {
  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black text-gray-400">جودة البيانات</div>
        <span className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">
          {quality.label}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#0FF0FC]" style={{ width: `${quality.score}%` }} />
      </div>
      <div className="mt-2 grid gap-2 text-[10px] font-bold text-gray-400 sm:grid-cols-3">
        <div>إحصائيات: <span className="text-white">{ar(quality.availableStats)} / {ar(quality.totalStats)}</span></div>
        <div>أحداث: <span className="text-white">{ar(quality.eventsCount)}</span></div>
        <div>آخر تحديث: <span className="text-white">{quality.lastUpdated}</span></div>
      </div>
      <div className="mt-2 text-[10px] font-bold leading-5 text-gray-500">{quality.hint}</div>
    </div>
  );
}
