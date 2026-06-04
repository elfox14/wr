'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Navbar } from '@/components/ui/Navbar';
import Link from 'next/link';

export default function MatchesPage() {
  const { matches, fetchMatches } = useStore();

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-20">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-extrabold mb-10 text-center bg-clip-text text-transparent bg-gradient-to-r from-[#FFD700] to-[#0FF0FC]">
          جدول المباريات
        </h1>

        <div className="space-y-6">
          {matches.length === 0 ? (
            <p className="text-center text-gray-400">لا توجد مباريات متاحة حالياً.</p>
          ) : (
            matches.map(match => {
              const d = new Date(match.matchDate);
              const isLive = match.status === 'LIVE';
              return (
                <div key={match.id} className={`bg-[#1A1A1A] border ${isLive ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-white/10'} rounded-2xl p-6 relative overflow-hidden`}>
                  
                  {isLive && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg animate-pulse">
                      مباشر LIVE
                    </div>
                  )}

                  <div className="text-center text-gray-400 text-sm mb-4 font-mono">
                    {match.groupPhase} • {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {/* Home Team */}
                    <Link href={`/asset/${match.homeTeam.id}`} className="flex-1 flex flex-col items-center group">
                      <span className="text-5xl mb-2">{match.homeTeam.image}</span>
                      <span className="font-bold text-lg group-hover:text-[#0FF0FC] transition-colors">{match.homeTeam.name}</span>
                      <span className="font-mono text-sm text-gray-400 mt-1">{match.homeTeam.current_price} ¢</span>
                    </Link>

                    {/* Score / VS */}
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {match.status === 'SCHEDULED' ? (
                        <div className="bg-black/50 border border-white/20 rounded-full px-4 py-2 font-bold text-gray-400">VS</div>
                      ) : (
                        <div className="text-4xl font-bold font-mono tracking-widest text-[#FFD700]">
                          {match.homeScore} - {match.awayScore}
                        </div>
                      )}
                      {match.status === 'FINISHED' && (
                        <span className="text-xs text-gray-500 mt-2">انتهت</span>
                      )}
                    </div>

                    {/* Away Team */}
                    <Link href={`/asset/${match.awayTeam.id}`} className="flex-1 flex flex-col items-center group">
                      <span className="text-5xl mb-2">{match.awayTeam.image}</span>
                      <span className="font-bold text-lg group-hover:text-[#0FF0FC] transition-colors">{match.awayTeam.name}</span>
                      <span className="font-mono text-sm text-gray-400 mt-1">{match.awayTeam.current_price} ¢</span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
