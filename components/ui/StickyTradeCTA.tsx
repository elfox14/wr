'use client';

import Link from 'next/link';
import { ArrowUpLeft, ShoppingCart, TrendingUp } from 'lucide-react';

type StickyTradeCTAProps = {
  assetId: string;
  assetName?: string | null;
  price?: number | null;
  isTeam?: boolean;
};

export function StickyTradeCTA({ assetId, assetName, price, isTeam = false }: StickyTradeCTAProps) {
  const safePrice = Math.round(Number(price || 0));

  return (
    <div className="lg:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.7rem)] z-[58]">
      <div className="mx-auto max-w-md rounded-[1.4rem] border border-[#0FF0FC]/25 bg-black/90 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <Link
            href={`/asset/${assetId}#trade-panel`}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[1.1rem] bg-[#0FF0FC] px-4 py-3 text-black active:scale-[0.98]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ShoppingCart size={18} />
              <span className="truncate text-sm font-black">تداول {isTeam ? 'المنتخب' : 'الأصل'}</span>
            </span>
            <span className="shrink-0 text-xs font-black tabular-nums">{safePrice.toLocaleString()}¢</span>
          </Link>
          <Link
            href="/market"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/10 text-white active:scale-95"
            aria-label="السوق"
          >
            <TrendingUp size={19} />
          </Link>
        </div>
        {assetName && (
          <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-gray-400">
            <ArrowUpLeft size={12} /> وصول سريع للتداول: {assetName}
          </div>
        )}
      </div>
    </div>
  );
}
