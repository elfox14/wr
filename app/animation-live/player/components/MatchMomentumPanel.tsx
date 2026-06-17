'use client';

import type { MomentumSegment, Team } from '../types';
import { ar } from '../formatters';
import { sideName } from '../pressureUtils';
import MomentumCard from './MomentumCard';

type MatchMomentumPanelProps = {
  segments: MomentumSegment[];
  strongestSegment: MomentumSegment | null;
  home: Team;
  away: Team;
  onSelectEvent: (id: string) => void;
};

function segmentTotal(segment: MomentumSegment) {
  return segment.home + segment.away;
}

function segmentLeaderText(segment: MomentumSegment, home: Team, away: Team) {
  if (!segment.available) return 'غير متوفر';
  return sideName(segment.leader, home, away);
}

export default function MatchMomentumPanel({ segments, strongestSegment, home, away, onSelectEvent }: MatchMomentumPanelProps) {
  const maxTotal = Math.max(1, ...segments.map(segmentTotal));

  return (
    <section className="order-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">Match Momentum</div>
          <h2 className="mt-1 text-xl font-black text-white">منحنى الزخم حسب فترات المباراة</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">
          أقوى فترة: <span className="text-white">{strongestSegment ? `د ${strongestSegment.label}` : 'غير متوفر'}</span>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-3 text-sm font-bold leading-7 text-white">
        {strongestSegment
          ? `أقوى فترة كانت د ${strongestSegment.label} لصالح ${sideName(strongestSegment.leader, home, away)} بمؤشر ${ar(segmentTotal(strongestSegment))}.`
          : 'لا توجد أحداث كافية لاستخراج أقوى فترة في المباراة.'}
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-3 text-[10px] font-black text-gray-400">منحنى الزخم</div>
        <div className="grid grid-cols-6 items-end gap-2">
          {segments.map((segment) => {
            const total = segmentTotal(segment);
            const height = segment.available ? Math.max(14, Math.round((total / maxTotal) * 92)) : 10;
            const leader = segmentLeaderText(segment, home, away);
            return (
              <div key={segment.key} className="flex min-h-[126px] flex-col items-center justify-end gap-2">
                <div className="text-[9px] font-black text-gray-500">{leader}</div>
                <div className="flex h-24 w-full max-w-[34px] items-end overflow-hidden rounded-full bg-white/10">
                  <div className={`w-full rounded-full ${segment.leader === 'home' ? 'bg-[#0FF0FC]' : segment.leader === 'away' ? 'bg-[#FFD700]' : 'bg-white/25'}`} style={{ height: `${height}%` }} />
                </div>
                <div className="text-[10px] font-black text-white">{segment.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {segments.map((segment) => (
          <MomentumCard key={segment.key} segment={segment} home={home} away={away} onSelectEvent={onSelectEvent} />
        ))}
      </div>
    </section>
  );
}
