'use client';

import Link from 'next/link';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/news', 'الأخبار'],
  ['/animation-live', 'البث التفاعلي'],
];

export function Footer() {
  return (
    <footer className="w-full border-t border-white/5 bg-background mt-10">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-xl font-black text-white">MC PRIME World Cup</Link>
            <p className="mt-2 max-w-xl text-sm leading-7 text-gray-400">منصة رياضية لمتابعة مباريات وأخبار ومجموعات كأس العالم.</p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-bold text-gray-400">
            {links.map(([href, label]) => <Link key={href} href={href} className="hover:text-white">{label}</Link>)}
          </nav>
        </div>
        <div className="mt-6 border-t border-white/10 pt-5 text-xs font-bold text-gray-500">
          © {new Date().getFullYear()} MC PRIME World Cup. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
