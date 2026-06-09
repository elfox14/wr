'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Briefcase, CalendarDays, Home, Trophy, WalletCards } from 'lucide-react';

const mobileNavItems = [
  { name: 'الرئيسية', href: '/', icon: Home },
  { name: 'السوق', href: '/market', icon: BarChart3 },
  { name: 'المباريات', href: '/matches', icon: CalendarDays },
  { name: 'الترتيب', href: '/leaderboard', icon: Trophy },
  { name: 'محفظتي', href: '/portfolio', icon: Briefcase },
];

function isActivePath(pathname: string | null, href: string) {
  if (href === '/') return pathname === '/';
  return Boolean(pathname?.startsWith(href));
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-black/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-10px_35px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 text-[10px] font-black transition-all active:scale-95 ${
                active
                  ? 'bg-[#0FF0FC]/15 text-[#0FF0FC] shadow-[0_0_18px_rgba(15,240,252,0.12)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {active && <span className="absolute -top-1 h-1 w-7 rounded-full bg-[#0FF0FC]" />}
              <Icon size={20} strokeWidth={active ? 2.8 : 2.2} />
              <span className="leading-none">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
