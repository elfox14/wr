'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const logoSrc = '/brand/borsa-mondial-sport-logo-icon.svg?v=20260616sport';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/statistics', 'الإحصائيات'],
  ['/round-of-32', 'مسار البطولة'],
  ['/animation-live', 'البث التفاعلي'],
] as const;

const primaryMobileLinks = [
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/statistics', 'الإحصائيات'],
  ['/round-of-32', 'المسار'],
  ['/animation-live', 'LIVE'],
] as const;

function NavItem({ href, label, className, onClick }: { href: string; label: string; className: string; onClick?: () => void }) {
  return <Link href={href} onClick={onClick} className={className}>{label}</Link>;
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 w-full border-b border-white/10 bg-[#030907]/92 shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#030907]/78 mobile-nav-safe">
        <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-8">
          <div className="flex min-h-[60px] items-center justify-between gap-2 lg:min-h-[84px]">
            <Link href="/" onClick={closeMenu} className="group flex shrink-0 items-center gap-2" aria-label="بورصة المونديال الرئيسية">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-[#0FF0FC]/25 bg-[#06111f] p-1.5 shadow-[0_0_22px_rgba(15,240,252,0.16)] transition group-hover:scale-[1.02] group-hover:border-[#FFD700]/35 sm:h-12 sm:w-12 lg:h-14 lg:w-14">
                <Image src={logoSrc} alt="بورصة المونديال" width={56} height={56} className="h-full w-full object-contain" priority />
              </span>
              <span className="hidden min-w-0 flex-col leading-none md:flex">
                <span className="whitespace-nowrap text-base font-black text-white lg:text-lg">بورصة المونديال</span>
                <span className="mt-1 whitespace-nowrap text-[10px] font-black tracking-[0.18em] text-[#0FF0FC] lg:text-[11px]">MC PRIME SPORTS</span>
              </span>
            </Link>

            <div className="hidden items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-sm font-black text-gray-300 lg:flex">
              {links.map(([href, label]) => (
                <NavItem key={href} href={href} label={label} className="rounded-xl px-2.5 py-2.5 transition hover:bg-white/10 hover:text-white xl:px-3" />
              ))}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 lg:hidden">
              <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1 mobile-scrollbar mobile-quick-nav">
                {primaryMobileLinks.map(([href, label]) => (
                  <NavItem
                    key={href}
                    href={href}
                    label={label}
                    onClick={closeMenu}
                    className={`mobile-tap inline-flex min-h-10 shrink-0 items-center rounded-xl px-2.5 py-2 text-[10.5px] font-black transition active:scale-95 ${href === '/animation-live' ? 'bg-red-500/15 text-red-100 ring-1 ring-red-300/10' : 'text-gray-200 hover:bg-white/10 hover:text-white'}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                className="mobile-tap flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15 active:scale-95 sm:h-11 sm:w-11"
                aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                aria-expanded={isOpen}
              >
                {isOpen ? <X size={21} strokeWidth={2.5} /> : <Menu size={21} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="absolute inset-x-2 top-[calc(100%+0.45rem)] lg:hidden">
              <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#07111f]/97 shadow-[0_18px_42px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
                <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3">
                  {links.map(([href, label]) => (
                    <NavItem
                      key={href}
                      href={href}
                      label={label}
                      onClick={closeMenu}
                      className={`mobile-tap min-h-12 rounded-xl border px-2 py-3 text-center text-[11px] font-black transition active:scale-[0.98] ${href === '/animation-live' ? 'border-red-300/20 bg-red-500/10 text-red-100' : 'border-white/10 bg-white/[0.045] text-gray-100 hover:border-[#0FF0FC]/30 hover:bg-white/[0.075]'}`}
                    />
                  ))}
                </div>
                <div className="border-t border-white/10 px-3 py-2 text-center text-[10px] font-bold text-gray-500">
                  كأس العالم 2026 — مباريات، مجموعات، منتخبات، إحصائيات، أخبار وتحليل
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
      <div className="h-[60px] lg:h-[84px]" />
    </>
  );
}
