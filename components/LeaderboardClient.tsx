'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { Trophy, TrendingUp, Medal, Calendar, CalendarDays, CalendarCheck, Crown } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { PageHeader } from '@/components/ui/PageHeader';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'all-time';

interface LeaderboardUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  profit: number;
  isReal: boolean;
}

export default function LeaderboardClient() {
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
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader 
          title="ترتيب المستثمرين"
          description="أفضل المتداولين في بورصة المونديال"
          icon={<Trophy size={48} />}
          glowColor="bg-accent/10"
          textColor="text-accent"
        />

        {/* Timeframe Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          <button 
            onClick={() => setTimeframe('daily')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'daily' ? 'bg-primary text-white shadow-anti-gravity' : 'bg-surface text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <Calendar size={18} /> يومي
          </button>
          <button 
            onClick={() => setTimeframe('weekly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'weekly' ? 'bg-primary text-white shadow-anti-gravity' : 'bg-surface text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <CalendarDays size={18} /> أسبوعي
          </button>
          <button 
            onClick={() => setTimeframe('monthly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'monthly' ? 'bg-primary text-white shadow-anti-gravity' : 'bg-surface text-gray-400 hover:bg-white/10 border border-white/5'}`}
          >
            <CalendarCheck size={18} /> شهري
          </button>
          <button 
            onClick={() => setTimeframe('all-time')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${timeframe === 'all-time' ? 'bg-accent text-white shadow-[0_4px_14px_0_rgba(212,160,23,0.39)]' : 'bg-surface text-gray-400 hover:bg-white/10 border border-white/5'}`}
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
              let bgGlow = "hover:border-primary/50 hover:shadow-card-hover";
              
              if (index === 0) { rankColor = "text-accent"; bgGlow = "border-accent/30 shadow-[0_0_20px_rgba(212,160,23,0.15)]"; }
              else if (index === 1) { rankColor = "text-gray-300"; bgGlow = "border-gray-300/30 shadow-card"; }
              else if (index === 2) { rankColor = "text-[#CD7F32]"; bgGlow = "border-[#CD7F32]/30 shadow-card"; }

              return (
                <div 
                  key={user.id} 
                  className={`relative flex items-center justify-between p-5 rounded-2xl bg-surface border ${isCurrentUser ? 'border-primary shadow-anti-gravity' : 'border-white/5'} ${bgGlow} transition-all overflow-hidden group`}
                >
                  {isCurrentUser && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                  )}

                  <div className="flex items-center gap-6">
                    <div className={`text-3xl font-bold font-mono w-10 text-center tabular-nums ${rankColor}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    
                    <div className="w-12 h-12 bg-background/50 rounded-full flex items-center justify-center text-2xl border border-white/10 group-hover:border-primary/50 transition-colors">
                      {user.avatar}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        {user.name} 
                        {isCurrentUser && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-bold">أنت</span>}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">@{user.username}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">صافي الأرباح</p>
                    <p className="text-2xl font-bold text-success flex items-center justify-end gap-1 tabular-nums">
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
