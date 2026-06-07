'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Gift, Video, Users, Calendar, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';

export default function RewardsPage() {
  const { data: session, status } = useSession();
  const { userStats, fetchPortfolio, addNotification } = useStore();
  const router = useRouter();
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [referralInput, setReferralInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [adTimer, setAdTimer] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && !userStats) {
      fetchPortfolio();
    }
  }, [session, userStats, fetchPortfolio]);

  const handleClaim = async (type: 'daily' | 'weekly') => {
    setLoadingAction(type);
    try {
      const res = await fetch(`/api/rewards/${type}`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        addNotification(data.error);
      } else {
        addNotification(data.message);
        await fetchPortfolio();
      }
    } catch (err) {
      addNotification('حدث خطأ في الخادم');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWatchAd = () => {
    setLoadingAction('ad');
    setAdTimer(15);
    
    const interval = setInterval(() => {
      setAdTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          finishAdWatch();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishAdWatch = async () => {
    try {
      const res = await fetch(`/api/rewards/ad`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        addNotification(data.error);
      } else {
        addNotification(data.message);
        await fetchPortfolio();
      }
    } catch (err) {
      addNotification('حدث خطأ في الخادم');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralInput) return;
    
    setLoadingAction('referral');
    try {
      const res = await fetch(`/api/rewards/referral`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referralInput.trim() })
      });
      const data = await res.json();
      
      if (!res.ok) {
        addNotification(data.error);
      } else {
        addNotification(data.message);
        setReferralInput('');
        await fetchPortfolio();
      }
    } catch (err) {
      addNotification('حدث خطأ في الخادم');
    } finally {
      setLoadingAction(null);
    }
  };

  const copyReferralCode = () => {
    if (userStats?.referralCode) {
      navigator.clipboard.writeText(userStats.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const checkCooldown = (lastRewardDate?: string, hoursRequired: number = 24) => {
    if (!lastRewardDate) return { canClaim: true, timeLeft: '' };
    
    const lastDate = new Date(lastRewardDate);
    const now = new Date();
    const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    
    if (diffHours >= hoursRequired) {
      return { canClaim: true, timeLeft: '' };
    }
    
    const remainingHours = hoursRequired - diffHours;
    const h = Math.floor(remainingHours);
    const m = Math.floor((remainingHours - h) * 60);
    
    return { 
      canClaim: false, 
      timeLeft: `${h} ساعة و ${m} دقيقة` 
    };
  };

  if (!userStats) {
    return <div className="p-8 text-center text-white">جاري التحميل...</div>;
  }

  const dailyStatus = checkCooldown(userStats.lastDailyReward, 24);
  const weeklyStatus = checkCooldown(userStats.lastWeeklyReward, 168);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
            
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader 
          title="مركز المكافآت"
          description="احصل على كوينز مجانية لزيادة محفظتك الاستثمارية"
          icon={<Gift size={48} />}
          glowColor="bg-[#FFD700]/10"
          textColor="text-[#FFD700]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Watch Ad */}
          <div className="bg-surface border border-white/5 shadow-card hover:shadow-card-hover p-6 rounded-2xl relative overflow-hidden group transition-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0FF0FC]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#0FF0FC]/20 p-3 rounded-lg text-[#0FF0FC]">
                <Video size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">مشاهدة إعلان</h2>
                <p className="text-sm text-gray-400">+500 كوين لكل إعلان</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleWatchAd}
            disabled={loadingAction === 'ad'}
            className="w-full mt-4 bg-white/5 border border-white/10 hover:bg-[#0FF0FC]/20 hover:text-[#0FF0FC] hover:border-[#0FF0FC]/50 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50"
          >
            {adTimer !== null ? `جاري المشاهدة... (${adTimer}ث)` : 'شاهد الآن'}
          </button>
        </div>

          {/* Daily Reward */}
          <div className="bg-surface border border-white/5 shadow-card hover:shadow-card-hover p-6 rounded-2xl relative overflow-hidden transition-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#FFD700]/20 p-3 rounded-lg text-[#FFD700]">
                <Calendar size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">المكافأة اليومية</h2>
                <p className="text-sm text-gray-400">+1000 كوين يومياً</p>
              </div>
            </div>
          </div>
          
          {dailyStatus.canClaim ? (
            <button 
              onClick={() => handleClaim('daily')}
              disabled={loadingAction === 'daily'}
              className="w-full mt-4 bg-[#FFD700] text-black font-bold py-3 px-4 rounded-xl hover:bg-[#FFD700]/80 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,215,0,0.4)]"
            >
              {loadingAction === 'daily' ? 'جاري الاستلام...' : 'استلم مكافأتك الآن'}
            </button>
          ) : (
            <button disabled className="w-full mt-4 bg-white/5 border border-white/10 text-gray-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
              <AlertCircle size={18} /> متاحة بعد {dailyStatus.timeLeft}
            </button>
          )}
        </div>

          {/* Weekly Reward */}
          <div className="bg-surface border border-white/5 shadow-card hover:shadow-card-hover p-6 rounded-2xl relative overflow-hidden transition-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF0055]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#FF0055]/20 p-3 rounded-lg text-[#FF0055]">
                <Gift size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">المكافأة الأسبوعية</h2>
                <p className="text-sm text-gray-400">+5000 كوين أسبوعياً</p>
              </div>
            </div>
          </div>
          
          {weeklyStatus.canClaim ? (
            <button 
              onClick={() => handleClaim('weekly')}
              disabled={loadingAction === 'weekly'}
              className="w-full mt-4 bg-[#FF0055] text-white font-bold py-3 px-4 rounded-xl hover:bg-[#FF0055]/80 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,0,85,0.4)]"
            >
              {loadingAction === 'weekly' ? 'جاري الاستلام...' : 'استلم مكافأتك الكبرى'}
            </button>
          ) : (
            <button disabled className="w-full mt-4 bg-white/5 border border-white/10 text-gray-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
              <AlertCircle size={18} /> متاحة بعد {weeklyStatus.timeLeft}
            </button>
          )}
        </div>

          {/* Referrals */}
          <div className="bg-surface border border-white/5 shadow-card hover:shadow-card-hover p-6 rounded-2xl relative overflow-hidden md:col-span-2 transition-shadow">
            <div className="absolute top-0 left-0 w-48 h-48 bg-[#9D00FF]/10 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none"></div>
            <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#9D00FF]/20 p-3 rounded-lg text-[#9D00FF]">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">دعوة الأصدقاء</h2>
                <p className="text-sm text-gray-400">+2000 كوين لك ولصديقك!</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* User's Code */}
            <div>
              <p className="text-sm text-gray-400 mb-2">كود الدعوة الخاص بك (انشره لأصدقائك)</p>
              <div className="flex items-center gap-2">
                <div className="bg-black/50 border border-white/10 p-3 rounded-xl flex-1 text-center font-mono text-xl text-white tracking-widest">
                  {userStats.referralCode || 'جاري التوليد...'}
                </div>
                <button 
                  onClick={copyReferralCode}
                  className="bg-[#9D00FF] hover:bg-[#9D00FF]/80 text-white p-3.5 rounded-xl transition-colors"
                >
                  {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>

            {/* Input Code */}
            <div>
              {userStats.referredById ? (
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-center h-full flex flex-col justify-center">
                  <CheckCircle2 className="mx-auto text-green-500 mb-2" size={28} />
                  <p className="text-green-500 font-bold">لقد استخدمت كود دعوة مسبقاً</p>
                </div>
              ) : (
                <form onSubmit={handleApplyReferral}>
                  <p className="text-sm text-gray-400 mb-2">أدخل كود صديقك للحصول على المكافأة</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="XXXXXX"
                      value={referralInput}
                      onChange={e => setReferralInput(e.target.value.toUpperCase())}
                      className="bg-black/50 border border-white/10 p-3 rounded-xl flex-1 text-center font-mono text-xl text-white uppercase outline-none focus:border-[#9D00FF]"
                      maxLength={6}
                    />
                    <button 
                      type="submit"
                      disabled={loadingAction === 'referral' || referralInput.length < 3}
                      className="bg-white text-black font-bold px-6 py-3.5 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      تفعيل
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          </div>

        </div>

      </main>
    </div>
  );
}
