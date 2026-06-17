'use client';

import type { MomentumSegment, Team } from '../types';
import { ar } from '../formatters';
import { eventIcon, eventLabel } from '../eventUtils';
import { sideName } from '../pressureUtils';

type MomentumCardProps = {
  segment: MomentumSegment;
  home: Team;
  away: Team;
  onSelectEvent: (id: string) => void;
};

export default function MomentumCard({ segment, home, away, onSelectEvent }: MomentumCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-[#FFD700]">د {segment.label}</span>
        <span className="text-[10px] font-black text-gray-500">{segment.rating}</span>
      </div>
      <div className="text-sm font-black text-white">
        الأكثر ضغطًا: <span className="text-[#FFD700]">{sideName(segment.leader, home, away)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400">
        <div>أحداث ضغط: <span className="text-white">{segment.available ? `${ar(segment.homeEvents)} - ${ar(segment.awayEvents)}` : 'غير متوفر'}</span></div>
        <div>هجمات خطيرة: <span className="text-white">{segment.available ? `${ar(segment.homeDangerEvents)} - ${ar(segment.awayDangerEvents)}` : 'غير متوفر'}</span></div>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-5 text-gray-300">
        <span className="font-black text-gray-500">أهم حدث: </span>
        {segment.topEvent ? (
          <button type="button" onClick={() => segment.topEvent && onSelectEvent(segment.topEvent.id)} className="text-right font-bold text-[#0FF0FC] hover:text-[#FFD700]">
            {segment.topEvent.minute ? `د${segment.topEvent.minute} - ` : ''}{eventIcon(segment.topEvent.type)} {eventLabel(segment.topEvent.type)}
          </button>
        ) : 'غير متوفر'}
      </div>
    </div>
  );
}
