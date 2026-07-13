'use client';

import Link from 'next/link';

const logoSrc = '/brand/borsa-mondial-sport-logo-icon.svg?v=20260616sport';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/articles', 'المقالات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/statistics', 'الإحصائيات'],
  ['/round-of-32', 'مسار البطولة'],
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
    <footer className="mt-8 w-full border-t border-white/5 bg-background mobile-footer-safe">
      <div className="mx-auto max-w-7xl px-3 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#0FF0FC]/25 bg-[#06111f] p-1.5 shadow-[0_0_24px_rgba(15,240,252,0.15)] sm:h-16 sm:w-16 sm:p-2">
              <img src={logoSrc} alt="بورصة المونديال" className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black text-white sm:text-xl">بورصة المونديال</span>
              <span className="mt-1 block max-w-xl text-xs font-bold leading-6 text-gray-400 sm:mt-2 sm:text-sm sm:leading-7">
                منصة رياضية مباشرة لمتابعة مباريات وأخبار ومجموعات كأس العالم، مع تحليل كروي ومؤشرات افتراضية ترفيهية مبنية على بيانات رياضية فقط.
              </span>
              <span className="mt-2 block text-[10px] font-black tracking-[0.16em] text-[#0FF0FC] sm:text-[11px]">MC PRIME SPORTS EXCHANGE</span>
            </span>
          </Link>

          <nav className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-400 sm:flex sm:flex-wrap sm:gap-3 sm:text-sm" aria-label="روابط الموقع الرئيسية">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-center transition hover:text-white sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-[11px] font-bold leading-6 text-gray-400 sm:px-4 sm:text-xs">
          تنويه: جميع الأسعار والمؤشرات داخل المنصة افتراضية وترفيهية فقط، ولا تمثل قيمة مالية أو توصية مالية.
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 text-[11px] font-bold text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <div>
            © {new Date().getFullYear()} بورصة المونديال — MC PRIME. جميع الحقوق محفوظة.
          </div>
          <nav className="flex flex-wrap gap-2 sm:gap-4" aria-label="روابط الثقة والسياسات">
            {trustLinks.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg bg-white/[0.025] px-2 py-1 transition hover:text-gray-300 sm:bg-transparent sm:px-0 sm:py-0">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
