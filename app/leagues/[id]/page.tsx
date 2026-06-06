'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Trophy, TrendingUp, Copy, CheckCircle, ArrowRight, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function GroupLeaderboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchLeague();
    }
  }, [status, router]);

  const fetchLeague = async () => {
    try {
      const res = await fetch(`/api/leagues/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setLeague(data);
      } else {
        router.push('/leagues'); // Redirect if not member or not found
      }
    } catch (e) {
      console.error(e);
      router.push('/leagues');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (league) {
      navigator.clipboard.writeText(league.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!league) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/leagues" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowRight size={20} /> العودة لدوريات التحدي
        </Link>

        <PageHeader 
          title={league.name}
          description="لوحة الصدارة الخاصة بأعضاء هذا الدوري."
          icon={<Users size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        >
          <div className="bg-black/50 border border-primary/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">رمز الدعوة للأصدقاء</p>
              <p className="font-mono text-xl font-bold tracking-widest text-primary">{league.inviteCode}</p>
            </div>
            <button 
              onClick={handleCopy}
              className="w-12 h-12 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl flex items-center justify-center transition-colors"
            >
              {copied ? <CheckCircle size={24} /> : <Copy size={24} />}
            </button>
          </div>
        </PageHeader>



        {/* Leaderboard List */}
        <div className="space-y-4">
          {league.leaderboard.map((user: any, index: number) => {
            const isCurrentUser = session?.user && (session.user as any).id === user.id;
            let rankColor = "text-gray-400";
            let bgGlow = "hover:border-[#0FF0FC]/50";
            
            if (index === 0) { rankColor = "text-[#FFD700]"; bgGlow = "border-[#FFD700]/30 shadow-[0_0_20px_rgba(255,215,0,0.15)]"; }
            else if (index === 1) { rankColor = "text-gray-300"; bgGlow = "border-gray-300/30"; }
            else if (index === 2) { rankColor = "text-[#CD7F32]"; bgGlow = "border-[#CD7F32]/30"; }

            return (
              <div 
                key={user.id} 
                className={`relative flex items-center justify-between p-5 rounded-2xl bg-surface border ${isCurrentUser ? 'border-primary shadow-[0_0_10px_rgba(15,240,252,0.3)]' : 'border-white/5'} ${bgGlow} transition-all overflow-hidden group`}
              >
                {isCurrentUser && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                )}

                <div className="flex items-center gap-6">
                  <div className={`text-3xl font-bold font-mono w-10 text-center ${rankColor}`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  
                  <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-2xl border border-white/10 group-hover:border-[#0FF0FC]/50 transition-colors overflow-hidden">
                    {user.image && user.image.startsWith('http') ? (
                       <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                       user.image || '👤'
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      {user.name} 
                      {isCurrentUser && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">أنت</span>}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">@{user.username}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">صافي الأرباح</p>
                  <p className="text-2xl font-bold font-mono text-green-400 flex items-center justify-end gap-1">
                    <TrendingUp size={20} />
                    +{user.total_profit.toLocaleString()} ¢
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
