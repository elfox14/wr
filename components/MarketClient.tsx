'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore, Asset } from '@/lib/store';
import { TrendingUp, TrendingDown, ArrowRight, Search, LayoutGrid, List, Globe, Users, Target, Activity, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { TeamRosterDrawer } from '@/components/ui/TeamRosterDrawer';
import { AssetImage } from '@/components/ui/AssetImage';
import { StockCard } from '@/components/ui/StockCard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function MarketClient({
  usersCount = 0,
  todayVolume = 0,
  nextMatchDate = null
}: {
  usersCount?: number;
  todayVolume?: number;
  nextMatchDate?: string | null;
}) {
  const { assets, fetchAssets } = useStore();
  const [filterType, setFilterType] = useState<'ALL' | 'TEAM' | 'PLAYER' | 'WATCHLIST'>('TEAM');
  const [smartFilter, setSmartFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [isProMode, setIsProMode] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Asset | null>(null);
  const [countdown, setCountdown] = useState<string>('لا توجد مباريات مجدولة');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('SCORE');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchAssets();
    const savedWatchlist = localStorage.getItem('watchlistAssetIds');
    if (savedWatchlist) {
      try { setWatchlist(JSON.parse(savedWatchlist)); } catch(e) {}
    }
  }, [fetchAssets]);

  // Countdown timer logic
  useEffect(() => {
    if (!nextMatchDate) return;
    const matchTime = new Date(nextMatchDate).getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = matchTime - now;

      if (distance < 0) {
        setCountdown('جارية الآن أو انتهت');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${days}d : ${hours}h : ${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // update every minute
    return () => clearInterval(interval);
  }, [nextMatchDate]);

  const toggleWatchlist = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setWatchlist(prev => {
      const nw = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('watchlistAssetIds', JSON.stringify(nw));
      return nw;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'PRICE' || field === 'SCORE' || field === 'OPPORTUNITY' ? 'desc' : 'asc');
    }
  };

  const processedAssets = assets.map(asset => {
    const marketPrice = asset.marketPrice ?? asset.current_price;
    const fairValue = asset.fairValue ?? asset.current_price;
    const premiumDiscountPercent = fairValue > 0 ? ((marketPrice - fairValue) / fairValue) * 100 : 0;
    
    const undervaluationScore = premiumDiscountPercent < 0 ? Math.min(100, Math.abs(premiumDiscountPercent) * 4) : 0;
    const lowVolatilityScore = 100 - (asset.volatilityScore ?? 50);
    
    const opportunityScore = 
      (undervaluationScore * 0.35) + 
      ((asset.momentum ?? 50) * 0.25) + 
      ((asset.marketDemand ?? 50) * 0.25) + 
      (lowVolatilityScore * 0.15);

    return {
      ...asset,
      marketPrice,
      fairValue,
      premiumDiscountPercent,
      opportunityScore,
      momentum: asset.momentum ?? 50,
      marketDemand: asset.marketDemand ?? 50,
      volatilityScore: asset.volatilityScore ?? 50,
      score: asset.score ?? 0,
      ownersCount: asset.ownersCount ?? 0,
      change: asset.change ?? 0
    };
  });

  // Derived Stats for Overview
  const teams = processedAssets.filter(a => a.type === 'TEAM');
  const players = processedAssets.filter(a => a.type === 'PLAYER');
  
  const topTeams = [...teams].sort((a, b) => (b.score) - (a.score)).slice(0, 3);
  const topPlayers = [...players].sort((a, b) => b.marketPrice - a.marketPrice).slice(0, 3);

  const sortedByChange = [...processedAssets].sort((a, b) => (b.change) - (a.change));
  const topGainer = sortedByChange.length > 0 && sortedByChange[0].change > 0 ? sortedByChange[0] : null;
  const topLoser = sortedByChange.length > 0 && sortedByChange[sortedByChange.length - 1].change < 0 ? sortedByChange[sortedByChange.length - 1] : null;

  // Filtering Logic
  let filteredAssets = processedAssets.filter(asset => {
    if (filterType !== 'ALL' && filterType !== 'WATCHLIST' && asset.type !== filterType) return false;
    if (filterType === 'WATCHLIST' && !watchlist.includes(asset.id)) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!asset.name.toLowerCase().includes(q) && !asset.code.toLowerCase().includes(q)) return false;
    }

    switch(smartFilter) {
      case 'UNDERVALUED': return asset.premiumDiscountPercent <= -10;
      case 'OVERVALUED': return asset.premiumDiscountPercent >= 10;
      case 'HIGH_MOMENTUM': return asset.momentum >= 70;
      case 'HIGH_DEMAND': return asset.marketDemand >= 70;
      case 'LOW_RISK': return asset.volatilityScore <= 30;
      case 'TOP_GAINERS': return asset.change > 0;
      case 'TOP_LOSERS': return asset.change < 0;
      case 'BLUE_CHIPS': return asset.score >= 85 && asset.volatilityScore <= 40;
      case 'SPECULATIVE': return asset.volatilityScore >= 70 && asset.momentum >= 60;
      default: return true;
    }
  });

  if (smartFilter === 'TOP_GAINERS') {
    filteredAssets.sort((a, b) => b.change - a.change);
  } else if (smartFilter === 'TOP_LOSERS') {
    filteredAssets.sort((a, b) => a.change - b.change);
  } else {
    filteredAssets.sort((a, b) => {
      let valA = 0; let valB = 0;
      switch(sortField) {
        case 'SCORE': valA = a.score; valB = b.score; break;
        case 'PRICE': valA = a.marketPrice; valB = b.marketPrice; break;
        case 'FAIR_VALUE': valA = a.fairValue; valB = b.fairValue; break;
        case 'PREMIUM_DISCOUNT': valA = a.premiumDiscountPercent; valB = b.premiumDiscountPercent; break;
        case 'MOMENTUM': valA = a.momentum; valB = b.momentum; break;
        case 'DEMAND': valA = a.marketDemand; valB = b.marketDemand; break;
        case 'VOLATILITY': valA = a.volatilityScore; valB = b.volatilityScore; break;
        case 'CHANGE': valA = a.change; valB = b.change; break;
        case 'OWNERS': valA = a.ownersCount; valB = b.ownersCount; break;
        case 'OPPORTUNITY': valA = a.opportunityScore; valB = b.opportunityScore; break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
  };

  const renderSortableHeader = (label: string, field: string, align: 'center' | 'left' | 'right' = 'center') => (
    <th className={`p-4 font-bold text-${align} cursor-pointer hover:text-white transition-colors`} onClick={() => handleSort(field)}>
      {label} <SortIcon field={field} />
    </th>
  );

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
            
      <TeamRosterDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <PageHeader 
          title="سوق كأس العالم 2026"
          description="استكشف 48 منتخبًا مشاركًا وقوائمهم النهائية، وقارن بين قوة المنتخبات وجودة اللاعبين وحركة السوق في مكان واحد."
          icon={<Globe size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        <div className="bg-surface border border-white/5 rounded-xl p-4 mb-8 flex flex-wrap gap-4 justify-between items-center text-sm shadow-card">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-gray-400">متداول نشط:</span>
            <span className="font-bold text-white tabular-nums">{usersCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <Activity size={16} className="text-primary" />
            <span className="text-gray-400">حجم التداول اليوم:</span>
            <span className="font-bold text-white tabular-nums">{todayVolume.toLocaleString()} ¢</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <TrendingUp size={16} className="text-success" />
            <span className="text-gray-400">أكثر صعوداً:</span>
            <span className="font-bold text-success truncate max-w-[100px] sm:max-w-none">{topGainer?.name || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <TrendingDown size={16} className="text-danger" />
            <span className="text-gray-400">أكثر هبوطاً:</span>
            <span className="font-bold text-danger truncate max-w-[100px] sm:max-w-none">{topLoser?.name || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4 bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
            <span className="text-gray-400">المباراة القادمة:</span>
            <span className="font-bold text-accent tabular-nums" dir="ltr">{countdown}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-surface border border-white/5 p-6 rounded-2xl flex flex-col justify-center shadow-card">
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Globe size={20} className="text-primary" /> 
              <span>إجمالي المنتخبات</span>
            </div>
            <div className="text-4xl font-bold text-white tabular-nums">48</div>
            <div className="text-sm text-gray-500 mt-2">مشارك في مونديال 2026</div>
          </div>
          
          <div className="bg-surface border border-white/5 p-6 rounded-2xl flex flex-col justify-center shadow-card">
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Users size={20} className="text-accent" /> 
              <span>اللاعبين المتاحين</span>
            </div>
            <div className="text-4xl font-bold text-white tabular-nums">{players.length}</div>
            <div className="text-sm text-gray-500 mt-2">حتى 1,248 لاعباً متاحاً</div>
          </div>

          <div className="bg-surface border border-white/5 p-6 rounded-2xl col-span-1 md:col-span-2 flex items-center justify-between shadow-card">
            <div className="w-1/2 pr-4 border-r border-white/10 hidden md:block">
              <div className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Target size={16} className="text-success" /> أعلى المنتخبات تقييماً</div>
              <div className="flex flex-col gap-2">
                {topTeams.map(t => (
                  <div key={t.id} className="flex justify-between text-sm font-bold">
                    <span className="flex items-center gap-1"><AssetImage image={t.image} name={t.name} type={t.type as 'TEAM' | 'PLAYER'} className="w-5 h-5" width={20} height={20} /> {t.name}</span>
                    <span className="text-accent tabular-nums">{t.score?.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-1/2 md:pl-4">
              <div className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Activity size={16} className="text-primary" /> أغلى النجوم في السوق</div>
              <div className="flex flex-col gap-2">
                {topPlayers.map(p => (
                  <div key={p.id} className="flex justify-between text-sm font-bold">
                    <span className="truncate max-w-[150px]">{p.name}</span>
                    <span className="tabular-nums text-white">{p.marketPrice?.toLocaleString()}¢</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Area */}
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md py-4 mb-8 border-b border-white/5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-grow lg:flex-grow-0">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input 
                  type="text" 
                  placeholder="ابحث عن لاعب أو منتخب..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full lg:w-64 bg-surface/50 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              <div className="flex bg-surface/50 border border-white/10 rounded-xl p-1">
                <button onClick={() => setFilterType('TEAM')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'TEAM' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>المنتخبات</button>
                <button onClick={() => setFilterType('PLAYER')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'PLAYER' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>اللاعبين</button>
                <button onClick={() => setFilterType('WATCHLIST')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'WATCHLIST' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>المفضلة</button>
                <button onClick={() => setFilterType('ALL')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'ALL' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>الكل</button>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex bg-surface/50 border border-white/10 rounded-xl p-1 items-center">
                <button onClick={() => setIsProMode(false)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${!isProMode ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>
                  بسيط
                </button>
                <button onClick={() => setIsProMode(true)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${isProMode ? 'bg-primary text-white shadow-[0_0_10px_rgba(15,240,252,0.5)]' : 'text-gray-400 hover:text-white'}`}>
                  المحترفين (Pro)
                </button>
              </div>
              
              <div className="flex bg-surface/50 border border-white/10 rounded-xl p-1">
                <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                  <LayoutGrid size={18} />
                </button>
                <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-lg transition-colors ${viewMode === 'TABLE' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'UNDERVALUED', label: 'أقل من القيمة العادلة' },
              { id: 'OVERVALUED', label: 'أعلى من القيمة العادلة' },
              { id: 'HIGH_MOMENTUM', label: 'زخم عالي' },
              { id: 'HIGH_DEMAND', label: 'طلب عالي' },
              { id: 'LOW_RISK', label: 'مخاطرة منخفضة' },
              { id: 'TOP_GAINERS', label: 'أكثر ارتفاعاً' },
              { id: 'TOP_LOSERS', label: 'أكثر انخفاضاً' },
              { id: 'BLUE_CHIPS', label: 'قيادية (Blue Chips)' },
              { id: 'SPECULATIVE', label: 'مضاربة (Speculative)' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSmartFilter(filter.id)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${
                  smartFilter === filter.id 
                    ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(15,240,252,0.3)]' 
                    : 'bg-surface border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        {filteredAssets.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-bold mb-2">لا توجد نتائج</p>
            <p className="text-sm">لا توجد أصول مطابقة لهذا الفلتر حالياً.</p>
          </div>
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredAssets.map(asset => {
              let variant: 'default' | 'hot' | 'cold' = 'default';
              if (asset.change >= 5) variant = 'hot';
              else if (asset.change <= -5) variant = 'cold';
              const isWatched = watchlist.includes(asset.id);

              return (
                <div key={asset.id} className="relative flex justify-center group w-full">
                  <div className="absolute top-2 right-2 z-20">
                    <button onClick={(e) => toggleWatchlist(e, asset.id)} className="p-1.5 rounded-full bg-black/40 hover:bg-black/80 transition-colors backdrop-blur-md">
                      <Star size={16} className={isWatched ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]" : "text-gray-400"} />
                    </button>
                  </div>
                  <StockCard 
                    type={asset.type as 'TEAM' | 'PLAYER'}
                    name={asset.name}
                    code={asset.code}
                    image={asset.image}
                    score={asset.score}
                    price={asset.marketPrice}
                    change={asset.change}
                    volume={asset.volume}
                    marketCap={asset.market_cap}
                    priceHistory={asset.priceHistory?.map((h: any) => h.price) || [asset.marketPrice, asset.marketPrice]}
                    position={asset.position || undefined}
                    fifaRank={asset.fifaRank || undefined}
                    onClick={() => {
                      if (asset.type === 'TEAM') {
                        setSelectedTeam(asset);
                      } else {
                        window.location.href = `/asset/${asset.id}`;
                      }
                    }}
                    variant={variant}
                    isProMode={isProMode}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface border border-white/10 rounded-2xl overflow-x-auto shadow-card">
            <table className="w-full text-right border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-background/60 border-b border-white/10 text-gray-400 text-sm tracking-wider">
                  <th className="p-4 font-bold text-right">الأصل</th>
                  {filterType === 'TEAM' && renderSortableHeader('FIFA Rank', 'SCORE')}
                  {filterType === 'TEAM' && renderSortableHeader('المُلاّك', 'OWNERS')}
                  
                  {filterType === 'PLAYER' && <th className="p-4 font-bold text-center">المركز</th>}
                  {filterType === 'PLAYER' && <th className="p-4 font-bold text-center">العمر</th>}
                  {filterType === 'PLAYER' && <th className="p-4 font-bold text-center">النادي</th>}
                  
                  {filterType === 'ALL' && <th className="p-4 font-bold text-center">النوع</th>}

                  {renderSortableHeader('التقييم', 'SCORE')}
                  {renderSortableHeader('فرصة (Opp)', 'OPPORTUNITY')}
                  {renderSortableHeader('العادلة', 'FAIR_VALUE')}
                  {renderSortableHeader('السوق', 'PRICE')}
                  {renderSortableHeader('علاوة/خصم', 'PREMIUM_DISCOUNT')}
                  {renderSortableHeader('الزخم', 'MOMENTUM')}
                  {renderSortableHeader('الطلب', 'DEMAND')}
                  {renderSortableHeader('التقلب', 'VOLATILITY')}
                  {renderSortableHeader('التغير 24h', 'CHANGE')}
                  <th className="p-4 font-bold text-left">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => {
                  const isWatched = watchlist.includes(asset.id);
                  return (
                    <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => {
                      if (asset.type === 'TEAM') setSelectedTeam(asset);
                      else window.location.href = `/asset/${asset.id}`;
                    }}>
                      <td className="p-4 flex items-center gap-3">
                        <button onClick={(e) => toggleWatchlist(e, asset.id)} className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0">
                          <Star size={16} className={isWatched ? "text-yellow-400 fill-yellow-400" : "text-gray-500"} />
                        </button>
                        <AssetImage image={asset.image} name={asset.name} type={asset.type as 'TEAM' | 'PLAYER'} className="w-10 h-10 bg-background/40 flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0" width={40} height={40} />
                        <div>
                          <p className="font-bold text-white text-md group-hover:text-primary transition-colors">{asset.name}</p>
                          <p className="text-xs text-gray-500">{asset.code}</p>
                        </div>
                      </td>
                      
                      {filterType === 'TEAM' && (
                        <td className="p-4 text-center text-gray-300 tabular-nums font-bold">
                          {asset.type === 'TEAM' ? `#${asset.fifaRank || '-'}` : '-'}
                        </td>
                      )}
                      {filterType === 'TEAM' && (
                        <td className="p-4 text-center text-gray-400 tabular-nums">
                          {asset.ownersCount ? asset.ownersCount.toLocaleString() : '0'}
                        </td>
                      )}
                      
                      {filterType === 'PLAYER' && (
                        <td className="p-4 text-center">
                          <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300 font-bold">{asset.position || '-'}</span>
                        </td>
                      )}
                      {filterType === 'PLAYER' && (
                        <td className="p-4 text-center text-gray-300 tabular-nums">
                          {asset.age || '-'}
                        </td>
                      )}
                      {filterType === 'PLAYER' && (
                        <td className="p-4 text-center text-gray-400 text-sm truncate max-w-[120px]">
                          {asset.club || '-'}
                        </td>
                      )}

                      {filterType === 'ALL' && (
                        <td className="p-4 text-center">
                          <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300 font-bold">
                            {asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}
                          </span>
                        </td>
                      )}

                      <td className="p-4 text-center font-bold text-accent tabular-nums">
                        {asset.score?.toFixed(1)}
                      </td>
                      
                      <td className="p-4 text-center font-bold text-blue-400 tabular-nums">
                        {asset.opportunityScore?.toFixed(1)}
                      </td>

                      <td className="p-4 text-center text-gray-300 tabular-nums font-mono">
                        {asset.fairValue?.toFixed(0)} ¢
                      </td>

                      <td className="p-4 text-center font-bold text-white tabular-nums">
                        {asset.marketPrice?.toFixed(0)} ¢
                      </td>

                      <td className="p-4 text-center tabular-nums">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${asset.premiumDiscountPercent > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                          {asset.premiumDiscountPercent > 0 ? '+' : ''}{asset.premiumDiscountPercent?.toFixed(1)}%
                        </span>
                      </td>

                      <td className="p-4 text-center font-bold tabular-nums">
                        <span className={asset.momentum >= 70 ? 'text-green-400' : 'text-gray-400'}>{asset.momentum?.toFixed(0)}</span>
                      </td>

                      <td className="p-4 text-center font-bold tabular-nums">
                        <span className={asset.marketDemand >= 70 ? 'text-green-400' : 'text-gray-400'}>{asset.marketDemand?.toFixed(0)}</span>
                      </td>

                      <td className="p-4 text-center font-bold tabular-nums">
                        <span className={asset.volatilityScore <= 30 ? 'text-green-400' : asset.volatilityScore >= 70 ? 'text-red-400' : 'text-gray-400'}>{asset.volatilityScore?.toFixed(0)}</span>
                      </td>
                      
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center justify-center gap-1 font-bold tabular-nums ${asset.change >= 0 ? 'text-success' : 'text-danger'}`}>
                          {asset.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {Math.abs(asset.change || 0)}%
                        </span>
                      </td>
                      
                      <td className="p-4 text-left">
                        <Link 
                          href={`/asset/${asset.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 px-3 py-1.5 rounded-lg font-bold transition-all text-xs"
                        >
                          تداول <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
