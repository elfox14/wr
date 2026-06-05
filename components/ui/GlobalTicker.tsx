'use client';

import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';

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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A] border-t border-[#0FF0FC]/20 flex shadow-[0_-5px_15px_rgba(15,240,252,0.1)]">
      <div className="bg-[#0FF0FC]/10 text-[#0FF0FC] px-4 py-2 font-bold flex items-center gap-2 whitespace-nowrap shrink-0 border-l border-[#0FF0FC]/20 z-10 relative">
        <Zap size={16} className="animate-pulse" />
        <span className="hidden sm:inline">مباشر: السوق الآن</span>
        <span className="sm:hidden">السوق</span>
      </div>
      <div className="flex-1 overflow-hidden relative flex items-center">
        <div className="animate-marquee whitespace-nowrap flex gap-10 px-4">
          {marketNews.map((news, i) => (
            <div key={`${news.id}-${i}`} className="flex items-center gap-3 text-sm">
              <span className="text-xl">{news.asset?.image || '⚽'}</span>
              <span className="font-bold text-gray-300">{news.title || news.titleAr}</span>
              {news.changePercent && (
                <span className={`font-mono text-xs flex items-center gap-1 px-2 py-0.5 rounded ${news.changePercent >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {news.changePercent >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                  {Math.abs(news.changePercent)}%
                </span>
              )}
            </div>
          ))}
          {/* Duplicate for infinite seamless scroll */}
          {marketNews.map((news, i) => (
            <div key={`dup-${news.id}-${i}`} className="flex items-center gap-3 text-sm">
              <span className="text-xl">{news.asset?.image || '⚽'}</span>
              <span className="font-bold text-gray-300">{news.title || news.titleAr}</span>
              {news.changePercent && (
                <span className={`font-mono text-xs flex items-center gap-1 px-2 py-0.5 rounded ${news.changePercent >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {news.changePercent >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                  {Math.abs(news.changePercent)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
