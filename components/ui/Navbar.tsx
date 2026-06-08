'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { 
  Trophy, 
  TrendingUp, 
  CalendarDays, 
  Grid3X3, 
  Gift, 
  Briefcase, 
  LogOut, 
  User as UserIcon, 
  Menu, 
  X, 
  ChevronDown,
  Coins,
  ShieldAlert
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { InsufficientFundsModal } from './InsufficientFundsModal';

export function Navbar() {
  const { data: session, status } = useSession();
  const { userStats, showInsufficientFundsModal, setShowInsufficientFundsModal, fetchPortfolio } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [pathname]);

  // Fetch portfolio if logged in but no stats
  useEffect(() => {
    if (session && !userStats) {
      fetchPortfolio();
    }
  }, [session, userStats, fetchPortfolio]);

  const navLinks = [
    { name: 'السوق', href: '/market', icon: <TrendingUp size={16} /> },
    { name: 'المباريات', href: '/matches', icon: <CalendarDays size={16} /> },
    { name: 'المجموعات', href: '/groups', icon: <Grid3X3 size={16} /> },
    { name: 'الترتيب', href: '/leaderboard', icon: <Trophy size={16} /> },
    { name: 'المكافآت', href: '/rewards', icon: <Gift size={16} /> },
    { name: 'المحفظة', href: '/portfolio', icon: <Briefcase size={16} /> },
  ];

  return (
    <>
      <nav className="w-full fixed top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-all">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 lg:h-20">
            
            {/* RIGHT: Logo Section */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-3 group">
                <Image 
                  src="/brand/logo-horizontal.png" 
                  alt="MC PRIME Exchange" 
                  width={220} 
                  height={48} 
                  className="object-contain transition-transform duration-300 group-hover:scale-105 h-10 lg:h-12 w-auto" 
                  priority 
                />
              </Link>
            </div>
            
            {/* CENTER: Desktop Navigation */}
            <div className="hidden lg:flex items-center justify-center space-x-2 space-x-reverse flex-1 px-8">
              {navLinks.map((link) => {
                const isActive = pathname?.startsWith(link.href);
                return (
                  <Link 
                    key={link.href} 
                    href={link.href} 
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl transition-all duration-300
                      ${isActive 
                        ? 'bg-[#0FF0FC]/10 border border-[#0FF0FC]/20 text-[#0FF0FC] shadow-[0_0_10px_rgba(15,240,252,0.1)]' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}
                    `}
                  >
                    {link.icon}
                    {link.name}
                  </Link>
                );
              })}
            </div>
            
            {/* LEFT: Action Section */}
            <div className="flex items-center gap-3">
              {status === 'loading' ? (
                <div className="w-32 h-10 bg-white/5 animate-pulse rounded-full"></div>
              ) : session ? (
                <div className="hidden lg:flex items-center gap-4">
                  
                  {/* Balance Pill */}
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 group hover:bg-white/10 transition-colors">
                    <span className="text-gray-400 text-xs font-bold">رصيدك:</span>
                    <span className="font-mono font-bold text-[#FFD700] text-sm group-hover:animate-pulse">
                      {userStats ? userStats.balance.toLocaleString() : '...'} ¢
                    </span>
                  </div>

                  {/* Free Coins Button */}
                  <Link 
                    href="/rewards"
                    className="bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700] hover:text-black hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] px-5 py-2 rounded-full font-black text-sm flex items-center gap-2 transition-all duration-300"
                  >
                    <Coins size={16} />
                    اكسب كوينز
                  </Link>

                  {/* User Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex items-center gap-2 p-1.5 pr-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
                    >
                      <span className="text-xs font-bold text-white max-w-[80px] truncate">
                        {session.user?.name?.split(' ')[0] || session.user?.email?.split('@')[0]}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0FF0FC] to-[#FFD700] flex items-center justify-center overflow-hidden">
                         <UserIcon size={14} className="text-black" />
                      </div>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    <div className={`absolute left-0 top-full mt-2 w-56 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-200 transform origin-top-left ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                      <div className="p-4 border-b border-white/5 bg-white/5">
                        <p className="text-sm font-bold text-white truncate">{session.user?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{session.user?.email}</p>
                      </div>
                      <div className="p-2 space-y-1">
                        <Link href="/portfolio" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                          <Briefcase size={16} /> محفظتي
                        </Link>
                        <Link href="/leagues" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                          <Trophy size={16} /> دورياتي
                        </Link>
                        <Link href="/rewards" className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#FFD700] hover:bg-[#FFD700]/10 rounded-xl transition-colors font-bold">
                          <Gift size={16} /> المكافآت
                        </Link>
                        {session.user?.email === 'admin@worldcup.com' && (
                          <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors">
                            <ShieldAlert size={16} /> الإدارة
                          </Link>
                        )}
                      </div>
                      <div className="p-2 border-t border-white/5">
                        <button 
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <LogOut size={16} /> تسجيل الخروج
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="hidden lg:flex items-center gap-3">
                  <Link 
                    href="/login" 
                    className="px-4 py-2 text-sm font-bold text-gray-300 hover:text-white transition-colors"
                  >
                    تسجيل الدخول
                  </Link>
                  <Link 
                    href="/register" 
                    className="bg-[#0FF0FC] hover:bg-[#0FF0FC]/80 text-black px-6 py-2 rounded-full font-black text-sm shadow-[0_0_15px_rgba(15,240,252,0.3)] hover:shadow-[0_0_20px_rgba(15,240,252,0.5)] transition-all"
                  >
                    إنشاء حساب
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button 
                className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
              </button>

            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <div 
          className={`lg:hidden fixed inset-x-0 top-[64px] h-[calc(100vh-64px)] bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 transition-all duration-300 overflow-y-auto ${
            isMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          <div className="p-4 flex flex-col min-h-full">
            
            {session && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0FF0FC] to-[#FFD700] flex items-center justify-center overflow-hidden">
                     <UserIcon size={24} className="text-black" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{session.user?.name}</p>
                    <p className="text-xs text-gray-400">{session.user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-black/50 p-3 rounded-xl mb-4">
                  <span className="text-sm text-gray-400">الرصيد المتاح:</span>
                  <span className="font-mono font-black text-[#FFD700] text-lg">
                    {userStats ? userStats.balance.toLocaleString() : '...'} ¢
                  </span>
                </div>

                <Link 
                  href="/rewards"
                  className="w-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700] hover:text-black py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Coins size={18} />
                  اكسب كوينز
                </Link>
              </div>
            )}

            <div className="space-y-2 mb-6 flex-1">
              {navLinks.map((link) => {
                const isActive = pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl text-base font-bold transition-colors ${
                      isActive
                        ? 'bg-[#0FF0FC]/10 border border-[#0FF0FC]/20 text-[#0FF0FC]'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    {link.icon}
                    {link.name}
                  </Link>
                );
              })}
              {session && (
                <Link
                  href="/leagues"
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl text-base font-bold transition-colors ${
                    pathname?.startsWith('/leagues')
                      ? 'bg-[#0FF0FC]/10 border border-[#0FF0FC]/20 text-[#0FF0FC]'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Trophy size={18} />
                  دورياتي
                </Link>
              )}
            </div>
            
            {session ? (
              <button 
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white py-4 rounded-xl font-bold text-base transition-colors mt-auto"
              >
                <LogOut size={20} /> تسجيل الخروج
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <Link 
                  href="/login" 
                  className="flex justify-center bg-white/5 text-white py-4 rounded-xl font-bold text-sm"
                >
                  تسجيل الدخول
                </Link>
                <Link 
                  href="/register" 
                  className="flex justify-center bg-[#0FF0FC] text-black py-4 rounded-xl font-black text-sm"
                >
                  إنشاء حساب
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-16 lg:h-20" />
      
      <InsufficientFundsModal 
        isOpen={showInsufficientFundsModal} 
        onClose={() => setShowInsufficientFundsModal(false)} 
      />
    </>
  );
}
