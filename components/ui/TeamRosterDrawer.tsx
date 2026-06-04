'use client';

import React from 'react';
import { Asset } from '@/lib/store';
import { X, TrendingUp, TrendingDown, Users, Shield, Zap, Target } from 'lucide-react';
import Link from 'next/link';

interface TeamRosterDrawerProps {
  team: Asset | null;
  onClose: () => void;
}

export function TeamRosterDrawer({ team, onClose }: TeamRosterDrawerProps) {
  if (!team) return null;

  const players = team.players || [];
  
  // Group players by position
  const goalkeepers = players.filter(p => p.position === 'GK');
  const defenders = players.filter(p => p.position === 'DEF');
  const midfielders = players.filter(p => p.position === 'MID');
  const forwards = players.filter(p => p.position === 'FWD');

  const renderPlayerGroup = (title: string, group: Asset[], icon: React.ReactNode) => {
    if (group.length === 0) return null;
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
          {icon}
          {title} ({group.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {group.map(player => (
            <Link 
              href={`/asset/${player.id}`} 
              key={player.id}
              className="bg-black/40 border border-white/5 rounded-xl p-4 flex justify-between items-center hover:border-[#0FF0FC]/50 hover:bg-[#0FF0FC]/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{player.image}</span>
                <div>
                  <div className="font-bold text-white group-hover:text-[#0FF0FC] transition-colors">{player.name}</div>
                  <div className="text-xs text-gray-500">Score: <span className="text-gray-300">{player.score || 'N/A'}</span></div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-gray-300">{player.current_price}¢</div>
                <div className={`text-xs font-bold flex items-center justify-end gap-1 ${player.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {player.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(player.change)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-[#121212] border-l border-white/10 shadow-2xl z-[110] flex flex-col transform transition-transform overflow-hidden animate-slide-in">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-br from-[#1A1A1A] to-black flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0FF0FC]/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <span className="text-5xl drop-shadow-lg">{team.image}</span>
            <div>
              <h2 className="text-3xl font-bold text-white">{team.name} <span className="text-gray-500 text-lg">({team.code})</span></h2>
              <div className="flex gap-4 mt-2 text-sm text-gray-400">
                <span className="bg-white/5 px-2 py-1 rounded-md">FIFA Rank: <strong className="text-white">#{team.fifaRank || 'N/A'}</strong></span>
                <span className="bg-white/5 px-2 py-1 rounded-md">Team Score: <strong className="text-[#FFD700]">{team.score || 'N/A'}</strong></span>
              </div>
            </div>
          </div>
          
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors relative z-10 text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
          <div className="flex justify-between items-center mb-8">
            <p className="text-gray-400">تصفح تشكيلة المنتخب ({players.length} لاعبين)</p>
            <Link 
              href={`/asset/${team.id}`}
              className="px-4 py-2 bg-[#0FF0FC] hover:bg-[#0FF0FC]/80 text-black font-bold rounded-lg transition-colors text-sm"
            >
              تداول المنتخب بالكامل
            </Link>
          </div>

          {renderPlayerGroup('حراسة المرمى', goalkeepers, <Shield size={18} className="text-blue-400" />)}
          {renderPlayerGroup('خط الدفاع', defenders, <Shield size={18} className="text-green-400" />)}
          {renderPlayerGroup('خط الوسط', midfielders, <Zap size={18} className="text-yellow-400" />)}
          {renderPlayerGroup('خط الهجوم', forwards, <Target size={18} className="text-red-400" />)}
          
          {players.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              لم يتم تحديث القائمة النهائية بعد.
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
}
