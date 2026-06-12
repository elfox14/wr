'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Radio, Zap } from 'lucide-react';

type TickerItemType = 'MATCH_EVENT' | 'FALLBACK';

interface TickerData {
  id: string;
  type: TickerItemType;
  title: string;
  body?: string;
  matchId?: string;
  href?: string;
  timestamp?: string;
  source?: 'live_match' | 'finished_match' | 'upcoming_match' | 'match_event' | 'fallback' | string;
}

function fallbackItems(): TickerData[] {
  return [
    { id: 'fallback-1', type: 'FALLBACK', source: 'fallback', title: 'شريط المباريات يعرض الأحداث والنتائج فقط.' },
    { id: 'fallback-2', type: 'FALLBACK', source: 'fallback', title: 'لا توجد أحداث مباشرة الآن — تابع بث الانيميشن عند بدء المباراة.' },
    { id: 'fallback-3', type: 'FALLBACK', source: 'fallback', title: 'الأهداف والنتائج ستظهر هنا فور توفرها من مصادر المباراة.' },
  ];
}

function getTickerSection(item: TickerData) {
  if (item.source === 'live_match') return { label: 'مباشر', className: 'border-red-400/30 bg-red-500/15 text-red-200' };
  if (item.source === 'match_event') return { label: 'حدث مباراة', className: 'border-[#FFD700]/35 bg-[#FFD700]/12 text-[#FFD700]' };
  if (item.source === 'finished_match') return { label: 'آخر نتيجة', className: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100' };
  if (item.source === 'upcoming_match') return { label: 'قادم', className: 'border-[#0FF0FC]/30 bg-[#0FF0FC]/10 text-[#0FF0FC]' };
  return { label: 'مباريات', className: 'border-white/10 bg-white/5 text-gray-300' };
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
      <div className="relative z-20 flex shrink-0 items-center gap-2 border-r border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1.5 text-xs font-black text-[#FFD700] shadow-[5px_0_15px_rgba(255,215,0,0.1)] sm:px-5 sm:text-sm" title={updatedAt ? `آخر تحديث: ${new Date(updatedAt).toLocaleTimeString('ar-EG')}` : undefined}>
        <Radio size={14} className="animate-pulse" />
        <span className="hidden tracking-wider lg:inline">مباريات مباشرة</span>
        <span className="tracking-wider font-mono lg:hidden">LIVE</span>
        <div className="absolute bottom-0 right-0 top-0 w-[1px] bg-gradient-to-b from-transparent via-[#FFD700]/50 to-transparent" />
      </div>

      <div className="relative z-20 flex shrink-0 items-center gap-1 border-r border-white/5 bg-black/25 px-1.5">
        <button
          type="button"
          onClick={() => scrollTicker(-1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-200 hover:border-[#FFD700]/40 hover:text-[#FFD700]"
          aria-label="الرجوع في شريط المباريات"
          title="رجوع"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => scrollTicker(1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-200 hover:border-[#FFD700]/40 hover:text-[#FFD700]"
          aria-label="التقديم في شريط المباريات"
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
  const section = getTickerSection(item);
  const icon = item.source === 'fallback' ? <Zap size={14} className="text-gray-400" /> : <span>⚽</span>;
  const colorClass = item.source === 'live_match' ? 'text-red-100' : item.source === 'finished_match' ? 'text-emerald-100' : item.source === 'upcoming_match' ? 'text-[#0FF0FC]' : 'text-[#FFD700]';
  const displayHref = item.href || (item.matchId ? '/animation-live' : undefined);

  const innerContent = (
    <>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black leading-none ${section.className}`}>
        {section.label}
      </span>

      <span className="h-5 w-[1px] shrink-0 bg-white/10" />

      <div className="flex items-center gap-1.5" dir="rtl">
        {icon}
      </div>

      <span className={`hidden font-medium sm:inline ${colorClass}`} dir="rtl">
        {item.title}
      </span>
      <span className={`max-w-[240px] truncate font-medium sm:hidden ${colorClass}`} dir="rtl">
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
