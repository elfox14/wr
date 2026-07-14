import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, Database, Home, ShieldCheck, Sparkles, Trophy, Wrench } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'الرئيسية', icon: Home },
  { href: '/admin/apis', label: 'اختبارات API', icon: Activity },
  { href: '/admin/worldcup-bootstrap', label: 'إعادة بناء كأس العالم', icon: Database },
  { href: '/admin/knockout-sync', label: 'مزامنة الأدوار', icon: Trophy },
];

export default function AdminShell({
  title,
  subtitle,
  badge = 'MC PRIME Admin',
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-[#0FF0FC]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-black text-white">MC PRIME Exchange</p>
              <p className="text-xs text-gray-400">لوحة تحكم الأدمن</p>
            </div>
          </Link>

          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-gray-200 transition hover:border-[#0FF0FC]/40 hover:bg-[#0FF0FC]/10 hover:text-white"
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0FF0FC]/10 via-white/[0.03] to-[#FFD700]/10 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
                <Sparkles size={14} /> {badge}
              </p>
              <h1 className="text-3xl font-black md:text-5xl">{title}</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-300 md:text-base">{subtitle}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
              <div className="mb-2 flex items-center gap-2 font-black text-white"><Wrench size={16} /> وضع الإدارة</div>
              <p>كل العمليات الحساسة تعمل من السيرفر بدون كشف مفاتيح API داخل المتصفح.</p>
            </div>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
