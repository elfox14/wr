'use client';

import type { XgFlowPoint } from '@/lib/analytics/derive-xg-flow';

interface Props {
  data: XgFlowPoint[];
  homeColor?: string;
  awayColor?: string;
  homeLabel: string;
  awayLabel: string;
}

const HEIGHT = 120;
const PADDING = { top: 10, right: 10, bottom: 24, left: 32 };

export default function XgFlowChart({
  data,
  homeColor = '#3b82f6',
  awayColor = '#ef4444',
  homeLabel,
  awayLabel,
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm" dir="rtl">
        لا تتوفر بيانات xG
      </div>
    );
  }

  const maxXg = Math.max(
    ...data.map((d) => Math.max(d.homeCumulative, d.awayCumulative)),
    0.5
  );
  const maxMinute = data[data.length - 1]?.minute ?? 90;

  const chartW = 560;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;
  const totalW = chartW + PADDING.left + PADDING.right;
  const totalH = HEIGHT;

  const scaleX = (minute: number) =>
    PADDING.left + (minute / maxMinute) * chartW;
  const scaleY = (xg: number) =>
    PADDING.top + chartH - (xg / maxXg) * chartH;

  const buildPath = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const homePoints = [{ x: PADDING.left, y: scaleY(0) }, ...data.map((d) => ({ x: scaleX(d.minute), y: scaleY(d.homeCumulative) }))];
  const awayPoints = [{ x: PADDING.left, y: scaleY(0) }, ...data.map((d) => ({ x: scaleX(d.minute), y: scaleY(d.awayCumulative) }))];
  const yTicks = [0, maxXg / 2, maxXg];
  const xTicks = [0, 15, 30, 45, 60, 75, 90].filter((m) => m <= maxMinute);

  return (
    <div dir="rtl" className="w-full">
      <div className="flex justify-end gap-4 mb-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5" style={{ backgroundColor: homeColor }} />
          {homeLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5" style={{ backgroundColor: awayColor }} />
          {awayLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full" style={{ height: totalH }} aria-label="مخطط تدفق xG">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PADDING.left} y1={scaleY(v)} x2={PADDING.left + chartW} y2={scaleY(v)} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={PADDING.left - 4} y={scaleY(v) + 4} textAnchor="end" fontSize="9" fill="#6b7280">{v.toFixed(1)}</text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text key={m} x={scaleX(m)} y={totalH - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{m}&apos;</text>
        ))}
        <path d={buildPath(homePoints)} fill="none" stroke={homeColor} strokeWidth="2" strokeLinejoin="round" />
        <path d={buildPath(awayPoints)} fill="none" stroke={awayColor} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
