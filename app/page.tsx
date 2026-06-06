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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
      icon: <Globe size={28} className="text-primary mb-2" />
    },
    {
      title: "ابنِ محفظتك",
      desc: "اختر أصولك بعناية وقم بشرائها بالسعر الحالي للسوق.",
      num: "02",
      icon: <ShieldCheck size={28} className="text-primary mb-2" />
    },
    {
      title: "راقب المباريات",
      desc: "شاهد كيف ترتفع أسهمك مع كل هدف أو تمريرة حاسمة.",
      num: "03",
      icon: <PlayCircle size={28} className="text-primary mb-2" />
    },
    {
      title: "اجنِ الأرباح",
      desc: "بع أسهمك في الوقت المناسب ونافس على المركز الأول.",
      num: "04",
      icon: <Trophy size={28} className="text-primary mb-2" />
    }
  ];

  const faqs = [
    {
      question: "هل هذه المنصة للاستثمار الحقيقي والمراهنات؟",
      answer: <>لا، WorldCup Exchange هي منصة <span className="text-primary font-bold">افتراضية تماماً</span> مخصصة للمتعة والمنافسة فقط. جميع العملات والأسهم داخل المنصة افتراضية و<span className="text-accent font-bold">لا تحمل أي قيمة نقدية حقيقية</span>.</>
    },
    {
      question: "كيف تتغير أسعار اللاعبين والمنتخبات؟",
      answer: <>تعتمد <span className="text-primary font-bold">خوارزمية تسعير الأسهم</span> على عاملين: الأداء الحقيقي في المباريات (أهداف، صناعة لعب، شباك نظيفة) وقانون العرض والطلب داخل المنصة (حركة البيع والشراء من قبل المستخدمين).</>
    },
    {
      question: "هل أستطيع إنشاء دوريات خاصة مع أصدقائي؟",
      answer: <>نعم! يمكنك التوجه إلى قسم 'المجموعات' لإنشاء <span className="text-white font-bold">مجموعة خاصة</span> ودعوة أصدقائك عبر رابط مباشر للتنافس بينكم بشكل حصري.</>
    },
    {
      question: "متى يتم تصفير الحسابات وإعلان الفائز؟",
      answer: <>تستمر المنافسة طوال فترة بطولة كأس العالم، ومع إطلاق صافرة نهاية المباراة النهائية، <span className="text-white font-bold">يتم تجميد السوق وإعلان قائمة أفضل المتداولين</span> بناءً على صافي قيمة محافظهم.</>
    }
  ];

  return (
    <main className="min-h-screen bg-background text-foreground overflow-hidden relative selection:bg-primary/30">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-5 pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-surface/50 blur-[150px] pointer-events-none" />

      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-white/5 text-sm text-gray-300 mb-8 shadow-sm"
        >
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          موسم المونديال قد بدأ. هل أنت مستعد للعبة؟
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400"
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
          <Link href="/market" className="px-8 py-4 bg-primary text-white font-bold rounded-xl text-lg hover:bg-primary-light hover:-translate-y-1 transition-all shadow-anti-gravity flex items-center justify-center gap-2">
            <TrendingUp size={22} /> دخول السوق
          </Link>
          <Link href="/leaderboard" className="px-8 py-4 bg-surface border border-white/10 text-white font-bold rounded-xl text-lg hover:bg-white/5 hover:-translate-y-1 transition-all shadow-sm flex items-center justify-center gap-2">
            <Trophy size={22} className="text-accent" /> لوحة الصدارة
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
            className="bg-surface border border-success/20 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-success text-white px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm">
                  <TrendingUp size={14}/> سهم محلق
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{topGainer?.image || '⚽'}</span>
                <h3 className="text-xl font-bold text-white truncate">{topGainer?.name || '---'}</h3>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-gray-400 text-xs">السعر الحالي</p>
                <p className="text-2xl font-bold text-white tabular-nums">{topGainer?.current_price || '0.00'} ¢</p>
              </div>
              {topGainer?.change === 0 ? (
                <div className="bg-white/5 text-gray-400 px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1">
                  سعر افتتاحي
                </div>
              ) : (
                <div className="bg-success/10 text-success px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1">
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
            className="bg-surface border border-danger/20 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-danger text-white px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm">
                  <TrendingDown size={14}/> فرصة شراء؟
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{topLoser?.image || '⚽'}</span>
                <h3 className="text-xl font-bold text-white truncate">{topLoser?.name || '---'}</h3>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-gray-400 text-xs">السعر الحالي</p>
                <p className="text-2xl font-bold text-white tabular-nums">{topLoser?.current_price || '0.00'} ¢</p>
              </div>
              {topLoser?.change === 0 ? (
                <div className="bg-white/5 text-gray-400 px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1">
                  سعر افتتاحي
                </div>
              ) : (
                <div className="bg-danger/10 text-danger px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1">
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
            className="text-3xl md:text-4xl font-extrabold mb-4"
          >
            كيف تلعب وتكسب؟
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-16 h-1 bg-primary mx-auto rounded-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-10 right-10 h-[2px] bg-white/5 z-0" />
          
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative z-10 flex flex-col items-center text-center px-4"
            >
              <div className="w-24 h-24 rounded-full bg-surface border-4 border-surface flex flex-col items-center justify-center text-white mb-6 shadow-card group hover:border-primary/50 transition-all duration-300">
                {step.icon}
                <span className="text-xs text-gray-500 font-bold tracking-widest">{step.num}</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Market Insights (Articles) */}
      <section className="relative z-10 bg-surface/50 border-y border-white/5 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-4">
                <Newspaper size={14} /> أهم التحليلات
              </div>
              <motion.h2 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-extrabold mb-4"
              >
                تحليلات وخبراء السوق
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-gray-400 max-w-2xl text-sm"
              >
                مقالات حصرية ونظرة تحليلية لمعرفة أسرار بناء المحافظ الاستثمارية الرابحة.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <Link href="/articles" className="inline-flex items-center gap-2 px-6 py-3 bg-surface hover:bg-white/5 border border-white/10 rounded-xl font-bold transition-all text-sm">
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
                <Link href={`/article/${article.id}`} className="group flex flex-col h-full bg-surface rounded-2xl border border-white/5 overflow-hidden hover:border-primary/40 transition-all shadow-card hover:shadow-card-hover hover:-translate-y-1">
                  <div className="h-48 w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent z-10 opacity-90" />
                    <img 
                      src={article.imageUrl} 
                      alt={article.title} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 right-4 z-20">
                      <span className="bg-background/80 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md font-bold border border-white/10">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1 relative z-20 -mt-8">
                    <h3 className="text-lg font-bold mb-3 text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6 line-clamp-2 leading-loose flex-1">
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
            className="text-3xl md:text-4xl font-extrabold mb-4"
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
              className="bg-surface p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex gap-6 items-start group shadow-card"
            >
              <div className="w-14 h-14 rounded-xl bg-background flex items-center justify-center shrink-0 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                {feat.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{feat.title}</h3>
                <p className="text-gray-400 leading-loose text-sm">{feat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="relative z-10 py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
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
                className={`bg-surface border p-6 rounded-2xl cursor-pointer transition-colors select-none ${openFaq === i ? 'border-primary/30' : 'border-white/5 hover:border-white/20'}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-white pr-4">{faq.question}</h3>
                  <div className="shrink-0 bg-background p-2 rounded-lg">
                    {openFaq === i ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} className="text-gray-500" />}
                  </div>
                </div>
                {openFaq === i && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-gray-400 leading-loose mt-4 text-sm"
                  >
                    {faq.answer}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Final CTA */}
      <section className="relative z-10 py-24 border-t border-white/5 bg-surface/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black mb-8 leading-tight"
          >
            لا تكتفِ بالمشاهدة.<br/>
            <span className="text-primary">كن جزءاً من اللعبة.</span>
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link 
              href="/register"
              className="inline-flex items-center gap-3 px-10 py-5 bg-primary text-white font-extrabold rounded-xl text-xl hover:bg-primary-light hover:-translate-y-1 transition-all shadow-anti-gravity"
            >
              أنشئ حسابك مجاناً <ArrowLeftIcon />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-background py-8 text-center text-gray-600 text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-bold text-gray-500 mb-2">WorldCup Exchange © 2026</p>
          <p className="max-w-2xl mx-auto">منصة ترفيهية تفاعلية. جميع الأرقام والأصول افتراضية ولا تمثل تداولاً حقيقياً بأموال واقعية.</p>
        </div>
      </footer>
    </main>
  );
}

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  );
}
