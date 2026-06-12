'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, Flame, Radio, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';

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
    { id: 'fallback-1', type: 'FALLBACK', source: 'fallback', title: 'مرحباً بك في MC PRIME Exchange — تابع السوق والمباريات مباشرة.' },
    { id: 'fallback-2', type: 'FALLBACK', source: 'fallback', title: 'الأسعار تتحرك مع التداول وأحداث المباراة داخل المنصة.' },
    { id: 'fallback-3', type: 'FALLBACK', source: 'fallback', title: 'جميع الكوينز افتراضية وتُستخدم داخل المنصة فقط.' },
  ];
}

function getTickerSection(item: TickerData) {
  if (item.source === 'live_match') return { label: 'مباشر', className: 'border-red-400/30 bg-red-500/15 text-red-200' };
  if (item.source === 'finished_match') return { label: 'آخر نتيجة', className: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100' };
  if (item.source === 'upcoming_match') return { label: 'قادم', className: 'border-[#0FF0FC]/30 bg-[#0FF0FC]/10 text-[#0FF0FC]' };
  if (item.source === 'market_news' && item.type === 'MATCH_EVENT') return { label: 'حدث مباراة', className: 'border-[#FFD700]/35 bg-[#FFD700]/12 text-[#FFD700]' };
  if (item.source === 'market_news') return { label: 'خبر سوق', className: 'border-white/15 bg-white/5 text-gray-200' };
  if (item.source === 'price_history') return { label: 'تحرك سعر', className: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/8 text-[#0FF0FC]' };
  return { label: 'تنبيه', className: 'border-white/10 bg-white/5 text-gray-300' };
}

export function GlobalTicker() {
  const [tickerItems, setTickerItems] = useState<TickerData[]>(fallbackItems);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTicker() {
      try {
        const res = await fetch('/api/live-ticker?limit=36', { cache: 'no-store' });
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
    const timer = window.setInterval(fetchTicker, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const speedPxPerSecond = 12;

    function tick(now: number) {
      const el = scrollerRef.current;
      if (!last) last = now;
      const delta = now - last;
      last = now;

      if (el && !isPaused) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 8) {
          el.scrollLeft += (delta / 1000) * speedPxPerSecond;
          if (el.scrollLeft >= maxScroll - 2) el.scrollLeft = 0;
        }
      }

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isPaused]);

  const marqueeItems = useMemo(() => {
    const items = tickerItems.length >= 4 ? tickerItems : [...tickerItems, ...fallbackItems()];
    return items.slice(0, 36);
  }, [tickerItems]);

  function scrollTicker(direction: -1 | 1) {
    setIsPaused(true);
    scrollerRef.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
    window.setTimeout(() => setIsPaused(false), 2500);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-11 overflow-hidden border-t border-white/5 bg-[#050505]/92 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:h-12">
      <div className="relative z-20 flex shrink-0 items-center gap-2 border-r border-[#0FF0FC]/20 bg-primary/10 px-3 py-1.5 text-xs font-black text-[#0FF0FC] shadow-[5px_0_15px_rgba(15,240,252,0.15)] sm:px-5 sm:text-sm" title={updatedAt ? `آخر تحديث: ${new Date(updatedAt).toLocaleTimeString('ar-EG')}` : undefined}>
        <Radio size={14} className="animate-pulse" />
        <span className="hidden tracking-wider lg:inline">مباشر: أخبار ونتائج</span>
        <span className="tracking-wider font-mono lg:hidden">LIVE</span>
        <div className="absolute bottom-0 right-0 top-0 w-[1px] bg-gradient-to-b from-transparent via-[#0FF0FC]/50 to-transparent" />
      </div>

      <div className="relative z-20 flex shrink-0 items-center gap-1 border-r border-white/5 bg-black/25 px-1.5">
        <button
          type="button"
          onClick={() => scrollTicker(-1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-200 hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"
          aria-label="الرجوع في شريط الأخبار"
          title="رجوع"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => scrollTicker(1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-200 hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"
          aria-label="التقديم في شريط الأخبار"
          title="تقديم"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center overflow-hidden">
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-[#050505] to-transparent sm:w-16" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-[#050505] to-transparent sm:w-16" />

        <div
          ref={scrollerRef}
          dir="ltr"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="mobile-scrollbar h-full flex-1 overflow-x-auto overflow-y-hidden scroll-smooth px-3"
        >
          <div className="flex h-full min-w-max items-center gap-3 py-1">
            {marqueeItems.map((item, i) => (
              <TickerItemRenderer key={`${item.id}-${i}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TickerItemRenderer({ item }: { item: TickerData }) {
  let icon = null;
  let colorClass = 'text-gray-300';
  let badgeClass = 'bg-white/5 text-gray-300 border-white/10';
  const section = getTickerSection(item);

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

  const displayHref = item.href || (item.assetId ? `/asset/${item.assetId}` : item.matchId ? '/live' : undefined);

  const innerContent = (
    <>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black leading-none ${section.className}`}>
        {section.label}
      </span>

      <span className="h-5 w-[1px] shrink-0 bg-white/10" />

      <div className="flex items-center gap-1.5" dir="rtl">
        {icon}
        {item.assetImage && (
          <img src={item.assetImage} alt={item.assetName || 'asset'} className="h-4 w-4 rounded-full border border-white/10 object-cover sm:h-5 sm:w-5" />
        )}
        {item.assetName && (
          <span className="font-bold tracking-wide text-white">{item.assetName}</span>
        )}
      </div>

      {item.marketPrice != null && (
        <span className="font-mono font-bold text-white">{Math.round(item.marketPrice)}¢</span>
      )}

      {item.changePercent != null && Math.abs(Number(item.changePercent)) > 0 && (
        <span className={`flex items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-[10px] font-bold sm:px-1.5 sm:text-xs ${badgeClass}`}>
          <span dir="ltr">{Number(item.changePercent) > 0 ? '+' : ''}{Math.round(Number(item.changePercent) * 10) / 10}%</span>
        </span>
      )}

      <span className={`hidden font-medium sm:inline ${colorClass}`} dir="rtl">
        {item.title}
      </span>
      <span className={`max-w-[220px] truncate font-medium sm:hidden ${colorClass}`} dir="rtl">
        {item.title}
      </span>
    </>
  );

  const className = `flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-1.5 text-xs transition-colors hover:bg-white/6 sm:gap-3 sm:text-sm ${displayHref ? 'hover:scale-[1.01]' : ''}`;

  if (displayHref) {
    return <Link href={displayHref} className={className}>{innerContent}</Link>;
  }

  return <div className={className}>{innerContent}</div>;
}
