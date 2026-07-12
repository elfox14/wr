'use client';

import React from 'react';
import TeamHeatmap from './TeamHeatmap';
import type { HeatmapPoint } from '@/lib/match-page/types';

interface PlayerHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  playerImage?: string | null;
  isHome: boolean;
  points?: HeatmapPoint[];
}

export default function PlayerHeatmapModal({ isOpen, onClose, playerName, playerImage, isHome, points = [] }: PlayerHeatmapModalProps) {
  if (!isOpen || !points.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#111116] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          ✕
        </button>
        
        <div className="flex items-center gap-4 mb-6">
          {playerImage ? (
            <img src={playerImage} alt={playerName} className="w-16 h-16 rounded-full object-cover border-2 border-white/20 bg-white/5" />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center text-xl font-bold">
              {playerName.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{playerName}</h3>
            <p className="text-sm text-white/50">الخريطة الحرارية للاعب</p>
          </div>
        </div>
        
        <div className="w-full flex justify-center">
          <TeamHeatmap 
            teamName="" 
            isHome={isHome} 
            points={points} 
          />
        </div>
        <div className="mt-4 text-xs text-white/40 text-center leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
          <span className="block mb-1 font-bold text-white/60">ℹ️ دليل الخريطة الحرارية:</span>
          المناطق <strong>الحمراء</strong> تدل على تواجد اللاعب بكثافة عالية (أكثر لمسات)، و<strong>البرتقالية والصفراء</strong> تشير إلى كثافة متوسطة، بينما <strong>الخضراء</strong> تشير إلى تواجد عابر.
        </div>
      </div>
    </div>
  );
}

