'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Props = {
  src: string;
  matchId: string;
  lang: string;
  statsPanel: string;
  teamPanel: string;
};

function withReloadToken(src: string, reloadKey: number) {
  try {
    const url = new URL(src);
    url.searchParams.set('_reload', String(reloadKey));
    return url.toString();
  } catch {
    return src;
  }
}

export default function AnimationIframe({ src, matchId, lang, statsPanel, teamPanel }: Props) {
  const [reloadKey, setReloadKey] = useState(1);
  const [autoReload, setAutoReload] = useState(true);
  const [lastReloadAt, setLastReloadAt] = useState(() => new Date());

  const iframeSrc = useMemo(() => withReloadToken(src, reloadKey), [src, reloadKey]);

  function reloadIframe() {
    setReloadKey((value) => value + 1);
    setLastReloadAt(new Date());
  }

  useEffect(() => {
    if (!autoReload) return;
    const interval = window.setInterval(() => {
      reloadIframe();
    }, 90_000);
    return () => window.clearInterval(interval);
  }, [autoReload]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black text-gray-300 md:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <span>Match ID: {matchId}</span>
          <span>Language: {lang}</span>
          <span>Stats: {statsPanel}</span>
          <span>Team Panel: {teamPanel || 'default'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-gray-400">
            آخر تحديث: {lastReloadAt.toLocaleTimeString('ar-EG')}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-gray-200">
            <input
              type="checkbox"
              checked={autoReload}
              onChange={(event) => setAutoReload(event.target.checked)}
              className="h-3 w-3 accent-[#0FF0FC]"
            />
            تحديث تلقائي 90ث
          </label>
          <button
            type="button"
            onClick={reloadIframe}
            className="inline-flex items-center gap-1 rounded-full border border-[#0FF0FC]/30 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black"
          >
            <RefreshCw size={12} />
            إعادة تحميل البث
          </button>
        </div>
      </div>
      <iframe
        key={reloadKey}
        title="Football Animation Live"
        src={iframeSrc}
        className="h-[82vh] w-full border-0 bg-black sm:h-[80vh] lg:h-[78vh]"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
