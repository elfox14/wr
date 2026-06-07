'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, Mail, ShieldAlert, FileText, Info, HelpCircle } from 'lucide-react';

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
              {/* Twitter SVG */}
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary/20 transition-all group">
                <svg className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
              </a>
              {/* Instagram SVG */}
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary/20 transition-all group">
                <svg className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              {/* Facebook SVG */}
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary/20 transition-all group">
                <svg className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.312h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
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
