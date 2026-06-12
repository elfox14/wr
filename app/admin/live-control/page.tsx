'use client';

import Link from 'next/link';
import { Activity, Link2, Radio, Shield, Zap } from 'lucide-react';

const cards = [
  {
    title: 'صفحة اللايف العامة',
    text: 'متابعة المباريات والأخبار والتحركات للمستخدمين.',
    href: '/live',
    icon: Radio,
    tone: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]',
  },
  {
    title: 'Live Health',
    text: 'مراقبة الربط، الأخبار، تحركات الأسعار، وأزرار التشغيل اليدوي.',
    href: '/admin/live-health',
    icon: Activity,
    tone: 'border-[#00FF88]/20 bg-[#00FF88]/10 text-[#00FF88]',
  },
  {
    title: 'إدارة الربط',
    text: 'عرض المباريات غير المرتبطة وربط animationMatchId يدويًا.',
    href: '/admin/unlinked-matches',
    icon: Link2,
    tone: 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]',
  },
  {
    title: 'مرشحو iSports',
    text: 'البحث عن أقرب مباريات iSports لمباراة محلية.',
    href: '/admin/isports-candidates',
    icon: Zap,
    tone: 'border-violet-400/20 bg-violet-500/10 text-violet-200',
  },
];

export default function LiveControlPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/8 bg-gradient-to-br from-[#111] to-black p-6 shadow-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]"><Shield size={15} /> Live Control</div>
          <h1 className="text-3xl font-black sm:text-4xl">لوحة التحكم الموحدة للايف</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">مدخل سريع لكل صفحات مراقبة وتشغيل وربط اللايف بدون فتح روابط كثيرة يدويًا.</p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className={`rounded-3xl border p-5 transition hover:-translate-y-1 hover:bg-white/5 ${card.tone}`}>
                <Icon className="mb-4" size={28} />
                <h2 className="text-xl font-black">{card.title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-300">{card.text}</p>
              </Link>
            );
          })}
        </section>

        <section className="mt-8 rounded-3xl border border-white/5 bg-[#111] p-5">
          <h2 className="text-xl font-black text-white">طريقة التشغيل المقترحة</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-gray-300">
            <p>1) افتح Live Health وضع ADMIN_API_SECRET أو CRON_SECRET.</p>
            <p>2) استخدم زر تحديث Live الآن قبل وأثناء المباراة.</p>
            <p>3) استخدم زر ربط Animation الآن قبل المباراة بساعة أو عند ظهور مباراة غير مرتبطة.</p>
            <p>4) لو ظهرت مباراة غير مرتبطة، افتح إدارة الربط ثم مرشحو iSports لاختيار animationMatchId الصحيح.</p>
            <p className="text-[#FFD700]">مهم: اضبط CRON_BASE_URL في Render على https://worldcup.mcprim.com واترك API-Football fallback غير مفعل.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
