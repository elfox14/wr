'use client';

import { useEffect, useRef, useState } from 'react';

type AdSenseBannerProps = {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  responsive?: 'true' | 'false';
  style?: React.CSSProperties;
  className?: string;
};

export default function AdSenseBanner({
  slot,
  format = 'auto',
  responsive = 'true',
  style,
  className,
}: AdSenseBannerProps) {
  const [isDev, setIsDev] = useState(false);
  const adInitialized = useRef(false);

  useEffect(() => {
    // Check if we are in development environment
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true);
    }
  }, []);

  useEffect(() => {
    // In production, push the ad to adsbygoogle
    if (!isDev && typeof window !== 'undefined') {
      try {
        const adsbygoogle = (window as any).adsbygoogle || [];
        // Only push if not already initialized for this component instance
        if (!adInitialized.current) {
          adsbygoogle.push({});
          adInitialized.current = true;
        }
      } catch (err) {
        console.error('AdSense initialization error:', err);
      }
    }
  }, [isDev, slot]);

  // Premium design container with a subtle glassmorphism background to prevent CLS
  const containerClasses = `adsense-container min-h-[100px] w-full overflow-hidden flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-2xl p-4 my-6 text-center select-none ${className || ''}`;

  if (isDev) {
    return (
      <div className={containerClasses} style={style}>
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-full bg-[#0FF0FC]/10 border border-[#0FF0FC]/25 px-3 py-1 text-[10px] font-black text-[#0FF0FC] tracking-wider uppercase">
            مساحة إعلانية (معاينة التطوير)
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1">Google AdSense Banner</p>
          <span className="text-[10px] font-mono text-gray-500">
            Slot: {slot} | Format: {format}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minWidth: '250px', width: '100%', height: '100%', ...style }}
        data-ad-client="ca-pub-9147440531390790"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}
