'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const logoSrc = '/brand/worldcup-2026-logo-upload.svg?v=20260615a';

const links = [
  ['/', 'الرئيسية'],
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/teams', 'المنتخبات'],
  ['/players', 'اللاعبون'],
  ['/news', 'الأخبار والتحليل'],
  ['/animation-live', 'البث التفاعلي'],
] as const;

const primaryMobileLinks = [
  ['/matches', 'المباريات'],
  ['/groups', 'المجموعات'],
  ['/animation-live', 'LIVE'],
] as const;

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/90 shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-[68px] items-center justify-between gap-3 lg:min-h-[84px]">
            <Link href="/" onClick={closeMenu} className="group flex shrink-0 items-center gap-2" aria-label="MC PRIME World Cup الرئيسية">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-white p-1 shadow-[0_0_20px_rgba(255,215,0,0.13)] transition group-hover:scale-[1.02] lg:h-14 lg:w-14">
                <Image src={logoSrc} alt="World Cup 2026" width={56} height={56} unoptimized className="h-full w-full object-contain" priority />
              </span>
            </Link>

            <div className="hidden items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-sm font-black text-gray-300 lg:flex">
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-xl px-3 py-2.5 transition hover:bg-white/10 hover:text-white xl:px-3.5">
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 lg:hidden">
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-1 mobile-scrollbar">
                {primaryMobileLinks.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className={`shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-black transition ${href === '/animation-live' ? 'bg-red-500/15 text-red-100' : 'text-gray-200 hover:bg-white/10 hover:text-white'}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15 active:scale-95"
                aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                aria-expanded={isOpen}
              >
                {isOpen ? <X size={21} strokeWidth={2.5} /> : <Menu size={21} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="pb-3 lg:hidden">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07111f]/95 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
                <div className="grid grid-cols-2 gap-1.5 p-2">
                  {links.map(([href, label]) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={closeMenu}
                      className={`rounded-xl border px-3 py-3 text-center text-xs font-black transition active:scale-[0.98] ${href === '/animation-live' ? 'border-red-300/20 bg-red-500/10 text-red-100' : 'border-white/10 bg-white/[0.045] text-gray-100 hover:border-[#0FF0FC]/30 hover:bg-white/[0.075]'}`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
                <div className="border-t border-white/10 px-3 py-2 text-center text-[10px] font-bold text-gray-500">
                  كأس العالم 2026 — مباريات، مجموعات، منتخبات، أخبار وتحليل
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
      <div className={isOpen ? 'h-[276px] lg:h-[84px]' : 'h-[68px] lg:h-[84px]'} />
    </>
  );
}
