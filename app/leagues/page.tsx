'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, Plus, LogIn, Trophy, ArrowLeft, Crown, TrendingUp, BarChart3, Copy, CheckCircle2 } from 'lucide-react';
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
  myRank?: number;
  myNetWorth?: number;
  topMemberName?: string;
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

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const copyToClipboard = (code: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent link navigation
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('تم نسخ رمز الدعوة');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // Calculate Summary Stats
  const totalMembers = leagues.reduce((acc, l) => acc + l.memberCount, 0);
  const bestRank = leagues.length > 0 ? Math.min(...leagues.map(l => l.myRank || 99999)) : 0;
  const bestNetWorth = leagues.length > 0 ? Math.max(...leagues.map(l => l.myNetWorth || 0)) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      
      <main className="max-w-6xl mx-auto px-4 py-12">
        <PageHeader 
          title="دوريات التداول الاجتماعي"
          description="تداول ونافس أصدقائك في دوريات خاصة. المتداول ذو المحفظة الأكبر يفوز بالتحدي."
          icon={<Users size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        {/* SUMMARY CARDS */}
        {leagues.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">دورياتي</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black text-white">{leagues.length}</span>
                <Trophy className="text-[#CD7F32] mb-1" size={24} />
              </div>
            </div>
            <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">إجمالي الأعضاء</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black text-white">{totalMembers}</span>
                <Users className="text-primary mb-1" size={24} />
              </div>
            </div>
            <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">أفضل مركز حالي</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black text-white">#{bestRank === 99999 ? '-' : bestRank}</span>
                <Crown className="text-[#FFD700] mb-1" size={24} />
              </div>
            </div>
            <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">أفضل أداء لمحفظتك</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-mono font-black text-white">{bestNetWorth} ¢</span>
                <TrendingUp className="text-success mb-1" size={24} />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Create League */}
          <div className="bg-surface border border-white/5 shadow-card rounded-3xl p-8 hover:border-primary/30 transition-all">
            <div className="w-14 h-14 bg-[#0FF0FC]/20 rounded-full flex items-center justify-center mb-6">
              <Plus className="text-[#0FF0FC]" size={28} />
            </div>
            <h2 className="text-2xl font-bold mb-2">إنشاء دوري جديد</h2>
            <p className="text-gray-400 mb-6 text-sm">احصل على رمز دعوة خاص وشارك الرابط مع أصدقائك لبدء التحدي.</p>
            
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
            <p className="text-gray-400 mb-6 text-sm">لديك رمز دعوة من صديق؟ أدخله هنا للانضمام إلى دوريه الخاص.</p>
            
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {leagues.map(league => (
                <div key={league.id} className="bg-surface shadow-card border border-white/5 rounded-3xl p-6 hover:border-primary/50 hover:shadow-card-hover transition-all flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                  
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                      <h3 className="font-bold text-2xl text-white mb-2">{league.name}</h3>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded"><Users size={14} /> {league.memberCount} عضو</span>
                        {league.isCreator && (
                          <span className="bg-[#FFD700]/20 text-[#FFD700] text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest">المنشئ</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Invite Code Block */}
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">رمز الدعوة</p>
                      <button 
                        onClick={(e) => copyToClipboard(league.inviteCode, e)}
                        className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:border-white/20 transition cursor-copy"
                        title="انسخ الرمز"
                      >
                        <span className="font-mono text-sm text-gray-300 font-bold">{league.inviteCode}</span>
                        {copiedCode === league.inviteCode ? <CheckCircle2 size={14} className="text-success" /> : <Copy size={14} className="text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center flex flex-col justify-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">مركزي الحالي</p>
                      <p className="text-2xl font-black text-[#FFD700]">#{league.myRank || '-'}</p>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center flex flex-col justify-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">قيمة محفظتي</p>
                      <p className="text-xl font-mono font-bold text-primary">{league.myNetWorth || 0} ¢</p>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center flex flex-col justify-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">المتصدر</p>
                      <p className="text-sm font-bold text-white truncate px-1">{league.topMemberName || '-'}</p>
                    </div>
                  </div>

                  <Link href={`/leagues/${league.id}`} className="mt-auto relative z-10">
                    <button className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-black font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                      <BarChart3 size={18} /> فتح لوحة الدوري
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
