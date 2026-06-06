'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { TrendingUp, TrendingDown, Users, Activity, Trophy, PlayCircle, ShieldCheck, Zap, Globe, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Newspaper } from 'lucide-react';
import { Navbar } from '@/components/ui/Navbar';
import { getAllArticles } from '@/lib/articles';
import { motion } from 'framer-motion';

export default function Home() {
  const { assets, fetchAssets } = useStore();

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const sortedAssets = [...assets].sort((a, b) => b.change - a.change);
  const topGainer = sortedAssets[0];
  const topLoser = sortedAssets[sortedAssets.length - 1];

  const blogArticles = getAllArticles().slice(0, 3);

  const features = [
    {
      title: "سوق حيّ وديناميكي",
      description: "تتحرك الأسعار لحظة بلحظة بناءً على الأداء الحقيقي للاعبين والمنتخبات في المباريات لتعكس واقع الميدان.",
      icon: <Activity size={32} />
    },
    {
      title: "تداول افتراضي ممتع",
      description: "قم بشراء وبيع الأسهم الافتراضية، واختبر قدراتك التحليلية وقراءتك لواقع كرة القدم بدون أي مخاطر حقيقية.",
      icon: <TrendingUp size={32} />
    },
    {
      title: "بيانات وتحليلات فورية",
      description: "أدوات متطورة ومقالات تحليلية يومية تساعدك على اتخاذ أفضل القرارات في بناء محفظتك الاستثمارية.",
      icon: <Zap size={32} />
    },
    {
      title: "تنافس على الصدارة",
      description: "قارن أرباحك وتداولاتك مع مئات الآلاف من المتداولين حول العالم واصعد للقمة في لوحة الشرف.",
      icon: <Trophy size={32} />
    }
  ];

  const steps = [
    {
      title: "اكتشف السوق",
      desc: "تصفح قائمة واسعة من المنتخبات وأبرز اللاعبين المشاركين.",
      num: "01",
      icon: <Globe size={28} className="text-[#0FF0FC] mb-2" />
    },
    {
      title: "ابنِ محفظتك",
      desc: "اختر أصولك بعناية وقم بشرائها بالسعر الحالي للسوق.",
      num: "02",
      icon: <ShieldCheck size={28} className="text-[#0FF0FC] mb-2" />
    },
    {
      title: "راقب المباريات",
      desc: "شاهد كيف ترتفع أسهمك مع كل هدف أو تمريرة حاسمة.",
      num: "03",
      icon: <PlayCircle size={28} className="text-[#0FF0FC] mb-2" />
    },
    {
      title: "اجنِ الأرباح",
      desc: "بع أسهمك في الوقت المناسب ونافس على المركز الأول.",
      num: "04",
      icon: <Trophy size={28} className="text-[#0FF0FC] mb-2" />
    }
  ];

  const faqs = [
    {
      question: "هل هذه المنصة للاستثمار الحقيقي والمراهنات؟",
      answer: "لا، WorldCup Exchange هي منصة افتراضية تماماً مخصصة للمتعة والمنافسة فقط. جميع العملات والأسهم داخل المنصة افتراضية ولا تحمل أي قيمة نقدية حقيقية."
    },
    {
      question: "كيف تتغير أسعار اللاعبين والمنتخبات؟",
      answer: "تعتمد خوارزمية تسعير الأسهم على عاملين: الأداء الحقيقي في المباريات (أهداف، صناعة لعب، شباك نظيفة) وقانون العرض والطلب داخل المنصة (حركة البيع والشراء من قبل المستخدمين)."
    },
    {
      question: "هل أستطيع إنشاء دوريات خاصة مع أصدقائي؟",
      answer: "نعم! يمكنك التوجه إلى قسم 'المجموعات' لإنشاء مجموعة خاصة ودعوة أصدقائك عبر رابط مباشر للتنافس بينكم بشكل حصري."
    },
    {
      question: "متى يتم تصفير الحسابات وإعلان الفائز؟",
      answer: "تستمر المنافسة طوال فترة بطولة كأس العالم، ومع إطلاق صافرة نهاية المباراة النهائية، يتم تجميد السوق وإعلان قائمة أفضل المتداولين بناءً على صافي قيمة محافظهم."
    }
  ];

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden relative selection:bg-[#0FF0FC]/30 font-sans">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-[#0FF0FC]/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-[#1e3a8a]/10 blur-[150px] pointer-events-none" />

      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 mb-8 backdrop-blur-md"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#0FF0FC] animate-pulse" />
          موسم المونديال قد بدأ. هل أنت مستعد للعبة؟
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500"
        >
          بورصة كأس العالم
          <br />
          <span className="text-white">بين يديك</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          تداول أسهم المنتخبات واللاعبين، راقب تحركات السوق مع كل هدف، وأثبت أنك المحلل الرياضي الأذكى في العالم الافتراضي.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          <Link href="/market" className="px-8 py-4 bg-[#0FF0FC] text-black font-bold rounded-2xl text-lg hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_rgba(15,240,252,0.3)] flex items-center justify-center gap-2">
            <TrendingUp size={22} /> دخول السوق
          </Link>
          <Link href="/leaderboard" className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl text-lg hover:bg-white/10 hover:scale-105 transition-all backdrop-blur-sm flex items-center justify-center gap-2">
            <Trophy size={22} className="text-[#FFD700]" /> لوحة الصدارة
          </Link>
        </motion.div>
      </section>

      {/* 2. Live Market Stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6">

          {/* Top Gainer Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-[#111] to-[#1a2f1c] border border-green-500/20 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <p className="text-green-400 text-sm font-bold mb-2 flex items-center gap-1"><TrendingUp size={16}/> سهم محلق</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{topGainer?.image || '⚽'}</span>
                <h3 className="text-xl font-bold text-white truncate">{topGainer?.name || '---'}</h3>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-gray-400 text-xs">السعر الحالي</p>
                <p className="text-2xl font-mono font-bold text-white">{topGainer?.current_price || '0.00'} ¢</p>
              </div>
              {topGainer?.change === 0 ? (
                <div className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  سعر افتتاحي
                </div>
              ) : (
                <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  +{topGainer?.change}%
                </div>
              )}
            </div>
          </motion.div>

          {/* Top Loser Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-[#111] to-[#3a1a1a] border border-red-500/20 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <p className="text-red-400 text-sm font-bold mb-2 flex items-center gap-1"><TrendingDown size={16}/> فرصة شراء؟</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{topLoser?.image || '⚽'}</span>
                <h3 className="text-xl font-bold text-white truncate">{topLoser?.name || '---'}</h3>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-gray-400 text-xs">السعر الحالي</p>
                <p className="text-2xl font-mono font-bold text-white">{topLoser?.current_price || '0.00'} ¢</p>
              </div>
              {topLoser?.change === 0 ? (
                <div className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  سعر افتتاحي
                </div>
              ) : (
                <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  {topLoser?.change}%
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. How it Works */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold mb-4"
          >
            كيف تلعب وتكسب؟
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-16 h-1 bg-[#0FF0FC] mx-auto rounded-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-10 right-10 h-[2px] bg-white/5 z-0" />
          
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="w-24 h-24 rounded-full bg-[#111] border-4 border-[#0FF0FC]/20 flex flex-col items-center justify-center text-3xl font-black text-white mb-6 shadow-[0_0_30px_rgba(15,240,252,0.1)] group hover:border-[#0FF0FC] hover:bg-[#0FF0FC]/10 transition-all duration-500 relative overflow-hidden">
                {step.icon}
                <span className="text-xs text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 font-mono tracking-widest">{step.num}</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Market Insights (Articles) */}
      <section className="relative z-10 bg-[#0A0A0A] border-y border-white/5 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <motion.h2 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-5xl font-extrabold mb-4"
              >
                تحليلات وخبراء السوق
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-gray-400 max-w-2xl"
              >
                مقالات حصرية ونظرة تحليلية لمعرفة أسرار بناء المحافظ الاستثمارية الرابحة.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <Link href="/articles" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all text-sm">
                عرض جميع المقالات <ArrowLeftIcon />
              </Link>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blogArticles.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/article/${article.id}`} className="group flex flex-col h-full bg-[#111] rounded-3xl border border-white/5 overflow-hidden hover:border-[#0FF0FC]/40 transition-all hover:-translate-y-2">
                  <div className="h-56 w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent z-10 opacity-80" />
                    <img 
                      src={article.imageUrl} 
                      alt={article.title} 
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 right-4 z-20">
                      <span className="bg-black/50 backdrop-blur-md text-[#0FF0FC] text-xs px-3 py-1 rounded-full font-bold border border-white/10">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1 relative z-20 -mt-10">
                    <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#0FF0FC] transition-colors line-clamp-2 leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed flex-1">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-auto border-t border-white/5 pt-4">
                      <span>الكاتب: <span className="text-gray-300">{article.author}</span></span>
                      <span>{new Date(article.date).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold mb-4"
          >
            لماذا WorldCup Exchange؟
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#111] p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-all flex gap-6 items-start group"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center shrink-0 text-white group-hover:bg-[#0FF0FC] group-hover:text-black transition-colors">
                {feat.icon}
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">{feat.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="relative z-10 bg-[#111] border-t border-white/5 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-extrabold mb-4"
            >
              الأسئلة الشائعة
            </motion.h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-black border border-white/5 p-6 rounded-2xl"
              >
                <h3 className="text-lg font-bold text-white mb-2">{faq.question}</h3>
                <p className="text-gray-400">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Final CTA */}
      <section className="relative z-10 py-24 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] to-[#0A0A0A]" />
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-[#0FF0FC]/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black mb-8 leading-tight"
          >
            لا تكتفِ بالمشاهدة.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0FF0FC] to-[#FFD700]">كن جزءاً من اللعبة.</span>
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link 
              href="/register"
              className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black font-extrabold rounded-2xl text-xl hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              أنشئ حسابك مجاناً <ArrowLeftIcon />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-black py-8 text-center text-gray-600 text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-bold text-gray-500 mb-2">WorldCup Exchange © 2026</p>
          <p className="max-w-2xl mx-auto">منصة ترفيهية تفاعلية. جميع الأرقام والأصول افتراضية ولا تمثل تداولاً حقيقياً بأموال واقعية.</p>
        </div>
      </footer>
    </main>
  );
}

// Simple internal component to avoid missing imports for ArrowLeft
function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  );
}
