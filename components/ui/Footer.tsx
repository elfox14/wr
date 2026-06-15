'use client';

import Link from 'next/link';

const logoSrc = '/brand/worldcup-2026-logo-upload.svg?v=20260615a';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/news', 'الأخبار'],
  ['/animation-live', 'البث التفاعلي'],
] as const;

export function Footer() {
  return (
    <footer className="mt-10 w-full border-t border-white/5 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-white p-1 shadow-[0_0_22px_rgba(255,215,0,0.14)]">
              <img src={logoSrc} alt="World Cup 2026" className="h-full w-full object-contain" />
            </span>
            <span>
              <span className="block text-xl font-black text-white">MC PRIME World Cup</span>
              <span className="mt-2 block max-w-xl text-sm font-bold leading-7 text-gray-400">
                منصة رياضية لمتابعة مباريات وأخبار ومجموعات كأس العالم.
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-3 text-sm font-bold text-gray-400">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="transition hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5 text-xs font-bold text-gray-500">
          © {new Date().getFullYear()} MC PRIME World Cup. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
