'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseSlotProps = {
  slot?: string;
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical';
  minHeight?: number;
  className?: string;
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-9147440531390790';

export default function AdSenseSlot({ slot, format = 'auto', minHeight = 120, className = '' }: AdSenseSlotProps) {
  useEffect(() => {
    if (!slot || typeof window === 'undefined') return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {}
  }, [slot]);

  return (
    <aside
      aria-label="إعلان"
      className={`my-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20 ${className}`}
      style={{ minHeight }}
    >
      <div className="border-b border-white/10 px-3 py-1 text-center text-[10px] font-black text-slate-500">إعلان</div>
      {slot ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      ) : (
        <div className="flex items-center justify-center px-4 py-8 text-center text-xs font-bold leading-6 text-slate-500" style={{ minHeight: Math.max(80, minHeight - 24) }}>
          مساحة إعلان محجوزة بدون تحميل إعلان فعلي. أضف NEXT_PUBLIC_ADSENSE_ARTICLE_SLOT أو مرر رقم slot لتفعيلها.
        </div>
      )}
    </aside>
  );
}
