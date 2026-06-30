'use client';

import React from 'react';
import type { MatchPlayerStatItem } from '@/lib/match-page/types';

interface PitchFormationProps {
  teamName: string;
  formation: string;
  color: string;
  players: MatchPlayerStatItem[];
  isAway?: boolean;
}

export default function PitchFormation({ teamName, formation, color, players, isAway = false }: PitchFormationProps) {
  // Parse formation (e.g., "4-3-3" or "4-2-3-1")
  const lines = formation.split('-').map(Number);
  
  // Goalkeeper is always at the back
  const layout = [1, ...lines];
  
  // Distribute players
  let playerIndex = 0;
  const positions = layout.map((count, rowIdx) => {
    const rowPlayers = [];
    for (let i = 0; i < count; i++) {
      if (playerIndex < players.length) {
        rowPlayers.push(players[playerIndex]);
        playerIndex++;
      } else {
        // Fallback for missing data
        rowPlayers.push({ playerName: `Player ${playerIndex + 1}`, number: playerIndex + 1 });
        playerIndex++;
      }
    }
    return rowPlayers;
  });

  if (isAway) {
    positions.reverse(); // Goalkeeper at top for away team if stacked vertically
  }

  return (
    <div className="relative w-full aspect-[3/4] bg-[#111116] border border-white/10 rounded-xl p-2 md:p-4 overflow-hidden flex flex-col justify-between">
      {/* Pitch Lines */}
      <div className="absolute inset-2 border-2 border-white/10 pointer-events-none rounded">
        {/* Center Line */}
        <div className={`absolute left-0 right-0 h-px bg-white/10 ${isAway ? 'bottom-0' : 'top-0'}`} />
        {/* Center Circle (Half) */}
        <div className={`absolute left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-2 border-white/10 ${isAway ? 'bottom-0 translate-y-1/2' : 'top-0 -translate-y-1/2'}`} />
        {/* Penalty Area */}
        <div className={`absolute left-1/4 right-1/4 h-[20%] border-2 border-white/10 ${isAway ? 'top-0 border-t-0' : 'bottom-0 border-b-0'}`} />
        {/* Goal Area */}
        <div className={`absolute left-[38%] right-[38%] h-[8%] border-2 border-white/10 ${isAway ? 'top-0 border-t-0' : 'bottom-0 border-b-0'}`} />
      </div>

      <div className="z-10 flex justify-between items-center px-2 py-1 bg-black/40 rounded border border-white/5 mb-4">
        <span className="text-white font-bold text-xs md:text-sm truncate mr-2" style={{ color }}>{teamName}</span>
        <span className="text-gray-400 text-xs font-mono">{formation}</span>
      </div>

      <div className="flex-1 flex flex-col justify-evenly w-full z-10 py-4">
        {positions.map((row, rowIdx) => (
          <div key={rowIdx} className="flex justify-evenly w-full">
            {row.map((p, pIdx) => (
              <div key={pIdx} className="flex flex-col items-center group relative">
                <div 
                  className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white/20 flex items-center justify-center shadow-lg shadow-black/50"
                  style={{ backgroundColor: color }}
                >
                  <span className="text-black font-bold text-[10px] md:text-xs">{p.number || ''}</span>
                </div>
                <div className="mt-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] text-white font-bold text-center max-w-[60px] truncate">
                  {p.playerName?.split(' ').pop() || p.playerName}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
