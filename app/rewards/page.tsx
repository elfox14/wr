'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Gift, Video, Users, Calendar, AlertCircle, Copy, CheckCircle2, Trophy, Target, Medal, Star, Flame, LayoutGrid, Clock } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('daily');
  const [rewardStatus, setRewardStatus] = useState<any>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchRewardStatus = async () => {
    try {
      const res = await fetch('/api/rewards');
      if (res.ok) {
        const data = await res.json();
        setRewardStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (session && !userStats) {
      fetchPortfolio();
    }
    if (session) {
      fetchRewardStatus();
    }
  }, [session, userStats, fetchPortfolio]);

  const handleClaim = async (type: string, endpoint: string = '/api/rewards/claim') => {
    setLoadingAction(type);
    try {
      const payload = endpoint === '/api/rewards/claim' ? { taskId: type } : undefined;
      const res = await fetch(endpoint, { 
        method: 'POST',
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined
      });
      const data = await res.json();
      
      if (!res.ok) {
        addNotification(data.error);
      } else {
        addNotification(data.message);
        await fetchPortfolio();
        await fetchRewardStatus();
      }
    } catch (err) {
      addNotification('حدث خطأ في الخادم');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWatchAd = () => {
    if (rewardStatus?.ads?.watchedToday >= rewardStatus?.ads?.maxPerDay) {
      addNotification(`لقد وصلت للحد الأقصى للإعلانات اليوم (${rewardStatus.ads.maxPerDay})`);
      return;
    }
    if (rewardStatus?.remainingToday < rewardStatus?.ads?.amountPerAd) {
      addNotification('لقد وصلت للحد الأقصى للمكافآت اليومية (1500)');
      return;
    }

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
        await fetchRewardStatus();
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
        await fetchRewardStatus();
      }
    } catch (err) {
      addNotification('حدث خطأ في الخادم');
    } finally {
      setLoadingAction(null);
    }
  };

  const copyReferralCode = () => {
    if (rewardStatus?.referral?.code) {
      navigator.clipboard.writeText(rewardStatus.referral.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!userStats || !rewardStatus) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'daily', label: 'يومي', icon: <Calendar size={18} /> },
    { id: 'ads', label: 'إعلانات', icon: <Video size={18} /> },
    { id: 'tasks', label: 'مهام', icon: <Target size={18} /> },
    { id: 'referrals', label: 'إحالات', icon: <Users size={18} /> },
    { id: 'achievements', label: 'إنجازات', icon: <Medal size={18} /> },
    { id: 'season', label: 'الموسم', icon: <Trophy size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      
      {/* VIRTUAL COINS BANNER */}
      <div className="bg-gradient-to-r from-red-600 to-red-500 text-white text-center py-2 px-4 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
        <p className="font-bold text-xs md:text-sm flex items-center justify-center gap-2">
          <AlertCircle size={16} /> الكوينز افتراضية بالكامل ولا يمكن سحبها أو تحويلها إلى أموال حقيقية.
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="مركز المكافآت"
          description="أكمل المهام والإنجازات لزيادة رصيدك الافتراضي وبناء محفظتك"
          icon={<Gift size={40} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        {/* TOP DASHBOARD CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface border border-white/5 rounded-2xl p-4 shadow-card text-center">
            <p className="text-gray-400 text-xs mb-1">الرصيد الحالي</p>
            <p className="text-xl md:text-2xl font-black text-white font-mono">{userStats.balance.toLocaleString()} ¢</p>
          </div>
          
          <div className="bg-surface border border-white/5 rounded-2xl p-4 shadow-card text-center relative overflow-hidden">
            <div className="absolute bottom-0 left-0 h-1 bg-primary" style={{ width: `${(rewardStatus.earnedToday / rewardStatus.dailyCap) * 100}%` }}></div>
            <p className="text-gray-400 text-xs mb-1">المكافآت اليومية</p>
            <p className="text-xl md:text-2xl font-black text-primary font-mono">{rewardStatus.earnedToday} <span className="text-sm text-gray-500">/ {rewardStatus.dailyCap}</span></p>
          </div>
          
          <div className="bg-surface border border-white/5 rounded-2xl p-4 shadow-card text-center">
            <p className="text-gray-400 text-xs mb-1">أيام الاستمرار</p>
            <p className="text-xl md:text-2xl font-black text-orange-400 flex items-center justify-center gap-1">
              <Flame size={20} /> {rewardStatus.daily.streak} أيام
            </p>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-4 shadow-card text-center">
            <p className="text-gray-400 text-xs mb-1">الإعلانات المتبقية</p>
            <p className="text-xl md:text-2xl font-black text-blue-400">
              {rewardStatus.ads.maxPerDay - rewardStatus.ads.watchedToday} <span className="text-sm text-gray-500">/ {rewardStatus.ads.maxPerDay}</span>
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex overflow-x-auto gap-2 pb-4 mb-6 hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary text-black shadow-[0_0_15px_rgba(15,240,252,0.3)]' 
                  : 'bg-surface border border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div className="animate-fade-in">

          {/* DAILY TAB */}
          {activeTab === 'daily' && (
            <div className="space-y-6">
              <div className="bg-surface border border-white/5 p-6 rounded-3xl shadow-card">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-orange-500/20 p-4 rounded-2xl text-orange-500">
                    <Flame size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">تسجيل الدخول اليومي</h2>
                    <p className="text-gray-400 text-sm">سجل دخولك يومياً لزيادة مكافأتك تدريجياً (تصل لـ 1000)</p>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-8">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const isClaimed = day <= rewardStatus.daily.streak;
                    const isCurrent = day === rewardStatus.daily.streak + 1;
                    let amt = 300;
                    if(day===2) amt=350; if(day===3) amt=400; if(day===4) amt=450;
                    if(day===5) amt=500; if(day===6) amt=600; if(day===7) amt=1000;
                    
                    return (
                      <div key={day} className={`flex flex-col items-center p-2 rounded-xl border ${
                        isClaimed ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' :
                        isCurrent ? 'bg-white/10 border-white/20 text-white' :
                        'bg-black/30 border-white/5 text-gray-600'
                      }`}>
                        <span className="text-[10px] font-bold mb-1">يوم {day}</span>
                        {isClaimed ? <CheckCircle2 size={16} className="mb-1" /> : <Star size={16} className={isCurrent ? 'text-yellow-400 mb-1' : 'mb-1'} />}
                        <span className="text-xs font-mono font-bold">{amt}</span>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => handleClaim('daily', '/api/rewards/daily')}
                  disabled={loadingAction === 'daily' || !rewardStatus.daily.available || rewardStatus.remainingToday <= 0}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-black py-4 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {loadingAction === 'daily' ? 'جاري الاستلام...' : 
                   !rewardStatus.daily.available ? 'تم الاستلام اليوم' : 
                   rewardStatus.remainingToday <= 0 ? 'الحد الأقصى اليومي للمكافآت' :
                   `استلم مكافأة اليوم (${rewardStatus.daily.amount} ¢)`}
                </button>
              </div>

              {/* Weekly Bonus inside Daily Tab */}
              <div className="bg-surface border border-white/5 p-6 rounded-3xl shadow-card flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">المكافأة الأسبوعية</h3>
                  <p className="text-sm text-gray-400 mb-3">سجل دخولك 5 أيام في الأسبوع لتحصل على 1500، و7 أيام لـ 2500.</p>
                  <p className="text-xs text-primary font-bold">أيام الدخول هذا الأسبوع: {rewardStatus.weekly.loginDaysThisWeek}</p>
                </div>
                <button 
                  onClick={() => handleClaim('weekly', '/api/rewards/weekly')}
                  disabled={loadingAction === 'weekly' || !rewardStatus.weekly.available || rewardStatus.weekly.loginDaysThisWeek < 5}
                  className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                >
                  استلم (أسبوعي)
                </button>
              </div>
            </div>
          )}

          {/* ADS TAB */}
          {activeTab === 'ads' && (
            <div className="bg-surface border border-white/5 p-6 md:p-10 rounded-3xl shadow-card text-center max-w-2xl mx-auto">
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500 mx-auto mb-6">
                <Video size={48} />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">شاهد إعلاناً، اكسب كوينز!</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                ساعد في دعم المنصة عن طريق مشاهدة إعلان قصير، واحصل على {rewardStatus.ads.amountPerAd} كوينز فوراً لمحفظتك.
              </p>
              
              <div className="bg-black/50 border border-white/5 rounded-2xl p-4 mb-8 flex justify-center gap-8">
                <div>
                  <p className="text-xs text-gray-500 mb-1">إعلانات اليوم</p>
                  <p className="text-xl font-black text-white">{rewardStatus.ads.watchedToday} / {rewardStatus.ads.maxPerDay}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">المكافأة للإعلان</p>
                  <p className="text-xl font-black text-primary font-mono">+{rewardStatus.ads.amountPerAd} ¢</p>
                </div>
              </div>

              <button 
                onClick={handleWatchAd}
                disabled={loadingAction === 'ad' || !rewardStatus.ads.available}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50"
              >
                {adTimer !== null ? `جاري المشاهدة... (${adTimer}ث)` : 
                 rewardStatus.ads.watchedToday >= rewardStatus.ads.maxPerDay ? 'الحد الأقصى للإعلانات' : 
                 rewardStatus.remainingToday < rewardStatus.ads.amountPerAd ? 'الحد الأقصى اليومي للكوينز' :
                 'شاهد الإعلان الآن'}
              </button>
            </div>
          )}

          {/* TRADING TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-blue-400 text-sm mb-6 flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>المهام اليومية تخضع للحد الأقصى اليومي (1500 كوين). تأكد من إكمال المهام واستلام الجوائز يومياً قبل إعادة الضبط.</p>
              </div>

              {[
                { id: 'TASK_FIRST_TRADE', label: 'أول صفقة تداول لليوم', reward: 150, done: rewardStatus.tasks.firstTrade },
                { id: 'TASK_UNDERVALUED', label: 'شراء سهم بأقل من قيمته العادلة', reward: 100, done: rewardStatus.tasks.undervalued },
                { id: 'TASK_PROFIT_SELL', label: 'بيع سهم بربح محقق', reward: 100, done: rewardStatus.tasks.profitSell },
                { id: 'TASK_WATCHLIST', label: 'إضافة سهم للمفضلة', reward: 50, done: rewardStatus.tasks.watchlist },
                { id: 'TASK_DIVERSIFY', label: 'تنويع المحفظة (فريق + لاعب)', reward: 200, done: rewardStatus.tasks.diversify }
              ].map(task => (
                <div key={task.id} className="bg-surface border border-white/5 p-4 md:p-6 rounded-2xl shadow-card flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${task.done ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                      {task.done ? <CheckCircle2 size={20} /> : <Target size={20} />}
                    </div>
                    <div>
                      <h3 className="text-white font-bold">{task.label}</h3>
                      <p className="text-primary font-mono font-bold text-sm">+{task.reward} ¢</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleClaim(task.id)}
                    disabled={task.done || rewardStatus.remainingToday <= 0 || loadingAction === task.id}
                    className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                      task.done ? 'bg-green-500/10 text-green-500 cursor-not-allowed' : 
                      'bg-white/10 text-white hover:bg-white/20'
                    } disabled:opacity-50`}
                  >
                    {task.done ? 'تمت' : 'استلام'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* REFERRALS TAB */}
          {activeTab === 'referrals' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-surface border border-white/5 p-6 rounded-3xl shadow-card">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-purple-500/20 p-4 rounded-2xl text-purple-400">
                    <Users size={32} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">نظام الإحالة المرحلي</h2>
                    <p className="text-gray-400 text-sm">احصل على كوينز عن كل صديق ينضم ويبدأ التداول.</p>
                  </div>
                </div>

                <div className="bg-black/50 border border-white/5 p-4 rounded-2xl mb-6">
                  <p className="text-sm text-gray-400 mb-2">كود الدعوة الخاص بك</p>
                  <div className="flex items-center gap-2">
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex-1 text-center font-mono text-xl text-white tracking-widest">
                      {rewardStatus.referral.code}
                    </div>
                    <button 
                      onClick={copyReferralCode}
                      className="bg-purple-600 hover:bg-purple-500 text-white p-3.5 rounded-xl transition-colors"
                    >
                      {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white mb-2">مراحل الجوائز لكل صديق:</h3>
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                    <span className="text-sm text-gray-300">1. تسجيل الدخول باستخدام الكود</span>
                    <span className="font-mono text-primary font-bold">+500 ¢</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                    <span className="text-sm text-gray-300">2. أول صفقة تداول لصديقك</span>
                    <span className="font-mono text-primary font-bold">+500 ¢</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                    <span className="text-sm text-gray-300">3. ثروة صديقك تتجاوز 12,000</span>
                    <span className="font-mono text-primary font-bold">+1000 ¢</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-surface border border-white/5 p-6 rounded-3xl shadow-card">
                  <h3 className="text-lg font-bold text-white mb-4">إحصائيات الإحالة الخاصة بك</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/50 border border-white/5 p-4 rounded-2xl text-center">
                      <p className="text-gray-500 text-xs mb-1">إجمالي الأصدقاء</p>
                      <p className="text-2xl font-black text-white">{rewardStatus.referral.totalReferred}</p>
                    </div>
                    <div className="bg-black/50 border border-white/5 p-4 rounded-2xl text-center">
                      <p className="text-gray-500 text-xs mb-1">إحالات هذا الشهر (الحد الأقصى)</p>
                      <p className="text-2xl font-black text-white">{rewardStatus.referral.paidReferralsThisMonth} <span className="text-sm text-gray-600">/ {rewardStatus.referral.maxReferralsPerMonth}</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-white/5 p-6 rounded-3xl shadow-card">
                  {userStats.referredById ? (
                    <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl text-center">
                      <CheckCircle2 className="mx-auto text-green-500 mb-3" size={32} />
                      <p className="text-green-500 font-bold">لقد قمت باستخدام كود دعوة صديق مسبقاً.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyReferral}>
                      <h3 className="text-lg font-bold text-white mb-2">لديك كود دعوة؟</h3>
                      <p className="text-sm text-gray-400 mb-4">أدخل كود صديقك لتحصل فوراً على 500 كوين.</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="WCE-XXXXXX"
                          value={referralInput}
                          onChange={e => setReferralInput(e.target.value.toUpperCase())}
                          className="bg-black/50 border border-white/10 p-3 rounded-xl flex-1 text-center font-mono text-xl text-white uppercase outline-none focus:border-purple-500"
                          maxLength={10}
                        />
                        <button 
                          type="submit"
                          disabled={loadingAction === 'referral' || referralInput.length < 5}
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
          )}

          {/* ACHIEVEMENTS TAB */}
          {activeTab === 'achievements' && (
            <div>
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl text-purple-400 text-sm mb-6 flex items-start gap-3">
                <Trophy size={20} className="shrink-0 mt-0.5" />
                <p>الإنجازات هي مكافآت لمرة واحدة ولا تخضع للحد الأقصى اليومي! يمكنك استلامها فور تحقيقها.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'ACH_FIRST_TRADE', label: 'أول صفقة في مسيرتك', reward: 300, icon: <Flame /> },
                  { id: 'ACH_FIRST_PROFIT', label: 'أول ربح محقق', reward: 300, icon: <Star /> },
                  { id: 'ACH_10_TRADES', label: 'متداول نشط (10 صفقات)', reward: 500, icon: <ActivityIcon /> },
                  { id: 'ACH_TOP_100', label: 'دخول قائمة أفضل 100', reward: 1000, icon: <Medal /> },
                  { id: 'ACH_LEAGUE_CREATE', label: 'تأسيس دوري خاص', reward: 500, icon: <Users /> },
                  { id: 'ACH_OWN_GROUP_WINNER', label: 'امتلاك متصدر مجموعة', reward: 1000, icon: <Trophy /> },
                ].map(ach => (
                  <div key={ach.id} className="bg-surface border border-white/5 p-6 rounded-2xl shadow-card text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-800 text-gray-500 rounded-full flex items-center justify-center mb-4 border border-white/10">
                      {ach.icon}
                    </div>
                    <h3 className="font-bold text-white mb-1">{ach.label}</h3>
                    <p className="text-primary font-mono font-bold mb-4">+{ach.reward} ¢</p>
                    <button 
                      onClick={() => handleClaim(ach.id)}
                      disabled={loadingAction === ach.id}
                      className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      تحقق واستلام
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEASON REWARDS TAB */}
          {activeTab === 'season' && (
            <div className="bg-surface border border-white/5 p-6 md:p-10 rounded-3xl shadow-card text-center">
              <Trophy size={64} className="text-[#FFD700] mx-auto mb-6" />
              <h2 className="text-3xl font-black text-white mb-4">مكافآت بطولة كأس العالم</h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                هذه المكافآت الكبرى تُمنح تلقائياً لجميع المدربين النشطين مع تقدم مراحل البطولة الحقيقية. تأكد من بناء محفظتك مبكراً للاستفادة!
              </p>

              <div className="max-w-xl mx-auto space-y-4 text-right">
                <div className="bg-black/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="text-gray-500" />
                    <span className="font-bold text-white">انطلاق البطولة (مباراة الافتتاح)</span>
                  </div>
                  <span className="font-mono text-[#FFD700] font-black">+1000 ¢</span>
                </div>
                <div className="bg-black/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="text-gray-500" />
                    <span className="font-bold text-white">نهاية دور المجموعات</span>
                  </div>
                  <span className="font-mono text-[#FFD700] font-black">+1000 ¢</span>
                </div>
                <div className="bg-black/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="text-gray-500" />
                    <span className="font-bold text-white">انطلاق دور الـ 16</span>
                  </div>
                  <span className="font-mono text-[#FFD700] font-black">+1500 ¢</span>
                </div>
                <div className="bg-black/50 border border-white/5 p-4 rounded-xl flex items-center justify-between border-l-4 border-l-[#FFD700]">
                  <div className="flex items-center gap-3">
                    <Trophy className="text-[#FFD700]" />
                    <span className="font-bold text-white">أسبوع النهائي الكبير</span>
                  </div>
                  <span className="font-mono text-[#FFD700] font-black">+1500 ¢</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  );
}
