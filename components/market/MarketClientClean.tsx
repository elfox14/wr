'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Gauge,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import { useStore } from '@/lib/store';
import type { MarketClientProps, MarketSmartFilter, ProcessedMarketAsset } from './market-client-types';

type AssetTypeFilter = 'ALL' | 'TEAM' | 'PLAYER';

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function formatPrice(value: number) {
  return `${Math.round(value || 0).toLocaleString()}¢`;
}

function formatMatchDate(value?: string | null) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function assetTypeLabel(asset: ProcessedMarketAsset) {
  return asset.type === 'TEAM' ? 'منتخب' : 'لاعب';
}

function normalizeAsset(asset: ProcessedMarketAsset): ProcessedMarketAsset {
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

  return {
    ...asset,
    marketPrice,
    fairValue,
    premiumDiscountPercent,
    opportunityScore,
    momentum,
    marketDemand,
    volatilityScore,
    score,
    ownersCount,
    change,
  };
}

function analysisVerdict(asset: ProcessedMarketAsset) {
  if (asset.premiumDiscountPercent <= -10 && asset.momentum >= 65) return 'فرصة تحليلية قوية';
  if (asset.momentum >= 75) return 'زخم مرتفع يحتاج متابعة';
  if (asset.marketDemand >= 75) return 'طلب جماهيري قوي';
  if (asset.volatilityScore >= 75) return 'مخاطرة عالية';
  if (asset.premiumDiscountPercent > 12) return 'سعر أعلى من القيمة';
  return 'مراقبة هادئة';
}

function riskLabel(asset: ProcessedMarketAsset) {
  if (asset.volatilityScore >= 75) return { label: 'عالية', className: 'text-danger bg-danger/10 border-danger/20' };
  if (asset.volatilityScore >= 50) return { label: 'متوسطة', className: 'text-warning bg-warning/10 border-warning/20' };
  return { label: 'منخفضة', className: 'text-success bg-success/10 border-success/20' };
}

function metricBar(value: number, tone = 'bg-primary') {
  const safeValue = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export default function MarketClientClean({
  usersCount = 0,
  todayVolume = 0,
  todayTradesCount = 0,
  assetsCount = 0,
  teamsCount = 0,
  playersCount = 0,
  nextMatchDate = null,
  nextMatch = null,
}: MarketClientProps) {
  const { assets, fetchAssets } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>('ALL');
  const [smartFilter, setSmartFilter] = useState<MarketSmartFilter>('ALL');
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem('watchlistAssetIds');
      return saved ? JSON.parse(saved) as string[] : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const processedAssets = useMemo(
    () => assets.map((asset) => normalizeAsset(asset as ProcessedMarketAsset)),
    [assets],
  );

  const visibleTeamsCount = processedAssets.filter((asset) => asset.type === 'TEAM').length;
  const visiblePlayersCount = processedAssets.filter((asset) => asset.type === 'PLAYER').length;

  const opportunities = useMemo(
    () => [...processedAssets]
      .filter((asset) => asset.premiumDiscountPercent <= -5 || asset.momentum >= 70 || asset.marketDemand >= 70)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 8),
    [processedAssets],
  );

  const topGainer = useMemo(
    () => [...processedAssets].sort((a, b) => b.change - a.change).find((asset) => asset.change > 0) || null,
    [processedAssets],
  );

  const strongestMomentum = useMemo(
    () => [...processedAssets].sort((a, b) => b.momentum - a.momentum)[0] || null,
    [processedAssets],
  );

  const bestDiscount = useMemo(
    () => [...processedAssets].sort((a, b) => a.premiumDiscountPercent - b.premiumDiscountPercent)[0] || null,
    [processedAssets],
  );

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return processedAssets
      .filter((asset) => {
        const matchesType = typeFilter === 'ALL' || asset.type === typeFilter;
        const matchesQuery = !q || [asset.name, asset.code, asset.position || '', asset.club || '', asset.group || '', asset.continent || ''].join(' ').toLowerCase().includes(q);
        const matchesSmartFilter =
          smartFilter === 'ALL' ||
          (smartFilter === 'UNDERVALUED' && asset.premiumDiscountPercent <= -5) ||
          (smartFilter === 'HIGH_MOMENTUM' && asset.momentum >= 70) ||
          (smartFilter === 'HIGH_DEMAND' && asset.marketDemand >= 70) ||
          (smartFilter === 'LOW_RISK' && asset.volatilityScore <= 45) ||
          (smartFilter === 'TOP_GAINERS' && asset.change > 0) ||
          (smartFilter === 'TOP_LOSERS' && asset.change < 0) ||
          (smartFilter === 'BLUE_CHIPS' && asset.score >= 75 && asset.volatilityScore <= 55) ||
          (smartFilter === 'SPECULATIVE' && asset.volatilityScore >= 70);
        return matchesType && matchesQuery && matchesSmartFilter;
      })
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [processedAssets, searchQuery, smartFilter, typeFilter]);

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      window.localStorage.setItem('watchlistAssetIds', JSON.stringify(next));
      return next;
    });
  };

  const typeTabs: { id: AssetTypeFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'كل الأصول', count: processedAssets.length },
    { id: 'TEAM', label: 'المنتخبات', count: visibleTeamsCount || teamsCount },
    { id: 'PLAYER', label: 'اللاعبون', count: visiblePlayersCount || playersCount },
  ];

  const smartFilters: { id: MarketSmartFilter; label: string }[] = [
    { id: 'ALL', label: 'كل الفرص' },
    { id: 'UNDERVALUED', label: 'أقل من القيمة' },
    { id: 'HIGH_MOMENTUM', label: 'زخم قوي' },
    { id: 'HIGH_DEMAND', label: 'طلب مرتفع' },
    { id: 'LOW_RISK', label: 'مخاطرة أقل' },
    { id: 'BLUE_CHIPS', label: 'أصول قوية' },
    { id: 'SPECULATIVE', label: 'مضاربة عالية' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="غرفة عمليات السوق الرياضي"
          description="حلّل المنتخبات واللاعبين قبل القرار: السعر، القيمة العادلة، الزخم، الطلب، المخاطرة، وتأثير المباريات القادمة."
          icon={<Brain size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        <section className="mb-8 overflow-hidden rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-5 shadow-anti-gravity lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                <Sparkles size={14} /> Football Intelligence Exchange
              </p>
              <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">
                السوق هنا نتيجة للتحليل… وليس مجرد أسعار متحركة
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
                استخدم لوحة الفرص لاكتشاف الأصول الأقل من قيمتها، أصحاب الزخم العالي، والمنتخبات أو اللاعبين المتأثرين بالمباريات القادمة قبل أي تداول افتراضي.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-primary"><Users size={18} /> المستخدمون</div>
                <div className="text-3xl font-black text-white">{usersCount.toLocaleString()}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 text-sm font-black text-success">حجم التداول اليوم</div>
                <div className="text-3xl font-black text-white">{formatCompactNumber(todayVolume)}¢</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 text-sm font-black text-accent">صفقات اليوم</div>
                <div className="text-3xl font-black text-white">{todayTradesCount.toLocaleString()}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 text-sm font-black text-yellow-300">الأصول</div>
                <div className="text-3xl font-black text-white">{(assetsCount || processedAssets.length).toLocaleString()}</div>
                <div className="mt-1 text-xs text-gray-500">{teamsCount || visibleTeamsCount} منتخبات · {playersCount || visiblePlayersCount} لاعبين</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-[1.7rem] border border-accent/20 bg-[linear-gradient(135deg,rgba(255,215,0,0.12),rgba(15,240,252,0.06))] p-5 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-black text-accent">قبل قراءة الفرص</p>
                <h2 className="text-xl font-black text-white">افهم التسعير قبل أي تداول افتراضي</h2>
                <p className="mt-1 max-w-3xl text-sm leading-7 text-gray-300">
                  تعرف على الفرق بين السعر الحالي والقيمة العادلة، ولماذا يتحرك الأصل بسبب الأداء، الطلب، الشعبية، إرث المونديال، والزخم.
                </p>
              </div>
            </div>
            <Link href="/methodology" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-black text-black transition hover:bg-accent/90">
              افتح منهجية التسعير <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-3">
          <Link href={strongestMomentum ? `/asset/${strongestMomentum.id}` : '/market'} className="rounded-3xl border border-primary/15 bg-primary/10 p-5 shadow-card transition hover:border-primary/35">
            <div className="mb-3 flex items-center justify-between text-primary"><Zap size={22} /><span className="text-xs font-black">LIVE PULSE</span></div>
            <p className="text-sm text-gray-400">أقوى زخم حاليًا</p>
            <h2 className="mt-1 truncate text-2xl font-black text-white">{strongestMomentum?.name || 'غير متاح'}</h2>
            <p className="mt-2 text-sm font-black text-primary">Momentum {Math.round(strongestMomentum?.momentum || 0)}/100</p>
          </Link>

          <Link href={bestDiscount ? `/asset/${bestDiscount.id}` : '/market'} className="rounded-3xl border border-success/15 bg-success/10 p-5 shadow-card transition hover:border-success/35">
            <div className="mb-3 flex items-center justify-between text-success"><Target size={22} /><span className="text-xs font-black">VALUE GAP</span></div>
            <p className="text-sm text-gray-400">أكبر خصم عن القيمة العادلة</p>
            <h2 className="mt-1 truncate text-2xl font-black text-white">{bestDiscount?.name || 'غير متاح'}</h2>
            <p className="mt-2 text-sm font-black text-success">{bestDiscount ? `${bestDiscount.premiumDiscountPercent.toFixed(1)}%` : '—'}</p>
          </Link>

          <div className="rounded-3xl border border-accent/15 bg-accent/10 p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between text-accent"><CalendarDays size={22} /><span className="text-xs font-black">NEXT IMPACT</span></div>
            <p className="text-sm text-gray-400">المباراة المؤثرة القادمة</p>
            {nextMatch ? (
              <Link href={`/matches/${nextMatch.id}`} className="mt-1 block">
                <h2 className="truncate text-2xl font-black text-white">{nextMatch.homeTeam?.name || 'Home'} × {nextMatch.awayTeam?.name || 'Away'}</h2>
                <p className="mt-2 text-sm font-black text-accent" dir="ltr">{formatMatchDate(nextMatchDate)}</p>
              </Link>
            ) : (
              <p className="mt-2 text-sm text-gray-500">لا توجد مباريات مجدولة.</p>
            )}
          </div>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card lg:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-black text-primary">OPPORTUNITY BOARD</p>
                <h2 className="text-2xl font-black text-white">لوحة الفرص التحليلية</h2>
                <p className="mt-1 text-sm text-gray-500">مرتبة حسب الخصم عن القيمة، الزخم، الطلب، وانخفاض المخاطرة.</p>
              </div>
              <Gauge className="text-primary" size={28} />
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-right">الأصل</th>
                    <th className="px-3 py-2 text-center">السعر</th>
                    <th className="px-3 py-2 text-center">القيمة</th>
                    <th className="px-3 py-2 text-center">الفرق</th>
                    <th className="px-3 py-2 text-center">زخم</th>
                    <th className="px-3 py-2 text-center">طلب</th>
                    <th className="px-3 py-2 text-center">الحكم</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((asset) => (
                    <tr key={asset.id} className="group">
                      <td className="rounded-r-2xl border-y border-r border-white/5 bg-black/25 px-3 py-3">
                        <Link href={`/asset/${asset.id}`} className="flex min-w-0 items-center gap-3">
                          <AssetImage image={asset.image} type={asset.type === 'TEAM' ? 'TEAM' : 'PLAYER'} name={asset.name} width={42} height={42} className="h-11 w-11 rounded-2xl border border-white/10 object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-black text-white group-hover:text-primary">{asset.name}</p>
                            <p className="text-xs text-gray-500">{assetTypeLabel(asset)} · {asset.code}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="border-y border-white/5 bg-black/25 px-3 py-3 text-center font-black text-white">{formatPrice(asset.marketPrice)}</td>
                      <td className="border-y border-white/5 bg-black/25 px-3 py-3 text-center font-black text-gray-300">{formatPrice(asset.fairValue)}</td>
                      <td className={`border-y border-white/5 bg-black/25 px-3 py-3 text-center font-black ${asset.premiumDiscountPercent <= 0 ? 'text-success' : 'text-danger'}`}>{asset.premiumDiscountPercent.toFixed(1)}%</td>
                      <td className="border-y border-white/5 bg-black/25 px-3 py-3 text-center text-primary">{Math.round(asset.momentum)}</td>
                      <td className="border-y border-white/5 bg-black/25 px-3 py-3 text-center text-accent">{Math.round(asset.marketDemand)}</td>
                      <td className="rounded-l-2xl border-y border-l border-white/5 bg-black/25 px-3 py-3 text-center">
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">{analysisVerdict(asset)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card lg:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs font-black text-accent">PRE-TRADE ANALYSIS</p>
                <h2 className="text-2xl font-black text-white">تحليل قبل القرار</h2>
              </div>
              <ShieldCheck className="text-accent" size={28} />
            </div>
            <div className="space-y-3 text-sm leading-7 text-gray-300">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="font-black text-white">لا تعتمد على السعر فقط.</p>
                <p className="mt-1 text-xs text-gray-400">القرار الأفضل داخل المنصة يبدأ من مقارنة السعر الحالي بالقيمة العادلة، ثم قراءة الزخم والطلب والمباراة القادمة.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-primary/15 bg-primary/10 p-4">
                  <p className="text-xs text-primary">قاعدة ذكية</p>
                  <p className="mt-1 font-black text-white">خصم + زخم = فرصة</p>
                </div>
                <div className="rounded-2xl border border-danger/15 bg-danger/10 p-4">
                  <p className="text-xs text-danger">تحذير</p>
                  <p className="mt-1 font-black text-white">تذبذب عالٍ = مخاطرة</p>
                </div>
              </div>
              {topGainer && (
                <Link href={`/asset/${topGainer.id}`} className="block rounded-2xl border border-success/20 bg-success/10 p-4 hover:border-success/40">
                  <div className="mb-1 text-xs font-bold text-success">أعلى صعود خلال 24h</div>
                  <div className="font-black text-white">{topGainer.name}</div>
                  <div className="text-xs text-gray-400">+{topGainer.change.toFixed(1)}%</div>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/5 bg-surface p-4 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><SlidersHorizontal size={17} className="text-primary" /> فلاتر غرفة العمليات</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {typeTabs.map((tab) => {
              const selected = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`rounded-2xl px-4 py-2 text-xs font-black transition ${selected ? 'bg-primary text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                >
                  {tab.label} <span className="opacity-70">{tab.count}</span>
                </button>
              );
            })}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {smartFilters.map((filter) => {
              const selected = smartFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSmartFilter(filter.id)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${selected ? 'border-accent/40 bg-accent/15 text-accent' : 'border-white/10 bg-white/5 text-gray-400 hover:border-primary/30 hover:text-primary'}`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ابحث عن منتخب، لاعب، مركز، مجموعة، أو قارة..."
              className="w-full rounded-2xl border border-white/10 bg-background py-3 pr-11 pl-4 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredAssets.map((asset) => {
            const isWatched = watchlist.includes(asset.id);
            const risk = riskLabel(asset);
            return (
              <div key={asset.id} className="pro-card pro-interactive rounded-3xl p-5">
                <div className="relative z-10">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <Link href={`/asset/${asset.id}`} className="flex min-w-0 items-center gap-3">
                      <AssetImage image={asset.image} type={asset.type === 'TEAM' ? 'TEAM' : 'PLAYER'} name={asset.name} width={54} height={54} className="h-14 w-14 rounded-2xl border border-white/10 bg-background/60 object-cover" />
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-bold text-gray-400">{assetTypeLabel(asset)}</div>
                        <h3 className="truncate text-lg font-black text-white">{asset.name}</h3>
                        <p className="text-xs text-gray-500">{asset.code}</p>
                      </div>
                    </Link>
                    <button type="button" onClick={() => toggleWatchlist(asset.id)} className="rounded-xl bg-black/30 p-2 transition hover:bg-white/10">
                      <Star size={16} className={isWatched ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'} />
                    </button>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl bg-black/25 p-3">
                      <p className="text-gray-500">السعر</p>
                      <p className="text-lg font-black text-white">{formatPrice(asset.marketPrice)}</p>
                    </div>
                    <div className="rounded-2xl bg-black/25 p-3">
                      <p className="text-gray-500">القيمة</p>
                      <p className="text-lg font-black text-white">{formatPrice(asset.fairValue)}</p>
                    </div>
                    <div className="rounded-2xl bg-black/25 p-3">
                      <p className="text-gray-500">الزخم</p>
                      <p className="font-black text-primary">{Math.round(asset.momentum)}/100</p>
                      {metricBar(asset.momentum, 'bg-primary')}
                    </div>
                    <div className="rounded-2xl bg-black/25 p-3">
                      <p className="text-gray-500">الطلب</p>
                      <p className="font-black text-accent">{Math.round(asset.marketDemand)}/100</p>
                      {metricBar(asset.marketDemand, 'bg-accent')}
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${asset.premiumDiscountPercent <= 0 ? 'border-success/20 bg-success/10 text-success' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                      فرق القيمة {asset.premiumDiscountPercent.toFixed(1)}%
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${risk.className}`}>
                      مخاطرة {risk.label}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-[11px] font-black text-primary">لماذا يظهر هنا؟</p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">{analysisVerdict(asset)} · فرصة {asset.opportunityScore.toFixed(1)}/100</p>
                  </div>

                  <Link href={`/asset/${asset.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-3 text-xs font-black text-primary hover:bg-primary hover:text-black">
                    افتح ملف التحليل <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </section>

        {filteredAssets.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-surface p-8 text-center text-sm text-gray-500">
            لا توجد أصول مطابقة. جرّب تغيير الفلتر الذكي أو البحث.
          </div>
        )}
      </main>
    </div>
  );
}
