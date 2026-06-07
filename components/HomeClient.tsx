'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  TrendingUp, TrendingDown, Users, Activity, Trophy,
  PlayCircle, ShieldCheck, Zap, Globe, Newspaper,
  ChevronRight, Crown, Medal, Award
} from 'lucide-react';
import { getAllArticles } from '@/lib/articles';
import { AssetImage } from '@/components/ui/AssetImage';

export default function HomeClient({ initialAssets }: { initialAssets: any[] }) {
  // Sync the server-fetched assets into our global store silently if needed,
  // but we use initialAssets directly for rendering to avoid hydration mismatch.
  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
  }, [initialAssets]);

  const sortedAssets = [...initialAssets].sort((a, b) => (b.change || 0) - (a.change || 0));
  const topGainer = sortedAssets[0];
  const topLoser  = sortedAssets[sortedAssets.length - 1];
  const topArticle = getAllArticles()[0];

  // Mock leaderboard top 3 — replace with real data later
  const top3 = [
    { rank: 1, name: 'أبو خالد', profit: '+42.3%', icon: <Crown size={16} className="text-accent" /> },
    { rank: 2, name: 'سارة م.', profit: '+38.1%', icon: <Medal size={16} className="text-gray-300" /> },
    { rank: 3, name: 'محمد ع.', profit: '+31.7%', icon: <Award size={16} className="text-amber-600" /> },
  ];

  const renderAvatar = (asset: any) => {
    if (!asset) return <span className="text-2xl">⚽</span>;
    return <AssetImage image={asset.image} name={asset.name} type={asset.type} width={40} height={40} className="w-10 h-10 rounded-full bg-surface object-cover shrink-0" />;
  };

  return (
    <>
      
      <main className="home-grid">

        {/* ── TICKER ── */}
        <div className="bento-ticker">
          {/* Ticker is rendered globally from layout.tsx — this is a grid placeholder */}
        </div>

        {/* ── HERO ── */}
        <section className="bento-hero relative p-8 flex flex-col justify-between">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/60 border border-white/5 text-xs text-gray-300 mb-5">
              <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
              السوق مفتوح الآن
            </div>
            <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">بورصة المونديال</span>
              <br />
              <span className="text-white">بين يديك</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-md mb-6">
              تداول أسهم المنتخبات واللاعبين، راقب تحركات السوق مع كل هدف، وتصدّر الترتيب العالمي.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3">
            <Link href="/market" className="px-6 py-3 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-colors shadow-anti-gravity inline-flex items-center gap-2">
              <TrendingUp size={18} /> ادخل السوق
            </Link>
            <Link href="/register" className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-sm hover:bg-white/10 transition-colors inline-flex items-center gap-2">
              أنشئ حسابك مجاناً
            </Link>
          </div>
        </section>

        {/* ── TOP MOVER ── */}
        <aside className="bento-top-mover p-5 flex flex-col justify-between relative">
          <div className="absolute -bottom-6 -left-6 text-success/[0.04] pointer-events-none rotate-[-15deg]">
            <TrendingUp size={120} />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="bg-success/10 text-success px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
              <TrendingUp size={12} /> سهم محلق
            </span>
            {renderAvatar(topGainer)}
          </div>
          <div className="mt-auto pt-4 relative z-10">
            <h3 className="font-bold text-white text-lg truncate">{topGainer?.name || '---'}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black tabular-nums">{topGainer?.current_price || '0.00'}</span>
              <span className="text-xs text-gray-500">¢</span>
              {topGainer && topGainer.change !== 0 && (
                <span className="text-success text-xs font-bold tabular-nums mr-auto">+{topGainer.change}%</span>
              )}
            </div>
          </div>
        </aside>

        {/* ── BUY CHANCE ── */}
        <aside className="bento-buy-chance p-5 flex flex-col justify-between relative">
          <div className="absolute -bottom-6 -left-6 text-danger/[0.04] pointer-events-none rotate-[-15deg]">
            <TrendingDown size={120} />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="bg-danger/10 text-danger px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
              <TrendingDown size={12} /> فرصة شراء
            </span>
            {renderAvatar(topLoser)}
          </div>
          <div className="mt-auto pt-4 relative z-10">
            <h3 className="font-bold text-white text-lg truncate">{topLoser?.name || '---'}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black tabular-nums">{topLoser?.current_price || '0.00'}</span>
              <span className="text-xs text-gray-500">¢</span>
              {topLoser && topLoser.change !== 0 && (
                <span className="text-danger text-xs font-bold tabular-nums mr-auto">{topLoser?.change || 0}%</span>
              )}
            </div>
          </div>
        </aside>

        {/* ── MARKET STATS ── */}
        <section className="bento-market-stats p-6 flex items-center justify-around">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 text-gray-400 text-xs">
              <Users size={14} /> المتداولين
            </div>
            <div className="text-2xl font-black tabular-nums">250K<span className="text-sm text-gray-500">+</span></div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 text-gray-400 text-xs">
              <Activity size={14} className="text-primary" /> حجم التداول
            </div>
            <div className="text-2xl font-black tabular-nums">15.2M</div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 text-gray-400 text-xs">
              <Zap size={14} className="text-accent" /> الأصول المتاحة
            </div>
            <div className="text-2xl font-black tabular-nums">{initialAssets.length || '48'}</div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="bento-how-it-works p-6 flex flex-col justify-center relative">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/[0.04] blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-5 relative z-10">
            <h3 className="font-bold text-base">ابدأ في 4 خطوات</h3>
            <Link href="/articles" className="text-xs text-primary hover:text-primary-light inline-flex items-center gap-0.5 transition-colors">
              الدليل الكامل <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex justify-between items-start relative z-10">
            {[
              { label: 'اكتشف السوق', icon: <Globe size={18} />, num: '01' },
              { label: 'ابنِ محفظتك', icon: <ShieldCheck size={18} />, num: '02' },
              { label: 'راقب المباريات', icon: <PlayCircle size={18} />, num: '03' },
              { label: 'اجنِ الأرباح', icon: <Trophy size={18} />, num: '04' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-2 group flex-1">
                <div className="w-11 h-11 rounded-full bg-background border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:border-primary/40 transition-colors">
                  {step.icon}
                </div>
                <span className="text-[10px] font-bold text-gray-500 tracking-wider">{step.num}</span>
                <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors text-center leading-tight">{step.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURED ARTICLE ── */}
        <section className="bento-featured-article relative group">
          <Link href={`/article/${topArticle.id}`} className="block w-full h-full">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />
            <img
              src={topArticle.imageUrl}
              alt={topArticle.title}
              className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="relative z-20 h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="bg-primary text-white px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                  <Newspaper size={12} /> تحليل مميز
                </span>
                <span className="bg-background/60 backdrop-blur-sm text-white/70 px-2 py-0.5 rounded text-[10px] font-bold border border-white/10">
                  {topArticle.category}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors">
                  {topArticle.title}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">
                  {topArticle.excerpt}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span>{topArticle.author}</span>
                  <span>•</span>
                  <span>{new Date(topArticle.date).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* ── WHY US ── */}
        <section className="bento-why-us p-5 flex flex-col justify-between">
          <h3 className="font-bold text-sm mb-4">لماذا المنصة؟</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Activity size={15} className="text-primary" />
              </div>
              <div>
                <h4 className="text-xs font-bold mb-0.5">سوق حي</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">الأسعار تتفاعل مع كل هدف ولحظة حاسمة.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Trophy size={15} className="text-accent" />
              </div>
              <div>
                <h4 className="text-xs font-bold mb-0.5">تنافس عالمي</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">نافس آلاف المتداولين وتصدّر لوحة الشرف.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Newspaper size={15} className="text-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold mb-0.5">تحليلات يومية</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">مقالات حصرية تساعدك في بناء محفظتك.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── LEADERBOARD (Top 3) ── */}
        <section className="bento-leaderboard p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">أفضل المستثمرين</h3>
            <Link href="/leaderboard" className="text-[11px] text-primary hover:text-primary-light inline-flex items-center gap-0.5 transition-colors">
              الكل <ChevronRight size={11} />
            </Link>
          </div>
          <div className="space-y-3">
            {top3.map((user) => (
              <div key={user.rank} className="flex items-center gap-3 bg-background/40 rounded-xl px-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                  {user.icon}
                </div>
                <span className="text-sm font-bold flex-1 truncate">{user.name}</span>
                <span className="text-xs font-bold text-success tabular-nums">{user.profit}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bento-cta relative p-8 flex items-center justify-between bg-gradient-to-l from-primary to-primary-light !border-none">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">لا تكتفِ بالمشاهدة.</h2>
            <p className="text-white/70 text-sm">انضم لآلاف المتداولين وابدأ ببناء محفظتك الآن — مجاناً.</p>
          </div>
          <Link href="/register" className="relative z-10 px-8 py-3.5 bg-white text-primary font-bold rounded-xl text-sm hover:scale-[1.03] transition-transform shadow-lg shrink-0">
            ابدأ الآن
          </Link>
        </section>

        {/* ── FOOTER ── */}
        <footer className="bento-footer py-6 text-center text-gray-600 text-sm">
          <p className="font-bold text-gray-500 mb-1">WorldCup Exchange © 2026</p>
          <p className="text-xs max-w-xl mx-auto">منصة ترفيهية تفاعلية. جميع الأرقام والأصول افتراضية ولا تمثل تداولاً حقيقياً بأموال واقعية.</p>
        </footer>

      </main>
    </>
  );
}
