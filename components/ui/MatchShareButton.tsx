'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

type MatchShareButtonProps = {
  title: string;
  url: string;
  label?: string;
  className?: string;
};

export default function MatchShareButton({ title, url, label = 'شارك المباراة', className = '' }: MatchShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const text = `${title} على MC PRIME World Cup — تابع مركز المباراة والتحليل المباشر.`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: absoluteUrl });
      } else {
        await navigator.clipboard.writeText(`${text} ${absoluteUrl}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };

  return (
    <button type="button" onClick={handleShare} className={`inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-gray-300 transition hover:border-[#0FF0FC]/25 hover:bg-[#0FF0FC]/10 hover:text-[#0FF0FC] ${className}`}>
      <Share2 size={14} />
      {copied ? 'تم النسخ' : label}
    </button>
  );
}
