'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Zap, TrendingUp, TrendingDown, Radio, Flame, Users, AlertTriangle } from 'lucide-react';

type TickerItemType = 'PRICE_UP' | 'PRICE_DOWN' | 'UNDERVALUED' | 'OVERVALUED' | 'HIGH_DEMAND' | 'HIGH_MOMENTUM' | 'MATCH_EVENT' | 'NEWS' | 'FALLBACK';

interface TickerData {
  id: string;
  type: TickerItemType;
  title: string;
  assetId?: string;
  assetName?: string;
  assetImage?: string;
  marketPrice?: number;
  changePercent?: number;
  premiumDiscountPercent?: number;
  momentum?: number;
  marketDemand?: number;
  matchId?: string;
}

export function GlobalTicker() {
  const router = useRouter();
  const [marketNews, setMarketNews] = useState<any[]>([]);
  const assets = (useStore(s => s.assets) || []) as any[];

  useEffect(() => {
    // Fetch generic Market News
    fetch('/api/market-news?limit=5')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMarketNews(data);
      })
      .catch(console.error);
  }, []);

  const tickerItems = useMemo(() => {
    const items: TickerData[] = [];

    // 1. Generate items from active assets
    if (assets.length > 0) {
      // Top Gainers (PRICE_UP)
      const gainers = [...assets].filter(a => (a.change || 0) > 0).sort((a, b) => b.change - a.change).slice(0, 2);
      gainers.forEach(a => items.push({
        id: `gainer-${a.id}`, type: 'PRICE_UP', title: 'زخم قوي وطلب متزايد',
        assetId: a.id, assetName: a.name, assetImage: a.image, marketPrice: a.marketPrice ?? a.current_price, changePercent: a.change
      }));

      // Top Losers (PRICE_DOWN)
      const losers = [...assets].filter(a => (a.change || 0) < 0).sort((a, b) => a.change - b.change).slice(0, 2);
      losers.forEach(a => items.push({
        id: `loser-${a.id}`, type: 'PRICE_DOWN', title: 'فرصة شراء بأسعار منخفضة',
        assetId: a.id, assetName: a.name, assetImage: a.image, marketPrice: a.marketPrice ?? a.current_price, changePercent: a.change
      }));

      // Undervalued
      const undervalued = [...assets].filter(a => (a.premiumDiscountPercent || 0) <= -10).slice(0, 2);
      undervalued.forEach(a => items.push({
        id: `under-${a.id}`, type: 'UNDERVALUED', title: `أقل من قيمته العادلة بـ ${Math.abs(a.premiumDiscountPercent || 0)}%`,
        assetId: a.id, assetName: a.name, assetImage: a.image, premiumDiscountPercent: a.premiumDiscountPercent
      }));

      // Overvalued
      const overvalued = [...assets].filter(a => (a.premiumDiscountPercent || 0) >= 15).slice(0, 1);
      overvalued.forEach(a => items.push({
        id: `over-${a.id}`, type: 'OVERVALUED', title: `أعلى من قيمته العادلة بـ ${Math.abs(a.premiumDiscountPercent || 0)}%`,
        assetId: a.id, assetName: a.name, assetImage: a.image, premiumDiscountPercent: a.premiumDiscountPercent
      }));

      // High Momentum
      const highMom = [...assets].filter(a => (a.momentum || 0) >= 70).slice(0, 2);
      highMom.forEach(a => items.push({
        id: `mom-${a.id}`, type: 'HIGH_MOMENTUM', title: `Momentum ${(a.momentum || 0).toFixed(0)}/100`,
        assetId: a.id, assetName: a.name, assetImage: a.image, momentum: a.momentum
      }));

      // High Demand
      const highDem = [...assets].filter(a => (a.marketDemand || 0) >= 70).slice(0, 2);
      highDem.forEach(a => items.push({
        id: `dem-${a.id}`, type: 'HIGH_DEMAND', title: `Demand ${(a.marketDemand || 0).toFixed(0)}/100`,
        assetId: a.id, assetName: a.name, assetImage: a.image, marketDemand: a.marketDemand
      }));
    }

    // 2. Add real market news
    marketNews.forEach(news => {
      items.push({
        id: `news-${news.id}`,
        type: 'NEWS',
        title: news.title || news.titleAr,
        assetId: news.asset?.id,
        assetName: news.asset?.name,
        assetImage: news.asset?.image,
        changePercent: news.changePercent ?? undefined
      });
    });

    // 3. Fallbacks if too few items
    if (items.length < 4) {
      items.push(
        { id: 'fallback-1', type: 'FALLBACK', title: 'مرحباً بك في MC PRIME Exchange — ابدأ بناء محفظتك الآن.' },
        { id: 'fallback-2', type: 'FALLBACK', title: 'جميع الكوينز افتراضية وتُستخدم داخل المنصة فقط.' },
        { id: 'fallback-3', type: 'FALLBACK', title: 'تابع السوق والمباريات لاكتشاف فرص التداول الافتراضي.' }
      );
    }

    // Shuffle items a bit so it's mixed well
    return items.sort(() => Math.random() - 0.5);
  }, [assets, marketNews]);

  // handleItemClick removed since we will use Link

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-t border-white/5 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] flex h-9 sm:h-11 overflow-hidden group">
      
      {/* Live Badge */}
      <div className="bg-primary/10 text-[#0FF0FC] px-4 sm:px-6 py-1.5 font-black text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shrink-0 border-r border-[#0FF0FC]/20 z-20 relative shadow-[5px_0_15px_rgba(15,240,252,0.15)]">
        <Radio size={14} className="animate-pulse" />
        <span className="hidden sm:inline tracking-wider">مباشر: MC PRIME Exchange</span>
        <span className="sm:hidden tracking-wider font-mono">LIVE MARKET</span>
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#0FF0FC]/50 to-transparent"></div>
      </div>
      
      {/* Scrolling Content */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        {/* Gradient overlays for smooth fade at edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none"></div>

        <div className="animate-marquee hover:[animation-play-state:paused] whitespace-nowrap flex gap-8 sm:gap-12 px-4 items-center h-full">
          {tickerItems.map((item, i) => (
            <TickerItemRenderer key={`${item.id}-${i}`} item={item} />
          ))}
          {/* Duplicate for infinite seamless scroll */}
          {tickerItems.map((item, i) => (
            <TickerItemRenderer key={`dup-${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerItemRenderer({ item }: { item: TickerData }) {
  let icon = null;
  let colorClass = 'text-gray-300';
  let badgeClass = '';

  switch (item.type) {
    case 'PRICE_UP':
      icon = <TrendingUp size={14} className="text-[#00FF88]" />;
      colorClass = 'text-[#00FF88]';
      badgeClass = 'bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/20';
      break;
    case 'PRICE_DOWN':
      icon = <TrendingDown size={14} className="text-[#FF3B5C]" />;
      colorClass = 'text-[#FF3B5C]';
      badgeClass = 'bg-[#FF3B5C]/10 text-[#FF3B5C] border-[#FF3B5C]/20';
      break;
    case 'UNDERVALUED':
      icon = <span className="text-[#0FF0FC]">💎</span>;
      colorClass = 'text-[#0FF0FC]';
      break;
    case 'OVERVALUED':
      icon = <AlertTriangle size={14} className="text-orange-400" />;
      colorClass = 'text-orange-400';
      break;
    case 'HIGH_DEMAND':
      icon = <Users size={14} className="text-[#FFD700]" />;
      colorClass = 'text-[#FFD700]';
      break;
    case 'HIGH_MOMENTUM':
      icon = <Flame size={14} className="text-[#0FF0FC]" />;
      colorClass = 'text-[#0FF0FC]';
      break;
    case 'MATCH_EVENT':
      icon = <span>⚽</span>;
      break;
    case 'NEWS':
      icon = <span>📰</span>;
      break;
    case 'FALLBACK':
      icon = <Zap size={14} className="text-gray-400" />;
      break;
  }

  const innerContent = (
    <>
      <div className="flex items-center gap-1.5">
        {icon}
        {item.assetImage && (
          <img src={item.assetImage} alt={item.assetName} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-white/10" />
        )}
        {item.assetName && (
          <span className="font-bold text-white tracking-wide">{item.assetName}</span>
        )}
      </div>

      {item.marketPrice != null && (
        <span className="font-mono font-bold text-white">{item.marketPrice}¢</span>
      )}

      {item.changePercent != null && (
        <span className={`font-mono text-[10px] sm:text-xs font-bold flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded border ${badgeClass}`}>
          <span dir="ltr">{item.changePercent > 0 ? '+' : ''}{item.changePercent}%</span>
        </span>
      )}

      <span className={`hidden sm:inline ${colorClass} font-medium`}>
        {item.title}
      </span>
      {/* Mobile condensed version */}
      <span className={`sm:hidden ${colorClass} font-medium max-w-[150px] truncate`}>
        {item.title}
      </span>

      <span className="text-white/10 mx-1 sm:mx-2">•</span>
    </>
  );

  const className = `flex items-center gap-2 sm:gap-3 text-xs sm:text-sm cursor-pointer hover:bg-white/5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors ${item.assetId || item.matchId ? 'hover:scale-105' : ''}`;

  if (item.assetId) {
    return <Link href={`/asset/${item.assetId}`} className={className}>{innerContent}</Link>;
  }
  if (item.matchId) {
    return <Link href={`/matches/${item.matchId}`} className={className}>{innerContent}</Link>;
  }

  return (
    <div className={className}>
      {innerContent}
    </div>
  );
}
