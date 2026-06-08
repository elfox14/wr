'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Trophy, TrendingUp, Users, Activity, BarChart3, AlertTriangle, Wallet, ShieldCheck, XCircle, ArrowUpRight, ArrowDownRight, Target } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

export default function LeaderboardClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('netWorth'); // netWorth, roi, unrealizedPnL, tradesCount, portfolioRisk
  const [timeframe, setTimeframe] = useState('all-time'); // For UI, but strictly true for all-time now

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy, timeframe]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?sortBy=${sortBy}&timeframe=${timeframe}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'محافظ') return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (risk === 'متوازن') return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    if (risk === 'هجومي') return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      
      {/* PRIZE BANNER */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-400 text-white text-center py-3 px-4 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
        <p className="font-bold text-sm flex items-center justify-center gap-2">
          <Trophy size={16} /> الترتيب يعتمد على صافي الثروة الافتراضية داخل المنصة. الكوينز افتراضية بالكامل.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Responsive Header */}
        <div className="text-center mb-10 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(15,240,252,0.3)] flex items-center justify-center gap-4">
            <Trophy className="text-[#FFD700]" size={48} /> لوحة الصدارة
          </h1>
          <p className="text-gray-400 text-lg md:text-xl">
            أفضل المتداولين في منصة WorldCup Exchange. من سيحقق أعلى ثروة افتراضية؟
          </p>
        </div>

        {loading && !data ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : data && (
          <div className="animate-fade-in space-y-12">
            
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 text-center">
                <Users className="text-gray-400 mx-auto mb-2" size={20} />
                <p className="text-[10px] text-gray-500 uppercase mb-1">إجمالي المتداولين</p>
                <p className="text-xl font-black text-white">{data.stats.totalUsers}</p>
              </div>
              <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 text-center">
                <Wallet className="text-primary mx-auto mb-2" size={20} />
                <p className="text-[10px] text-gray-500 uppercase mb-1">إجمالي الثروات الافتراضية</p>
                <p className="text-xl font-black text-primary font-mono">{data.stats.totalNetWorth.toLocaleString()} ¢</p>
              </div>
              <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 text-center">
                <Activity className="text-orange-500 mx-auto mb-2" size={20} />
                <p className="text-[10px] text-gray-500 uppercase mb-1">حجم التداول اليوم</p>
                <p className="text-xl font-black text-white font-mono">{data.stats.totalTradingVolumeToday.toLocaleString()} ¢</p>
              </div>
              <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 text-center">
                <Target className="text-blue-500 mx-auto mb-2" size={20} />
                <p className="text-[10px] text-gray-500 uppercase mb-1">عدد الصفقات اليوم</p>
                <p className="text-xl font-black text-white">{data.stats.totalTradesToday.toLocaleString()}</p>
              </div>
              <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 text-center">
                <TrendingUp className="text-green-500 mx-auto mb-2" size={20} />
                <p className="text-[10px] text-gray-500 uppercase mb-1">أعلى ROI</p>
                <p className="text-xl font-black text-green-400 font-mono">+{data.stats.highestROI}%</p>
              </div>
              <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 text-center">
                <BarChart3 className="text-purple-500 mx-auto mb-2" size={20} />
                <p className="text-[10px] text-gray-500 uppercase mb-1">أعلى ربح غير محقق</p>
                <p className="text-xl font-black text-white font-mono">{data.stats.highestUnrealizedPnL.toLocaleString()} ¢</p>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-surface/50 border border-white/5 rounded-3xl p-4">
              
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { id: 'netWorth', label: 'صافي الثروة' },
                  { id: 'roi', label: 'ROI' },
                  { id: 'unrealizedPnL', label: 'أعلى ربح' },
                  { id: 'tradesCount', label: 'الأكثر نشاطاً' },
                  { id: 'portfolioRisk', label: 'الأقل مخاطرة' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setSortBy(tab.id)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${sortBy === tab.id ? 'bg-primary text-black shadow-[0_0_15px_rgba(15,240,252,0.4)]' : 'bg-black/40 border border-white/5 text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                {[
                  { id: 'all-time', label: 'كل الوقت' },
                  { id: 'monthly', label: 'شهري' },
                  { id: 'weekly', label: 'أسبوعي' },
                  { id: 'daily', label: 'يومي' }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setTimeframe(t.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${timeframe === t.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {timeframe !== 'all-time' && (
              <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2">
                <AlertTriangle size={16} /> قريباً — سيتم احتساب الأداء الزمني الدقيق من سجل الصفقات مباشرة لضمان أعلى درجات الدقة. الترتيب الحالي يعكس (كل الوقت).
              </div>
            )}

            {/* CURRENT USER RANK CARD */}
            {session && data.currentUserRank && (
              <div className="bg-gradient-to-r from-primary/20 to-black border border-primary/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(15,240,252,0.1)] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-black font-black text-2xl shadow-lg border-4 border-black">
                    #{data.currentUserRank}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl mb-1">مركزك الحالي</h3>
                    {data.currentUserRank > 50 ? (
                      <p className="text-gray-400 text-sm">أنت خارج قائمة أفضل 50 متداول. واصل التداول للوصول للقمة!</p>
                    ) : (
                      <p className="text-primary text-sm font-bold">أنت ضمن النخبة! حافظ على مركزك.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TOP 3 PODIUM */}
            {data.leaderboard.length >= 3 && (
              <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-8 pt-10 pb-6 px-4">
                
                {/* RANK 2 */}
                <div className="order-2 md:order-1 bg-gradient-to-b from-surface to-black border border-white/5 rounded-t-3xl rounded-b-xl p-6 flex flex-col items-center w-full md:w-64 relative shadow-card">
                  <div className="absolute -top-6 w-12 h-12 bg-gray-400 text-black font-black flex items-center justify-center rounded-full border-4 border-[#121212] shadow-lg">#2</div>
                  <div className="text-4xl mb-4 mt-2">{data.leaderboard[1].avatar}</div>
                  <h3 className="font-black text-white text-lg mb-1 truncate w-full text-center">{data.leaderboard[1].name}</h3>
                  <p className="text-gray-500 text-xs mb-4">@{data.leaderboard[1].username}</p>
                  <p className="font-mono font-black text-primary text-xl mb-2">{data.leaderboard[1].netWorth.toLocaleString()} ¢</p>
                  <div className={`text-sm font-bold flex items-center gap-1 ${data.leaderboard[1].roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.leaderboard[1].roi >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {Math.abs(data.leaderboard[1].roi)}%
                  </div>
                </div>

                {/* RANK 1 */}
                <div className="order-1 md:order-2 bg-gradient-to-b from-[#FFD700]/20 to-black border border-[#FFD700]/30 rounded-t-3xl rounded-b-xl p-8 flex flex-col items-center w-full md:w-72 relative shadow-[0_0_40px_rgba(255,215,0,0.15)] z-10 md:-translate-y-8">
                  <div className="absolute -top-8 w-16 h-16 bg-[#FFD700] text-black text-2xl font-black flex items-center justify-center rounded-full border-4 border-[#121212] shadow-[0_0_20px_rgba(255,215,0,0.5)]">#1</div>
                  <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none rounded-t-3xl"></div>
                  <div className="text-5xl mb-4 mt-4">{data.leaderboard[0].avatar}</div>
                  <h3 className="font-black text-[#FFD700] text-2xl mb-1 truncate w-full text-center drop-shadow-md">{data.leaderboard[0].name}</h3>
                  <p className="text-gray-400 text-sm mb-6">@{data.leaderboard[0].username}</p>
                  <p className="font-mono font-black text-white text-3xl mb-3 drop-shadow-lg">{data.leaderboard[0].netWorth.toLocaleString()} ¢</p>
                  <div className={`text-lg font-black flex items-center gap-1 bg-black/40 px-4 py-1.5 rounded-full ${data.leaderboard[0].roi >= 0 ? 'text-green-400 border border-green-500/30' : 'text-red-400 border border-red-500/30'}`}>
                    {data.leaderboard[0].roi >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    {Math.abs(data.leaderboard[0].roi)}%
                  </div>
                </div>

                {/* RANK 3 */}
                <div className="order-3 md:order-3 bg-gradient-to-b from-surface to-black border border-white/5 rounded-t-3xl rounded-b-xl p-6 flex flex-col items-center w-full md:w-64 relative shadow-card">
                  <div className="absolute -top-6 w-12 h-12 bg-orange-700 text-white font-black flex items-center justify-center rounded-full border-4 border-[#121212] shadow-lg">#3</div>
                  <div className="text-4xl mb-4 mt-2">{data.leaderboard[2].avatar}</div>
                  <h3 className="font-black text-white text-lg mb-1 truncate w-full text-center">{data.leaderboard[2].name}</h3>
                  <p className="text-gray-500 text-xs mb-4">@{data.leaderboard[2].username}</p>
                  <p className="font-mono font-black text-primary text-xl mb-2">{data.leaderboard[2].netWorth.toLocaleString()} ¢</p>
                  <div className={`text-sm font-bold flex items-center gap-1 ${data.leaderboard[2].roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.leaderboard[2].roi >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {Math.abs(data.leaderboard[2].roi)}%
                  </div>
                </div>

              </div>
            )}

            {/* TOP 50 TABLE */}
            <div className="bg-surface border border-white/5 rounded-3xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-black/60 border-b border-white/5 text-gray-400">
                    <tr>
                      <th className="p-4 text-center w-16">المركز</th>
                      <th className="p-4">المتداول</th>
                      <th className="p-4 text-primary font-bold">صافي الثروة</th>
                      <th className="p-4 text-center">ROI</th>
                      <th className="p-4 text-center">ربح غير محقق</th>
                      <th className="p-4 text-center">صفقات</th>
                      <th className="p-4 text-center">أصول</th>
                      <th className="p-4 text-center">أفضل سهم</th>
                      <th className="p-4 text-center">المخاطرة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.leaderboard.map((user: any) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4 text-center font-mono font-black text-gray-500 group-hover:text-white transition-colors">{user.rank}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{user.avatar}</span>
                            <div>
                              <p className="font-bold text-white leading-tight">{user.name}</p>
                              <p className="text-xs text-gray-500">@{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-black text-primary text-lg">{user.netWorth.toLocaleString()} ¢</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold ${user.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {user.roi >= 0 ? '+' : ''}{user.roi}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-mono font-bold ${user.unrealizedPnL > 0 ? 'text-green-500' : user.unrealizedPnL < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {user.unrealizedPnL > 0 ? '+' : ''}{user.unrealizedPnL.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-gray-400">{user.tradesCount}</td>
                        <td className="p-4 text-center font-mono text-gray-400">{user.assetsCount}</td>
                        <td className="p-4 text-center">
                          {user.bestHolding ? (
                            <div className="text-xs">
                              <p className="text-white font-bold">{user.bestHolding.name}</p>
                              <p className="text-green-400 font-mono">+{user.bestHolding.pnlPercent.toFixed(1)}%</p>
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getRiskColor(user.riskLabelAr)}`}>
                            {user.riskLabelAr}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
