'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MatchEventView } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

function meta(e: MatchEventView) {
  const x = `${e.type || ''} ${e.detail || ''}`.toLowerCase();
  if (x.includes('goal') || x.includes('هدف')) return { label: 'هدف', icon: 'G' };
  if (x.includes('red') || x.includes('حمراء')) return { label: 'بطاقة حمراء', icon: 'R' };
  if (x.includes('yellow') || x.includes('صفراء')) return { label: 'بطاقة صفراء', icon: 'Y' };
  if (x.includes('sub') || x.includes('تبديل')) return { label: 'تبديل', icon: 'S' };
  if (x.includes('pen')) return { label: 'ركلة جزاء', icon: 'P' };
  if (x.includes('var')) return { label: 'VAR', icon: 'V' };
  return { label: 'حدث', icon: '•' };
}
function posX(e: MatchEventView) { const n = Number(e.x ?? e.shot?.x); return Number.isFinite(n) ? Math.max(2, Math.min(98, n)) : null; }
function posY(e: MatchEventView) { const n = Number(e.y ?? e.shot?.y); return Number.isFinite(n) ? Math.max(2, Math.min(98, n)) : null; }

export default function InteractiveEventPitch({ events }: { events: MatchEventView[] }) {
  const markers = useMemo(() => events.filter((e) => posX(e) !== null && posY(e) !== null), [events]);
  const [selected, setSelected] = useState<string | null>(markers[0]?.id || null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || markers.length === 0) return;
    const timer = setInterval(() => setSelected((prev) => {
      const index = markers.findIndex((e) => e.id === prev);
      return markers[(Math.max(0, index) + 1) % markers.length].id;
    }), 1400);
    return () => clearInterval(timer);
  }, [playing, markers]);
  const current = markers.find((e) => e.id === selected) || markers[0] || null;
  return <section className="rounded-[1.4rem] border border-[#18E58F]/20 bg-[#0B3B25] p-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={() => setPlaying((v) => !v)} className="rounded-xl bg-[#18E58F] px-4 py-2 text-xs font-black text-black">{playing ? 'إيقاف العرض' : 'تشغيل الأحداث'}</button>
      <span className="text-xs font-bold text-[#B6F4D2]">أحداث بإحداثيات: {ar.format(markers.length)}</span>
    </div>
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border-2 border-white/30 bg-[#0d4c2d] sm:aspect-[16/10]">
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/40" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/40" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
      {markers.map((e) => {
        const active = selected === e.id;
        const m = meta(e);
        return <button key={e.id} type="button" onClick={() => setSelected(e.id)} title={`${m.label} ${e.playerName || ''}`} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border text-[10px] font-black ${active ? 'h-9 w-9 border-[#F8C846] bg-[#F8C846] text-black' : 'h-7 w-7 border-white/30 bg-black/55 text-white'}`} style={{ left: `${posX(e)}%`, top: `${100 - (posY(e) || 50)}%` }}>{m.icon}</button>;
      })}
    </div>
    {current ? <div className="mt-2 rounded-2xl border border-[#F8C846]/25 bg-[#F8C846]/10 p-3 text-xs font-bold text-white"><b className="text-[#F8C846]">{current.minuteLabel}</b> · {meta(current).label}{current.playerName ? ` — ${current.playerName}` : ''}</div> : <p className="mt-2 text-center text-xs text-[#B6F4D2]">لا توجد إحداثيات كافية لرسم الأحداث على الملعب.</p>}
  </section>;
}
