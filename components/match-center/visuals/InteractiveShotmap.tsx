'use client';

import React from 'react';
import type { MatchShotMapItem } from '@/lib/match-page/types';

interface InteractiveShotmapProps {
  homeTeamName: string;
  awayTeamName: string;
  shots?: MatchShotMapItem[];
  homeTeamId?: string;
}

export default function InteractiveShotmap({ homeTeamName, awayTeamName, shots = [], homeTeamId }: InteractiveShotmapProps) {
  if (!shots.length) return null;

  const allShots = shots
    .map((s, i) => {
      const isHome = s.teamId === homeTeamId || Boolean(s.teamName && homeTeamName && String(s.teamName).includes(homeTeamName));
      const outcome = String(s.outcome || '').toLowerCase();
      const isGoal = Boolean(s.isGoal || outcome.includes('goal') || outcome === 'هدف');
      const isOnTarget = Boolean(isGoal || s.isOnTarget || outcome.includes('saved'));
      const rawX = Number(s.x);
      const sourceY = Number(s.y);
      if (!Number.isFinite(rawX) || !Number.isFinite(sourceY)) return null;
      const rawY = sourceY > 50 ? 100 - sourceY : sourceY;
      const xgValue = s.xg === null || s.xg === undefined ? null : Number(s.xg);
      return {
        id: s.id || `real-shot-${i}`,
        x: rawX,
        y: rawY,
        xg: Number.isFinite(xgValue) ? xgValue : null,
        isGoal,
        isOnTarget,
        isHome,
        playerName: s.playerName || 'غير معروف',
        playerImage: s.playerImage || null,
        playerNumber: s.playerNumber || null,
        minute: s.minute ?? '؟'
      };
    })
    .filter((shot): shot is NonNullable<typeof shot> => shot !== null)
    .sort((a: any, b: any) => Number(b.xg || 0) - Number(a.xg || 0));

  if (!allShots.length) return null;

  return (
    <div className="relative w-full aspect-square md:aspect-[4/3] bg-[#0A0A0C] border border-white/10 rounded-2xl p-4 overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-4 z-10">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#0FF0FC]" />
            <span className="text-white text-xs font-bold">{homeTeamName}</span>
         </div>
         <h3 className="text-white font-black text-lg md:text-xl">خريطة التسديدات (Shotmap)</h3>
         <div className="flex items-center gap-2">
            <span className="text-white text-xs font-bold">{awayTeamName}</span>
            <div className="w-3 h-3 rounded-full bg-[#F8C846]" />
         </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mb-4 z-10 text-xs text-gray-400">
         <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white mask-star" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }}/> هدف</div>
         <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-white"/> على المرمى</div>
         <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full border border-white"/> خارج المرمى</div>
      </div>

      <div className="flex-1 relative w-full max-w-[500px] mx-auto border-2 border-white/10 rounded-t-lg overflow-hidden bg-[#111116] shadow-inner">
         {/* Pitch Markings */}
         <div className="absolute top-0 left-1/4 right-1/4 h-[40%] border-2 border-t-0 border-white/10" />
         <div className="absolute top-0 left-[38%] right-[38%] h-[15%] border-2 border-t-0 border-white/10" />
         <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
         <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-20 h-10 border-2 border-white/10 border-t-0 rounded-b-full opacity-50" />
         
         {/* Plot Shots */}
         {allShots.map((shot) => {
            const size = shot.xg === null ? 10 : Math.max(8, shot.xg * 40);
            const color = shot.isHome ? '#0FF0FC' : '#F8C846';
            
            return (
               <div 
                  key={shot.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 hover:z-50 cursor-pointer group"
                  style={{ 
                     left: `${shot.x}%`, 
                     top: `${shot.y}%`,
                  }}
               >
                  {shot.isGoal ? (
                     <div 
                        style={{ width: size * 1.5, height: size * 1.5, backgroundColor: color, clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', boxShadow: `0 0 15px ${color}` }} 
                     />
                  ) : (
                     <div 
                        style={{ 
                           width: size, 
                           height: size, 
                           backgroundColor: shot.isOnTarget ? color : 'transparent',
                           borderColor: color,
                           borderWidth: shot.isOnTarget ? 0 : 2,
                           borderRadius: '50%'
                        }} 
                     />
                  )}

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max min-w-[120px] bg-black/95 border border-white/20 p-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-2xl transition-opacity">
                     <div className="flex items-center gap-2 mb-1 border-b border-white/10 pb-1">
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold overflow-hidden border border-white/20">
                           {shot.playerImage ? <img src={shot.playerImage} alt={shot.playerName} className="h-full w-full object-cover" /> : shot.playerName.charAt(0)}
                        </div>
                        <div>
                           <div className="text-[10px] font-bold text-white truncate max-w-[100px]">{shot.playerName}{shot.playerNumber ? ` · #${shot.playerNumber}` : ''}</div>
                           <div className="text-[9px] text-[#18E58F]">{shot.minute}'</div>
                        </div>
                     </div>
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">النتيجة:</span>
                        <span className="font-bold text-white">{shot.isGoal ? 'هدف ⚽' : shot.isOnTarget ? 'على المرمى' : 'خارج المرمى'}</span>
                     </div>
                     {shot.xg !== null && <div className="flex justify-between text-[10px]"><span className="text-gray-400">xG:</span><span className="font-bold text-[#F8C846]">{shot.xg.toFixed(2)}</span></div>}
                  </div>
               </div>
            );
         })}
      </div>
    </div>
  );
}
