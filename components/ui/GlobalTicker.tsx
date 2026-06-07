'use client';

import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Radio } from 'lucide-react';

export function GlobalTicker() {
  const [marketNews, setMarketNews] = useState<any[]>([]);

  useEffect(() => {
    // Fetch Market News
    fetch('/api/market-news?limit=10')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMarketNews(data);
      })
      .catch(console.error);
  }, []);

  if (marketNews.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] flex h-10 sm:h-12 overflow-hidden group">
      
      {/* Live Badge */}
      <div className="bg-gradient-to-r from-primary/20 to-transparent text-primary px-4 sm:px-6 py-2 font-black text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shrink-0 border-r border-primary/20 z-10 relative shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
        <Radio size={16} className="animate-pulse" />
        <span className="hidden sm:inline tracking-wider">مباشر: بورصة المونديال</span>
        <span className="sm:hidden tracking-wider">مباشر</span>
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-primary/50 to-transparent"></div>
      </div>
      
      {/* Scrolling Content */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        {/* Gradient overlays for smooth fade at edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-background/90 to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-background/90 to-transparent z-10 pointer-events-none"></div>

        <div className="animate-marquee hover:[animation-play-state:paused] whitespace-nowrap flex gap-8 sm:gap-12 px-4 items-center h-full">
          {marketNews.map((news, i) => (
            <TickerItem key={`${news.id}-${i}`} news={news} />
          ))}
          {/* Duplicate for infinite seamless scroll */}
          {marketNews.map((news, i) => (
            <TickerItem key={`dup-${news.id}-${i}`} news={news} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerItem({ news }: { news: any }) {
  const isPositive = news.changePercent >= 0;
  
  return (
    <div className="flex items-center gap-3 text-sm cursor-pointer hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors">
      <span className="text-lg sm:text-xl drop-shadow-md">{news.asset?.image || '⚽'}</span>
      <span className="font-bold text-gray-200 hover:text-white transition-colors text-xs sm:text-sm">
        {news.title || news.titleAr}
      </span>
      {news.changePercent != null && (
        <span 
          className={`font-mono text-[10px] sm:text-xs font-bold flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md border ${
            isPositive 
              ? 'bg-success/10 text-success border-success/20 shadow-[0_0_10px_rgba(22,163,74,0.15)]' 
              : 'bg-danger/10 text-danger border-danger/20 shadow-[0_0_10px_rgba(220,38,38,0.15)]'
          }`}
        >
          {isPositive ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
          <span dir="ltr">{Math.abs(news.changePercent)}%</span>
        </span>
      )}
      <span className="text-white/10 mx-2 hidden sm:inline">•</span>
    </div>
  );
}
