'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/lib/store';
import {
  TrendingUp, TrendingDown, Users, Activity, Trophy,
  PlayCircle, ShieldCheck, Zap, Globe, Newspaper,
  ChevronRight, Crown, Medal, Award, Flame, AlertCircle, Calendar, LineChart, Hash
} from 'lucide-react';
import { getAllArticles } from '@/lib/articles';
import { AssetImage } from '@/components/ui/AssetImage';

export default function HomeClient({ 
  initialAssets, 
  usersCount = 0, 
  tradeVolume = 0, 
  executedTrades = 0,
  upcomingMatches = [] 
}: { 
  initialAssets: any[],
  usersCount?: number,
  tradeVolume?: number,
  executedTrades?: number,
  upcomingMatches?: any[]
}) {
  const [topUsers, setTopUsers] = useState<any[]>([]);

  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });

    // Fetch live leaderboard for top 3
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (data.leaderboard) {
          setTopUsers(data.leaderboard.slice(0, 3));
        }
      })
      .catch(err => console.error("Error fetching leaderboard", err));
  }, [initialAssets]);

  // Derived market stats
  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];
  
  // Market Now (السوق الآن) calculations
  const sortedByChange = [...safeAssets].sort((a, b) => ((b.change || 0) - (a.change || 0)));
  const topGainer = sortedByChange[0];
  const topLoser = sortedByChange[sortedByChange.length - 1];

  const sortedByMomentum = [...safeAssets].sort((a, b) => ((b.momentum || 0) - (a.momentum || 0)));
  const topMomentum = sortedByMomentum[0];

  const sortedByDemand = [...safeAssets].sort((a, b) => ((b.marketDemand || 0) - (a.marketDemand || 0)));
  const topDemand = sortedByDemand[0];

  const getPremiumDiscount = (asset: any) => {
    const marketPrice = asset.marketPrice ?? asset.current_price ?? 0;
    const fairValue = asset.fairValue ?? asset.current_price ?? 0;
    if (fairValue === 0) return 0;
    return ((marketPrice - fairValue) / fairValue) * 100;
  };

  // Smart Opportunities
  const smartOpportunities = safeAssets.filter(a => 
    getPremiumDiscount(a) <= -10 &&
    (a.momentum || 0) >= 70 &&
    (a.marketDemand || 0) >= 70 &&
    (a.volatilityScore || 0) <= 30
  ).slice(0, 4);

  // If we don't have enough exact matches, fallback to undervalued assets
  const displayOpportunities = smartOpportunities.length > 0 
    ? smartOpportunities 
    : safeAssets.filter(a => getPremiumDiscount(a) <= -5).slice(0, 3);

  // Articles
  const topArticle = getAllArticles()[0];

  const renderAvatar = (asset: any) => {
    if (!asset) return <span className="text-2xl">⚽</span>;
    return <AssetImage image={asset.image} name={asset.name} type={asset.type} width={40} height={40} className="w-10 h-10 rounded-full bg-surface object-cover shrink-0 border border-white/10" />;
  };

  const formatPrice = (asset: any) => {
    if (!asset) return '0.00';
    return asset.marketPrice ?? asset.current_price ?? '0.00';
  };

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* A) HERO SECTION */}
        <section className="relative rounded-3xl overflow-hidden bg-surface border border-white/5 p-8 md:p-12 min-h-[400px] flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
          
          <div className="relative z-10 max-w-2xl">
            <div className="mb-6">
              <Image src="/brand/logo-horizontal.png" alt="MC PRIME Exchange" width={240} height={60} className="h-12 w-auto" />
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
              بورصة المونديال الافتراضية
            </h1>
            
            <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-8">
              اشترِ وبيع أسهم المنتخبات واللاعبين بعملات افتراضية، تابع حركة السوق مع كل مباراة، ونافس أصدقاءك على صدارة الترتيب.
            </p>
            
            <div className="flex flex-wrap gap-4 items-center">
              <Link href="/market" className="px-8 py-3.5 bg-primary text-black font-bold rounded-xl text-sm hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(15,240,252,0.3)] inline-flex items-center gap-2">
                <TrendingUp size={18} /> ابدأ التداول الآن
              </Link>
              <Link href="/rewards" className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-sm hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                <Zap size={18} className="text-yellow-400" /> اكسب كوينز مجانية
              </Link>
              <Link href="/articles" className="text-sm font-bold text-gray-400 hover:text-primary transition-colors px-4 py-3">
                كيف تعمل المنصة؟
              </Link>
            </div>
            
            <div className="mt-8 flex items-center gap-2 text-xs text-gray-500 bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-white/5">
              <AlertCircle size={14} className="text-primary" />
              جميع الكوينز افتراضية بالكامل وتُستخدم داخل المنصة فقط، ولا يمكن سحبها أو تحويلها إلى أموال حقيقية.
            </div>
          </div>
        </section>

        {/* B) MARKET STATS STRIP */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <Users size={20} className="text-gray-400 mb-2" />
            <div className="text-2xl font-black text-white tabular-nums">{usersCount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">المتداولون</div>
          </div>
          <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <Activity size={20} className="text-primary mb-2" />
            <div className="text-2xl font-black text-white tabular-nums">{tradeVolume.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">حجم التداول الافتراضي</div>
          </div>
          <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <Hash size={20} className="text-accent mb-2" />
            <div className="text-2xl font-black text-white tabular-nums">{executedTrades.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">الصفقات المنفذة</div>
          </div>
          <div className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <Zap size={20} className="text-yellow-400 mb-2" />
            <div className="text-2xl font-black text-white tabular-nums">{safeAssets.length}</div>
            <div className="text-xs text-gray-500 mt-1">الأصول المتاحة</div>
          </div>
        </section>

        {/* C) السوق الآن (LIVE MARKET) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Activity className="text-primary" /> السوق الآن
            </h2>
            <Link href="/market" className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1">
              عرض الكل <ChevronRight size={16} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top Gainer */}
            <div className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-success/30 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                  <TrendingUp size={12} /> أعلى صعود
                </span>
                {renderAvatar(topGainer)}
              </div>
              <h3 className="font-bold text-white text-lg truncate mb-1">{topGainer?.name || '---'}</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black tabular-nums text-white">{formatPrice(topGainer)}</span>
                <span className="text-xs text-gray-500">¢</span>
                <span className="text-success text-xs font-bold tabular-nums mr-auto">+{topGainer?.change || 0}%</span>
              </div>
              <Link href={`/asset/${topGainer?.id}`} className="w-full py-2 bg-white/5 hover:bg-success/10 text-success rounded-lg text-sm font-bold flex justify-center items-center transition-colors">
                تداول
              </Link>
            </div>

            {/* Top Loser */}
            <div className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-danger/30 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-danger/10 text-danger px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                  <TrendingDown size={12} /> أكبر هبوط
                </span>
                {renderAvatar(topLoser)}
              </div>
              <h3 className="font-bold text-white text-lg truncate mb-1">{topLoser?.name || '---'}</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black tabular-nums text-white">{formatPrice(topLoser)}</span>
                <span className="text-xs text-gray-500">¢</span>
                <span className="text-danger text-xs font-bold tabular-nums mr-auto">{topLoser?.change || 0}%</span>
              </div>
              <Link href={`/asset/${topLoser?.id}`} className="w-full py-2 bg-white/5 hover:bg-danger/10 text-danger rounded-lg text-sm font-bold flex justify-center items-center transition-colors">
                تداول
              </Link>
            </div>

            {/* High Momentum */}
            <div className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-primary/30 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                  <Flame size={12} /> أعلى زخم
                </span>
                {renderAvatar(topMomentum)}
              </div>
              <h3 className="font-bold text-white text-lg truncate mb-1">{topMomentum?.name || '---'}</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black tabular-nums text-white">{formatPrice(topMomentum)}</span>
                <span className="text-xs text-gray-500">¢</span>
                <span className="text-primary text-xs font-bold tabular-nums mr-auto">زخم {topMomentum?.momentum || 0}</span>
              </div>
              <Link href={`/asset/${topMomentum?.id}`} className="w-full py-2 bg-white/5 hover:bg-primary/10 text-primary rounded-lg text-sm font-bold flex justify-center items-center transition-colors">
                تداول
              </Link>
            </div>

            {/* High Demand */}
            <div className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-accent/30 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-accent/10 text-accent px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                  <Users size={12} /> أعلى طلب سوقي
                </span>
                {renderAvatar(topDemand)}
              </div>
              <h3 className="font-bold text-white text-lg truncate mb-1">{topDemand?.name || '---'}</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black tabular-nums text-white">{formatPrice(topDemand)}</span>
                <span className="text-xs text-gray-500">¢</span>
                <span className="text-accent text-xs font-bold tabular-nums mr-auto">طلب {topDemand?.marketDemand || 0}</span>
              </div>
              <Link href={`/asset/${topDemand?.id}`} className="w-full py-2 bg-white/5 hover:bg-accent/10 text-accent rounded-lg text-sm font-bold flex justify-center items-center transition-colors">
                تداول
              </Link>
            </div>
          </div>
        </section>

        {/* D) فرص ذكية اليوم (SMART OPPORTUNITIES) */}
        {displayOpportunities.length > 0 && (
          <section>
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Zap className="text-yellow-400" /> فرص ذكية اليوم
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayOpportunities.map(asset => (
                <div key={asset.id} className="bg-gradient-to-b from-surface to-background border border-yellow-400/20 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-400/10 blur-xl rounded-full pointer-events-none" />
                  
                  <div className="flex items-center gap-3 mb-4">
                    {renderAvatar(asset)}
                    <div>
                      <h3 className="font-bold text-white leading-tight">{asset.name}</h3>
                      <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-white/5 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 mb-1">السعر السوقي</div>
                      <div className="font-bold text-sm text-white">{formatPrice(asset)} ¢</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 mb-1">القيمة العادلة</div>
                      <div className="font-bold text-sm text-gray-300">{asset.fairValue ?? '--'} ¢</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {getPremiumDiscount(asset) < 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-success/10 text-success border border-success/20">
                        خصم {Math.abs(Math.round(getPremiumDiscount(asset)))}%
                      </span>
                    )}
                    {(asset.momentum || 0) >= 70 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                        زخم عالٍ
                      </span>
                    )}
                    {(asset.volatilityScore || 0) <= 30 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
                        مخاطرة منخفضة
                      </span>
                    )}
                  </div>

                  <Link href={`/asset/${asset.id}`} className="w-full py-2.5 bg-yellow-400 text-black rounded-xl text-sm font-bold flex justify-center items-center hover:bg-yellow-500 transition-colors">
                    تداول الآن
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* E) مباريات قد تغيّر السوق (IMPACT MATCHES) */}
        {upcomingMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Calendar className="text-primary" /> مباريات قد تغيّر السوق
              </h2>
              <Link href="/matches" className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1">
                جدول المباريات <ChevronRight size={16} />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {upcomingMatches.map(match => (
                <div key={match.id} className="bg-surface border border-white/5 rounded-2xl p-5 flex flex-col">
                  <div className="text-center mb-4 text-xs font-bold text-gray-400 bg-white/5 py-1 rounded-md">
                    {new Date(match.matchDate).toLocaleDateString('ar-SA', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                        {match.homeTeam?.image ? (
                          <img src={match.homeTeam.image} alt={match.homeTeam.name} className="w-full h-full object-cover" />
                        ) : <span className="text-xl">🛡️</span>}
                      </div>
                      <span className="font-bold text-sm text-center text-white leading-tight">{match.homeTeam?.name || 'فريق'}</span>
                      <span className="text-xs text-primary font-mono">{formatPrice(safeAssets.find(a => a.id === match.homeTeamId))} ¢</span>
                    </div>
                    
                    <div className="px-3 py-1 bg-white/5 text-gray-500 text-xs font-bold rounded-full">VS</div>
                    
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                        {match.awayTeam?.image ? (
                          <img src={match.awayTeam.image} alt={match.awayTeam.name} className="w-full h-full object-cover" />
                        ) : <span className="text-xl">🛡️</span>}
                      </div>
                      <span className="font-bold text-sm text-center text-white leading-tight">{match.awayTeam?.name || 'فريق'}</span>
                      <span className="text-xs text-primary font-mono">{formatPrice(safeAssets.find(a => a.id === match.awayTeamId))} ¢</span>
                    </div>
                  </div>
                  
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Link href={`/matches`} className="py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold text-center transition-colors">
                      تحليل المباراة
                    </Link>
                    <Link href={`/market`} className="py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold text-center transition-colors">
                      تداول الفرق
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* F) كيف تعمل المنصة؟ */}
          <section className="lg:col-span-2">
            <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-6">
              <ShieldCheck className="text-primary" /> كيف تعمل المنصة؟
            </h2>
            <div className="bg-surface border border-white/5 rounded-2xl p-6 md:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'احصل على كوينز افتراضية', icon: <Zap size={24} />, desc: 'سجل دخولك أو شاهد الإعلانات لجمع الرصيد.', num: '01' },
                  { label: 'اختر أصولك', icon: <Globe size={24} />, desc: 'حلل الأداء واشترِ أسهم المنتخبات واللاعبين.', num: '02' },
                  { label: 'تابع المباريات', icon: <PlayCircle size={24} />, desc: 'الأسعار ترتفع وتنخفض مع كل حدث حقيقي.', num: '03' },
                  { label: 'نافس على الترتيب', icon: <Trophy size={24} />, desc: 'حقق أعلى عائد وتصدّر لوحة الشرف.', num: '04' },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center group">
                    <div className="w-16 h-16 rounded-2xl bg-background border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:border-primary/40 group-hover:bg-primary/5 transition-all mb-4 relative">
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-black rounded-full text-[10px] font-black flex items-center justify-center">{step.num}</span>
                      {step.icon}
                    </div>
                    <h3 className="font-bold text-sm text-white mb-2">{step.label}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* G) المتصدرون (LEADERBOARD PREVIEW) */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Crown className="text-yellow-400" /> المتصدرون
              </h2>
              <Link href="/leaderboard" className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1">
                القائمة الكاملة <ChevronRight size={16} />
              </Link>
            </div>
            
            <div className="bg-surface border border-white/5 rounded-2xl p-5 flex flex-col gap-3 h-[calc(100%-3rem)]">
              {topUsers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  جارِ تحميل المتصدرين...
                </div>
              ) : (
                topUsers.map((user, idx) => {
                  const icons = [
                    <Crown key="1" size={18} className="text-yellow-400" />,
                    <Medal key="2" size={18} className="text-gray-300" />,
                    <Award key="3" size={18} className="text-amber-600" />
                  ];
                  return (
                    <div key={user.id} className={`flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-background border-white/5'}`}>
                      <div className="w-8 flex justify-center">{icons[idx]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white truncate">{user.name}</div>
                        <div className="text-[11px] text-gray-500">الثروة: {Math.floor(user.netWorth || 0).toLocaleString()} ¢</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-sm ${user.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                          {user.roi >= 0 ? '+' : ''}{(user.roi || 0).toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-gray-500">العائد (ROI)</div>
                      </div>
                    </div>
                  );
                })
              )}
              
              <Link href="/leaderboard" className="mt-auto w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold flex justify-center items-center transition-colors">
                عرض ترتيبك
              </Link>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* H) الأكاديمية / المقال المميز */}
          {topArticle && (
            <section>
              <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-6">
                <Newspaper className="text-primary" /> الأكاديمية
              </h2>
              <Link href={`/article/${topArticle.id}`} className="block relative bg-surface border border-white/5 rounded-2xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
                <img src={topArticle.imageUrl} alt={topArticle.title} className="w-full h-64 object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                
                <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                  <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-lg text-[10px] font-bold w-fit mb-3">
                    {topArticle.category}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors">
                    {topArticle.title}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-4">
                    {topArticle.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{topArticle.author}</span>
                    <span className="flex items-center gap-1 text-primary">اقرأ المزيد <ChevronRight size={14} /></span>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* I) لماذا MC PRIME Exchange؟ */}
          <section>
            <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-6">
              <LineChart className="text-primary" /> لماذا MC PRIME؟
            </h2>
            <div className="bg-surface border border-white/5 rounded-2xl p-6 md:p-8 h-full flex flex-col justify-center">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <Activity size={20} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white mb-1">سوق رياضي حي ومباشر</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">الأسعار تتفاعل فورياً مع الأحداث، الأهداف، والإصابات في العالم الحقيقي.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0 border border-yellow-400/20">
                    <Zap size={20} className="text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white mb-1">كوينز افتراضية مجانية</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">احصل على المكافآت اليومية وابدأ التداول بدون أي رسوم مالية حقيقية.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20">
                    <Trophy size={20} className="text-accent" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white mb-1">بيئة تنافسية عادلة</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">خوارزميات تسعير متقدمة تضمن توازناً تاماً وتكافئ التحليل الرياضي الصحيح.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* J) FINAL CTA */}
        <section className="relative rounded-3xl overflow-hidden bg-primary p-8 md:p-12 text-center">
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-black mb-4">
              جاهز لاقتناص الفرص؟
            </h2>
            <p className="text-black/80 text-base md:text-lg mb-8 font-medium">
              انضم إلى آلاف المتداولين، ابنِ محفظتك من نجوم ومنتخبات كأس العالم، وتصدّر الترتيب العالمي.
            </p>
            <Link href="/market" className="px-8 py-4 bg-black text-white font-bold rounded-xl text-base hover:bg-gray-900 transition-all inline-flex items-center gap-2 shadow-2xl">
              <TrendingUp size={20} className="text-primary" /> ابدأ رحلتك الافتراضية
            </Link>
          </div>
        </section>

      </main>
    </>
  );
}
