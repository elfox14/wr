'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, Twitter, Instagram, Facebook, Mail, ShieldAlert, FileText, Info, HelpCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full bg-background border-t border-white/5 relative overflow-hidden mt-10">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          
          {/* Brand & Description */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <TrendingUp className="text-primary" size={28} />
              <span className="font-black text-xl tracking-wide text-white">
                WorldCup <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Exchange</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. حلل الأداء، استثمر في النجوم، ونافس على صدارة السوق العالمي.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary/20 transition-all group">
                <Twitter size={18} className="group-hover:scale-110 transition-transform" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary/20 transition-all group">
                <Instagram size={18} className="group-hover:scale-110 transition-transform" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary/20 transition-all group">
                <Facebook size={18} className="group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-white mb-5 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> روابط سريعة
            </h3>
            <ul className="space-y-3">
              <li><Link href="/market" className="text-gray-400 hover:text-primary transition-colors text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/20"></span> السوق</Link></li>
              <li><Link href="/ipo" className="text-gray-400 hover:text-primary transition-colors text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/20"></span> الاكتتاب (IPO)</Link></li>
              <li><Link href="/articles" className="text-gray-400 hover:text-primary transition-colors text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/20"></span> المقالات والتحليلات</Link></li>
              <li><Link href="/leaderboard" className="text-gray-400 hover:text-primary transition-colors text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/20"></span> الترتيب العالمي</Link></li>
            </ul>
          </div>

          {/* Legal Links (For Google Ads) */}
          <div>
            <h3 className="font-bold text-white mb-5 flex items-center gap-2">
              <ShieldAlert size={16} className="text-accent" /> الشروط والخصوصية
            </h3>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-gray-400 hover:text-accent transition-colors text-sm flex items-center gap-2"><FileText size={14} /> سياسة الخصوصية</Link></li>
              <li><Link href="/terms" className="text-gray-400 hover:text-accent transition-colors text-sm flex items-center gap-2"><FileText size={14} /> شروط الاستخدام</Link></li>
              <li><Link href="/about" className="text-gray-400 hover:text-accent transition-colors text-sm flex items-center gap-2"><Info size={14} /> من نحن</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-accent transition-colors text-sm flex items-center gap-2"><Mail size={14} /> اتصل بنا</Link></li>
            </ul>
          </div>

          {/* Support / Contact */}
          <div>
            <h3 className="font-bold text-white mb-5 flex items-center gap-2">
              <HelpCircle size={16} className="text-emerald-400" /> الدعم والمساعدة
            </h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              تحتاج إلى مساعدة أو لديك استفسار؟ فريق الدعم متاح على مدار الساعة.
            </p>
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-colors text-sm">
              <Mail size={16} /> تواصل مع الدعم
            </Link>
          </div>

        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-right">
          <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
            <strong className="text-gray-400">تنويه إخلاء مسؤولية:</strong> منصة WorldCup Exchange هي منصة ترفيهية تفاعلية تعتمد على أسواق افتراضية بالكامل. جميع الأرقام والأرصدة والأصول هي افتراضية فقط ولا تمثل تداولاً حقيقياً بأموال واقعية أو أوراق مالية. الأداء السابق للأصول الافتراضية لا يضمن الأداء المستقبلي.
          </p>
          <div className="text-sm font-bold text-gray-400 shrink-0">
            © {new Date().getFullYear()} WorldCup Exchange. جميع الحقوق محفوظة.
          </div>
        </div>
      </div>
    </footer>
  );
}
