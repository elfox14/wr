'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/lib/store';
import {
  TrendingUp, TrendingDown, Users, Activity, Trophy,
  PlayCircle, ShieldCheck, Zap, Globe, Newspaper,
  ChevronRight, Crown, Medal, Award, Flame, AlertCircle, Calendar, LineChart, Hash, Clock
} from 'lucide-react';
import { getAllArticles } from '@/lib/articles';
import { AssetImage } from '@/components/ui/AssetImage';

export default function HomeClient({
  initialAssets,
  usersCount = 0,
  tradeVolume = 0,
  executedTrades = 0,
  upcomingMatches = [],
  assetsCount = 0,
  playersCount = 0,
  teamsCount = 0,
  upcomingMatchesCount = 0,
  recentTransactions = [],
  mostTradedAssets = [],
  topDemandAssets = [],
  topMomentumAssets = [],
  undervaluedAssets = []
}: {
  initialAssets: any[],
  usersCount?: number,
  tradeVolume?: number,
  executedTrades?: number,
  upcomingMatches?: any[],
  assetsCount?: number,
  playersCount?: number,
  teamsCount?: number,
  upcomingMatchesCount?: number,
  recentTransactions?: any[],
  mostTradedAssets?: any[],
  topDemandAssets?: any[],
  topMomentumAssets?: any[],
  undervaluedAssets?: any[]
}) {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [activeMarketTab, setActiveMarketTab] = useState('الكل');
  const [matchTab, setMatchTab] = useState<'upcoming' | 'live' | 'today'>('upcoming');

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

  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];

  const getPremiumDiscount = (asset: any) => {
    const marketPrice = asset.marketPrice ?? asset.current_price ?? 0;
    const fairValue = asset.fairValue ?? asset.current_price ?? 0;
    if (fairValue === 0) return 0;
    return ((marketPrice - fairValue) / fairValue) * 100;
  };

  // 1. Format Helpers
  const formatCoins = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M¢';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K¢';
    }
    return value.toLocaleString() + '¢';
  };

  const renderAvatar = (asset: any, size: number = 32) => {
    if (!asset) return <span className="text-xl">⚽</span>;
    return (
      <AssetImage
        image={asset.image}
        name={asset.name}
        type={asset.type}
        width={size}
        height={size}
        className="rounded-full bg-surface object-cover shrink-0 border border-white/10"
      />
    );
  };

  // 2. Interactive Market Filter
  const getFilteredAssets = () => {
    switch (activeMarketTab) {
      case 'المنتخبات':
        return safeAssets.filter(a => a.type === 'TEAM');
      case 'اللاعبون':
        return safeAssets.filter(a => a.type === 'PLAYER');
      case 'أقل من القيمة':
        return safeAssets.filter(a => getPremiumDiscount(a) <= -5);
      case 'زخم عالي':
        return safeAssets.filter(a => (a.momentum || 0) >= 70);
      case 'طلب عالي':
        return safeAssets.filter(a => (a.marketDemand || 0) >= 70);
      case 'الكل':
      default:
        return safeAssets;
    }
  };

  const filteredMarketAssets = getFilteredAssets().slice(0, 8);

  // 3. Smart Opportunities (Strict Calculation)
  const calculatedOpportunities = safeAssets.map(asset => {
    const premiumDiscount = getPremiumDiscount(asset);
    const reasons: string[] = [];
    if (premiumDiscount <= -5) reasons.push('أقل من القيمة العادلة');
    if ((asset.momentum || 0) >= 70) reasons.push('زخم قوي');
    if ((asset.marketDemand || 0) >= 70) reasons.push('طلب سوقي مرتفع');
    if ((asset.volatilityScore || 0) <= 30) reasons.push('مخاطرة منخفضة');

    return {
      ...asset,
      reasons,
      premiumDiscount
    };
  }).filter(o => o.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length)
    .slice(0, 4);

  // 4. Match Filter
  const getFilteredMatches = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    switch (matchTab) {
      case 'live':
        return upcomingMatches.filter((m: any) => m.status === 'IN_PLAY' || m.status === 'LIVE');
      case 'today':
        return upcomingMatches.filter((m: any) => {
          const matchDateStr = new Date(m.matchDate).toISOString().split('T')[0];
          return matchDateStr === todayStr;
        });
      case 'upcoming':
      default:
        return upcomingMatches.filter((m: any) => m.status === 'SCHEDULED');
    }
  };

  const filteredMatches = getFilteredMatches().slice(0, 3);

  // Helper to find live price for match teams
  const getTeamPrice = (teamId: string) => {
    const asset = safeAssets.find(a => a.id === teamId);
    if (!asset) return '---';
    return `${(asset.marketPrice ?? asset.current_price ?? 0).toLocaleString()} ¢`;
  };

  // 5. Academy featured article selection
  const featuredArticle = getAllArticles().find(a => a.featured) || getAllArticles()[0];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

      {/* A) HERO SECTION - interactive & compact */}
      <section className="relative rounded-3xl overflow-hidden bg-surface border border-white/5 p-6 md:p-8 min-h-[300px] flex flex-col justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Right Text Block */}
          <div className="lg:col-span-7 space-y-6">
            <div className="mb-2">
              <Image src="/brand/logo-horizontal.png" alt="MC PRIME Exchange" width={200} height={50} className="h-8 md:h-9 w-auto" />
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight">
              بورصة المونديال الافتراضية
            </h1>

            <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-xl">
              اشترِ وبيع أسهم المنتخبات واللاعبين بعملات افتراضية فقط، وتابع حركة السوق مع كل مباراة.
            </p>

            <div className="flex flex-wrap gap-3 items-center">
              <Link href="/market" className="px-6 py-3 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(15,240,252,0.2)] inline-flex items-center gap-1.5">
                <TrendingUp size={16} /> ابدأ التداول الآن
              </Link>
              <Link href="/rewards" className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs hover:bg-white/10 transition-colors inline-flex items-center gap-1.5">
                <Zap size={16} className="text-yellow-400" /> كسب كوينز مجانية
              </Link>
              <Link href="/articles" className="text-xs font-bold text-gray-400 hover:text-primary transition-colors px-3 py-3">
                كيف تعمل المنصة؟
              </Link>
            </div>
          </div>

          {/* Left Snapshot Card */}
          <div className="lg:col-span-5">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl">
              <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2 border-b border-white/5 pb-2">
                <Activity size={14} className="text-primary animate-pulse" />
                حالة السوق الآن
              </h3>

              {mostTradedAssets.length === 0 && topMomentumAssets.length === 0 && topDemandAssets.length === 0 && upcomingMatches.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500">لا توجد بيانات كافية بعد</div>
              ) : (
                <div className="space-y-3">
                  {/* Most Traded */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">أكثر أصل تداولاً</span>
                    {mostTradedAssets[0] ? (
                      <Link href={`/asset/${mostTradedAssets[0].id}`} className="flex items-center gap-2 text-white hover:text-primary transition-colors font-semibold">
                        {renderAvatar(mostTradedAssets[0], 20)}
                        <span>{mostTradedAssets[0].name}</span>
                        <span className="text-gray-500 font-mono">({(mostTradedAssets[0].marketPrice ?? mostTradedAssets[0].current_price ?? 0)} ¢)</span>
                      </Link>
                    ) : (
                      <span className="text-gray-600">---</span>
                    )}
                  </div>

                  {/* Top Momentum */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">أعلى زخم حالي</span>
                    {topMomentumAssets[0] ? (
                      <Link href={`/asset/${topMomentumAssets[0].id}`} className="flex items-center gap-2 text-white hover:text-primary transition-colors font-semibold">
                        {renderAvatar(topMomentumAssets[0], 20)}
                        <span>{topMomentumAssets[0].name}</span>
                        <span className="text-success font-bold font-mono">+{topMomentumAssets[0].momentum}%</span>
                      </Link>
                    ) : (
                      <span className="text-gray-600">---</span>
                    )}
                  </div>

                  {/* Top Demand */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">أعلى طلب سوقي</span>
                    {topDemandAssets[0] ? (
                      <Link href={`/asset/${topDemandAssets[0].id}`} className="flex items-center gap-2 text-white hover:text-primary transition-colors font-semibold">
                        {renderAvatar(topDemandAssets[0], 20)}
                        <span>{topDemandAssets[0].name}</span>
                        <span className="text-yellow-400 font-bold font-mono">★ {topDemandAssets[0].marketDemand}</span>
                      </Link>
                    ) : (
                      <span className="text-gray-600">---</span>
                    )}
                  </div>

                  {/* Nearest Match */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                    <span className="text-gray-500">أقرب مباراة</span>
                    {upcomingMatches[0] ? (
                      <Link href={`/matches`} className="flex items-center gap-1.5 text-white hover:text-primary transition-colors font-semibold">
                        <span className="text-[10px] text-gray-400">
                          {upcomingMatches[0].homeTeam?.name} VS {upcomingMatches[0].awayTeam?.name}
                        </span>
                        <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">قادمة</span>
                      </Link>
                    ) : (
                      <span className="text-gray-600">---</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* B) REAL STATS STRIP */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'المتداولون', value: usersCount.toLocaleString(), icon: <Users size={16} className="text-gray-400" /> },
          { label: 'حجم التداول', value: formatCoins(tradeVolume), icon: <Activity size={16} className="text-primary" /> },
          { label: 'الصفقات المنفذة', value: executedTrades.toLocaleString(), icon: <Hash size={16} className="text-accent" /> },
          { label: 'الأصول المتاحة', value: assetsCount.toLocaleString(), icon: <Zap size={16} className="text-yellow-400" /> },
          { label: 'اللاعبون', value: playersCount.toLocaleString(), icon: <Flame size={16} className="text-primary/70" /> },
          { label: 'المنتخبات', value: teamsCount.toLocaleString(), icon: <Globe size={16} className="text-success" /> },
          { label: 'المباريات القادمة', value: upcomingMatchesCount.toLocaleString(), icon: <Calendar size={16} className="text-gray-400" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-white/10 transition-colors">
            <div className="mb-1.5">{stat.icon}</div>
            <div className="text-lg font-black text-white font-mono">{stat.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* C) السوق الآن (LIVE MARKET WITH TABS) */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="text-primary" /> السوق الآن
          </h2>
          {/* Tab Controls */}
          <div className="flex flex-wrap gap-1.5 bg-black/40 border border-white/5 p-1 rounded-xl">
            {['الكل', 'المنتخبات', 'اللاعبون', 'أقل من القيمة', 'زخم عالي', 'طلب عالي'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMarketTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  activeMarketTab === tab
                    ? 'bg-primary text-black shadow-[0_0_12px_rgba(15,240,252,0.2)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredMarketAssets.length === 0 ? (
          <div className="text-center py-16 bg-surface/35 border border-white/5 rounded-3xl">
            <AlertCircle className="mx-auto text-gray-600 mb-3" size={36} />
            <h3 className="text-sm font-bold text-gray-400">لا توجد أصول مطابقة حاليًا</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMarketAssets.map(asset => {
              const discount = getPremiumDiscount(asset);
              return (
                <div
                  key={asset.id}
                  className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Avatar, Name & Type */}
                    <div className="flex justify-between items-start mb-4">
                      {renderAvatar(asset, 40)}
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${asset.type === 'TEAM' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                        {asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base truncate mb-1">{asset.name}</h3>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-2 my-4">
                      <div className="bg-white/5 rounded-lg p-2 text-right">
                        <div className="text-[9px] text-gray-500 mb-0.5">السعر السوقي</div>
                        <div className="font-bold text-sm text-white font-mono">{(asset.marketPrice ?? asset.current_price ?? 0).toLocaleString()} ¢</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-right">
                        <div className="text-[9px] text-gray-500 mb-0.5">القيمة العادلة</div>
                        <div className="font-bold text-sm text-gray-400 font-mono">{(asset.fairValue ?? asset.current_price ?? 0).toLocaleString()} ¢</div>
                      </div>
                    </div>

                    {/* Stats List */}
                    <div className="space-y-1.5 text-[11px] text-gray-400 border-t border-white/5 pt-3 mb-4">
                      <div className="flex justify-between">
                        <span>العلاقة العادلة (Premium/Discount)</span>
                        <span className={`font-bold font-mono ${discount < 0 ? 'text-success' : discount > 0 ? 'text-danger' : 'text-gray-400'}`}>
                          {discount < 0 ? `خصم ${Math.abs(Math.round(discount))}%` : discount > 0 ? `علاوة +${Math.round(discount)}%` : 'متطابق'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>الزخم حالياً</span>
                        <span className="text-white font-bold font-mono">{asset.momentum ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مستوى الطلب</span>
                        <span className="text-white font-bold font-mono">{asset.marketDemand ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مؤشر التقلب</span>
                        <span className="text-white font-bold font-mono">{asset.volatilityScore ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <Link href={`/asset/${asset.id}`} className="w-full py-2 bg-white/5 hover:bg-primary/10 text-primary border border-primary/10 rounded-xl text-xs font-bold flex justify-center items-center transition-colors">
                    تداول الأصول
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* D) فرص حقيقية من السوق (SMART OPPORTUNITIES) */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <Zap className="text-yellow-400" /> فرص حقيقية من السوق
        </h2>

        {calculatedOpportunities.length === 0 ? (
          <div className="text-center py-16 bg-surface/35 border border-white/5 rounded-3xl">
            <AlertCircle className="mx-auto text-gray-600 mb-3" size={36} />
            <h3 className="text-sm font-bold text-gray-400">لا توجد فرص واضحة حاليًا. راقب السوق أو تصفح الأصول.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {calculatedOpportunities.map(asset => (
              <div key={asset.id} className="bg-gradient-to-b from-surface to-background border border-yellow-400/20 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-400/10 blur-xl rounded-full pointer-events-none" />

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {renderAvatar(asset, 40)}
                    <div>
                      <h3 className="font-bold text-white leading-tight">{asset.name}</h3>
                      <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-white/5 rounded-lg p-2 text-right">
                      <div className="text-[10px] text-gray-500 mb-1">السعر السوقي</div>
                      <div className="font-bold text-sm text-white font-mono">{(asset.marketPrice ?? asset.current_price ?? 0).toLocaleString()} ¢</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-right">
                      <div className="text-[10px] text-gray-500 mb-1">القيمة العادلة</div>
                      <div className="font-bold text-sm text-gray-300 font-mono">{(asset.fairValue ?? asset.current_price ?? 0).toLocaleString()} ¢</div>
                    </div>
                  </div>

                  {/* Dynamic Reason Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {asset.reasons.map((reason: string, idx: number) => {
                      const colors = {
                        'أقل من القيمة العادلة': 'bg-success/10 text-success border-success/20',
                        'زخم قوي': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                        'طلب سوقي مرتفع': 'bg-primary/10 text-primary border-primary/20',
                        'مخاطرة منخفضة': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      };
                      return (
                        <span key={idx} className={`text-[9px] font-bold px-2 py-1 rounded border ${colors[reason as keyof typeof colors] || 'bg-white/5 text-gray-300'}`}>
                          {reason}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <Link href={`/asset/${asset.id}`} className="w-full py-2.5 bg-yellow-400 text-black rounded-xl text-sm font-bold flex justify-center items-center hover:bg-yellow-500 transition-colors">
                  تداول الآن
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* E) مباريات قد تغيّر السوق (IMPACT MATCHES WITH TABS) */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="text-primary" /> مباريات قد تغيّر السوق
          </h2>
          {/* Match Status Tabs */}
          <div className="flex gap-1.5 bg-black/40 border border-white/5 p-1 rounded-xl w-fit">
            {[
              { id: 'upcoming', label: 'القادمة' },
              { id: 'live', label: 'مباشرة' },
              { id: 'today', label: 'اليوم' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMatchTab(tab.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  matchTab === tab.id
                    ? 'bg-primary text-black shadow-[0_0_12px_rgba(15,240,252,0.2)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="text-center py-16 bg-surface/35 border border-white/5 rounded-3xl">
            <Calendar className="mx-auto text-gray-600 mb-3" size={36} />
            <h3 className="text-sm font-bold text-gray-400">لا توجد مباريات مجدولة حاليًا</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {filteredMatches.map(match => (
              <div key={match.id} className="bg-surface border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-white/10 transition-colors">
                <div>
                  <div className="text-center mb-4 text-[10px] font-bold text-gray-400 bg-white/5 py-1 rounded-md flex items-center justify-center gap-1.5">
                    <Clock size={10} className="text-primary" />
                    {new Date(match.matchDate).toLocaleDateString('ar-SA', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="flex justify-between items-center mb-6">
                    {/* Home Team */}
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                        {match.homeTeam?.image ? (
                          <img src={match.homeTeam.image} alt={match.homeTeam.name} className="w-full h-full object-cover" />
                        ) : <span className="text-xl">⚽</span>}
                      </div>
                      <span className="font-bold text-xs text-center text-white leading-tight">{match.homeTeam?.name || 'فريق 1'}</span>
                      <span className="text-xs text-primary font-mono">{getTeamPrice(match.homeTeamId)}</span>
                    </div>

                    <div className="px-3 py-1 bg-white/5 text-gray-500 text-xs font-bold rounded-full">VS</div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                        {match.awayTeam?.image ? (
                          <img src={match.awayTeam.image} alt={match.awayTeam.name} className="w-full h-full object-cover" />
                        ) : <span className="text-xl">⚽</span>}
                      </div>
                      <span className="font-bold text-xs text-center text-white leading-tight">{match.awayTeam?.name || 'فريق 2'}</span>
                      <span className="text-xs text-primary font-mono">{getTeamPrice(match.awayTeamId)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/matches/${match.id}`} className="py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold text-center transition-colors">
                    تحليل المباراة
                  </Link>
                  <Link href={`/market?type=TEAM`} className="py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold text-center transition-colors">
                    تداول المنتخبين
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* F) نشاط المنصة المباشر & المتصدرون */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* نشاط المنصة المباشر */}
        <section className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="text-primary" /> نشاط المنصة المباشر
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-5 space-y-3 min-h-[260px] flex flex-col justify-center">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">لا توجد صفقات حديثة بعد</div>
            ) : (
              recentTransactions.slice(0, 5).map((tx: any) => {
                const userName = tx.user?.name || 'متداول';
                const typeText = tx.type === 'BUY' ? 'اشترى' : 'باع';
                const quantity = tx.quantity;
                const assetName = tx.asset?.name || 'أصل';
                const price = tx.price_at_time;
                const dateStr = new Date(tx.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-white/5 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${tx.type === 'BUY' ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                      <span>
                        <strong className="text-white">{userName}</strong> {typeText} <span className="text-primary font-bold">{quantity}</span> من <strong className="text-white">{assetName}</strong> بسعر <span className="text-accent font-bold font-mono">{price}¢</span>
                      </span>
                    </div>
                    <span className="text-gray-500 font-mono text-[10px]">{dateStr}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* المتصدرون */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Crown className="text-yellow-400" /> المتصدرون
            </h2>
            <Link href="/leaderboard" className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1">
              القائمة الكاملة <ChevronRight size={16} />
            </Link>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-5 flex flex-col gap-3 min-h-[260px] justify-between">
            {topUsers.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
                الترتيب سيظهر بعد تنفيذ أولى الصفقات
              </div>
            ) : (
              <div className="space-y-2">
                {topUsers.map((user, idx) => {
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
                        <div className="text-[10px] text-gray-500">الثروة: {Math.floor(user.netWorth || 0).toLocaleString()} ¢</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-sm ${user.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                          {user.roi >= 0 ? '+' : ''}{(user.roi || 0).toFixed(1)}%
                        </div>
                        <div className="text-[9px] text-gray-500">العائد (ROI)</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Link href="/leaderboard" className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex justify-center items-center transition-colors mt-auto">
              عرض ترتيبك
            </Link>
          </div>
        </section>
      </div>

      {/* G) كيف تعمل المنصة؟ */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
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
                <div className="w-14 h-14 rounded-2xl bg-background border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:border-primary/40 group-hover:bg-primary/5 transition-all mb-4 relative">
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-black rounded-full text-[9px] font-black flex items-center justify-center">{step.num}</span>
                  {step.icon}
                </div>
                <h3 className="font-bold text-xs text-white mb-2">{step.label}</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* H) الأكاديمية / المقال المميز & لماذا MC PRIME */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* الأكاديمية */}
        {featuredArticle && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Newspaper className="text-primary" /> الأكاديمية
            </h2>
            <Link href={`/article/${featuredArticle.id}`} className="block relative bg-surface border border-white/5 rounded-2xl overflow-hidden group h-[280px]">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-transparent z-10" />
              <img src={featuredArticle.imageUrl} alt={featuredArticle.title} className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700" />

              <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-lg text-[9px] font-bold w-fit mb-3">
                  {featuredArticle.category}
                </span>
                <h3 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {featuredArticle.title}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                  {featuredArticle.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{featuredArticle.author}</span>
                  <span className="flex items-center gap-1 text-primary">اقرأ المزيد <ChevronRight size={14} /></span>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* لماذا MC PRIME */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <LineChart className="text-primary" /> لماذا MC PRIME؟
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6 md:p-8 h-[280px] flex flex-col justify-center">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <Activity size={18} className="text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">سوق رياضي حي ومباشر</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">الأسعار تتفاعل فورياً مع الأحداث، الأهداف، والإصابات في العالم الحقيقي.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0 border border-yellow-400/20">
                  <Zap size={18} className="text-yellow-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">كوينز افتراضية مجانية</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">احصل على المكافآت اليومية وابدأ التداول بدون أي رسوم مالية حقيقية.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20">
                  <Trophy size={18} className="text-accent" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">بيئة تنافسية عادلة</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">خوارزميات تسعير متقدمة تضمن توازناً تاماً وتكافئ التحليل الرياضي الصحيح.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* J) FINAL CTA */}
      <section className="relative rounded-3xl overflow-hidden bg-primary p-8 text-center">
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        <div className="relative z-10 max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl md:text-3xl font-black text-black">
            جاهز لاقتناص الفرص؟
          </h2>
          <p className="text-black/80 text-xs md:text-sm font-medium">
            انضم إلى آلاف المتداولين، ابنِ محفظتك من نجوم ومنتخبات كأس العالم، وتصدّر الترتيب العالمي.
          </p>
          <Link href="/market" className="px-6 py-3 bg-black text-white font-bold rounded-xl text-xs hover:bg-gray-900 transition-all inline-flex items-center gap-1.5 shadow-2xl">
            <TrendingUp size={16} className="text-primary" /> ابدأ رحلتك الافتراضية
          </Link>
        </div>
      </section>

      {/* Virtual Coins Disclaimer at bottom */}
      <div className="flex items-center justify-center gap-2 text-center text-[10px] text-gray-500 border-t border-white/5 pt-6">
        <AlertCircle size={12} className="text-primary" />
        <span>جميع الكوينز افتراضية بالكامل وتُستخدم داخل المنصة فقط، ولا يمكن سحبها أو تحويلها إلى أموال حقيقية.</span>
      </div>

    </main>
  );
}
