'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { BookOpen, Briefcase, CalendarDays, ChevronDown, FileText, Gift, LogOut, Menu, Newspaper, Radio, Shield, ShieldAlert, Trophy, User as UserIcon, Users, X, TrendingUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { InsufficientFundsModal } from './InsufficientFundsModal';

const adminEmails = new Set(['worldcup@mcprim.com', 'elfox14usa@gmail.com']);
const slogan = 'مباريات، تحليل، وإحصائيات في تجربة واحدة';
const platformLogo = '/brand/worldcup-2026-logo.svg';
const headerLogo = '/brand/worldcup-exchange-header-logo.svg?v=wc2026-logo-v3';

function DropdownLink({ href, icon, label, cyan, gold, danger, onClick }: { href: string; icon: ReactNode; label: string; cyan?: boolean; gold?: boolean; danger?: boolean; onClick?: () => void }) {
  const color = danger ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : cyan ? 'text-[#0FF0FC] hover:bg-[#0FF0FC]/10' : gold ? 'text-[#FFD700] hover:bg-[#FFD700]/10' : 'text-gray-300 hover:text-white hover:bg-white/5';
  return <Link href={href} onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${color}`}>{icon}{label}</Link>;
}

export function Navbar() {
  const { data: session, status } = useSession();
  const { userStats, showInsufficientFundsModal, setShowInsufficientFundsModal, fetchPortfolio } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isExchangeMenuOpen, setIsExchangeMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const exchangeMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userEmail = session?.user?.email ?? '';
  const userRole = (session?.user as any)?.role;
  const isAuthenticated = status === 'authenticated';
  const isAdminUser = isAuthenticated && (adminEmails.has(userEmail) || userRole === 'ADMIN');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserMenuOpen(false);
      if (exchangeMenuRef.current && !exchangeMenuRef.current.contains(target)) setIsExchangeMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (session && !userStats) fetchPortfolio();
  }, [session, userStats, fetchPortfolio]);

  const navLinks = [
    { name: 'الأخبار', href: '/news', icon: <Newspaper size={16} /> },
    { name: 'المجموعات', href: '/groups', icon: <Trophy size={16} /> },
    { name: 'المنتخبات', href: '/market?type=TEAM', icon: <Shield size={16} />, activeType: 'TEAM' },
    { name: 'اللاعبون', href: '/market?type=PLAYER', icon: <Users size={16} />, activeType: 'PLAYER' },
    { name: 'المباريات', href: '/matches', icon: <CalendarDays size={16} /> },
    { name: 'بث أنيميشن', href: '/animation-live', icon: <Radio size={16} /> },
  ];

  const exchangeLinks = [
    { name: 'السوق', href: '/market', icon: <TrendingUp size={16} /> },
    { name: 'محفظتي', href: '/portfolio', icon: <Briefcase size={16} /> },
    { name: 'المكافآت', href: '/rewards', icon: <Gift size={16} /> },
    { name: 'منهجية التسعير', href: '/methodology', icon: <BookOpen size={16} /> },
  ];

  const isLinkActive = (link: { href: string; activeType?: string }) => {
    if (link.activeType) return pathname === '/market' && searchParams?.get('type') === link.activeType;
    if (link.href === '/market') return pathname === '/market' && !searchParams?.get('type');
    return pathname?.startsWith(link.href);
  };

  const isExchangeActive = pathname === '/market' || pathname === '/portfolio' || pathname === '/rewards' || pathname === '/methodology';
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/80 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-20 items-center justify-center lg:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="فتح القائمة" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
              {isMobileMenuOpen ? <X size={30} /> : <Menu size={30} />}
            </button>
            <Link href="/" aria-label="بورصة المونديال 2026" className="flex h-[70px] w-[70px] items-center justify-center overflow-hidden rounded-3xl bg-white p-1 shadow-[0_0_36px_rgba(15,240,252,0.35)]">
              <img src={headerLogo} alt="بورصة المونديال 2026" className="h-full w-full object-contain" />
            </Link>
          </div>

          <div className="hidden h-20 items-center justify-between gap-3 lg:flex">
            <Link href="/" className="group flex flex-none items-center gap-3 overflow-hidden rounded-2xl px-1 py-1 transition hover:bg-white/[0.03]">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#0FF0FC]/25 bg-white shadow-[0_0_18px_rgba(15,240,252,0.18)]">
                <img src={platformLogo} alt="World Cup 2026" className="h-full w-full object-contain" />
              </span>
              <span className="hidden min-w-[132px] flex-col leading-none sm:flex">
                <span className="text-sm font-black tracking-wide text-white">WORLD CUP</span>
                <span className="mt-1 text-[10px] font-black text-[#FFD700]">2026</span>
              </span>
            </Link>

            <Link href="/" aria-label="بورصة المونديال 2026" className="hidden h-[68px] w-[68px] flex-none items-center justify-center overflow-hidden rounded-3xl bg-white p-1 shadow-[0_0_34px_rgba(15,240,252,0.25)] transition hover:bg-white xl:flex 2xl:h-[74px] 2xl:w-[74px]">
              <img src={headerLogo} alt="بورصة المونديال 2026" className="h-full w-full object-contain" />
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 px-3 lg:flex xl:gap-2 xl:px-5">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link);
                return <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-bold transition-all duration-300 xl:px-3 ${isActive ? 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC] shadow-[0_0_10px_rgba(15,240,252,0.1)]' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}>{link.icon}{link.name}</Link>;
              })}

              <div className="relative" ref={exchangeMenuRef}>
                <button onClick={() => setIsExchangeMenuOpen(!isExchangeMenuOpen)} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-bold transition-all duration-300 xl:px-3 ${isExchangeActive ? 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                  <TrendingUp size={16} /> البورصة <ChevronDown size={14} className={`transition-transform ${isExchangeMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl transition-all duration-200 ${isExchangeMenuOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0'}`}>
                  <div className="border-b border-white/5 px-4 py-3"><p className="text-xs font-black text-[#FFD700]">كل ما يخص التداول</p></div>
                  <div className="space-y-1 p-2">{exchangeLinks.map((link) => <DropdownLink key={link.href} href={link.href} icon={link.icon} label={link.name} gold={link.href !== '/portfolio'} />)}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-none items-center gap-3">
              {status === 'loading' ? <div className="h-10 w-32 animate-pulse rounded-full bg-white/5" /> : session ? (
                <div className="hidden items-center gap-3 lg:flex">
                  <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition-colors hover:bg-white/10 xl:flex">
                    <span className="text-xs font-bold text-gray-400">رصيدك:</span>
                    <span className="font-mono text-sm font-bold text-[#FFD700]">{userStats ? userStats.balance.toLocaleString() : '...'} ¢</span>
                  </div>
                  <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 pr-3 transition-all hover:bg-white/10">
                      <span className="hidden max-w-[80px] truncate text-xs font-bold text-white xl:block">{session.user?.name?.split(' ')[0] || session.user?.email?.split('@')[0]}</span>
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#0FF0FC] to-[#FFD700]"><UserIcon size={14} className="text-black" /></div>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`absolute left-0 top-full mt-2 w-64 origin-top-left overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl backdrop-blur-xl transition-all duration-200 ${isUserMenuOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0'}`}>
                      <div className="border-b border-white/5 bg-white/5 p-4"><p className="truncate text-sm font-bold text-white">{session.user?.name}</p><p className="truncate text-xs text-gray-400">{session.user?.email}</p></div>
                      <div className="space-y-1 p-2">
                        <DropdownLink href="/portfolio" icon={<Briefcase size={16} />} label="محفظتي" />
                        <DropdownLink href="/daily-summary" icon={<CalendarDays size={16} />} label="ملخص اليوم" cyan />
                        <DropdownLink href="/match-digests" icon={<FileText size={16} />} label="ملخصات المباريات" cyan />
                        {isAdminUser && <><DropdownLink href="/admin" icon={<ShieldAlert size={16} />} label="الإدارة" danger /><DropdownLink href="/admin/content-studio" icon={<FileText size={16} />} label="استوديو المحتوى" gold /><DropdownLink href="/admin/news" icon={<Newspaper size={16} />} label="إدارة الأخبار" cyan /><DropdownLink href="/admin/match-events" icon={<Trophy size={16} />} label="إدارة أحداث المباراة" gold /></>}
                      </div>
                      <div className="border-t border-white/5 p-2"><button onClick={() => signOut({ callbackUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"><LogOut size={16} /> تسجيل الخروج</button></div>
                    </div>
                  </div>
                </div>
              ) : <div className="hidden items-center gap-3 lg:flex"><Link href="/login" className="px-4 py-2 text-sm font-bold text-gray-300 transition-colors hover:text-white">تسجيل الدخول</Link><Link href="/register" className="rounded-full bg-[#0FF0FC] px-6 py-2 text-sm font-black text-black shadow-[0_0_15px_rgba(15,240,252,0.3)] transition-all hover:bg-[#0FF0FC]/80">إنشاء حساب</Link></div>}
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-white/10 bg-black/95 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <img src={headerLogo} alt="بورصة المونديال 2026" className="h-12 w-12 rounded-2xl bg-white object-contain p-1" />
              <div><div className="text-sm font-black text-white">بورصة المونديال 2026</div><div className="text-xs font-bold leading-5 text-gray-300">{slogan}</div></div>
            </div>
            <div className="space-y-2 px-4 py-4">
              {navLinks.map((link) => <Link key={link.href} href={link.href} onClick={closeMobileMenu} className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-colors ${isLinkActive(link) ? 'border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>{link.icon}{link.name}</Link>)}
              <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/[0.04] p-2"><div className="px-2 pb-2 text-xs font-black text-[#FFD700]">البورصة — كل ما يخص التداول</div>{exchangeLinks.map((link) => <DropdownLink key={link.href} href={link.href} onClick={closeMobileMenu} icon={link.icon} label={link.name} />)}</div>
              {session && <><Link href="/daily-summary" onClick={closeMobileMenu} className="flex items-center gap-3 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 font-bold text-[#0FF0FC]"><CalendarDays size={16} /> ملخص اليوم</Link><Link href="/match-digests" onClick={closeMobileMenu} className="flex items-center gap-3 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 font-bold text-[#0FF0FC]"><FileText size={16} /> ملخصات المباريات</Link>{isAdminUser && <Link href="/admin" onClick={closeMobileMenu} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-bold text-red-400"><ShieldAlert size={16} /> الإدارة</Link>}<button onClick={() => signOut({ callbackUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-400 hover:bg-red-500/10 hover:text-red-500"><LogOut size={16} /> تسجيل الخروج</button></>}
            </div>
          </div>
        )}
      </nav>
      <div className="h-20" />
      <InsufficientFundsModal isOpen={showInsufficientFundsModal} onClose={() => setShowInsufficientFundsModal(false)} />
    </>
  );
}
