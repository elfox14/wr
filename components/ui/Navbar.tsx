'use client';

import Link from 'next/link';

const logoSrc = '/brand/worldcup-2026-logo.svg';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/news', 'الأخبار والتحليل'],
  ['/animation-live', 'البث التفاعلي'],
] as const;

export function Navbar() {
  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:bg-white/[0.04]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/30 bg-white shadow-[0_0_24px_rgba(255,215,0,0.16)]">
              <img src={logoSrc} alt="World Cup 2026" className="h-full w-full object-contain" />
            </span>
            <span className="hidden leading-none sm:block">
              <span className="block text-sm font-black tracking-wide text-white">WORLD CUP 2026</span>
              <span className="mt-1 block text-[11px] font-black text-[#0FF0FC]">مباريات • تحليل • إحصائيات</span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-bold text-gray-300 transition hover:bg-white/10 hover:text-white">
                {label}
              </Link>
            ))}
          </div>

          <Link href="/matches" className="rounded-2xl bg-[#0FF0FC] px-4 py-2 text-sm font-black text-black shadow-[0_0_18px_rgba(15,240,252,0.22)] transition hover:bg-[#4AFAFF]">
            مباريات اليوم
          </Link>
        </div>
      </nav>
      <div className="h-20" />
    </>
  );
}
