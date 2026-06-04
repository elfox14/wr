'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { Trophy, TrendingUp, Medal, Calendar, CalendarDays, CalendarCheck, Crown } from 'lucide-react';
import { useSession } from 'next-auth/react';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'all-time';

interface LeaderboardUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  profit: number;
  isReal: boolean;
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [timeframe, setTimeframe] = useState<Timeframe>('all-time');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, [timeframe]);

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-20">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#FFD700]/10 rounded-full blur-3xl -z-10"></div>
          <h1 className="text-5xl font-extrabold mb-4 flex items-center justify-center gap-4 text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FFA500]">
            <Trophy className="text-[#FFD700]" size={48} />
            ترتيب المستثمرين
            <Trophy className="text-[#FFD700]" size={48} />
          </h1>
          <p className="text-gray-400 text-lg">أفضل المتداولين في بورصة المونديال</p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          <button 
            onClick={() => setTimeframe('daily')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'daily' ? 'bg-[#0FF0FC] text-black shadow-[0_0_15px_rgba(15,240,252,0.5)]' : 'bg-[#1A1A1A] text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <Calendar size={18} /> يومي
          </button>
          <button 
            onClick={() => setTimeframe('weekly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'weekly' ? 'bg-[#0FF0FC] text-black shadow-[0_0_15px_rgba(15,240,252,0.5)]' : 'bg-[#1A1A1A] text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <CalendarDays size={18} /> أسبوعي
          </button>
          <button 
            onClick={() => setTimeframe('monthly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'monthly' ? 'bg-[#0FF0FC] text-black shadow-[0_0_15px_rgba(15,240,252,0.5)]' : 'bg-[#1A1A1A] text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <CalendarCheck size={18} /> شهري
          </button>
          <button 
            onClick={() => setTimeframe('all-time')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'all-time' ? 'bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.5)]' : 'bg-[#1A1A1A] text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <Crown size={18} /> طوال البطولة
          </button>
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 bg-white/5 animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user, index) => {
              const currentUser = session?.user as any;
              const isCurrentUser = currentUser?.email && user.id === currentUser.id;
              let rankColor = "text-gray-400";
              let bgGlow = "hover:border-[#0FF0FC]/50";
              
              if (index === 0) { rankColor = "text-[#FFD700]"; bgGlow = "border-[#FFD700]/30 shadow-[0_0_20px_rgba(255,215,0,0.15)]"; }
              else if (index === 1) { rankColor = "text-gray-300"; bgGlow = "border-gray-300/30"; }
              else if (index === 2) { rankColor = "text-[#CD7F32]"; bgGlow = "border-[#CD7F32]/30"; }

              return (
                <div 
                  key={user.id} 
                  className={`relative flex items-center justify-between p-5 rounded-2xl bg-[#1A1A1A] border ${isCurrentUser ? 'border-[#0FF0FC] shadow-[0_0_10px_rgba(15,240,252,0.3)]' : 'border-white/5'} ${bgGlow} transition-all overflow-hidden group`}
                >
                  {isCurrentUser && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0FF0FC]"></div>
                  )}

                  <div className="flex items-center gap-6">
                    <div className={`text-3xl font-bold font-mono w-10 text-center ${rankColor}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    
                    <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-2xl border border-white/10 group-hover:border-[#0FF0FC]/50 transition-colors">
                      {user.avatar}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        {user.name} 
                        {isCurrentUser && <span className="text-xs bg-[#0FF0FC]/20 text-[#0FF0FC] px-2 py-0.5 rounded">أنت</span>}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">@{user.username}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">صافي الأرباح</p>
                    <p className="text-2xl font-bold font-mono text-green-400 flex items-center justify-end gap-1">
                      <TrendingUp size={20} />
                      +{user.profit.toLocaleString()} ¢
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
