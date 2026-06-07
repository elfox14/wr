'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Wallet, TrendingUp, LogOut, User as UserIcon, Bell, PlayCircle, Menu, X, ChevronDown } from 'lucide-react';
import { useStore } from '@/lib/store';
import { RewardedAdModal } from './RewardedAdModal';

export function Navbar() {
  const { data: session, status } = useSession();
  const { userStats } = useStore();
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: 'السوق', href: '/market' },
    { name: 'الاكتتاب', href: '/ipo', highlight: true },
    { name: 'المقالات', href: '/articles' },
    { name: 'المجموعات', href: '/groups' },
    { name: 'المباريات', href: '/matches' },
  ];

  const authLinks = [
    { name: 'المحفظة', href: '/portfolio' },
    { name: 'الترتيب', href: '/leaderboard' },
    { name: 'المكافآت', href: '/rewards' },
    { name: 'الإدارة', href: '/admin', admin: true },
  ];

  return (
    <>
      <nav 
        className={`w-full fixed top-0 z-50 transition-all duration-300 ease-in-out border-b ${
          scrolled 
            ? 'bg-background/80 backdrop-blur-xl border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] py-2' 
            : 'bg-background/40 backdrop-blur-md border-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            
            {/* Logo Section */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                  <TrendingUp className="text-white" size={24} />
                </div>
                <span className="font-black text-xl tracking-wide text-white hidden sm:block">
                  WorldCup <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Exchange</span>
                </span>
              </Link>
              
              {/* Desktop Navigation */}
              <div className="hidden lg:flex space-x-6 space-x-reverse items-center">
                {navLinks.map((link) => {
                  const isActive = pathname?.startsWith(link.href);
                  return (
                    <Link 
                      key={link.href} 
                      href={link.href} 
                      className={`relative px-1 py-2 text-sm font-bold transition-colors duration-300
                        ${link.highlight ? 'text-emerald-400 hover:text-emerald-300' : 
                          isActive ? 'text-primary' : 'text-gray-400 hover:text-white'}
                      `}
                    >
                      {link.name}
                      {isActive && (
                        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--color-primary),0.8)]" />
                      )}
                    </Link>
                  );
                })}

                {session && (
                  <div className="flex space-x-6 space-x-reverse items-center border-r border-white/10 pr-6">
                    {authLinks.map((link) => {
                      const isActive = pathname?.startsWith(link.href);
                      return (
                        <Link 
                          key={link.href} 
                          href={link.href} 
                          className={`relative px-1 py-2 text-sm font-bold transition-colors duration-300
                            ${link.admin ? 'text-danger hover:text-red-400' : 
                              isActive ? 'text-accent' : 'text-gray-300 hover:text-white'}
                          `}
                        >
                          {link.name}
                          {isActive && (
                            <span className={`absolute -bottom-1 left-0 right-0 h-0.5 rounded-full ${link.admin ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-accent shadow-[0_0_8px_rgba(255,215,0,0.8)]'}`} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Action Section */}
            <div className="flex items-center gap-3 sm:gap-4">
              {status === 'loading' ? (
                <div className="w-20 h-8 bg-white/5 animate-pulse rounded-lg"></div>
              ) : session ? (
                <div className="flex items-center gap-3">
                  
                  {/* Action Buttons */}
                  <div className="hidden sm:flex items-center gap-3">
                    <button 
                      onClick={() => setIsAdOpen(true)}
                      className="group relative overflow-hidden bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-300"
                    >
                      <div className="absolute inset-0 w-1/4 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 -translate-x-full group-hover:animate-shine" />
                      <PlayCircle size={16} className="group-hover:scale-110 transition-transform" />
                      <span className="text-xs">شحن مجاني</span>
                    </button>

                    <button className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                      <Bell size={20} />
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-background"></span>
                    </button>
                  </div>

                  {/* Balance Display */}
                  <div className="bg-black/40 border border-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 shadow-inner">
                    <Wallet size={16} className="text-accent" />
                    <span className="font-mono font-bold text-accent tabular-nums text-sm sm:text-base">
                      {userStats ? userStats.balance.toLocaleString() : '...'} ¢
                    </span>
                  </div>

                  {/* User Menu */}
                  <div className="hidden sm:flex items-center gap-3 pl-2 border-r border-white/10 pr-4">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-white max-w-[100px] truncate" title={session.user?.name || session.user?.email || ''}>
                        {session.user?.name || session.user?.email}
                      </span>
                      <span className="text-[10px] text-gray-500">متداول نشط</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-accent p-[2px]">
                      <div className="w-full h-full bg-background rounded-full flex items-center justify-center overflow-hidden">
                         <UserIcon size={16} className="text-gray-300" />
                      </div>
                    </div>
                    <button 
                      onClick={() => signOut({ callbackUrl: '/' })} 
                      className="p-2 text-gray-500 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors ml-1"
                      title="تسجيل الخروج"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link 
                    href="/login" 
                    className="px-3 py-2 sm:px-4 text-xs sm:text-sm font-bold text-gray-300 hover:text-white transition-colors"
                  >
                    دخول
                  </Link>
                  <Link 
                    href="/register" 
                    className="relative px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary-light transition-all shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--color-primary),0.5)] overflow-hidden group"
                  >
                    <div className="absolute inset-0 w-1/4 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:animate-shine" />
                    ابدأ التداول
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button 
                className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div 
          className={`lg:hidden absolute top-full left-0 w-full bg-background/95 backdrop-blur-xl border-b border-white/10 transition-all duration-300 overflow-hidden ${
            isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                  pathname?.startsWith(link.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
            
            {session && (
              <>
                <div className="h-px bg-white/10 my-2 mx-4" />
                {authLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                      pathname?.startsWith(link.href)
                        ? link.admin ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
                        : link.admin ? 'text-danger/80 hover:bg-danger/10' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
                
                {/* Mobile User Actions */}
                <div className="grid grid-cols-2 gap-2 mt-4 px-2">
                  <button 
                    onClick={() => setIsAdOpen(true)}
                    className="flex items-center justify-center gap-2 bg-accent/10 text-accent py-2.5 rounded-xl font-bold text-sm"
                  >
                    <PlayCircle size={16} /> شحن
                  </button>
                  <button 
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex items-center justify-center gap-2 bg-white/5 text-gray-400 hover:text-danger py-2.5 rounded-xl font-bold text-sm transition-colors"
                  >
                    <LogOut size={16} /> خروج
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
      
      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-20" />
      
      <RewardedAdModal isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} />
    </>
  );
}
