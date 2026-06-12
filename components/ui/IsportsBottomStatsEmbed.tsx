'use client';

import Link from 'next/link';
import { BarChart3, ExternalLink } from 'lucide-react';

type Props = {
  matchId?: number | string | null;
  compact?: boolean;
  title?: string;
  className?: string;
};

export function getIsportsPcUrl(matchId?: number | string | null) {
  if (!matchId) return '';
  const url = new URL('https://www.isportslive8.com/football/pc.html');
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', 'en');
  url.searchParams.set('v', '1');
  return url.toString();
}

export function IsportsBottomStatsEmbed({ matchId, compact = false, title = 'إحصائيات البث المباشر', className = '' }: Props) {
  const src = getIsportsPcUrl(matchId);
  if (!src) return null;

  return (
    <section className={`rounded-2xl border border-[#0FF0FC]/15 bg-black/35 p-2 ${className}`} onClick={(event) => event.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] font-black">
        <span className="inline-flex items-center gap-1 text-[#0FF0FC]"><BarChart3 size={12} /> {title}</span>
        <Link href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gray-500 transition hover:text-[#FFD700]">
          فتح كامل <ExternalLink size={11} />
        </Link>
      </div>
      <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#202020] ${compact ? 'h-[132px] sm:h-[154px]' : 'h-[178px] sm:h-[220px]'}`}>
        <iframe
          title={`iSports live stats ${matchId}`}
          src={src}
          className="absolute left-0 w-full border-0 bg-[#202020]"
          style={{
            top: compact ? '-388px' : '-372px',
            height: compact ? '560px' : '620px',
            pointerEvents: 'none',
          }}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="mt-2 px-1 text-[10px] leading-4 text-gray-500">عرض بصري مباشر من iSports؛ لا يستخدم رصيد API الخاص بالمنصة.</p>
    </section>
  );
}
