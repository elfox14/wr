"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, Clock, Newspaper, Radio, TrendingDown, TrendingUp } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  body?: string;
  source: string;
  category?: 'match' | 'trading' | 'platform';
  type: string;
  link?: string;
  date: string;
  assetName?: string;
  assetImage?: string;
  marketPrice?: number;
  changePercent?: number;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

function NewsCard({ item }: { item: NewsItem }) {
  const isTrading = item.category === 'trading';
  const isMatch = item.category === 'match';
  const positive = Number(item.changePercent || 0) >= 0;
  const Icon = isMatch ? Radio : positive ? TrendingUp : TrendingDown;
  const accent = isMatch ? 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/20' : positive ? 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/20' : 'text-[#FF3B5C] bg-[#FF3B5C]/10 border-[#FF3B5C]/20';

  const content = (
    <article className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#151515] p-5 transition-all hover:border-[#0FF0FC]/30 hover:bg-white/[0.04]">
      <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full blur-[80px] opacity-25 ${isMatch ? 'bg-yellow-400' : positive ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl border p-2 ${accent}`}>
            <Icon size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-[#0FF0FC]">{item.source}</span>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
              <Clock size={12} />
              {formatDate(item.date)}
            </div>
          </div>
        </div>
        {item.link && <ArrowUpRight size={16} className="text-gray-500 transition-colors group-hover:text-[#0FF0FC]" />}
      </div>

      <h3 className="relative mt-4 text-base font-black leading-7 text-white transition-colors group-hover:text-[#0FF0FC]">
        {item.title}
      </h3>

      {item.body && <p className="relative mt-3 line-clamp-3 text-sm leading-6 text-gray-400">{item.body}</p>}

      {(item.assetName || item.marketPrice != null || item.changePercent != null) && (
        <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4 text-xs">
          {item.assetName && <span className="rounded-full bg-white/5 px-3 py-1 font-bold text-white">{item.assetName}</span>}
          {item.marketPrice != null && <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-white">{Math.round(item.marketPrice)}¢</span>}
          {item.changePercent != null && Math.abs(Number(item.changePercent)) > 0 && (
            <span className={`rounded-full border px-3 py-1 font-mono font-bold ${accent}`} dir="ltr">
              {Number(item.changePercent) > 0 ? '+' : ''}{Math.round(Number(item.changePercent) * 10) / 10}%
            </span>
          )}
        </div>
      )}
    </article>
  );

  if (!item.link) return content;
  return <Link href={item.link}>{content}</Link>;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/news', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setNews(Array.isArray(data.news) ? data.news : []);
        setUpdatedAt(data.updatedAt || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const matchNews = useMemo(() => news.filter((item) => item.category === 'match'), [news]);
  const tradingNews = useMemo(() => news.filter((item) => item.category === 'trading'), [news]);
  const platformNews = useMemo(() => news.filter((item) => item.category === 'platform' || (!item.category && item.type === 'info')), [news]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/8 bg-gradient-to-br from-[#111] via-[#0A0A0A] to-black p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-bold text-[#0FF0FC]">
                <Newspaper size={15} /> مركز الأخبار
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">أخبار المباريات والتداول</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">
                صفحة منفصلة تجمع أخبار الأهداف والمباريات بعيدًا عن أخبار التداول وحركة الأسعار داخل بورصة المونديال.
              </p>
            </div>
            {updatedAt && <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">آخر تحديث: {formatDate(updatedAt)}</div>}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-white/5 bg-[#111] p-10 text-center text-gray-500">جاري تحميل الأخبار...</div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <section className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-black"><Radio className="text-[#FFD700]" /> أخبار المباريات والأهداف</h2>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">{matchNews.length} خبر</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {matchNews.length ? matchNews.map((item) => <NewsCard key={item.id} item={item} />) : (
                  <div className="rounded-3xl border border-white/5 bg-[#111] p-8 text-center text-gray-500 md:col-span-2">لا توجد أخبار مباريات حاليًا.</div>
                )}
              </div>
            </section>

            <aside className="space-y-8">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-black"><Activity className="text-[#0FF0FC]" /> أخبار التداول</h2>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">{tradingNews.length} خبر</span>
                </div>
                <div className="space-y-4">
                  {tradingNews.length ? tradingNews.map((item) => <NewsCard key={item.id} item={item} />) : (
                    <div className="rounded-3xl border border-white/5 bg-[#111] p-8 text-center text-gray-500">لا توجد أخبار تداول حاليًا.</div>
                  )}
                </div>
              </section>

              {platformNews.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Newspaper className="text-gray-300" /> تنبيهات المنصة</h2>
                  <div className="space-y-4">
                    {platformNews.map((item) => <NewsCard key={item.id} item={item} />)}
                  </div>
                </section>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
