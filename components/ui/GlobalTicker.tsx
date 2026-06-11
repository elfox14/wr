'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Zap, TrendingUp, TrendingDown, Radio, Flame, Users, AlertTriangle } from 'lucide-react';

type TickerItemType = 'PRICE_UP' | 'PRICE_DOWN' | 'UNDERVALUED' | 'OVERVALUED' | 'HIGH_DEMAND' | 'HIGH_MOMENTUM' | 'MATCH_EVENT' | 'NEWS' | 'FALLBACK';

interface TickerData {
  id: string;
  type: TickerItemType;
  title: string;
  body?: string;
  assetId?: string;
  assetName?: string;
  assetImage?: string;
  marketPrice?: number;
  changePercent?: number;
  premiumDiscountPercent?: number;
  momentum?: number;
  marketDemand?: number;
  matchId?: string;
  href?: string;
  timestamp?: string;
  source?: string;
}

function fallbackItems(): TickerData[] {
  return [
    { id: 'fallback-1', type: 'FALLBACK', title: 'مرحباً بك في MC PRIME Exchange — تابع السوق والمباريات مباشرة.' },
    { id: 'fallback-2', type: 'FALLBACK', title: 'الأسعار تتحرك مع التداول وأحداث المباراة داخل المنصة.' },
    { id: 'fallback-3', type: 'FALLBACK', title: 'جميع الكوينز افتراضية وتُستخدم داخل المنصة فقط.' },
  ];
}

export function GlobalTicker() {
  const [tickerItems, setTickerItems] = useState<TickerData[]>(fallbackItems);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTicker() {
      try {
        const res = await fetch('/api/live-ticker?limit=28', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const items = Array.isArray(data?.items) && data.items.length > 0 ? data.items : fallbackItems();
        setTickerItems(items);
        setUpdatedAt(data?.updatedAt || null);
      } catch (error) {
        console.error('Global ticker fetch failed:', error);
      }
    }

    fetchTicker();
    const timer = window.setInterval(fetchTicker, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const marqueeItems = useMemo(() => {
    const items = tickerItems.length >= 4 ? tickerItems : [...tickerItems, ...fallbackItems()];
    return items.slice(0, 32);
  }, [tickerItems]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-t border-white/5 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] flex h-9 sm:h-11 overflow-hidden group">
      <div className="bg-primary/10 text-[#0FF0FC] px-4 sm:px-6 py-1.5 font-black text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shrink-0 border-r border-[#0FF0FC]/20 z-20 relative shadow-[5px_0_15px_rgba(15,240,252,0.15)]" title={updatedAt ? `آخر تحديث: ${new Date(updatedAt).toLocaleTimeString('ar-EG')}` : undefined}>
        <Radio size={14} className="animate-pulse" />
        <span className="hidden sm:inline tracking-wider">مباشر: أخبار السوق والمباريات</span>
        <span className="sm:hidden tracking-wider font-mono">LIVE NEWS</span>
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#0FF0FC]/50 to-transparent"></div>
      </div>

      <div className="flex-1 overflow-hidden relative flex items-center">
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none"></div>

        <div className="animate-marquee hover:[animation-play-state:paused] whitespace-nowrap flex gap-8 sm:gap-12 px-4 items-center h-full">
          {marqueeItems.map((item, i) => (
            <TickerItemRenderer key={`${item.id}-${i}`} item={item} />
          ))}
          {marqueeItems.map((item, i) => (
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
  let badgeClass = 'bg-white/5 text-gray-300 border-white/10';

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
      colorClass = 'text-[#FFD700]';
      badgeClass = 'bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/20';
      break;
    case 'NEWS':
      icon = <span>📰</span>;
      break;
    case 'FALLBACK':
      icon = <Zap size={14} className="text-gray-400" />;
      break;
  }

  const displayHref = item.href || (item.assetId ? `/asset/${item.assetId}` : item.matchId ? '/matches' : undefined);

  const innerContent = (
    <>
      <div className="flex items-center gap-1.5">
        {icon}
        {item.assetImage && (
          <img src={item.assetImage} alt={item.assetName || 'asset'} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-white/10" />
        )}
        {item.assetName && (
          <span className="font-bold text-white tracking-wide">{item.assetName}</span>
        )}
      </div>

      {item.marketPrice != null && (
        <span className="font-mono font-bold text-white">{Math.round(item.marketPrice)}¢</span>
      )}

      {item.changePercent != null && Math.abs(Number(item.changePercent)) > 0 && (
        <span className={`font-mono text-[10px] sm:text-xs font-bold flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded border ${badgeClass}`}>
          <span dir="ltr">{Number(item.changePercent) > 0 ? '+' : ''}{Math.round(Number(item.changePercent) * 10) / 10}%</span>
        </span>
      )}

      <span className={`hidden sm:inline ${colorClass} font-medium`}>
        {item.title}
      </span>
      <span className={`sm:hidden ${colorClass} font-medium max-w-[180px] truncate`}>
        {item.title}
      </span>

      <span className="text-white/10 mx-1 sm:mx-2">•</span>
    </>
  );

  const className = `flex items-center gap-2 sm:gap-3 text-xs sm:text-sm cursor-pointer hover:bg-white/5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors ${displayHref ? 'hover:scale-105' : ''}`;

  if (displayHref) {
    return <Link href={displayHref} className={className}>{innerContent}</Link>;
  }

  return <div className={className}>{innerContent}</div>;
}
