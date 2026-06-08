'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore, Asset } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Globe,
  LayoutGrid,
  LineChart,
  List,
  Maximize2,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';

type ProcessedAsset = Asset & {
  marketPrice: number;
  fairValue: number;
  premiumDiscountPercent: number;
  opportunityScore: number;
  momentum: number;
  marketDemand: number;
  volatilityScore: number;
  score: number;
  ownersCount: number;
  change: number;
};

type ViewMode = 'CARDS' | 'TABLE' | 'HEATMAP';

const typeFilters = [
  { id: 'ALL', label: 'الكل' },
  { id: 'TEAM', label: 'المنتخبات' },
  { id: 'PLAYER', label: 'اللاعبون' },
  { id: 'WATCHLIST', label: 'قائمتي' },
] as const;

const smartFilters = [
  { id: 'ALL', label: 'الكل' },
  { id: 'UNDERVALUED', label: 'أقل من القيمة' },
  { id: 'HIGH_MOMENTUM', label: 'زخم عالي' },
  { id: 'HIGH_DEMAND', label: 'طلب عالي' },
  { id: 'LOW_RISK', label: 'منخفض المخاطر' },
  { id: 'TOP_GAINERS', label: 'الأكثر صعودًا' },
  { id: 'TOP_LOSERS', label: 'الأكثر هبوطًا' },
  { id: 'BLUE_CHIPS', label: 'أصول قيادية' },
  { id: 'SPECULATIVE', label: 'مضاربية' },
] as const;

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function formatPrice(value: number) {
  return `${Math.round(value || 0).toLocaleString()}¢`;
}

function assetTypeLabel(asset: ProcessedAsset | Asset) {
  return asset.type === 'TEAM' ? 'منتخب' : 'لاعب';
}

function getAssetBadges(asset: ProcessedAsset) {
  const badges: { label: string; className: string }[] = [];

  if (asset.premiumDiscountPercent <= -5) badges.push({ label: 'أقل من القيمة', className: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20' });
  if (asset.premiumDiscountPercent >= 10) badges.push({ label: 'أعلى من القيمة', className: 'bg-danger/10 text-danger border-danger/20' });
  if (asset.momentum >= 70) badges.push({ label: 'زخم قوي', className: 'bg-success/10 text-success border-success/20' });
  if (asset.marketDemand >= 70) badges.push({ label: 'طلب مرتفع', className: 'bg-primary/10 text-primary border-primary/20' });
  if (asset.volatilityScore <= 30) badges.push({ label: 'مخاطرة منخفضة', className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' });
  if (asset.volatilityScore >= 70) badges.push({ label: 'متقلب', className: 'bg-orange-400/10 text-orange-300 border-orange-400/20' });
  if ((asset.type === 'TEAM' && (asset.fifaRank || 99) <= 10) || (asset.type === 'PLAYER' && (asset.playerTier || 0) >= 0.9)) {
    badges.push({ label: 'أصل قيادي', className: 'bg-white/10 text-white border-white/15' });
  }

  return badges.slice(0, 3);
}

function getOpportunityReason(asset: ProcessedAsset) {
  if (asset.premiumDiscountPercent <= -5 && asset.momentum >= 60 && asset.volatilityScore <= 45) return 'فرصة متوازنة';
  if (asset.premiumDiscountPercent <= -5) return 'أقل من القيمة العادلة';
  if (asset.momentum >= 70) return 'زخم قوي';
  if (asset.marketDemand >= 70) return 'طلب سوقي مرتفع';
  if (asset.volatilityScore <= 30) return 'مخاطرة منخفضة';
  return 'قيد المتابعة';
}

function MetricCard({ icon, label, value, hint, accent = 'text-primary' }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface/80 p-4 shadow-card">
      <div className={`mb-3 flex items-center gap-2 text-sm ${accent}`}>{icon}<span className="font-bold">{label}</span></div>
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-surface/40 p-10 text-center">
      <AlertCircle className="mx-auto mb-4 text-gray-500" size={36} />
      <h3 className="mb-2 text-xl font-black text-white">{title}</h3>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export default function MarketClient({
  usersCount = 0,
  todayVolume = 0,
  todayTradesCount = 0,
  assetsCount = 0,
  teamsCount = 0,
  playersCount = 0,
  nextMatchDate = null,
  nextMatch = null,
  recentNews = [],
}: {
  usersCount?: number;
  todayVolume?: number;
  todayTradesCount?: number;
  assetsCount?: number;
  teamsCount?: number;
  playersCount?: number;
  nextMatchDate?: string | null;
  nextMatch?: any;
  recentNews?: any[];
}) {
  const { assets, fetchAssets } = useStore();
  const [filterType, setFilterType] = useState<'ALL' | 'TEAM' | 'PLAYER' | 'WATCHLIST'>('ALL');
  const [smartFilter, setSmartFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('CARDS');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<ProcessedAsset | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('OPPORTUNITY');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [countdown, setCountdown] = useState('لا توجد مباريات مجدولة');

  useEffect(() => {
    fetchAssets();
    const savedWatchlist = localStorage.getItem('watchlistAssetIds');
    const savedCompare = localStorage.getItem('compareAssetIds');
    if (savedWatchlist) try { setWatchlist(JSON.parse(savedWatchlist)); } catch {}
    if (savedCompare) try { setCompareIds(JSON.parse(savedCompare)); } catch {}
  }, [fetchAssets]);

  useEffect(() => {
    if (!nextMatchDate) return;
    const matchTime = new Date(nextMatchDate).getTime();
    const updateCountdown = () => {
      const distance = matchTime - Date.now();
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
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextMatchDate]);

  const processedAssets = useMemo<ProcessedAsset[]>(() => assets.map((asset) => {
    const marketPrice = Number(asset.marketPrice ?? asset.current_price ?? 0);
    const fairValue = Number(asset.fairValue ?? asset.current_price ?? marketPrice);
    const premiumDiscountPercent = fairValue > 0 ? ((marketPrice - fairValue) / fairValue) * 100 : 0;
    const momentum = Number(asset.momentum ?? 50);
    const marketDemand = Number(asset.marketDemand ?? 50);
    const volatilityScore = Number(asset.volatilityScore ?? 50);
    const score = Number(asset.score ?? 0);
    const ownersCount = Number(asset.ownersCount ?? 0);
    const change = Number(asset.change ?? 0);
    const undervaluationScore = premiumDiscountPercent < 0 ? Math.min(100, Math.abs(premiumDiscountPercent) * 4) : 0;
    const lowVolatilityScore = 100 - volatilityScore;
    const opportunityScore = (undervaluationScore * 0.35) + (momentum * 0.25) + (marketDemand * 0.25) + (lowVolatilityScore * 0.15);
    return { ...asset, marketPrice, fairValue, premiumDiscountPercent, opportunityScore, momentum, marketDemand, volatilityScore, score, ownersCount, change };
  }), [assets]);

  const computedTeamsCount = teamsCount || processedAssets.filter(a => a.type === 'TEAM').length;
  const computedPlayersCount = playersCount || processedAssets.filter(a => a.type === 'PLAYER').length;
  const computedAssetsCount = assetsCount || processedAssets.length;
  const sortedByChange = [...processedAssets].sort((a, b) => b.change - a.change);
  const topGainer = sortedByChange.find(a => a.change > 0) || null;
  const topLoser = [...processedAssets].sort((a, b) => a.change - b.change).find(a => a.change < 0) || null;
  const topMomentum = [...processedAssets].sort((a, b) => b.momentum - a.momentum)[0] || null;
  const topDemand = [...processedAssets].sort((a, b) => b.marketDemand - a.marketDemand)[0] || null;
  const mostTraded = [...processedAssets].sort((a, b) => b.ownersCount - a.ownersCount)[0] || null;

  const opportunities = processedAssets
    .filter((asset) => asset.premiumDiscountPercent <= -5 || asset.momentum >= 70 || asset.marketDemand >= 70 || asset.volatilityScore <= 30)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 6);

  const filteredAssets = useMemo(() => {
    const filtered = processedAssets.filter((asset) => {
      if (filterType !== 'ALL' && filterType !== 'WATCHLIST' && asset.type !== filterType) return false;
      if (filterType === 'WATCHLIST' && !watchlist.includes(asset.id)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchable = [asset.name, asset.code, asset.position || '', asset.club || '', asset.group || '', asset.continent || ''].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      switch (smartFilter) {
        case 'UNDERVALUED': return asset.premiumDiscountPercent <= -5;
        case 'HIGH_MOMENTUM': return asset.momentum >= 70;
        case 'HIGH_DEMAND': return asset.marketDemand >= 70;
        case 'LOW_RISK': return asset.volatilityScore <= 30;
        case 'TOP_GAINERS': return asset.change > 0;
        case 'TOP_LOSERS': return asset.change < 0;
        case 'BLUE_CHIPS': return (asset.type === 'TEAM' && (asset.fifaRank || 99) <= 10) || (asset.type === 'PLAYER' && (asset.playerTier || 0) >= 0.9);
        case 'SPECULATIVE': return asset.volatilityScore >= 60 && asset.momentum >= 60;
        default: return true;
      }
    });
    return filtered.sort((a, b) => {
      let valA = 0; let valB = 0;
      switch (sortField) {
        case 'SCORE': valA = a.score; valB = b.score; break;
        case 'PRICE': valA = a.marketPrice; valB = b.marketPrice; break;
        case 'FAIR_VALUE': valA = a.fairValue; valB = b.fairValue; break;
        case 'PREMIUM_DISCOUNT': valA = a.premiumDiscountPercent; valB = b.premiumDiscountPercent; break;
        case 'MOMENTUM': valA = a.momentum; valB = b.momentum; break;
        case 'DEMAND': valA = a.marketDemand; valB = b.marketDemand; break;
        case 'VOLATILITY': valA = a.volatilityScore; valB = b.volatilityScore; break;
        case 'CHANGE': valA = a.change; valB = b.change; break;
        case 'OWNERS': valA = a.ownersCount; valB = b.ownersCount; break;
        case 'OPPORTUNITY': default: valA = a.opportunityScore; valB = b.opportunityScore; break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedAssets, filterType, watchlist, searchQuery, smartFilter, sortField, sortDirection]);

  const compareAssets = compareIds.map(id => processedAssets.find(asset => asset.id === id)).filter(Boolean) as ProcessedAsset[];

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('watchlistAssetIds', JSON.stringify(next));
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : [prev[1], prev[2], id];
      localStorage.setItem('compareAssetIds', JSON.stringify(next));
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDirection(['PRICE', 'SCORE', 'OPPORTUNITY', 'MOMENTUM', 'DEMAND'].includes(field) ? 'desc' : 'asc');
    }
  };

  const sortIcon = (field: string) => sortField !== field ? null : sortDirection === 'asc' ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />;

  const getHeatmapStyle = (asset: ProcessedAsset) => {
    const absChange = Math.min(Math.abs(asset.change), 15);
    const opacity = 0.15 + (absChange / 15) * 0.35;
    return { background: asset.change > 0 ? `rgba(0,255,136,${opacity})` : asset.change < 0 ? `rgba(255,59,92,${opacity})` : 'rgba(255,255,255,0.06)' };
  };

  const renderMiniMetrics = (asset: ProcessedAsset) => (
    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">زخم</div><div className="font-black text-white tabular-nums">{asset.momentum.toFixed(0)}</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">طلب</div><div className="font-black text-white tabular-nums">{asset.marketDemand.toFixed(0)}</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">تقلب</div><div className="font-black text-white tabular-nums">{asset.volatilityScore.toFixed(0)}</div></div>
    </div>
  );

  const renderAssetCard = (asset: ProcessedAsset) => {
    const isWatched = watchlist.includes(asset.id);
    const isCompared = compareIds.includes(asset.id);
    const badges = getAssetBadges(asset);
    return (
      <button key={asset.id} type="button" onClick={() => setSelectedAsset(asset)} className="group rounded-3xl border border-white/5 bg-surface p-5 text-right shadow-card transition-all hover:-translate-y-1 hover:border-primary/40">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AssetImage image={asset.image} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={54} height={54} className="h-14 w-14 rounded-2xl border border-white/10 bg-background/60 object-cover" />
            <div>
              <div className="flex items-center gap-2"><span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-300">{assetTypeLabel(asset)}</span><span className={`text-xs font-bold tabular-nums ${asset.change >= 0 ? 'text-success' : 'text-danger'}`}>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(1)}%</span></div>
              <h3 className="mt-1 max-w-[180px] truncate text-lg font-black text-white group-hover:text-primary">{asset.name}</h3>
              <p className="text-xs text-gray-500">{asset.code}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span onClick={(e) => { e.stopPropagation(); toggleWatchlist(asset.id); }} className="rounded-xl bg-black/30 p-2 transition-colors hover:bg-white/10"><Star size={16} className={isWatched ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'} /></span>
            <span onClick={(e) => { e.stopPropagation(); toggleCompare(asset.id); }} className={`rounded-xl p-2 transition-colors ${isCompared ? 'bg-primary/20 text-primary' : 'bg-black/30 text-gray-500 hover:bg-white/10'}`}><BarChart3 size={16} /></span>
          </div>
        </div>
        <div className="flex items-end justify-between"><div><p className="text-xs text-gray-500">السعر الحالي</p><p className="text-2xl font-black text-white tabular-nums">{formatPrice(asset.marketPrice)}</p></div><div className="text-left"><p className="text-xs text-gray-500">القيمة العادلة</p><p className="font-bold text-gray-200 tabular-nums">{formatPrice(asset.fairValue)}</p></div></div>
        <div className="mt-3"><span className={`rounded-lg px-2 py-1 text-xs font-black tabular-nums ${asset.premiumDiscountPercent <= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{asset.premiumDiscountPercent > 0 ? '+' : ''}{asset.premiumDiscountPercent.toFixed(1)}%</span></div>
        {renderMiniMetrics(asset)}
        <div className="mt-4 flex flex-wrap gap-2">{badges.length > 0 ? badges.map((badge) => <span key={badge.label} className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${badge.className}`}>{badge.label}</span>) : <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-gray-500">قيد المتابعة</span>}</div>
      </button>
    );
  };

  const renderTable = () => (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-surface shadow-card">
      <table className="w-full whitespace-nowrap text-right">
        <thead className="border-b border-white/10 bg-background/60 text-sm text-gray-400"><tr><th className="p-4">الأصل</th>{[['SCORE','التقييم'],['OPPORTUNITY','الفرصة'],['PRICE','السوق'],['FAIR_VALUE','العادلة'],['PREMIUM_DISCOUNT','خصم/علاوة'],['MOMENTUM','الزخم'],['DEMAND','الطلب'],['VOLATILITY','التقلب'],['CHANGE','24h']].map(([field,label]) => <th key={field} onClick={() => handleSort(field)} className="cursor-pointer p-4 text-center hover:text-white">{label} {sortIcon(field)}</th>)}<th className="p-4 text-left">إجراء</th></tr></thead>
        <tbody>{filteredAssets.map((asset) => <tr key={asset.id} onClick={() => setSelectedAsset(asset)} className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"><td className="p-4"><div className="flex items-center gap-3"><button type="button" onClick={(e) => { e.stopPropagation(); toggleWatchlist(asset.id); }} className="rounded-lg p-1 hover:bg-white/10"><Star size={16} className={watchlist.includes(asset.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'} /></button><AssetImage image={asset.image} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={42} height={42} className="h-11 w-11 rounded-xl border border-white/10 bg-background/50 object-cover" /><div><div className="font-black text-white">{asset.name}</div><div className="text-xs text-gray-500">{asset.code} · {assetTypeLabel(asset)}</div></div></div></td><td className="p-4 text-center font-bold text-accent tabular-nums">{asset.score.toFixed(1)}</td><td className="p-4 text-center font-bold text-primary tabular-nums">{asset.opportunityScore.toFixed(1)}</td><td className="p-4 text-center font-bold text-white tabular-nums">{formatPrice(asset.marketPrice)}</td><td className="p-4 text-center text-gray-300 tabular-nums">{formatPrice(asset.fairValue)}</td><td className="p-4 text-center"><span className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${asset.premiumDiscountPercent <= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{asset.premiumDiscountPercent > 0 ? '+' : ''}{asset.premiumDiscountPercent.toFixed(1)}%</span></td><td className="p-4 text-center font-bold tabular-nums text-gray-200">{asset.momentum.toFixed(0)}</td><td className="p-4 text-center font-bold tabular-nums text-gray-200">{asset.marketDemand.toFixed(0)}</td><td className="p-4 text-center font-bold tabular-nums text-gray-200">{asset.volatilityScore.toFixed(0)}</td><td className={`p-4 text-center font-bold tabular-nums ${asset.change >= 0 ? 'text-success' : 'text-danger'}`}>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(1)}%</td><td className="p-4 text-left"><Link href={`/asset/${asset.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:bg-primary/20">تداول <ArrowRight size={14} /></Link></td></tr>)}</tbody>
      </table>
    </div>
  );

  const renderHeatmap = () => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {filteredAssets.map((asset) => <button key={asset.id} type="button" onClick={() => setSelectedAsset(asset)} style={getHeatmapStyle(asset)} className={`min-h-[140px] rounded-3xl border p-4 text-right transition-all hover:-translate-y-1 hover:scale-[1.02] ${asset.premiumDiscountPercent <= -5 ? 'border-yellow-400/60' : asset.momentum >= 70 ? 'border-primary/60' : asset.marketDemand >= 70 ? 'border-purple-400/50' : 'border-white/10'}`}><div className="flex items-start justify-between gap-2"><AssetImage image={asset.image} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={36} height={36} className="h-10 w-10 rounded-xl border border-white/10 bg-background/50 object-cover" /><span className={`text-xs font-black tabular-nums ${asset.change >= 0 ? 'text-success' : 'text-danger'}`}>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(1)}%</span></div><h3 className="mt-3 line-clamp-2 font-black text-white">{asset.name}</h3><p className="mt-1 text-xs text-gray-400">{formatPrice(asset.marketPrice)}</p><div className="mt-3 flex flex-wrap gap-1">{getAssetBadges(asset).slice(0, 2).map(badge => <span key={badge.label} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}>{badge.label}</span>)}</div></button>)}
    </div>
  );

  const selectedBadges = selectedAsset ? getAssetBadges(selectedAsset) : [];
  const estimatedTotal = selectedAsset ? selectedAsset.marketPrice * Math.max(1, tradeQuantity) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="مركز قيادة السوق" description="راقب نبض السوق، اكتشف الفرص، قارن الأصول، واتخذ قراراتك باستخدام بيانات حقيقية من المنصة فقط." icon={<Globe size={48} />} glowColor="bg-primary/10" textColor="text-primary" />

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard icon={<Users size={18} />} label="المستخدمون" value={usersCount.toLocaleString()} hint="حسابات مسجلة" /><MetricCard icon={<Activity size={18} />} label="حجم التداول اليوم" value={`${formatCompactNumber(todayVolume)}¢`} hint={todayVolume === 0 ? 'لا توجد صفقات اليوم بعد' : 'من جدول الصفقات'} accent="text-success" /><MetricCard icon={<LineChart size={18} />} label="صفقات اليوم" value={todayTradesCount.toLocaleString()} hint={todayTradesCount === 0 ? 'ابدأ أول صفقة لتفعيل النشاط' : 'صفقات منفذة اليوم'} accent="text-accent" /><MetricCard icon={<Target size={18} />} label="الأصول المتاحة" value={computedAssetsCount.toLocaleString()} hint={`${computedTeamsCount} منتخبات · ${computedPlayersCount} لاعبين`} accent="text-yellow-300" /></section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]"><div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-black text-white">نبض السوق الآن</h2><p className="mt-1 text-sm text-gray-500">أقوى التحركات المحسوبة من بيانات الأصول الحالية.</p></div><div className="hidden rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black text-primary sm:block">LIVE MARKET</div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[{ title:'أكثر أصل متابعة', asset:mostTraded, icon:<Users size={16} className="text-accent" />, empty:'لا توجد ملاك بعد' },{ title:'أعلى صعود', asset:topGainer, icon:<TrendingUp size={16} className="text-success" />, empty:'لا توجد حركة صعود' },{ title:'أعلى زخم', asset:topMomentum, icon:<Flame size={16} className="text-primary" />, empty:'لا توجد بيانات زخم' },{ title:'أعلى طلب', asset:topDemand, icon:<Zap size={16} className="text-yellow-300" />, empty:'لا توجد بيانات طلب' }].map(item => <button key={item.title} type="button" onClick={() => item.asset && setSelectedAsset(item.asset)} className="rounded-2xl border border-white/5 bg-background/40 p-4 text-right transition-colors hover:border-primary/30"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-gray-500">{item.title}</span>{item.icon}</div>{item.asset ? <div className="flex items-center gap-2"><AssetImage image={item.asset.image} type={item.asset.type as 'TEAM' | 'PLAYER'} name={item.asset.name} width={34} height={34} className="h-9 w-9 rounded-xl border border-white/10 object-cover" /><div className="min-w-0"><div className="truncate font-black text-white">{item.asset.name}</div><div className="text-xs text-gray-500">{formatPrice(item.asset.marketPrice)}</div></div></div> : <p className="text-sm text-gray-600">{item.empty}</p>}</button>)}</div></div><div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card"><div className="mb-4 flex items-center gap-2"><Sparkles size={20} className="text-yellow-300" /><h2 className="text-xl font-black text-white">المباراة القادمة</h2></div>{nextMatch ? <Link href={`/matches/${nextMatch.id}`} className="block rounded-2xl border border-white/5 bg-background/40 p-4 hover:border-primary/30"><div className="mb-3 text-xs font-bold text-accent" dir="ltr">{countdown}</div><div className="flex items-center justify-between gap-4"><div className="text-center"><AssetImage image={nextMatch.homeTeam?.image} type="TEAM" name={nextMatch.homeTeam?.name || 'Home'} width={42} height={42} className="mx-auto h-12 w-12 rounded-xl object-cover" /><div className="mt-2 text-sm font-black text-white">{nextMatch.homeTeam?.name}</div></div><div className="text-xs font-black text-gray-500">VS</div><div className="text-center"><AssetImage image={nextMatch.awayTeam?.image} type="TEAM" name={nextMatch.awayTeam?.name || 'Away'} width={42} height={42} className="mx-auto h-12 w-12 rounded-xl object-cover" /><div className="mt-2 text-sm font-black text-white">{nextMatch.awayTeam?.name}</div></div></div></Link> : <EmptyState title="لا توجد مباريات مجدولة" text="سيظهر هنا أقرب لقاء مؤثر على السوق عند توفره." />}</div></section>

        <section className="mb-8 rounded-3xl border border-white/5 bg-surface p-6 shadow-card"><div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-2xl font-black text-white">فرص السوق الآن</h2><p className="mt-1 text-sm text-gray-500">فرص محسوبة من السعر العادل، الزخم، الطلب، والتقلب. لا توجد بيانات وهمية.</p></div><Link href="/articles" className="hidden items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-gray-300 hover:text-primary md:inline-flex">كيف أقرأ الفرص؟ <ArrowRight size={14} /></Link></div>{opportunities.length === 0 ? <EmptyState title="لا توجد فرص واضحة حاليًا" text="راقب السوق أو تصفح الأصول. ستظهر الفرص عندما تتحرك البيانات الحقيقية." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{opportunities.map(asset => <button key={asset.id} type="button" onClick={() => setSelectedAsset(asset)} className="rounded-2xl border border-white/5 bg-background/40 p-4 text-right transition-colors hover:border-primary/30"><div className="mb-3 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><AssetImage image={asset.image} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={44} height={44} className="h-12 w-12 rounded-xl border border-white/10 object-cover" /><div><div className="font-black text-white">{asset.name}</div><div className="text-xs text-gray-500">{assetTypeLabel(asset)} · {asset.code}</div></div></div><span className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-2 py-1 text-[10px] font-black text-yellow-300">{getOpportunityReason(asset)}</span></div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">السوق</div><div className="font-black text-white">{formatPrice(asset.marketPrice)}</div></div><div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">العادلة</div><div className="font-black text-white">{formatPrice(asset.fairValue)}</div></div><div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">خصم/علاوة</div><div className={asset.premiumDiscountPercent <= 0 ? 'font-black text-success' : 'font-black text-danger'}>{asset.premiumDiscountPercent > 0 ? '+' : ''}{asset.premiumDiscountPercent.toFixed(1)}%</div></div><div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">نقاط الفرصة</div><div className="font-black text-primary">{asset.opportunityScore.toFixed(1)}</div></div></div></button>)}</div>}</section>

        <section className="sticky top-16 z-40 mb-8 rounded-3xl border border-white/5 bg-background/90 p-4 backdrop-blur-xl"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1 lg:max-w-md"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} /><input type="text" placeholder="ابحث عن منتخب، لاعب، مركز، مجموعة، نادي..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-surface/60 py-3 pl-4 pr-10 text-sm outline-none transition-colors focus:border-primary" /></div><div className="flex flex-wrap gap-2">{typeFilters.map(filter => <button key={filter.id} type="button" onClick={() => setFilterType(filter.id)} className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${filterType === filter.id ? 'bg-primary text-black' : 'bg-surface text-gray-400 hover:text-white'}`}>{filter.label}</button>)}</div></div><div className="flex flex-wrap items-center gap-2">{[{ id:'CARDS', icon:<LayoutGrid size={18} />, label:'بطاقات' },{ id:'TABLE', icon:<List size={18} />, label:'جدول' },{ id:'HEATMAP', icon:<Maximize2 size={18} />, label:'Heatmap' }].map(item => <button key={item.id} type="button" onClick={() => setViewMode(item.id as ViewMode)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-colors ${viewMode === item.id ? 'bg-white text-black' : 'bg-surface text-gray-400 hover:text-white'}`}>{item.icon} {item.label}</button>)}</div></div><div className="mt-4 flex flex-wrap gap-2">{smartFilters.map(filter => <button key={filter.id} type="button" onClick={() => setSmartFilter(filter.id)} className={`rounded-xl border px-3 py-2 text-xs font-black transition-colors ${smartFilter === filter.id ? 'border-primary/50 bg-primary/20 text-primary' : 'border-white/5 bg-surface text-gray-500 hover:text-white'}`}>{filter.label}</button>)}</div></section>

        <section className="mb-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-white">قائمة السوق</h2><p className="mt-1 text-sm text-gray-500">{filteredAssets.length.toLocaleString()} أصل مطابق للفلاتر الحالية.</p></div>{compareAssets.length > 0 && <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">المقارنة: {compareAssets.map(a => a.name).join(' × ')}</div>}</div>{filteredAssets.length === 0 ? <EmptyState title="لا توجد أصول مطابقة" text="غيّر الفلاتر أو ابحث بكلمة مختلفة. لن نعرض أصولًا وهمية." /> : viewMode === 'CARDS' ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredAssets.map(renderAssetCard)}</div> : viewMode === 'TABLE' ? renderTable() : renderHeatmap()}</section>

        <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card"><div className="mb-5 flex items-center gap-2"><Star className="text-yellow-300" size={20} /><h2 className="text-xl font-black text-white">قائمتي</h2></div>{watchlist.length === 0 ? <EmptyState title="قائمة المراقبة فارغة" text="أضف أصولًا للمراقبة من زر النجمة في السوق." /> : <div className="space-y-3">{watchlist.map(id => processedAssets.find(asset => asset.id === id)).filter(Boolean).slice(0, 6).map(asset => asset as ProcessedAsset).map(asset => <button key={asset.id} type="button" onClick={() => setSelectedAsset(asset)} className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-background/40 p-3 text-right hover:border-primary/30"><div className="flex items-center gap-3"><AssetImage image={asset.image} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={36} height={36} className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-black text-white">{asset.name}</div><div className="text-xs text-gray-500">{formatPrice(asset.marketPrice)}</div></div></div><div className={asset.change >= 0 ? 'font-black text-success' : 'font-black text-danger'}>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(1)}%</div></button>)}</div>}</div><div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card"><div className="mb-5 flex items-center gap-2"><Bell className="text-primary" size={20} /><h2 className="text-xl font-black text-white">أحداث حرّكت السوق</h2></div>{recentNews.length === 0 ? <EmptyState title="لا توجد أحداث سوقية حديثة" text="ستظهر هنا الأحداث المؤثرة عند إضافتها من لوحة التحكم أو محرك الأخبار." /> : <div className="space-y-3">{recentNews.map((news: any) => <Link key={news.id} href={`/asset/${news.assetId}`} className="block rounded-2xl border border-white/5 bg-background/40 p-4 hover:border-primary/30"><div className="flex items-start justify-between gap-3"><div><div className="font-black text-white">{news.titleAr}</div><div className="mt-1 line-clamp-2 text-sm text-gray-500">{news.bodyAr}</div></div><span className={`rounded-lg px-2 py-1 text-xs font-black ${Number(news.changePercent || 0) >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{Number(news.changePercent || 0) >= 0 ? '+' : ''}{Number(news.changePercent || 0).toFixed(1)}%</span></div></Link>)}</div>}</div></section>
      </main>

      {selectedAsset && <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={() => setSelectedAsset(null)}><aside className="absolute left-0 top-0 h-full w-full max-w-[430px] overflow-y-auto border-r border-white/10 bg-[#07090d] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-6 flex items-start justify-between gap-4"><div className="flex items-center gap-4"><AssetImage image={selectedAsset.image} type={selectedAsset.type as 'TEAM' | 'PLAYER'} name={selectedAsset.name} width={70} height={70} className="h-20 w-20 rounded-3xl border border-white/10 bg-surface object-cover" /><div><span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">{assetTypeLabel(selectedAsset)}</span><h2 className="mt-2 text-2xl font-black text-white">{selectedAsset.name}</h2><p className="text-sm text-gray-500">{selectedAsset.code}</p></div></div><button onClick={() => setSelectedAsset(null)} className="rounded-xl bg-white/5 p-2 text-gray-400 hover:text-white"><X size={20} /></button></div><div className="mb-6 grid grid-cols-2 gap-3"><MetricCard icon={<TrendingUp size={16} />} label="السعر" value={formatPrice(selectedAsset.marketPrice)} /><MetricCard icon={<Target size={16} />} label="العادلة" value={formatPrice(selectedAsset.fairValue)} accent="text-yellow-300" /></div><div className="mb-6 rounded-3xl border border-white/5 bg-surface p-5"><h3 className="mb-4 font-black text-white">تحليل الأصل</h3>{[['خصم/علاوة', selectedAsset.premiumDiscountPercent, '%'], ['الزخم', selectedAsset.momentum, '/100'], ['الطلب', selectedAsset.marketDemand, '/100'], ['التقلب', selectedAsset.volatilityScore, '/100'], ['التقييم', selectedAsset.score, '/100']].map(([label, value, suffix]) => <div key={String(label)} className="mb-3"><div className="mb-1 flex items-center justify-between text-xs"><span className="text-gray-500">{label}</span><span className="font-black text-white tabular-nums">{Number(value).toFixed(String(label) === 'خصم/علاوة' ? 1 : 0)}{suffix}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, String(label) === 'خصم/علاوة' ? Math.abs(Number(value)) * 4 : Number(value)))}%` }} /></div></div>)}<div className="mt-4 flex flex-wrap gap-2">{selectedBadges.length > 0 ? selectedBadges.map(badge => <span key={badge.label} className={`rounded-lg border px-2 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>) : <span className="text-sm text-gray-500">لا توجد شارات خاصة حاليًا.</span>}</div></div><div className="mb-6 rounded-3xl border border-primary/15 bg-primary/5 p-5"><h3 className="mb-4 flex items-center gap-2 font-black text-white"><Zap size={18} className="text-primary" />تذكرة تداول سريعة</h3><label className="mb-2 block text-xs font-bold text-gray-500">الكمية</label><input type="number" min={1} value={tradeQuantity} onChange={(e) => setTradeQuantity(Math.max(1, Number(e.target.value || 1)))} className="mb-4 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /><div className="mb-4 rounded-2xl bg-black/20 p-4 text-sm"><div className="flex justify-between py-1"><span className="text-gray-500">سعر الوحدة</span><span className="font-bold text-white">{formatPrice(selectedAsset.marketPrice)}</span></div><div className="flex justify-between py-1"><span className="text-gray-500">إجمالي تقديري</span><span className="font-black text-primary">{formatPrice(estimatedTotal)}</span></div></div><div className="grid grid-cols-2 gap-3"><Link href={`/asset/${selectedAsset.id}`} className="rounded-2xl bg-primary px-4 py-3 text-center font-black text-black hover:bg-primary/90">شراء / بيع</Link><button type="button" onClick={() => toggleWatchlist(selectedAsset.id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white hover:bg-white/10">{watchlist.includes(selectedAsset.id) ? 'إزالة من قائمتي' : 'إضافة للمراقبة'}</button></div></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => toggleCompare(selectedAsset.id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white hover:bg-white/10">{compareIds.includes(selectedAsset.id) ? 'إزالة المقارنة' : 'قارن'}</button><Link href={`/asset/${selectedAsset.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black text-white hover:bg-white/10">فتح التفاصيل</Link></div></aside></div>}

      {compareAssets.length > 0 && <div className="fixed bottom-16 left-4 right-4 z-[70] mx-auto max-w-5xl rounded-3xl border border-primary/20 bg-[#07090d]/95 p-4 shadow-2xl backdrop-blur-xl"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black text-white">مقارنة الأصول</h3><button onClick={() => { setCompareIds([]); localStorage.removeItem('compareAssetIds'); }} className="text-xs font-bold text-gray-400 hover:text-white">مسح المقارنة</button></div><div className="grid gap-3 md:grid-cols-3">{compareAssets.map(asset => <button key={asset.id} onClick={() => setSelectedAsset(asset)} className="rounded-2xl border border-white/5 bg-surface p-3 text-right hover:border-primary/30"><div className="mb-3 flex items-center gap-2"><AssetImage image={asset.image} type={asset.type as 'TEAM' | 'PLAYER'} name={asset.name} width={34} height={34} className="h-9 w-9 rounded-xl object-cover" /><div><div className="font-black text-white">{asset.name}</div><div className="text-xs text-gray-500">{assetTypeLabel(asset)}</div></div></div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/5 p-2"><div className="text-gray-500">السعر</div><div className="font-bold text-white">{formatPrice(asset.marketPrice)}</div></div><div className="rounded-lg bg-white/5 p-2"><div className="text-gray-500">الزخم</div><div className="font-bold text-primary">{asset.momentum.toFixed(0)}</div></div></div></button>)}</div>{compareAssets.length >= 2 && <div className="mt-3 rounded-2xl border border-white/5 bg-white/5 p-3 text-sm text-gray-300"><CheckCircle2 className="ml-2 inline text-success" size={16} />{compareAssets[0].premiumDiscountPercent < compareAssets[1].premiumDiscountPercent ? `${compareAssets[0].name} أقل من قيمته العادلة مقارنة بـ ${compareAssets[1].name}.` : `${compareAssets[1].name} أقل من قيمته العادلة مقارنة بـ ${compareAssets[0].name}.`}</div>}</div>}
    </div>
  );
}
