'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { BookOpen, Brain, Briefcase, CalendarDays, ChevronDown, Coins, Gift, LogOut, Menu, Newspaper, Radio, Shield, ShieldAlert, Trophy, User as UserIcon, Users, X, TrendingUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { InsufficientFundsModal } from './InsufficientFundsModal';

const adminEmails = new Set(['worldcup@mcprim.com', 'elfox14usa@gmail.com']);

export function Navbar() {
  const { data: session, status } = useSession();
  const { userStats, showInsufficientFundsModal, setShowInsufficientFundsModal, fetchPortfolio } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userEmail = session?.user?.email ?? '';
  const userRole = (session?.user as any)?.role;
  const isAuthenticated = status === 'authenticated';
  const isAdminUser = isAuthenticated && (adminEmails.has(userEmail) || userRole === 'ADMIN');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (session && !userStats) fetchPortfolio();
  }, [session, userStats, fetchPortfolio]);

  const navLinks = [
    { name: 'مركز التحليل', href: '/team-intelligence', icon: <Brain size={16} /> },
    { name: 'الأخبار', href: '/news', icon: <Newspaper size={16} /> },
    { name: 'المجموعات', href: '/groups', icon: <Trophy size={16} /> },
    { name: 'المنتخبات', href: '/market?type=TEAM', icon: <Shield size={16} />, activeType: 'TEAM' },
    { name: 'اللاعبون', href: '/market?type=PLAYER', icon: <Users size={16} />, activeType: 'PLAYER' },
    { name: 'السوق', href: '/market', icon: <TrendingUp size={16} /> },
    { name: 'المباريات', href: '/matches', icon: <CalendarDays size={16} /> },
    { name: 'بث أنيميشن', href: '/animation-live', icon: <Radio size={16} /> },
    { name: 'المحفظة', href: '/portfolio', icon: <Briefcase size={16} /> },
    { name: 'المنهجية', href: '/methodology', icon: <BookOpen size={16} /> },
  ];

  const isLinkActive = (link: { href: string; activeType?: string }) => {
    if (link.activeType) return pathname === '/market' && searchParams?.get('type') === link.activeType;
    if (link.href === '/market') return pathname === '/market' && !searchParams?.get('type');
    return pathname?.startsWith(link.href);
  };

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/80 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <Image src="/brand/logo-horizontal.png" alt="MC PRIME Exchange" width={220} height={48} className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105 lg:h-12" priority />
            </Link>

            <div className="hidden flex-1 items-center justify-center space-x-2 space-x-reverse px-8 lg:flex">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link);
                return <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-all duration-300 ${isActive ? 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC] shadow-[0_0_10px_rgba(15,240,252,0.1)]' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}>{link.icon}{link.name}</Link>;
              })}
            </div>

            <div className="flex items-center gap-3">
              {status === 'loading' ? <div className="h-10 w-32 animate-pulse rounded-full bg-white/5" /> : session ? (
                <div className="hidden items-center gap-4 lg:flex">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition-colors hover:bg-white/10">
                    <span className="text-xs font-bold text-gray-400">رصيدك:</span>
                    <span className="font-mono text-sm font-bold text-[#FFD700]">{userStats ? userStats.balance.toLocaleString() : '...'} ¢</span>
                  </div>
                  <Link href="/rewards" className="flex items-center gap-2 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-5 py-2 text-sm font-black text-[#FFD700] transition-all hover:bg-[#FFD700] hover:text-black"><Coins size={16} /> اكسب كوينز</Link>
                  <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 pr-3 transition-all hover:bg-white/10">
                      <span className="max-w-[80px] truncate text-xs font-bold text-white">{session.user?.name?.split(' ')[0] || session.user?.email?.split('@')[0]}</span>
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#0FF0FC] to-[#FFD700]"><UserIcon size={14} className="text-black" /></div>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`absolute left-0 top-full mt-2 w-60 origin-top-left overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl backdrop-blur-xl transition-all duration-200 ${isDropdownOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0'}`}>
                      <div className="border-b border-white/5 bg-white/5 p-4"><p className="truncate text-sm font-bold text-white">{session.user?.name}</p><p className="truncate text-xs text-gray-400">{session.user?.email}</p></div>
                      <div className="space-y-1 p-2">
                        <DropdownLink href="/portfolio" icon={<Briefcase size={16} />} label="محفظتي" />
                        <DropdownLink href="/news" icon={<Newspaper size={16} />} label="الأخبار" cyan />
                        <DropdownLink href="/daily-summary" icon={<CalendarDays size={16} />} label="ملخص اليوم" />
                        <DropdownLink href="/team-intelligence" icon={<Shield size={16} />} label="مركز التحليل" />
                        <DropdownLink href="/animation-live" icon={<Radio size={16} />} label="بث أنيميشن" gold />
                        <DropdownLink href="/methodology" icon={<BookOpen size={16} />} label="منهجية التسعير" />
                        <DropdownLink href="/rewards" icon={<Gift size={16} />} label="المكافآت" gold />
                        {isAdminUser && <><DropdownLink href="/admin" icon={<ShieldAlert size={16} />} label="الإدارة" danger /><DropdownLink href="/admin/news" icon={<Newspaper size={16} />} label="إدارة الأخبار" cyan /><DropdownLink href="/admin/match-events" icon={<Trophy size={16} />} label="إدارة أحداث المباراة" gold /></>}
                      </div>
                      <div className="border-t border-white/5 p-2"><button onClick={() => signOut({ callbackUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"><LogOut size={16} /> تسجيل الخروج</button></div>
                    </div>
                  </div>
                </div>
              ) : <div className="hidden items-center gap-3 lg:flex"><Link href="/login" className="px-4 py-2 text-sm font-bold text-gray-300 transition-colors hover:text-white">تسجيل الدخول</Link><Link href="/register" className="rounded-full bg-[#0FF0FC] px-6 py-2 text-sm font-black text-black shadow-[0_0_15px_rgba(15,240,252,0.3)] transition-all hover:bg-[#0FF0FC]/80">إنشاء حساب</Link></div>}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden">{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && <div className="border-t border-white/10 bg-black/95 backdrop-blur-xl lg:hidden"><div className="space-y-2 px-4 py-4">{navLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-colors ${isLinkActive(link) ? 'border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>{link.icon}{link.name}</Link>)}{session && <><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"><div className="flex items-center justify-between"><span className="text-sm text-gray-400">الرصيد</span><span className="font-mono font-bold text-[#FFD700]">{userStats ? userStats.balance.toLocaleString() : '...'} ¢</span></div></div><Link href="/daily-summary" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-[#0FF0FC] bg-[#0FF0FC]/10 border border-[#0FF0FC]/20"><CalendarDays size={16} /> ملخص اليوم</Link><Link href="/rewards" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/20"><Gift size={16} /> اكسب كوينز</Link>{isAdminUser && <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-bold text-red-400"><ShieldAlert size={16} /> الإدارة</Link>}<button onClick={() => signOut({ callbackUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-400 hover:bg-red-500/10 hover:text-red-500"><LogOut size={16} /> تسجيل الخروج</button></>}</div></div>}
      </nav>
      <div className="h-16 lg:h-20" />
      <InsufficientFundsModal isOpen={showInsufficientFundsModal} onClose={() => setShowInsufficientFundsModal(false)} />
    </>
  );
}

function DropdownLink({ href, icon, label, cyan, gold, danger }: { href: string; icon: React.ReactNode; label: string; cyan?: boolean; gold?: boolean; danger?: boolean }) {
  const color = danger ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : cyan ? 'text-[#0FF0FC] hover:bg-[#0FF0FC]/10' : gold ? 'text-[#FFD700] hover:bg-[#FFD700]/10' : 'text-gray-300 hover:text-white hover:bg-white/5';
  return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${color}`}>{icon}{label}</Link>;
}
