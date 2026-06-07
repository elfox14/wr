'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Trophy, TrendingUp, Copy, CheckCircle, ArrowRight, Users, LayoutDashboard, ListOrdered, Activity as ActivityIcon, Crown, Sword, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function LeagueDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'members' | 'activity' | 'knockout'>('overview');
  const [sortBy, setSortBy] = useState<'netWorth' | 'roi' | 'unrealizedPnL' | 'realizedProfit' | 'tradesCount' | 'portfolioRisk'>('netWorth');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status, router]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/leagues/${params.id}/analytics`);
      if (res.ok) {
        const jsonData = await res.json();
        setData(jsonData);
      } else {
        router.push('/leagues');
      }
    } catch (e) {
      console.error(e);
      router.push('/leagues');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (data?.league) {
      navigator.clipboard.writeText(data.league.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (data?.league) {
      const url = `${window.location.origin}/leagues?join=${data.league.inviteCode}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!data || !data.league) return null;

  const { league, currentUserRank, currentUserNetWorth, totalMembers, averageNetWorth, highestNetWorth, topPerformer, mostActiveTrader, leaderboard, recentActivity } = data;

  // Sorting logic for leaderboard
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    return b[sortBy] - a[sortBy];
  });

  const getSortIcon = (key: string) => {
    return sortBy === key ? <ArrowDownRight size={14} className="inline ml-1 text-[#0FF0FC]" /> : null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <Link href="/leagues" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
              <ArrowRight size={20} /> العودة لدوريات التداول
            </Link>
            <h1 className="text-4xl font-black text-white flex items-center gap-3">
              <Trophy className="text-[#FFD700]" size={36} /> {league.name}
            </h1>
            <p className="text-gray-400 mt-2 flex items-center gap-2">
              <Users size={16} /> أعضاء الدوري: {totalMembers}
            </p>
          </div>
          
          <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 flex flex-col gap-3 min-w-[280px]">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest text-center">رمز الدعوة</p>
            <div className="font-mono text-3xl font-black tracking-widest text-center text-primary">{league.inviteCode}</div>
            <div className="flex gap-2">
              <button onClick={handleCopyCode} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center gap-1 border border-white/10">
                {copiedCode ? <CheckCircle size={14} className="text-success" /> : <Copy size={14} />} نسخ الرمز
              </button>
              <button onClick={handleCopyLink} className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center gap-1 border border-primary/20">
                {copiedLink ? <CheckCircle size={14} /> : <Copy size={14} />} رابط مباشر
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Tabs Navigation */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-8 border-b border-white/10 pb-4">
          <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-primary text-black' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <LayoutDashboard size={18} /> نظرة عامة
          </button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'leaderboard' ? 'bg-primary text-black' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <ListOrdered size={18} /> لوحة الصدارة
          </button>
          <button onClick={() => setActiveTab('knockout')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'knockout' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <Sword size={18} /> التصفيات (Knockout)
          </button>
          <button onClick={() => setActiveTab('members')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'members' ? 'bg-primary text-black' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <Users size={18} /> الأعضاء
          </button>
          <button onClick={() => setActiveTab('activity')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activity' ? 'bg-primary text-black' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <ActivityIcon size={18} /> نشاط التداول
          </button>
        </div>

        {/* TAB CONTENT: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">مركزي الحالي</p>
                <p className="text-4xl font-black text-[#FFD700]">#{currentUserRank || '-'}</p>
              </div>
              <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">قيمة محفظتي</p>
                <p className="text-2xl font-mono font-bold text-primary">{Math.round(currentUserNetWorth).toLocaleString()} ¢</p>
              </div>
              <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">متوسط ثروة الدوري</p>
                <p className="text-2xl font-mono font-bold text-white">{Math.round(averageNetWorth).toLocaleString()} ¢</p>
              </div>
              <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Crown size={80} /></div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 relative z-10">أعلى ثروة</p>
                <p className="text-2xl font-mono font-bold text-success relative z-10">{Math.round(highestNetWorth).toLocaleString()} ¢</p>
              </div>
            </div>

            {/* Top Performers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-400 mb-1 flex items-center gap-2"><Trophy size={16} className="text-[#FFD700]" /> متصدر الدوري</h3>
                  <p className="text-2xl font-black text-white">{topPerformer?.name || 'لا يوجد'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase">قيمة المحفظة</p>
                  <p className="text-xl font-mono font-bold text-primary">{Math.round(topPerformer?.netWorth || 0).toLocaleString()} ¢</p>
                </div>
              </div>
              
              <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-400 mb-1 flex items-center gap-2"><ActivityIcon size={16} className="text-orange-500" /> المتداول الأنشط</h3>
                  <p className="text-2xl font-black text-white">{mostActiveTrader?.name || 'لا يوجد'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase">العمليات</p>
                  <p className="text-xl font-mono font-bold text-orange-500">{mostActiveTrader?.tradesCount || 0} صفقة</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="animate-fade-in space-y-4">
            
            <div className="flex flex-wrap items-center gap-2 bg-surface p-4 rounded-xl border border-white/5">
              <span className="text-sm font-bold text-gray-400 mr-2">فرز حسب:</span>
              {[
                { key: 'netWorth', label: 'صافي الثروة' },
                { key: 'roi', label: 'معدل العائد (ROI)' },
                { key: 'unrealizedPnL', label: 'الأرباح غير المحققة' },
                { key: 'realizedProfit', label: 'الأرباح المحققة' },
                { key: 'tradesCount', label: 'عدد الصفقات' },
                { key: 'portfolioRisk', label: 'مخاطر المحفظة' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === opt.key ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-black/30 text-gray-400 border border-white/5 hover:bg-white/5'}`}
                >
                  {opt.label} {getSortIcon(opt.key)}
                </button>
              ))}
            </div>

            <div className="bg-surface border border-white/5 rounded-2xl shadow-card overflow-x-auto">
              <table className="w-full text-right text-sm whitespace-nowrap">
                <thead className="bg-black/60 text-gray-400 border-b border-white/5">
                  <tr>
                    <th className="p-4 text-center">المركز</th>
                    <th className="p-4">المتداول</th>
                    <th className="p-4 text-center">صافي الثروة</th>
                    <th className="p-4 text-center">العائد (ROI)</th>
                    <th className="p-4 text-center">أرباح عائمة</th>
                    <th className="p-4 text-center">الصفقات</th>
                    <th className="p-4 text-center">مخاطر المحفظة</th>
                    <th className="p-4 text-center">أفضل أصل</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((user, index) => {
                    const isMe = user.id === (session?.user as any)?.id;
                    const rank = index + 1;
                    
                    return (
                      <tr key={user.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${isMe ? 'bg-primary/5' : ''}`}>
                        <td className="p-4 text-center">
                          <span className={`text-xl font-black font-mono ${rank === 1 ? 'text-[#FFD700]' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-[#CD7F32]' : 'text-gray-500'}`}>
                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                              {user.image && user.image.startsWith('http') ? <img src={user.image} alt={user.name} /> : '👤'}
                            </div>
                            <div>
                              <p className="flex items-center gap-2">{user.name} {isMe && <span className="text-[10px] bg-primary text-black px-1.5 rounded">أنت</span>}</p>
                              <p className="text-xs text-gray-500 font-mono">@{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-white">{Math.round(user.netWorth).toLocaleString()} ¢</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${user.roi >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {user.roi >= 0 ? '+' : ''}{user.roi.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-gray-300">{Math.round(user.unrealizedPnL).toLocaleString()} ¢</td>
                        <td className="p-4 text-center text-gray-400">{user.tradesCount}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${user.portfolioRisk > 60 ? 'bg-red-500/10 text-red-500' : user.portfolioRisk > 30 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
                            {user.riskLabelAr}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {user.bestHolding ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-white">{user.bestHolding.assetName}</span>
                              <span className="text-[10px] text-green-400 font-mono">+{user.bestHolding.pnlPercent.toFixed(1)}%</span>
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: MEMBERS */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {leaderboard.map((user: any) => (
              <div key={user.id} className="bg-surface border border-white/5 rounded-2xl p-5 shadow-card hover:border-white/10 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                      {user.image && user.image.startsWith('http') ? <img src={user.image} alt={user.name} /> : '👤'}
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        {user.name}
                        {user.isCreator && <span className="text-[9px] bg-[#FFD700]/20 text-[#FFD700] px-1.5 rounded uppercase font-bold">المنشئ</span>}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono">@{user.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 mb-1">انضم</p>
                    <p className="text-xs font-mono text-gray-400">{new Date(user.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500">الثروة</p>
                    <p className="font-mono text-xs font-bold text-white">{Math.round(user.netWorth).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">الأصول</p>
                    <p className="font-mono text-xs font-bold text-white">{user.assetsCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">المخاطرة</p>
                    <p className={`text-xs font-bold mt-0.5 ${user.portfolioRisk > 60 ? 'text-red-500' : user.portfolioRisk > 30 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {user.riskLabelAr}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB CONTENT: ACTIVITY */}
        {activeTab === 'activity' && (
          <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card animate-fade-in">
            <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2 pb-4 border-b border-white/10">
              <ActivityIcon className="text-orange-500" size={18} /> سجل نشاط المتداولين
            </h3>
            
            {recentActivity.length === 0 ? (
              <div className="text-center py-10">
                <Clock size={40} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400">لا توجد أي أنشطة تداول مسجلة في هذا الدوري حتى الآن.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((act: any) => {
                  const isBuy = act.type === 'BUY';
                  return (
                    <div key={act.id} className="flex items-center gap-4 p-3 bg-black/40 rounded-xl border border-white/5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border ${isBuy ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                        {isBuy ? 'شراء' : 'بيع'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">
                          قام <span className="font-bold text-white">{act.userName}</span> {isBuy ? 'بشراء' : 'ببيع'} <span className="font-bold text-[#0FF0FC]">{act.quantity} أسهم</span> من <span className="font-bold text-white">{act.assetName}</span>
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-1">بسعر {act.price_at_time} ¢ للسهم</p>
                      </div>
                      <div className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-1 rounded">
                        {new Date(act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: KNOCKOUT */}
        {activeTab === 'knockout' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-8 text-center shadow-[0_0_30px_rgba(249,115,22,0.1)]">
              <Sword size={64} className="mx-auto text-orange-500 mb-4" />
              <h2 className="text-3xl font-black text-white mb-2">نظام تصفيات خروج المغلوب</h2>
              <p className="text-orange-400 font-bold text-lg mb-6">قيد التجهيز للمراحل القادمة من المونديال</p>
              <div className="max-w-2xl mx-auto bg-black/50 border border-white/10 rounded-xl p-6 text-gray-300 text-sm leading-relaxed">
                <p className="mb-4">مع تقدم مباريات كأس العالم إلى الأدوار الإقصائية، سيتم تفعيل نظام "الـ Knockout" في الدوريات.</p>
                <div className="bg-surface p-4 rounded-lg text-right border-r-4 border-orange-500">
                  <p className="font-bold text-white mb-2">قانون التأهل الأساسي:</p>
                  <p>سيتأهل **أفضل 8 أعضاء** بناءً على **معدل العائد (ROI)** إلى دور ربع النهائي من الدوري.</p>
                </div>
              </div>
            </div>

            {/* Qualifier Preview */}
            <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-card">
              <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                <ShieldAlert className="text-[#FFD700]" size={18} /> المؤهلون المحتملون (Top 8 by ROI)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[...leaderboard].sort((a: any, b: any) => b.roi - a.roi).slice(0, 8).map((user: any, idx: number) => (
                  <div key={user.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden group hover:border-orange-500/50 transition-colors">
                    <div className="absolute top-0 left-0 bg-orange-500 text-black text-[10px] font-black px-2 py-0.5 rounded-br-lg">
                      تأهل #{idx + 1}
                    </div>
                    <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center overflow-hidden border-2 border-orange-500/50 mb-3 mt-2">
                      {user.image && user.image.startsWith('http') ? <img src={user.image} alt={user.name} /> : '👤'}
                    </div>
                    <p className="font-bold text-white text-sm truncate w-full">{user.name}</p>
                    <p className="text-xs font-bold font-mono text-green-400 mt-1">ROI: +{user.roi.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
