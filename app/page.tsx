'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { TrendingUp, TrendingDown, Users, Activity, Trophy, PlayCircle, ShieldCheck, Zap, Globe, ArrowLeftIcon, Newspaper, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/ui/Navbar';
import { getAllArticles } from '@/lib/articles';
import { motion } from 'framer-motion';

export default function Home() {
  const { assets, fetchAssets } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetchAssets();
    setMounted(true);
  }, [fetchAssets]);

  const sortedAssets = [...assets].sort((a, b) => b.change - a.change);
  const topGainer = sortedAssets[0];
  const topLoser = sortedAssets[sortedAssets.length - 1];
  
  const topArticle = getAllArticles()[0]; // Only need the top article for Bento
  
  const renderAvatar = (asset: any, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-sm',
      md: 'w-12 h-12 text-xl',
      lg: 'w-16 h-16 text-2xl'
    };
    
    if (asset?.image && asset.image.trim() !== '') return <span className="text-3xl">{asset.image}</span>;
    if (asset?.name) return <div className={`${sizeClasses[size]} rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/30 shrink-0`}>{asset.name.charAt(0)}</div>;
    return <span className="text-3xl">⚽</span>;
  };

  if (!mounted) return null; // Avoid hydration mismatch for motion and random stats

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 pb-20">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none z-0" />
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[150px] pointer-events-none z-0" />
      
      <Navbar />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(140px,auto)]">
          
          {/* 1. HERO BLOCK (2x2) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="md:col-span-2 md:row-span-2 bg-surface border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between shadow-card group"
          >
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-primary/10 to-transparent opacity-50 z-0 pointer-events-none transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border border-white/5 text-xs text-gray-300 mb-6">
                <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                الموسم قد بدأ
              </div>
              <h1 className="text-4xl lg:text-5xl font-black mb-4 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
                بورصة المونديال<br/> <span className="text-white">بين يديك</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-sm mb-8">
                تداول أسهم المنتخبات، راقب تحركات السوق مع كل هدف، وتصدر الترتيب العالمي.
              </p>
            </div>
            <div className="relative z-10 flex flex-wrap gap-3">
              <Link href="/market" className="px-6 py-3 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light hover:-translate-y-0.5 transition-all shadow-anti-gravity flex items-center gap-2">
                <TrendingUp size={18} /> ادخل السوق
              </Link>
              <Link href="/leaderboard" className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-sm hover:bg-white/10 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                <Trophy size={18} className="text-accent" /> الترتيب
              </Link>
            </div>
          </motion.div>

          {/* 2. TOP GAINER (1x1) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-1 row-span-1 bg-surface border border-success/20 rounded-3xl p-5 flex flex-col justify-between shadow-card hover:border-success/40 transition-colors relative overflow-hidden"
          >
            <div className="absolute -bottom-4 -left-4 text-success/5 rotate-[-15deg] pointer-events-none">
              <TrendingUp size={100} />
            </div>
            <div className="flex justify-between items-start z-10">
              <span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold flex items-center gap-1">سهم محلق</span>
              {renderAvatar(topGainer, 'sm')}
            </div>
            <div className="z-10 mt-4">
              <h3 className="font-bold text-white truncate text-lg">{topGainer?.name || '---'}</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black tabular-nums">{topGainer?.current_price || '0.00'}</span>
                <span className="text-xs text-gray-500">¢</span>
                <span className="text-success text-xs font-bold tabular-nums ml-auto">+{topGainer?.change}%</span>
              </div>
            </div>
          </motion.div>

          {/* 3. TOP LOSER (1x1) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-1 row-span-1 bg-surface border border-danger/20 rounded-3xl p-5 flex flex-col justify-between shadow-card hover:border-danger/40 transition-colors relative overflow-hidden"
          >
            <div className="absolute -bottom-4 -left-4 text-danger/5 rotate-[-15deg] pointer-events-none">
              <TrendingDown size={100} />
            </div>
            <div className="flex justify-between items-start z-10">
              <span className="bg-danger/10 text-danger px-2 py-1 rounded text-xs font-bold flex items-center gap-1">فرصة شراء</span>
              {renderAvatar(topLoser, 'sm')}
            </div>
            <div className="z-10 mt-4">
              <h3 className="font-bold text-white truncate text-lg">{topLoser?.name || '---'}</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black tabular-nums">{topLoser?.current_price || '0.00'}</span>
                <span className="text-xs text-gray-500">¢</span>
                <span className="text-danger text-xs font-bold tabular-nums ml-auto">{topLoser?.change}%</span>
              </div>
            </div>
          </motion.div>

          {/* 4. TOP ARTICLE (1x2) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="col-span-1 md:row-span-2 bg-surface border border-white/5 rounded-3xl relative overflow-hidden group shadow-card"
          >
            <Link href={`/article/${topArticle.id}`} className="block w-full h-full">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
              <img 
                src={topArticle.imageUrl} 
                alt={topArticle.title}
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="relative z-20 h-full p-5 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="bg-primary/90 text-white px-2 py-1 rounded text-xs font-bold">مقال مميز</span>
                  <div className="bg-background/80 backdrop-blur p-1.5 rounded-full text-white/50 group-hover:text-white transition-colors">
                    <ArrowLeftIcon size={14} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-primary transition-colors">
                    {topArticle.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {topArticle.excerpt}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* 5. CTA BLOCK (1x1) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="col-span-1 row-span-1 bg-gradient-to-br from-primary to-primary-light rounded-3xl p-5 flex flex-col justify-center items-center text-center shadow-anti-gravity group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="relative z-10 w-full">
              <h3 className="font-black text-white text-xl mb-1">انضم للمنافسة</h3>
              <p className="text-white/80 text-xs mb-4">أنشئ محفظتك الآن مجاناً</p>
              <Link href="/register" className="block w-full bg-white text-primary font-bold py-2.5 rounded-xl text-sm hover:scale-[1.02] transition-transform">
                سجل الآن
              </Link>
            </div>
          </motion.div>

          {/* 6. MARKET STATS (2x1) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="md:col-span-2 row-span-1 bg-surface border border-white/5 rounded-3xl p-5 shadow-card flex items-center justify-around"
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-gray-400 text-xs">
                <Users size={14} /> المتداولين
              </div>
              <div className="text-2xl font-black tabular-nums">250K+</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-gray-400 text-xs">
                <Activity size={14} className="text-primary" /> حجم التداول
              </div>
              <div className="text-2xl font-black tabular-nums">15.2M</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-gray-400 text-xs">
                <Zap size={14} className="text-accent" /> المكافآت
              </div>
              <div className="text-2xl font-black tabular-nums">50K+</div>
            </div>
          </motion.div>

          {/* 7. FEATURE 1: DYNAMIC MARKET (1x1) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="col-span-1 row-span-1 bg-surface border border-white/5 rounded-3xl p-5 shadow-card hover:border-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-primary mb-3">
              <Activity size={20} />
            </div>
            <h3 className="font-bold text-sm mb-1">سوق حي 100%</h3>
            <p className="text-xs text-gray-500 leading-relaxed">الأسعار تتفاعل مع أداء اللاعبين في أرض الملعب.</p>
          </motion.div>

          {/* 8. HOW TO PLAY (2x1) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="md:col-span-2 row-span-1 bg-surface border border-white/5 rounded-3xl p-5 shadow-card flex flex-col justify-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-3xl z-0 pointer-events-none" />
            <div className="flex items-center justify-between mb-4 z-10">
              <h3 className="font-bold">ابدأ في 4 خطوات</h3>
              <Link href="/articles" className="text-xs text-primary hover:text-primary-light flex items-center gap-1">الدليل الكامل <ChevronRight size={12} /></Link>
            </div>
            <div className="flex justify-between items-center z-10 w-full relative">
              <div className="absolute top-1/2 right-4 left-4 h-px bg-white/10 -translate-y-1/2 z-0" />
              {[
                { label: "اكتشف", icon: <Globe size={16} /> },
                { label: "اشترِ", icon: <ShieldCheck size={16} /> },
                { label: "راقب", icon: <PlayCircle size={16} /> },
                { label: "اربح", icon: <Trophy size={16} /> }
              ].map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center gap-2 group">
                  <div className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:border-primary/50 transition-colors">
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">{step.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* 9. WHY PLATFORM (2x1) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="md:col-span-2 row-span-1 bg-surface border border-white/5 rounded-3xl p-5 shadow-card flex items-center gap-4"
          >
            <div className="flex-1">
              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-accent mb-3">
                <Trophy size={20} />
              </div>
              <h3 className="font-bold text-sm mb-1">تنافس وتصدر</h3>
              <p className="text-xs text-gray-500 leading-relaxed">تحدى أصدقائك في دوريات خاصة أو تصدر اللائحة العالمية.</p>
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="flex-1 pl-2">
              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-white mb-3">
                <Newspaper size={20} />
              </div>
              <h3 className="font-bold text-sm mb-1">تحليلات مستمرة</h3>
              <p className="text-xs text-gray-500 leading-relaxed">نصائح ومقالات يومية تساعدك في بناء المحفظة.</p>
            </div>
          </motion.div>

        </div>
      </div>
    </main>
  );
}
