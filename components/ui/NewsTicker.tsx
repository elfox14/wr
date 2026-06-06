'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { TrendingUp, TrendingDown, Globe } from 'lucide-react';
import Link from 'next/link';

export function NewsTicker() {
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (data.news) {
          setNews(data.news);
        }
      })
      .catch(err => console.error('Error fetching news:', err));
  }, []);

  if (news.length === 0) return null;

  return (
    <div className="w-full bg-[#0F0F0F] border-b border-white/5 overflow-hidden flex items-center h-12 text-sm sticky top-16 z-40">
      <div className="bg-[#0FF0FC] text-black font-bold px-4 h-full flex items-center z-10 whitespace-nowrap shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
        أخبار السوق
      </div>
      
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <style>{`
          @keyframes ticker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-ticker {
            display: inline-block;
            white-space: nowrap;
            animation: ticker 40s linear infinite;
            padding-right: 50px;
          }
          .animate-ticker:hover {
            animation-play-state: paused;
          }
        `}</style>
        <div className="animate-ticker w-full">
          {news.map((item, i) => (
            <div key={item.id + i} className="inline-flex items-center gap-2 mx-8 text-gray-300 hover:text-white transition-colors">
              {item.type === 'market_up' && <TrendingUp size={16} className="text-green-500" />}
              {item.type === 'market_down' && <TrendingDown size={16} className="text-red-500" />}
              {item.type === 'external' && <Globe size={16} className="text-blue-400" />}
              
              {item.link ? (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  <span className="font-bold ml-1 text-white">{item.source}:</span> {item.title}
                </a>
              ) : (
                <Link href="/news" className="hover:underline">
                  <span className="font-bold ml-1 text-white">{item.source}:</span> {item.title}
                </Link>
              )}
              
              <span className="text-white/20 mx-4">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
