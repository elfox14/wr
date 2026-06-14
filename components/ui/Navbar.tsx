'use client';

import Link from 'next/link';

const logoSrc = '/brand/worldcup-2026-logo.svg?v=20260614c';

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
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:min-h-[92px] lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-white p-1 shadow-[0_0_22px_rgba(255,215,0,0.14)] lg:h-16 lg:w-16">
              <img src={logoSrc} alt="World Cup 2026" className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black leading-tight text-white lg:text-xl">MC PRIME World Cup</span>
              <span className="mt-1 block max-w-xl text-xs font-bold leading-5 text-gray-400 lg:text-sm">
                منصة رياضية لمتابعة مباريات وأخبار ومجموعات كأس العالم.
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-400 lg:justify-end">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl px-2.5 py-2 transition hover:bg-white/10 hover:text-white xl:px-3">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div className="h-[116px] lg:h-[92px]" />
    </>
  );
}
