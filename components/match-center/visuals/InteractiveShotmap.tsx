'use client';

import React from 'react';
import type { MatchShotMapItem } from '@/lib/match-page/types';

interface InteractiveShotmapProps {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  shots?: MatchShotMapItem[];
  homeTeamId?: string;
}

export default function InteractiveShotmap({ matchId, homeTeamName, awayTeamName, shots = [], homeTeamId }: InteractiveShotmapProps) {
  // Deterministic random generator based on matchId
  const seed = Array.from(matchId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const generateShots = (teamSeedOffset: number, count: number, isHome: boolean) => {
    return Array(count).fill(0).map((_, i) => {
      const s = seed + teamSeedOffset + i;
      const x = (Math.sin(s) * 10000) % 100; 
      const y = (Math.cos(s) * 10000) % 50;  
      
      const weightedX = 20 + Math.abs(x) * 0.6; 
      const weightedY = Math.abs(y) * 0.8;
      
      const isGoal = (s % 10) > 8; 
      const isOnTarget = (s % 10) > 5 && !isGoal; 
      
      return {
        id: `shot-${isHome ? 'h' : 'a'}-${i}`,
        x: weightedX,
        y: weightedY, 
        xg: 0.05 + (Math.abs(Math.sin(s)) * 0.4), 
        isGoal,
        isOnTarget,
        isHome,
        playerName: `لاعب ${i+1}`,
        minute: Math.floor(Math.abs(Math.sin(s * 2)) * 90) + 1
      };
    });
  };

  const hasRealShots = shots.length > 0;
  
  let allShots = [];
  
  if (hasRealShots) {
     allShots = shots.map((s, i) => {
        // Simple logic to detect if it's home or away. Using teamId or name matching.
        const isHome = s.teamId === homeTeamId || (s.teamName && homeTeamName && String(s.teamName).includes(homeTeamName));
        const isGoal = s.isGoal || s.outcome?.toLowerCase().includes('goal') || s.outcome === 'هدف';
        const isOnTarget = isGoal || s.isOnTarget || s.outcome?.toLowerCase().includes('saved');
        
        let rawX = Number(s.x) || 50;
        let rawY = Number(s.y) || 25;
        
        // Normalize coordinates if needed (assuming 0-100 scale where 100 is opponent goal)
        // For half pitch representation, we map X from 0-100 (left-right) and Y from 50-100 to 0-50 (depth)
        // This mapping logic can be refined based on actual API coordinates format.
        if (rawY > 50) rawY = 100 - rawY; // Mirror everything to one half

        return {
           id: s.id || `real-shot-${i}`,
           x: rawX,
           y: rawY,
           xg: Number(s.xg) || 0.1,
           isGoal,
           isOnTarget,
           isHome,
           playerName: s.playerName || 'غير معروف',
           minute: s.minute || '؟'
        };
     });
  } else {
     const homeShots = generateShots(100, 12, true);
     const awayShots = generateShots(200, 9, false);
     allShots = [...homeShots, ...awayShots];
  }

  allShots = allShots.sort((a, b) => b.xg - a.xg);

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
            const size = Math.max(8, shot.xg * 40);
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
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold overflow-hidden border border-white/20">
                           {shot.playerName.charAt(0)}
                        </div>
                        <div>
                           <div className="text-[10px] font-bold text-white truncate max-w-[80px]">{shot.playerName}</div>
                           <div className="text-[9px] text-[#18E58F]">{shot.minute}'</div>
                        </div>
                     </div>
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">النتيجة:</span>
                        <span className="font-bold text-white">{shot.isGoal ? 'هدف ⚽' : shot.isOnTarget ? 'على المرمى' : 'خارج المرمى'}</span>
                     </div>
                     <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">xG:</span>
                        <span className="font-bold text-[#F8C846]">{shot.xg.toFixed(2)}</span>
                     </div>
                  </div>
               </div>
            );
         })}
      </div>
    </div>
  );
}
