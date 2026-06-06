'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, Plus, LogIn, Trophy, ArrowLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface League {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  isCreator: boolean;
}

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchLeagues();
    }
  }, [status, router]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch('/api/leagues');
      if (res.ok) {
        const data = await res.json();
        setLeagues(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName) return;
    setIsCreating(true);

    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('تم إنشاء الدوري بنجاح!');
        setCreateName('');
        router.push(`/leagues/${data.id}`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'حدث خطأ');
      }
    } catch (e) {
      toast.error('خطأ في الاتصال');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    setIsJoining(true);

    try {
      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('تم الانضمام بنجاح!');
        setJoinCode('');
        router.push(`/leagues/${data.leagueId}`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'حدث خطأ');
      }
    } catch (e) {
      toast.error('خطأ في الاتصال');
    } finally {
      setIsJoining(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <PageHeader 
          title="دوريات التحدي"
          description="أنشئ دوري خاص بك ونافس أصدقاءك على المراكز الأولى"
          icon={<Users size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Create League */}
          <div className="bg-surface border border-white/5 shadow-card rounded-3xl p-8 hover:border-primary/30 transition-all">
            <div className="w-14 h-14 bg-[#0FF0FC]/20 rounded-full flex items-center justify-center mb-6">
              <Plus className="text-[#0FF0FC]" size={28} />
            </div>
            <h2 className="text-2xl font-bold mb-2">إنشاء دوري جديد</h2>
            <p className="text-gray-400 mb-6">احصل على رمز دعوة خاص وشارك الرابط مع أصدقائك لبدء التحدي.</p>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                placeholder="اسم المجموعة (مثال: دوري الأبطال)"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0FF0FC] transition-colors"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-[#0FF0FC] text-black font-bold py-3 rounded-xl hover:bg-[#00B4DB] transition-colors disabled:opacity-50"
              >
                {isCreating ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}
              </button>
            </form>
          </div>

          {/* Join League */}
          <div className="bg-surface border border-white/5 shadow-card rounded-3xl p-8 hover:border-[#CD7F32]/30 transition-all">
            <div className="w-14 h-14 bg-[#CD7F32]/20 rounded-full flex items-center justify-center mb-6">
              <LogIn className="text-[#CD7F32]" size={28} />
            </div>
            <h2 className="text-2xl font-bold mb-2">الانضمام إلى دوري</h2>
            <p className="text-gray-400 mb-6">لديك رمز دعوة من صديق؟ أدخله هنا للانضمام إلى دوريه الخاص.</p>
            
            <form onSubmit={handleJoin} className="space-y-4">
              <input
                type="text"
                placeholder="رمز الدعوة (مثال: X7AB9Q)"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#CD7F32] uppercase transition-colors"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={isJoining}
                className="w-full bg-[#CD7F32] text-white font-bold py-3 rounded-xl hover:bg-[#A0522D] transition-colors disabled:opacity-50"
              >
                {isJoining ? 'جاري الانضمام...' : 'انضم الآن'}
              </button>
            </form>
          </div>
        </div>

        {/* User Leagues */}
        <div>
          <h2 className="text-3xl font-bold mb-6 border-b border-white/10 pb-4">دورياتي ({leagues.length})</h2>
          
          {leagues.length === 0 ? (
            <div className="text-center py-12 bg-surface border border-white/5 shadow-card rounded-3xl">
              <Trophy className="mx-auto text-gray-500 mb-4" size={48} />
              <p className="text-gray-400 text-lg">لم تنضم لأي دوري بعد.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagues.map(league => (
                <Link href={`/leagues/${league.id}`} key={league.id}>
                  <div className="bg-surface shadow-card border border-white/5 rounded-2xl p-6 hover:border-primary/50 hover:shadow-card-hover transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-xl text-white group-hover:text-[#0FF0FC] transition-colors">
                        {league.name}
                      </h3>
                      {league.isCreator && (
                        <span className="bg-[#FFD700]/20 text-[#FFD700] text-xs px-2 py-1 rounded">المنشئ</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-400">
                      <span className="flex items-center gap-1"><Users size={16} /> {league.memberCount} عضو</span>
                      <span className="flex items-center gap-1 text-[#0FF0FC] opacity-0 group-hover:opacity-100 transition-opacity">
                        عرض الترتيب <ArrowLeft size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
