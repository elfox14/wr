'use client';

import React, { useMemo } from 'react';
import type { HeatmapPoint, HeatmapSource } from '@/lib/match-page/types';
import { analyzeHeatmap } from '@/lib/heatmap-analyzer';

interface TeamHeatmapProps {
  teamName?: string;
  isHome: boolean;
  points?: HeatmapPoint[];
  source?: HeatmapSource;
}

export default function TeamHeatmap({ teamName, isHome, points = [], source }: TeamHeatmapProps) {
  const verifiedPoints = useMemo(() => points.map((point) => ({
    x: Number(point.x),
    y: Number(point.y),
    count: point.count,
  })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100), [points]);
  const hasPoints = verifiedPoints.length > 0;
  const analysis = useMemo(() => analyzeHeatmap(verifiedPoints), [verifiedPoints]);
  if (!hasPoints) return null;

  // Grid approach for accurate density
  const gridRows = 16;
  const gridCols = 24;
  const cellWidth = 100 / gridCols;
  const cellHeight = 100 / gridRows;

  const grid: number[][] = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
  let maxCount = 0;

  if (hasPoints) {
    verifiedPoints.forEach(pt => {
      const x = Number(pt.x);
      const y = Number(pt.y);
      if (isNaN(x) || isNaN(y)) return;
      
      const col = Math.max(0, Math.min(Math.floor(x / cellWidth), gridCols - 1));
      const row = Math.max(0, Math.min(Math.floor(y / cellHeight), gridRows - 1));
      if (grid[row] && grid[row][col] !== undefined) {
        grid[row][col] += (Number(pt.count) || 1);
        if (grid[row][col] > maxCount) maxCount = grid[row][col];
      }
    });
  }

  const getCellColor = (count: number, max: number) => {
    if (count === 0) return 'transparent';
    const intensity = count / max;
    if (intensity > 0.6) return 'rgba(255, 0, 0, 0.75)'; // Red
    if (intensity > 0.3) return 'rgba(255, 120, 0, 0.65)'; // Orange
    if (intensity > 0.1) return 'rgba(255, 255, 0, 0.55)'; // Yellow
    return 'rgba(126, 200, 80, 0.45)'; // Light green
  };

  return (
    <div className="flex flex-col items-center flex-1 w-full mx-auto">
      {teamName && <div className="text-sm font-bold mb-2 text-center truncate w-full px-1 text-white">{teamName}</div>}
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-2.5 py-1 text-[9px] font-black text-[#18E58F]"><span className="h-1.5 w-1.5 rounded-full bg-[#18E58F]" />{source === 'VERIFIED_ACTION_COORDINATES' ? 'مشتقة من أحداث موثقة' : 'نقاط المزود المباشرة'} · {verifiedPoints.length.toLocaleString('ar-EG')} نقطة</div>
      {/* Horizontal Pitch */}
      <div className="relative w-full aspect-[1.5/1] sm:aspect-[1.6/1] bg-[#7ec850] rounded-sm overflow-hidden flex flex-col group border-2 border-white/80">
        
        {/* Heat grid */}
        <div className="absolute inset-0 z-10" style={{ filter: 'blur(12px)' }}>
          {hasPoints ? grid.map((row, rIdx) => 
            row.map((count, cIdx) => count > 0 && (
              <div 
                key={`${rIdx}-${cIdx}`}
                className="absolute rounded-full"
                style={{
                  left: `${(cIdx + 0.5) * cellWidth}%`,
                  top: `${(rIdx + 0.5) * cellHeight}%`,
                  width: `${cellWidth * 2.5}%`,
                  height: `${cellHeight * 2.5}%`,
                  backgroundColor: getCellColor(count, Math.max(3, maxCount)), // smooth scaling
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs opacity-70">
              لا توجد بيانات متاحة
            </div>
          )}
        </div>

        {/* Pitch Lines overlay (White) */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Halfway Line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -ml-[1px] bg-white/80" />
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[35%] aspect-square rounded-full border-[2px] border-white/80" />
          {/* Center Spot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/80" />
          
          {/* Left Penalty Area */}
          <div className="absolute top-[20%] bottom-[20%] left-0 w-[18%] border-[2px] border-l-0 border-white/80" />
          {/* Left Goal Area */}
          <div className="absolute top-[35%] bottom-[35%] left-0 w-[6%] border-[2px] border-l-0 border-white/80" />
          {/* Left Penalty Arc (using border radius) */}
          <div className="absolute top-[35%] bottom-[35%] left-[12%] w-[10%] border-[2px] rounded-r-full border-white/80" style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }} />
          
          {/* Right Penalty Area */}
          <div className="absolute top-[20%] bottom-[20%] right-0 w-[18%] border-[2px] border-r-0 border-white/80" />
          {/* Right Goal Area */}
          <div className="absolute top-[35%] bottom-[35%] right-0 w-[6%] border-[2px] border-r-0 border-white/80" />
          {/* Right Penalty Arc */}
          <div className="absolute top-[35%] bottom-[35%] right-[12%] w-[10%] border-[2px] rounded-l-full border-white/80" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />

          {/* Direction Arrow */}
          {isHome && (
             <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-center opacity-70">
                <div className="w-16 h-0.5 bg-white"></div>
                <div className="w-2 h-2 border-t-2 border-r-2 border-white rotate-45 -ml-1"></div>
             </div>
          )}
          {!isHome && (
             <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-center opacity-70">
                <div className="w-2 h-2 border-t-2 border-l-2 border-white -rotate-45 -mr-1"></div>
                <div className="w-16 h-0.5 bg-white"></div>
             </div>
          )}
        </div>
      </div>
      
      {hasPoints && (
        <div className="mt-2 text-[9px] sm:text-[10px] text-slate-300 bg-white/5 p-1.5 rounded w-full border border-white/10 text-center leading-relaxed">
           {analysis.summary}
        </div>
      )}
    </div>
  );
}

