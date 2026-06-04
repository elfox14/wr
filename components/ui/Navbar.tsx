'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Wallet, TrendingUp, LogOut, User as UserIcon, Bell } from 'lucide-react';
import { useStore } from '@/lib/store';
import { NewsTicker } from './NewsTicker';

export function Navbar() {
  const { data: session, status } = useSession();
  const { userStats } = useStore(); // We use the store to get the real balance if logged in

  return (
    <nav className="w-full border-b border-white/10 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <TrendingUp className="text-[#0FF0FC]" size={28} />
              <span className="font-bold text-xl tracking-wider text-white">
                WorldCup <span className="text-[#0FF0FC]">Exchange</span>
              </span>
            </Link>
            
            <div className="hidden md:flex space-x-8 space-x-reverse items-center">
              <Link href="/market" className="text-gray-300 hover:text-white transition-colors">السوق</Link>
              <Link href="/groups" className="text-gray-300 hover:text-white transition-colors">المجموعات</Link>
              <Link href="/matches" className="text-gray-300 hover:text-white transition-colors">المباريات</Link>
              {session && (
                <>
                  <Link href="/portfolio" className="text-gray-300 hover:text-white transition-colors">المحفظة</Link>
                  <Link href="/leaderboard" className="text-gray-300 hover:text-white transition-colors">الترتيب</Link>
                  <Link href="/rewards" className="text-[#FFD700] font-bold hover:text-white transition-colors">المكافآت</Link>
                  {/* Mock admin access check based on role, for demo just showing link */}
                  <Link href="/admin" className="text-red-400 hover:text-red-300 font-medium transition-colors">
                    الإدارة
                  </Link>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <span className="text-gray-500">...</span>
            ) : session ? (
              <div className="flex items-center gap-4">
                <button className="text-gray-400 hover:text-[#0FF0FC] transition-colors relative">
                  <Bell size={20} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="bg-black/50 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                  <Wallet size={16} className="text-[#FFD700]" />
                  <span className="font-mono font-bold text-[#FFD700]">
                    {userStats ? userStats.balance : '...'} ¢
                  </span>
                </div>
                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                  <UserIcon size={18} className="text-gray-400" />
                  <span className="text-sm font-bold hidden sm:inline-block max-w-[100px] truncate" title={session.user?.name || session.user?.email || ''}>
                    {session.user?.name || session.user?.email}
                  </span>
                  <button onClick={() => signOut({ callbackUrl: '/' })} className="ml-2 text-gray-500 hover:text-red-500 transition-colors">
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="px-4 py-2 text-sm font-bold text-white hover:text-[#0FF0FC] transition-colors">
                  تسجيل الدخول
                </Link>
                <Link href="/register" className="px-4 py-2 text-sm font-bold bg-[#0FF0FC] text-black rounded-lg hover:bg-[#0FF0FC]/80 transition-colors">
                  ابدأ الآن
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Wrapper to distinctly separate Ticker from header */}
      <div className="w-full bg-black/80 border-t border-b border-white/10 mt-1 shadow-lg">
        <NewsTicker />
      </div>
    </nav>
  );
}
