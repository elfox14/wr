'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Play, CheckCircle2, Clock, Activity, TrendingUp, BarChart3, Users, ChevronRight, Newspaper, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatch();
  }, [params.id]);

  const fetchMatch = async () => {
    try {
      const res = await fetch(`/api/matches/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data);
      } else {
        router.push('/matches');
      }
    } catch (e) {
      console.error(e);
      router.push('/matches');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!match) return null;

  const hTeam = match.homeTeam;
  const aTeam = match.awayTeam;

  const hPrice = Math.round(hTeam.marketPrice ?? hTeam.current_price);
  const aPrice = Math.round(aTeam.marketPrice ?? aTeam.current_price);

  const hFair = Math.round(hTeam.fairValue ?? hTeam.current_price);
  const aFair = Math.round(aTeam.fairValue ?? aTeam.current_price);

  const hPremium = hFair > 0 ? ((hPrice - hFair) / hFair) * 100 : 0;
  const aPremium = aFair > 0 ? ((aPrice - aFair) / aFair) * 100 : 0;

  // Compile related players (top 6 by score)
  const allPlayers = [...(hTeam.players || []), ...(aTeam.players || [])]
    .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);

  // Compile news
  const allNews = [...(hTeam.marketNews || []), ...(aTeam.marketNews || [])]
    .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);

  const getStatusDisplay = (status: string) => {
    if (status === 'IN_PLAY') return <span className="flex items-center gap-2 text-red-500 bg-red-500/10 px-4 py-2 rounded-full text-sm font-bold border border-red-500/30 animate-pulse"><Play size={16} className="fill-current" /> مباشرة</span>;
    if (status === 'FINISHED') return <span className="flex items-center gap-2 text-[#FFD700] bg-[#FFD700]/10 px-4 py-2 rounded-full text-sm font-bold border border-[#FFD700]/30"><CheckCircle2 size={16} /> انتهت</span>;
    return <span className="flex items-center gap-2 text-[#0FF0FC] bg-[#0FF0FC]/10 px-4 py-2 rounded-full text-sm font-bold border border-[#0FF0FC]/30"><Clock size={16} /> قادمة</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <main className="max-w-5xl mx-auto px-4 py-8">
        
        <Link href="/matches" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ChevronRight size={20} className="rotate-180" /> العودة لمركز المباريات
        </Link>

        {/* MATCH HEADER */}
        <div className="bg-surface border border-white/5 rounded-3xl p-8 shadow-card relative overflow-hidden mb-8">
          {match.status === 'IN_PLAY' && <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0 animate-pulse"></div>}
          
          <div className="flex justify-between items-center mb-8">
            <span className="text-sm text-gray-400 font-bold bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
              {match.groupPhase || 'دور المجموعات'}
            </span>
            <div className="flex items-center gap-4">
              {getStatusDisplay(match.status)}
              <span className="text-sm text-gray-400 font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                {new Date(match.matchDate).toLocaleString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center relative z-10">
            {/* Home */}
            <div className="flex flex-col items-center w-1/3 text-center">
              <div className="w-24 h-24 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10 mb-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                {hTeam.image.startsWith('http') ? <img src={hTeam.image} className="w-full h-full object-cover" /> : <span className="text-6xl">{hTeam.image}</span>}
              </div>
              <h2 className="font-black text-white text-3xl mb-1">{hTeam.name}</h2>
              <p className="font-mono text-gray-500">{hTeam.code}</p>
            </div>

            {/* VS / Score */}
            <div className="flex flex-col items-center w-1/3 text-center">
              {match.status === 'SCHEDULED' ? (
                <div className="text-5xl font-black text-gray-600 italic tracking-widest">VS</div>
              ) : (
                <div className="bg-black/60 border border-white/10 rounded-2xl px-8 py-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4">
                  <span className="text-5xl font-black text-white">{match.homeScore}</span>
                  <span className="text-2xl font-black text-gray-500">-</span>
                  <span className="text-5xl font-black text-white">{match.awayScore}</span>
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex flex-col items-center w-1/3 text-center">
              <div className="w-24 h-24 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10 mb-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                {aTeam.image.startsWith('http') ? <img src={aTeam.image} className="w-full h-full object-cover" /> : <span className="text-6xl">{aTeam.image}</span>}
              </div>
              <h2 className="font-black text-white text-3xl mb-1">{aTeam.name}</h2>
              <p className="font-mono text-gray-500">{aTeam.code}</p>
            </div>
          </div>
        </div>

        {/* MARKET COMPARISON TABLE */}
        <div className="bg-surface border border-white/5 rounded-3xl shadow-card p-8 mb-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
            <BarChart3 className="text-primary" /> مقارنة قوى السوق المالي
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 text-sm">
                  <th className="pb-4 w-1/3 font-bold text-white">{hTeam.name}</th>
                  <th className="pb-4 w-1/3 text-xs uppercase tracking-widest">المؤشر</th>
                  <th className="pb-4 w-1/3 font-bold text-white">{aTeam.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-4 font-mono font-black text-xl text-primary">{hPrice} ¢</td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">السعر السوقي</td>
                  <td className="py-4 font-mono font-black text-xl text-primary">{aPrice} ¢</td>
                </tr>
                <tr>
                  <td className="py-4 font-mono font-bold text-gray-300">{hFair} ¢</td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">القيمة العادلة</td>
                  <td className="py-4 font-mono font-bold text-gray-300">{aFair} ¢</td>
                </tr>
                <tr>
                  <td className="py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${hPremium > 10 ? 'bg-red-500/10 text-red-500' : hPremium < -10 ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'}`}>
                      {hPremium > 0 ? '+' : ''}{hPremium.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">علاوة الإصدار</td>
                  <td className="py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${aPremium > 10 ? 'bg-red-500/10 text-red-500' : aPremium < -10 ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'}`}>
                      {aPremium > 0 ? '+' : ''}{aPremium.toFixed(1)}%
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-4 font-mono font-bold text-white">{hTeam.momentum || 50}</td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">الزخم (Momentum)</td>
                  <td className="py-4 font-mono font-bold text-white">{aTeam.momentum || 50}</td>
                </tr>
                <tr>
                  <td className="py-4 font-mono font-bold text-white">{hTeam.marketDemand || 50}</td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">طلب السوق</td>
                  <td className="py-4 font-mono font-bold text-white">{aTeam.marketDemand || 50}</td>
                </tr>
                <tr>
                  <td className="py-4 font-mono text-gray-400">{hTeam.volatilityScore || 10}</td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">معدل التذبذب</td>
                  <td className="py-4 font-mono text-gray-400">{aTeam.volatilityScore || 10}</td>
                </tr>
                <tr>
                  <td className="py-4 font-mono text-gray-400">{hTeam.fifaRank || '-'}</td>
                  <td className="py-4 text-xs text-gray-500 uppercase tracking-widest">تصنيف الفيفا</td>
                  <td className="py-4 font-mono text-gray-400">{aTeam.fifaRank || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-between gap-4">
            <button onClick={() => router.push(`/asset/${hTeam.id}`)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors border border-white/10">
              تداول أسهم {hTeam.name}
            </button>
            <button onClick={() => router.push(`/asset/${aTeam.id}`)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors border border-white/10">
              تداول أسهم {aTeam.name}
            </button>
          </div>
        </div>

        {/* IMPACT SCENARIOS */}
        {match.status === 'SCHEDULED' && (
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 mb-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center gap-2 border-b border-primary/20 pb-4">
              <TrendingUp /> التأثير المتوقع على القيمة العادلة
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-black/50 border border-white/5 p-4 rounded-2xl text-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <p className="text-xs text-gray-400 font-bold mb-2">في حال الفوز</p>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-green-400">+20 <span className="text-[10px] text-gray-500 uppercase">الزخم</span></p>
                  <p className="text-sm font-mono text-green-400">+15 <span className="text-[10px] text-gray-500 uppercase">الطلب</span></p>
                </div>
              </div>
              <div className="bg-black/50 border border-white/5 p-4 rounded-2xl text-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <p className="text-xs text-gray-400 font-bold mb-2">في حال التعادل</p>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-primary">+3 <span className="text-[10px] text-gray-500 uppercase">الزخم</span></p>
                  <p className="text-sm font-mono text-primary">+1 <span className="text-[10px] text-gray-500 uppercase">الطلب</span></p>
                </div>
              </div>
              <div className="bg-black/50 border border-white/5 p-4 rounded-2xl text-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <p className="text-xs text-gray-400 font-bold mb-2">في حال الخسارة</p>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-red-500">-20 <span className="text-[10px] text-gray-500 uppercase">الزخم</span></p>
                  <p className="text-sm font-mono text-red-500">-15 <span className="text-[10px] text-gray-500 uppercase">الطلب</span></p>
                </div>
              </div>
              <div className="bg-black/50 border border-white/5 p-4 rounded-2xl text-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <p className="text-xs text-gray-400 font-bold mb-2">شباك نظيفة</p>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-yellow-500">+10 <span className="text-[10px] text-gray-500 uppercase">الزخم</span></p>
                  <p className="text-sm font-mono text-yellow-500">+5 <span className="text-[10px] text-gray-500 uppercase">الطلب</span></p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              يتم تطبيق هذا التأثير تلقائياً على كل من المنتخبات وأبرز لاعبيها فور انتهاء المباراة وتسوية النتائج في المنصة.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* RELATED PLAYERS */}
          <div className="bg-surface border border-white/5 rounded-3xl p-8 shadow-card">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
              <Users className="text-primary" size={20} /> نجوم المباراة
            </h3>
            
            {allPlayers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">لا توجد أسهم لاعبين متاحة للتداول حالياً من هذه المنتخبات.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allPlayers.map((player: any) => (
                  <div key={player.id} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => router.push(`/asset/${player.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                        {player.image.startsWith('http') ? <img src={player.image} className="w-full h-full object-cover" /> : <span>{player.image}</span>}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{player.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{player.teamId === hTeam.id ? hTeam.name : aTeam.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-primary text-sm">{Math.round(player.marketPrice ?? player.current_price)} ¢</p>
                      <p className="text-[10px] text-gray-500">سعر السهم</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RELATED NEWS */}
          <div className="bg-surface border border-white/5 rounded-3xl p-8 shadow-card">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
              <Newspaper className="text-orange-500" size={20} /> أخبار مؤثرة
            </h3>
            
            {allNews.length === 0 ? (
              <div className="text-center py-8">
                <Newspaper size={40} className="mx-auto text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 italic">لا توجد أخبار مؤثرة لهذه المباراة حالياً.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allNews.map((news: any) => (
                  <div key={news.id} className="bg-black/40 border border-white/5 p-4 rounded-xl border-r-2 border-r-orange-500">
                    <p className="text-sm text-gray-200 font-bold mb-2">{news.titleAr || news.titleKey}</p>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{news.bodyAr || news.bodyKey}</p>
                    <p className="text-[10px] text-gray-600 mt-2 font-mono">{new Date(news.publishedAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
