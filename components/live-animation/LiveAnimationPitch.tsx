'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TeamTheme = { primaryColor?: string; secondaryColor?: string; crowdPrimary?: string };
type Team = { id: string; name: string; code?: string | null; image?: string | null; flagUrl?: string | null; theme?: TeamTheme };
type EventRow = { id: string; sequenceNumber: number; minute: number | null; teamId: string | null; playerName: string | null; jerseyNumber: string | null; eventType: string; eventLabel: string; detail: string; x: number; y: number; endX: number | null; endY: number | null; icon: string; color: string };
type MetricRow = { key: string; label: string; home: number | null; away: number | null; suffix?: string; available: boolean };
type ClockRow = { label: string; phaseLabel: string; minute: number | null; verifiedStarted: boolean; verifiedFinished: boolean };
type State = { ok: boolean; matchId: string; title: string; phase: string; status: string; clock?: ClockRow; score: { home: number; away: number }; teams: { home: Team; away: Team }; stats?: MetricRow[]; lastSequence: number; events: EventRow[]; lastUpdatedAt: string };

const ar = new Intl.NumberFormat('ar-EG');

function phaseLabel(phase: string) {
  if (phase === 'live') return 'مباشر';
  if (phase === 'halftime') return 'استراحة';
  if (phase === 'finished') return 'انتهت';
  return 'قبل المباراة';
}

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${Number.isInteger(n) ? ar.format(n) : n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}

function teamImage(team?: Team | null) {
  return team?.flagUrl || team?.image || null;
}

function TeamFlag({ team, className = 'h-5 w-7 rounded object-cover' }: { team?: Team | null; className?: string }) {
  const src = teamImage(team);
  if (!src) return <span className="inline-flex h-5 w-7 items-center justify-center rounded border border-white/10 bg-black/40 text-[9px] font-black text-[#F8C846]">{team?.code || '—'}</span>;
  return <img src={src} alt={`علم ${team?.name || 'منتخب'}`} className={`border border-white/10 ${className}`} loading="lazy" />;
}

function eventKey(event: EventRow) {
  return [event.minute ?? '', event.eventType || '', event.teamId || '', event.playerName || '', String(event.detail || '').slice(0, 80)].join('|').toLowerCase();
}

function mergeEvents(oldRows: EventRow[], newRows: EventRow[]) {
  const seen = new Set<string>();
  return [...oldRows, ...newRows]
    .filter((event) => {
      const key = eventKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sequenceNumber || 0) - Number(b.sequenceNumber || 0))
    .slice(-180);
}

function tone(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return 'border-[#F8C846]/30 bg-[#F8C846]/10';
  if (key.includes('red')) return 'border-red-400/30 bg-red-500/10';
  if (key.includes('yellow')) return 'border-[#F8C846]/25 bg-[#F8C846]/10';
  if (key.includes('sub')) return 'border-sky-300/25 bg-sky-400/10';
  return 'border-[#18E58F]/25 bg-[#18E58F]/10';
}

function metricWidth(home: number | null, away: number | null) {
  const h = Math.max(0, Number(home || 0));
  const a = Math.max(0, Number(away || 0));
  const total = h + a;
  if (!total) return { home: 50, away: 50 };
  const homeWidth = Math.max(6, Math.min(94, (h / total) * 100));
  return { home: homeWidth, away: 100 - homeWidth };
}

function ActiveEvent({ event, teams, playing }: { event: EventRow | null; teams: State['teams']; playing: boolean }) {
  if (!event) return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-400">لا يوجد حدث محدد بعد.</div>;
  const team = event.teamId === teams.home.id ? teams.home : event.teamId === teams.away.id ? teams.away : null;
  return <div className={`rounded-[1.5rem] border px-4 py-3 shadow-xl ${tone(event.eventType)}`}><div className="flex items-center gap-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/40 text-3xl ${playing ? 'animate-pulse' : ''}`}>{event.icon}</span><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-300"><span>{playing ? 'تشغيل تلقائي' : 'حدث محدد'} · {event.minute !== null ? `${event.minute}'` : '—'} · {team?.name || 'حدث عام'}</span>{team ? <TeamFlag team={team} className="h-4 w-6 rounded object-cover" /> : null}</p><h2 className="team-name-full text-2xl font-black text-white">{event.eventLabel}</h2><p className="team-name-full text-sm font-bold text-slate-200">{event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}</p></div></div></div>;
}

function Pitch({ state, event, playing }: { state: State; event: EventRow | null; playing: boolean }) {
  const ballX = event?.endX ?? event?.x ?? 50;
  const ballY = event?.endY ?? event?.y ?? 50;
  const homeColor = state.teams.home.theme?.primaryColor || '#F8C846';
  const awayColor = state.teams.away.theme?.primaryColor || '#18E58F';
  return <div className="relative aspect-[16/11] overflow-hidden rounded-[2rem] border border-white/10 bg-[#06110d] p-3 shadow-2xl shadow-black/40 md:aspect-[16/10]"><div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg, ${homeColor}22, transparent 45%, transparent 55%, ${awayColor}22)` }} /><div className="relative h-full overflow-hidden rounded-[1.5rem] border-2 border-white/20 bg-[#0a3b25]"><div className="absolute inset-4 rounded-[1.2rem] border-2 border-white/25" /><div className="absolute inset-y-4 left-1/2 w-0.5 bg-white/25" /><div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" /><div className="absolute left-4 top-[31%] h-[38%] w-[14%] rounded-r-2xl border-2 border-white/25" /><div className="absolute right-4 top-[31%] h-[38%] w-[14%] rounded-l-2xl border-2 border-white/25" />{event?.endX !== null && event?.endY !== null && event ? <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1={event.x} y1={event.y} x2={event.endX || event.x} y2={event.endY || event.y} stroke={event.color} strokeWidth="0.65" strokeDasharray="2 1.5" /></svg> : null}{event ? <div className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${event.x}%`, top: `${event.y}%` }}><div className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-black/80 text-2xl shadow-2xl ${playing ? 'animate-pulse' : ''}`} style={{ boxShadow: `0 0 34px ${event.color}88` }}>{event.icon}</div></div> : null}<div className="absolute z-40 -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${ballX}%`, top: `${ballY}%` }}><span className="block h-5 w-5 rounded-full border border-white bg-white shadow-[0_0_18px_rgba(255,255,255,.75)]" /></div></div></div>;
}

function ClockPanel({ state }: { state: State }) {
  const clock = state.clock;
  return <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white">{clock?.label || phaseLabel(state.phase)}</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{phaseLabel(state.phase)}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black text-slate-300"><span className="rounded-xl bg-white/[0.04] p-2">بدء مؤكد: {clock?.verifiedStarted ? 'نعم' : 'لا'}</span><span className="rounded-xl bg-white/[0.04] p-2">الشوط: {clock?.phaseLabel || phaseLabel(state.phase)}</span><span className="rounded-xl bg-white/[0.04] p-2">نهاية مؤكدة: {clock?.verifiedFinished ? 'نعم' : 'لا'}</span></div></div>;
}

function StatsPanel({ state }: { state: State }) {
  const stats = state.stats || [];
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4"><h2 className="mb-3 text-xl font-black">إحصائيات البث التفاعلي</h2>{stats.length ? <div className="grid gap-2 sm:grid-cols-2">{stats.map((metric) => { const width = metricWidth(metric.home, metric.away); return <article key={metric.key} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="grid grid-cols-[56px_1fr_56px] items-center gap-2 text-center"><b className="text-sm font-black text-[#F8C846]">{fmt(metric.home, metric.suffix)}</b><p className="text-xs font-black text-white">{metric.label}</p><b className="text-sm font-black text-[#18E58F]">{fmt(metric.away, metric.suffix)}</b></div><div className="mt-2 flex items-center gap-2" dir="ltr"><div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-white/10"><span className="h-full bg-[#18E58F]" style={{ width: `${width.away}%` }} /></div><div className="flex h-1.5 flex-1 justify-start overflow-hidden rounded-full bg-white/10"><span className="h-full bg-[#F8C846]" style={{ width: `${width.home}%` }} /></div></div><div className="mt-2 grid grid-cols-2 text-[9px] font-bold text-slate-500"><span>{state.teams.home.name}</span><span className="text-left">{state.teams.away.name}</span></div></article>; })}</div> : <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm font-bold text-slate-400">لا توجد إحصائيات محفوظة بعد.</div>}</div>;
}

export default function LiveAnimationPitch({ initialState }: { initialState: State }) {
  const [state, setState] = useState<State>(initialState);
  const [events, setEvents] = useState<EventRow[]>(mergeEvents([], initialState.events || []));
  const [activeIndex, setActiveIndex] = useState(Math.max(0, (initialState.events || []).length - 1));
  const [playing, setPlaying] = useState(false);
  const lastSeqRef = useRef(initialState.lastSequence || 0);
  const activeEvent = useMemo(() => events[activeIndex] || events[events.length - 1] || null, [events, activeIndex]);
  const shouldPoll = state.phase !== 'finished';

  useEffect(() => { if (!events.length) { setPlaying(false); setActiveIndex(0); return; } if (activeIndex > events.length - 1) setActiveIndex(events.length - 1); }, [activeIndex, events.length]);
  useEffect(() => { if (!playing || events.length <= 1) return; const timer = window.setInterval(() => setActiveIndex((current) => (current >= events.length - 1 ? 0 : current + 1)), 2600); return () => window.clearInterval(timer); }, [events.length, playing]);
  useEffect(() => { if (!shouldPoll) return; const timer = window.setInterval(async () => { try { const res = await fetch(`/api/matches/${state.matchId}/animation-state?afterSeq=${lastSeqRef.current}&limit=40`, { cache: 'no-store' }); const payload = await res.json(); if (!payload?.ok) return; setState(payload); if (payload.phase === 'finished') { const next = mergeEvents([], payload.events || []); setEvents(next); lastSeqRef.current = Math.max(lastSeqRef.current, Number(payload.lastSequence || 0)); setActiveIndex(Math.max(0, next.length - 1)); return; } if (payload.events?.length) { setEvents((prev) => { const next = mergeEvents(prev, payload.events); if (!playing) setActiveIndex(Math.max(0, next.length - 1)); return next; }); lastSeqRef.current = Math.max(lastSeqRef.current, Number(payload.lastSequence || 0)); } } catch {} }, 5000); return () => window.clearInterval(timer); }, [playing, shouldPoll, state.matchId]);

  return <div className="grid gap-4 lg:grid-cols-[1fr_390px]"><section className="space-y-3"><div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black md:text-3xl">الملعب التفاعلي المباشر</h1><p className="mt-1 text-sm font-bold text-slate-400">{state.title} · {phaseLabel(state.phase)}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-black"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1"><TeamFlag team={state.teams.home} />{state.teams.home.name}</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1"><TeamFlag team={state.teams.away} />{state.teams.away.name}</span></div></div><div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-3xl font-black">{state.score.home} - {state.score.away}</div></div><div className="mt-3"><ClockPanel state={state} /></div></div><ActiveEvent event={activeEvent} teams={state.teams} playing={playing} /><Pitch state={{ ...state, events }} event={activeEvent} playing={playing} /><StatsPanel state={state} /></section><aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">الأحداث</h2><div className="flex items-center gap-2"><button type="button" disabled={!events.length} onClick={() => setPlaying((value) => !value)} className="rounded-full border border-[#18E58F]/30 bg-[#18E58F]/10 px-3 py-1 text-xs font-black text-[#18E58F] disabled:opacity-50">{playing ? 'إيقاف الأحداث' : 'تشغيل الأحداث'}</button><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{events.length} حدث</span></div></div><div className="mb-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold leading-6 text-slate-400">اضغط على أي حدث لعرضه وحده على الملعب. زر التشغيل يعرض الأحداث بالتتابع.</div><div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">{events.slice().reverse().map((event, reverseIndex) => { const originalIndex = events.length - reverseIndex - 1; const active = originalIndex === activeIndex; const team = event.teamId === state.teams.home.id ? state.teams.home : event.teamId === state.teams.away.id ? state.teams.away : null; return <button key={`${event.id}-${reverseIndex}`} onClick={() => { setPlaying(false); setActiveIndex(originalIndex); }} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-[#18E58F]/40 bg-[#18E58F]/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.06]'}`}><div className="flex items-start gap-3"><span className="text-2xl">{event.icon}</span><div><p className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-400">{event.minute !== null ? `${event.minute}'` : '—'} · {event.eventLabel}{team ? <TeamFlag team={team} className="h-4 w-6 rounded object-cover" /> : null}</p><h3 className="mt-1 font-black text-white">{event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}</h3></div></div></button>; })}{!events.length ? <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm font-bold text-slate-400">لا توجد أحداث محفوظة بعد.</div> : null}</div></aside></div>;
}
