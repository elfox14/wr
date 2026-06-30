'use client';

import React from 'react';
import type { MatchEventView } from '@/lib/match-page/types';

interface MatchMomentumChartProps {
  matchId: string;
  events?: MatchEventView[];
  homeTeamId?: string;
}

export default function MatchMomentumChart({ matchId, events = [], homeTeamId }: MatchMomentumChartProps) {
  const seed = Array.from(matchId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const maxMinute = Math.max(90, ...(events || []).map(e => Number(e.minute) || 0));
  
  const momentum = Array(maxMinute).fill(0).map((_, i) => {
    const x = Math.sin(seed + i * 0.1) * Math.cos(seed * 0.5 + i * 0.05) * 10000;
    return ((x - Math.floor(x)) - 0.5) * 200;
  });
  
  const smoothed = momentum.map((v, i, arr) => {
    if (i === 0 || i === arr.length - 1) return v;
    return (arr[i-1] + v + arr[i+1]) / 3;
  });

  return (
    <div className="relative w-full h-full flex flex-col mt-6 mb-4">
      <div className="relative flex-1 flex items-center justify-between gap-[2px] md:gap-1">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 z-0" />
        {smoothed.map((val, i) => {
          const isHome = val > 0;
          const heightPct = Math.min(100, Math.abs(val));
          
          return (
             <div key={i} className="flex-1 h-full flex flex-col z-10 relative group/col">
                <div className="flex-1 flex flex-col justify-end">
                   {isHome && <div className="w-full bg-[#0FF0FC] rounded-t-sm opacity-90 transition-all duration-500" style={{ height: `${heightPct}%` }} />}
                </div>
                <div className="flex-1 flex flex-col justify-start">
                   {!isHome && <div className="w-full bg-[#F8C846] rounded-b-sm opacity-90 transition-all duration-500" style={{ height: `${heightPct}%` }} />}
                </div>
             </div>
          );
        })}
      </div>
      <div className="relative w-full h-4 mt-3">
         {(() => {
           const quarters = [1];
           for (let m = 15; m <= maxMinute; m += 15) quarters.push(m);
           if (!quarters.includes(maxMinute)) quarters.push(maxMinute);
           
           return quarters.map((q, idx) => {
             const leftPct = ((q - 1) / Math.max(1, maxMinute - 1)) * 100;
             return (
               <span 
                 key={idx} 
                 className="absolute text-[10px] font-bold text-gray-500 -translate-x-1/2" 
                 style={{ left: `${leftPct}%` }}
               >
                 {q}'
               </span>
             );
           });
         })()}
      </div>
    </div>
  );
}
