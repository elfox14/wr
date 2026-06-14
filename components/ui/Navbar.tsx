'use client';

import Link from 'next/link';

const links = [
  ['/', 'Home'],
  ['/news', 'News'],
  ['/groups', 'Groups'],
  ['/teams', 'Teams'],
  ['/players', 'Players'],
  ['/matches', 'Matches'],
  ['/team-intelligence', 'Analysis'],
  ['/animation-live', 'Live'],
];

export function Navbar() {
  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="font-black text-white">MC PRIME World Cup</Link>
          <div className="hidden items-center gap-2 lg:flex">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-bold text-gray-300 hover:bg-white/10 hover:text-white">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div className="h-20" />
    </>
  );
}
