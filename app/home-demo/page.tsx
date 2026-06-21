import type { Metadata } from 'next';
import Link from 'next/link';
import Home from '@/app/home-page-server';
import HomeDemoCommandCenter from '@/components/home-demo/HomeDemoCommandCenter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'ديمو الرئيسية الذكية | World Cup Exchange',
  description: 'صفحة ديمو مستقلة تعرض كروت الرئيسية الحالية أولًا ثم الإضافات المقترحة قبل الاعتماد.',
};

export default async function HomeDemoPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_30%),radial-gradient(circle_at_top_left,rgba(15,240,252,0.11),transparent_28%),linear-gradient(180deg,#06120d,#020706)] text-white">
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-[2rem] border border-[#FFD700]/20 bg-[linear-gradient(135deg,rgba(255,215,0,0.12),rgba(15,240,252,0.06),rgba(0,0,0,0.30))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#00FF88]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00FF88]" /> HOME DEMO REVIEW
              </div>
              <h1 className="mt-3 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">ديمو الرئيسية: الحالية أولًا ثم الإضافات</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-300">
                في الأعلى نفس كروت الرئيسية الحالية بنفس مصدرها وترتيبها، وتحتها كروت الديمو الجديدة قبل اعتماد أي نقل للرئيسية.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black">
              <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-gray-300 transition hover:text-white">الرئيسية الحالية</Link>
              <Link href="#demo-additions" className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-2 text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">انزل لكروت الديمو</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 pt-5 sm:px-4 lg:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 text-sm font-black text-[#FFD700]">١</span>
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">كروت الرئيسية الحالية بنفس الترتيب</h2>
            <p className="mt-1 text-xs font-bold text-gray-400 sm:text-sm">هذا القسم يستدعي نفس مكون السيرفر المستخدم في الصفحة الرئيسية الحالية مباشرة.</p>
          </div>
        </div>
      </section>

      <div className="border-y border-white/5 bg-black/10">
        <Home />
      </div>

      <section id="demo-additions" className="mx-auto max-w-7xl px-3 pb-2 pt-8 sm:px-4 lg:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-sm font-black text-[#0FF0FC]">٢</span>
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">كروت الديمو المقترحة</h2>
            <p className="mt-1 text-xs font-bold text-gray-400 sm:text-sm">الإضافات الجديدة تظهر بعد كروت الرئيسية حتى تكون المقارنة والموافقة أسهل.</p>
          </div>
        </div>
      </section>

      <HomeDemoCommandCenter />
    </div>
  );
}
