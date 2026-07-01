'use client';

import type { MomentumSegment } from '@/lib/analytics/derive-momentum';

interface Props {
  segments: MomentumSegment[];
  homeLabel: string;
  awayLabel: string;
  homeColor?: string;
  awayColor?: string;
}

export default function MomentumBar({
  segments,
  homeLabel,
  awayLabel,
  homeColor = '#3b82f6',
  awayColor = '#ef4444',
}: Props) {
  if (!segments || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 text-gray-400 text-xs" dir="rtl">
        لا تتوفر بيانات الزخم
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full">
      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span style={{ color: homeColor }}>{homeLabel}</span>
        <span className="text-gray-500">الزخم</span>
        <span style={{ color: awayColor }}>{awayLabel}</span>
      </div>

      {/* Bar segments */}
      <div className="flex h-6 rounded overflow-hidden gap-px">
        {segments.map((seg, idx) => {
          const absVal = Math.abs(seg.value);
          const intensity = Math.round(absVal * 100);
          const bgColor =
            seg.label === 'home'
              ? homeColor
              : seg.label === 'away'
              ? awayColor
              : '#374151';
          const opacity = 0.3 + absVal * 0.7;

          return (
            <div
              key={idx}
              className="flex-1 relative group"
              style={{ backgroundColor: bgColor, opacity }}
              title={`${seg.fromMinute}'-${seg.toMinute}': ${seg.label === 'home' ? homeLabel : seg.label === 'away' ? awayLabel : 'تعادل'} (${intensity}%)`}
            />
          );
        })}
      </div>

      {/* Minute labels */}
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        {segments.map((seg, idx) =>
          idx % 2 === 0 ? (
            <span key={idx} className="flex-1 text-center">{seg.fromMinute}&apos;</span>
          ) : (
            <span key={idx} className="flex-1" />
          )
        )}
      </div>
    </div>
  );
}
