"use client";

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Globe, Newspaper, ArrowUpRight, Flame } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  type: string;
  link?: string;
  date: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (data.news) {
          setNews(data.news);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const marketNews = news.filter(n => n.type === 'market_up' || n.type === 'market_down');
  const externalNews = news.filter(n => n.type === 'external');

  return (
    <div className="min-h-screen bg-[#121212] text-white">
            
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-10 border-b border-white/10 pb-6">
          <div className="p-3 bg-[#0FF0FC]/10 rounded-xl">
            <Newspaper size={32} className="text-[#0FF0FC]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white">أخبار السوق والبطولة</h1>
            <p className="text-gray-400 mt-1">تغطية حصرية لتحركات الأسهم وآخر أحداث كرة القدم</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">جاري تحميل الأخبار...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Market Movers Column */}
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Flame className="text-[#FFD700]" /> حركة السوق الداخلية
              </h2>
              
              {marketNews.length === 0 ? (
                <div className="bg-[#1A1A1A] p-6 rounded-3xl border border-white/5 text-center text-gray-500">
                  لا توجد حركات قوية في السوق حالياً.
                </div>
              ) : (
                marketNews.map((item) => (
                  <div key={item.id} className="bg-gradient-to-br from-[#1A1A1A] to-[#111] p-6 rounded-3xl border border-white/5 hover:border-white/20 transition-all shadow-lg group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] opacity-20 pointer-events-none ${item.type === 'market_up' ? 'bg-green-500' : 'bg-red-500'}`} />
                    
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${item.type === 'market_up' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {item.type === 'market_up' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      </div>
                      <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full">{item.source}</span>
                    </div>
                    
                    <h3 className="text-lg font-bold leading-tight mb-2 group-hover:text-[#0FF0FC] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500">{new Date(item.date).toLocaleTimeString('ar-SA')} - اليوم</p>
                  </div>
                ))
              )}
            </div>

            {/* External News Grid */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Globe className="text-[#0FF0FC]" /> آخر الأخبار الرياضية
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {externalNews.map((item) => (
                  <a 
                    key={item.id} 
                    href={item.link || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#1A1A1A] p-6 rounded-3xl border border-white/5 hover:border-[#0FF0FC]/30 hover:bg-white/5 transition-all flex flex-col h-full group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-[#0FF0FC] bg-[#0FF0FC]/10 px-3 py-1 rounded-full font-bold">
                          {item.source}
                        </span>
                        <ArrowUpRight size={16} className="text-gray-500 group-hover:text-[#0FF0FC] transition-colors" />
                      </div>
                      <h3 className="text-lg font-bold leading-relaxed mb-4 group-hover:text-white text-gray-200">
                        {item.title}
                      </h3>
                    </div>
                    <div className="mt-auto pt-4 border-t border-white/5 text-xs text-gray-500">
                      {new Date(item.date).toLocaleString('ar-SA')}
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
