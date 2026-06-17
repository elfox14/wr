'use client';

import Link from 'next/link';

const logoSrc = '/brand/borsa-mondial-sport-logo-icon.svg?v=20260616sport';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/news', 'الأخبار'],
  ['/animation-live', 'البث التفاعلي'],
] as const;

const trustLinks = [
  ['/about', 'عن الموقع'],
  ['/privacy', 'سياسة الخصوصية'],
  ['/privacy-policy', 'Privacy Policy'],
  ['/contact', 'اتصل بنا'],
  ['/terms', 'شروط الاستخدام'],
] as const;

export function Footer() {
  return (
    <footer className="mt-10 w-full border-t border-white/5 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#0FF0FC]/25 bg-[#06111f] p-2 shadow-[0_0_24px_rgba(15,240,252,0.15)]">
              <img src={logoSrc} alt="بورصة المونديال" className="h-full w-full object-contain" />
            </span>
            <span>
              <span className="block text-xl font-black text-white">بورصة المونديال</span>
              <span className="mt-2 block max-w-xl text-sm font-bold leading-7 text-gray-400">
                منصة رياضية مباشرة لمتابعة مباريات وأخبار ومجموعات كأس العالم، مع تحليل كروي وبورصة افتراضية ترفيهية.
              </span>
              <span className="mt-2 block text-[11px] font-black tracking-[0.18em] text-[#0FF0FC]">MC PRIME SPORTS EXCHANGE</span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-3 text-sm font-bold text-gray-400" aria-label="روابط الموقع الرئيسية">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="transition hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5 flex flex-col gap-4 text-xs font-bold text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {new Date().getFullYear()} بورصة المونديال — MC PRIME. جميع الحقوق محفوظة.
          </div>
          <nav className="flex flex-wrap gap-4" aria-label="روابط الثقة والسياسات">
            {trustLinks.map(([href, label]) => (
              <Link key={href} href={href} className="transition hover:text-gray-300">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
