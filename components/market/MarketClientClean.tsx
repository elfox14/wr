'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Brain, Search, Star, TrendingUp, Users } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { PageHeader } from '@/components/ui/PageHeader';
import { useStore } from '@/lib/store';
import type { MarketClientProps, ProcessedMarketAsset } from './market-client-types';

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function formatPrice(value: number) {
  return `${Math.round(value || 0).toLocaleString()}¢`;
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

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return processedAssets;
    return processedAssets.filter((asset) => [asset.name, asset.code, asset.position || '', asset.club || '', asset.group || ''].join(' ').toLowerCase().includes(q));
  }, [processedAssets, searchQuery]);

  const opportunities = useMemo(
    () => [...processedAssets]
      .filter((asset) => asset.premiumDiscountPercent <= -5 || asset.momentum >= 70 || asset.marketDemand >= 70)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 6),
    [processedAssets],
  );

  const topGainer = useMemo(
    () => [...processedAssets].sort((a, b) => b.change - a.change).find((asset) => asset.change > 0) || null,
    [processedAssets],
  );

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      window.localStorage.setItem('watchlistAssetIds', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="مركز قيادة السوق"
          description="راقب السوق، اكتشف الفرص، وقارن بين السعر الحالي والقيمة العادلة باستخدام بيانات المنصة."
          icon={<TrendingUp size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-surface/80 p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary"><Users size={18} /> المستخدمون</div>
            <div className="text-2xl font-black text-white">{usersCount.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-surface/80 p-4 shadow-card">
            <div className="mb-2 text-sm font-bold text-success">حجم التداول اليوم</div>
            <div className="text-2xl font-black text-white">{formatCompactNumber(todayVolume)}¢</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-surface/80 p-4 shadow-card">
            <div className="mb-2 text-sm font-bold text-accent">صفقات اليوم</div>
            <div className="text-2xl font-black text-white">{todayTradesCount.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-surface/80 p-4 shadow-card">
            <div className="mb-2 text-sm font-bold text-yellow-300">الأصول</div>
            <div className="text-2xl font-black text-white">{(assetsCount || processedAssets.length).toLocaleString()}</div>
            <div className="mt-1 text-xs text-gray-500">{teamsCount} منتخبات · {playersCount} لاعبين</div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">فرص السوق الآن</h2>
                <p className="mt-1 text-sm text-gray-500">أفضل الأصول حسب القيمة العادلة والزخم والطلب.</p>
              </div>
              <Brain className="text-primary" size={24} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {opportunities.map((asset) => (
                <Link key={asset.id} href={`/asset/${asset.id}`} className="rounded-2xl border border-white/5 bg-background/40 p-4 transition hover:border-primary/30">
                  <div className="mb-3 flex items-center gap-3">
                    <AssetImage image={asset.image} type={asset.type === 'TEAM' ? 'TEAM' : 'PLAYER'} name={asset.name} width={44} height={44} className="h-12 w-12 rounded-xl border border-white/10 object-cover" />
                    <div className="min-w-0">
                      <div className="truncate font-black text-white">{asset.name}</div>
                      <div className="text-xs text-gray-500">{assetTypeLabel(asset)} · {asset.code}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">السعر</div><div className="font-black text-white">{formatPrice(asset.marketPrice)}</div></div>
                    <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">العادلة</div><div className="font-black text-white">{formatPrice(asset.fairValue)}</div></div>
                    <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">الفرق</div><div className={asset.premiumDiscountPercent <= 0 ? 'font-black text-success' : 'font-black text-danger'}>{asset.premiumDiscountPercent.toFixed(1)}%</div></div>
                    <div className="rounded-xl bg-white/5 p-2"><div className="text-gray-500">الفرصة</div><div className="font-black text-primary">{asset.opportunityScore.toFixed(1)}</div></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
            <h2 className="mb-4 text-xl font-black text-white">المباراة القادمة</h2>
            {nextMatch ? (
              <Link href={`/matches/${nextMatch.id}`} className="block rounded-2xl border border-white/5 bg-background/40 p-4 hover:border-primary/30">
                <div className="mb-3 text-xs font-bold text-accent" dir="ltr">{nextMatchDate ? new Date(nextMatchDate).toLocaleString() : 'TBD'}</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-center text-sm font-black text-white">{nextMatch.homeTeam?.name || 'Home'}</div>
                  <div className="text-xs font-black text-gray-500">VS</div>
                  <div className="text-center text-sm font-black text-white">{nextMatch.awayTeam?.name || 'Away'}</div>
                </div>
              </Link>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">لا توجد مباريات مجدولة.</p>
            )}
            {topGainer && (
              <Link href={`/asset/${topGainer.id}`} className="mt-4 block rounded-2xl border border-success/20 bg-success/10 p-4 hover:border-success/40">
                <div className="mb-1 text-xs font-bold text-success">أعلى صعود</div>
                <div className="font-black text-white">{topGainer.name}</div>
                <div className="text-xs text-gray-400">+{topGainer.change.toFixed(1)}%</div>
              </Link>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/5 bg-surface p-4 shadow-card">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ابحث عن منتخب أو لاعب..."
              className="w-full rounded-2xl border border-white/10 bg-background py-3 pr-11 pl-4 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredAssets.map((asset) => {
            const isWatched = watchlist.includes(asset.id);
            return (
              <div key={asset.id} className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card transition hover:border-primary/40">
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
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500">السعر الحالي</p>
                    <p className="text-2xl font-black text-white">{formatPrice(asset.marketPrice)}</p>
                  </div>
                  <Link href={`/asset/${asset.id}`} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:bg-primary/20">
                    فتح <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
