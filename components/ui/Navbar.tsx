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
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto grid h-20 max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="World Cup 2026 homepage" className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-white p-1.5 shadow-[0_0_24px_rgba(255,215,0,0.18)] transition hover:scale-[1.03] lg:h-[72px] lg:w-[72px]">
            <img src={logoSrc} alt="World Cup 2026" className="h-full w-full object-contain" />
          </Link>

          <div className="hidden items-center justify-center gap-2 lg:flex">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-bold text-gray-300 transition hover:bg-white/10 hover:text-white xl:px-4">
                {label}
              </Link>
            ))}
          </div>

          <div className="h-16 w-16 lg:h-[72px] lg:w-[72px]" aria-hidden="true" />
        </div>
      </nav>
      <div className="h-20" />
    </>
  );
}
