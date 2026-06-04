'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { TrendingUp, TrendingDown, Users, Activity, Trophy, PlayCircle, ShieldCheck, Zap, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Navbar } from '@/components/ui/Navbar';

export default function Home() {
  const { assets, fetchAssets } = useStore();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const sortedAssets = [...assets].sort((a, b) => b.change - a.change);
  const topGainer = sortedAssets[0];
  const topLoser = sortedAssets[sortedAssets.length - 1];

  const features = [
    {
      title: "سوق حيّ",
      description: "تابع تحركات الأسعار لحظة بلحظة مع تغيّر الأداء الحقيقي في المباريات.",
      icon: <Activity className="text-[#0FF0FC]" size={32} />
    },
    {
      title: "تداول افتراضي",
      description: "اشترِ وبِع أصول اللاعبين والمنتخبات داخل تجربة مصممة للمتعة والتحليل.",
      icon: <TrendingUp className="text-[#0FF0FC]" size={32} />
    },
    {
      title: "مؤشرات واضحة",
      description: "راقب أعلى الأسهم صعودًا وهبوطًا وحجم التداول اليومي في مكان واحد.",
      icon: <Globe className="text-[#0FF0FC]" size={32} />
    },
    {
      title: "منافسة مستمرة",
      description: "قارن قراراتك بالآخرين واصعد في الترتيب العالمي مع كل صفقة ناجحة.",
      icon: <Trophy className="text-[#0FF0FC]" size={32} />
    }
  ];

  const steps = [
    "اختر لاعبين ومنتخبات لمحفظتك الافتراضية.",
    "تابع تغيّر الأسعار مع أحداث المباريات.",
    "نفّذ صفقاتك بناءً على قراءتك للسوق.",
    "نافس الآخرين على صدارة الترتيب."
  ];

  const faqs = [
    {
      question: "هل هذه المنصة للاستثمار الحقيقي؟",
      answer: "لا، WorldCup Exchange منصة افتراضية مخصصة للمتعة، المنافسة، وتحليل الأداء الرياضي، وليست استثمارًا ماليًا حقيقيًا أو مراهنة نقدية."
    },
    {
      question: "كيف تتغير الأسعار؟",
      answer: "تتغير أسعار اللاعبين والمنتخبات لحظيًا بناءً على الأداء الواقعي في المباريات وحركة السوق داخل المنصة."
    },
    {
      question: "ماذا يمكنني أن أتداول؟",
      answer: "يمكنك تداول أصول افتراضية مرتبطة باللاعبين والمنتخبات داخل السوق."
    },
    {
      question: "هل أستطيع المنافسة مع الآخرين؟",
      answer: "نعم، يمكنك متابعة الترتيب العالمي ومقارنة أدائك ببقية المستخدمين أو داخل مجموعاتك."
    }
  ];

  return (
    <main className="min-h-screen bg-[#121212] text-white overflow-hidden relative selection:bg-[#0FF0FC]/30">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#0FF0FC]/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-[#FFD700]/5 rounded-full blur-[120px] pointer-events-none translate-x-1/2" />

      <Navbar />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#1A1A1A] border border-white/10 text-sm text-gray-300 mb-8">
            <span className="text-[#0FF0FC] font-bold">جديد:</span> تجربة افتراضية للمتعة، المنافسة، وتحليل الأداء الرياضي
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            تداول كرة القدم بشكل افتراضي ونافس على صدارة السوق
          </h1>
          <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            منصة رياضية افتراضية تتيح لك شراء وبيع أسهم اللاعبين والمنتخبات، مع أسعار تتغير لحظيًا وفق الأداء الحقيقي في المباريات.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/market"
              className="px-8 py-4 bg-[#0FF0FC] hover:bg-[#00B4DB] text-black font-bold rounded-xl text-lg transition-all shadow-[0_0_20px_rgba(15,240,252,0.3)] hover:shadow-[0_0_30px_rgba(15,240,252,0.5)] transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <PlayCircle size={24} /> ابدأ التداول الافتراضي
            </Link>
            <Link 
              href="/leaderboard"
              className="px-8 py-4 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white border border-white/10 font-bold rounded-xl text-lg transition-all flex items-center justify-center gap-2 group"
            >
              <Trophy size={20} className="text-[#FFD700] group-hover:scale-110 transition-transform" /> شاهد الترتيب العالمي
            </Link>
          </div>
          
          <div className="mt-12 bg-white/5 border border-white/10 p-4 rounded-2xl max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-gray-400">
            <ShieldCheck size={24} className="text-[#0FF0FC] shrink-0" />
            <p className="text-right sm:text-center">هذه المنصة مخصصة للمتعة، المنافسة، وتحليل الأداء الرياضي، ولا تمثل استثمارًا ماليًا حقيقيًا أو مراهنة نقدية.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          <div className="bg-[#1A1A1A]/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center hover:border-white/10 transition-colors">
            <Users className="text-[#0FF0FC] mb-4" size={32} />
            <span className="text-3xl font-mono font-bold">250,000+</span>
            <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">إجمالي المتداولين</span>
          </div>
          
          <div className="bg-[#1A1A1A]/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center hover:border-white/10 transition-colors">
            <Activity className="text-[#FFD700] mb-4" size={32} />
            <span className="text-3xl font-mono font-bold">15M+</span>
            <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">حجم التداول اليومي</span>
          </div>

          <div className="bg-[#1A1A1A]/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center border-t-4 border-t-green-500 hover:border-white/10 transition-colors">
            <TrendingUp className="text-green-500 mb-4" size={32} />
            <span className="text-xl font-bold flex items-center gap-2">
              {topGainer ? topGainer.image : '⚽'} {topGainer ? topGainer.name : 'Salem Al-Dawsari'}
            </span>
            <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">أعلى سهم صعودًا</span>
            <span className="text-green-500 font-mono font-bold mt-1">{topGainer ? `+${topGainer.change}%` : '+3.66%'}</span>
          </div>

          <div className="bg-[#1A1A1A]/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center border-t-4 border-t-red-500 hover:border-white/10 transition-colors">
            <TrendingDown className="text-red-500 mb-4" size={32} />
            <span className="text-xl font-bold flex items-center gap-2">
              {topLoser ? topLoser.image : '⚽'} {topLoser ? topLoser.name : 'Moises Caicedo'}
            </span>
            <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">أعلى سهم هبوطًا</span>
            <span className="text-red-500 font-mono font-bold mt-1">{topLoser ? `${topLoser.change}%` : '-3.97%'}</span>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-24 bg-black/40 border-y border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">لماذا WorldCup Exchange؟</h2>
            <div className="w-24 h-1 bg-[#0FF0FC] mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-[#1A1A1A] p-8 rounded-3xl border border-white/5 hover:border-[#0FF0FC]/30 transition-all hover:-translate-y-2 h-full flex flex-col">
                <div className="w-16 h-16 bg-black/50 rounded-2xl flex items-center justify-center mb-6 shrink-0">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed flex-grow">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">كيف تعمل المنصة</h2>
            <div className="w-24 h-1 bg-[#FFD700] mx-auto rounded-full"></div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-center items-stretch md:items-start gap-4 md:gap-8">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center text-center w-full md:w-1/4 relative group">
                  <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border-2 border-[#FFD700] flex items-center justify-center text-3xl font-bold text-[#FFD700] mb-6 shadow-[0_0_20px_rgba(255,215,0,0.2)] group-hover:bg-[#FFD700] group-hover:text-black transition-all duration-300 z-10 relative">
                    {index + 1}
                  </div>
                  <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl w-full h-full min-h-[140px] flex items-center justify-center">
                    <p className="font-bold text-gray-300 text-lg leading-relaxed">{step}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex flex-col justify-start items-center pt-10">
                    <div className="w-12 h-1 bg-gradient-to-r from-[#FFD700] to-[#FFD700]/10 rounded-full"></div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-black/40 border-t border-white/5 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">الأسئلة الشائعة</h2>
            <div className="w-24 h-1 bg-white/20 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-[#1A1A1A] border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all h-full flex flex-col"
              >
                <h3 className="text-xl font-bold text-gray-200 mb-4">{faq.question}</h3>
                <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#1A1A1A] to-black border border-white/10 rounded-[3rem] p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-[#0FF0FC]/5 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              هل أنت جاهز لقراءة السوق قبل الجميع؟
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto relative z-10">
              ابدأ ببناء محفظتك الافتراضية، وتابع تحركات الأسعار، ونافس على صدارة السوق مع كل مباراة.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
              <Link 
                href="/market"
                className="px-8 py-4 bg-[#FFD700] hover:bg-[#F2C800] text-black font-bold rounded-xl text-lg transition-all shadow-[0_0_20px_rgba(255,215,0,0.3)] transform hover:-translate-y-1"
              >
                ابدأ التداول الافتراضي
              </Link>
              <Link 
                href="/leaderboard"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold rounded-xl text-lg transition-all"
              >
                شاهد الترتيب العالمي
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer Disclaimer */}
      <footer className="border-t border-white/10 bg-black py-8 text-center text-gray-600 text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <p>WorldCup Exchange © 2026</p>
          <p className="mt-2 max-w-3xl mx-auto">هذه المنصة مخصصة للمتعة، المنافسة، وتحليل الأداء الرياضي، ولا تمثل استثمارًا ماليًا حقيقيًا أو مراهنة نقدية.</p>
        </div>
      </footer>
    </main>
  );
}
