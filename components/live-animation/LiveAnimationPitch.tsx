'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Team = { id: string; name: string; code?: string | null; image?: string | null };
type AnimationEvent = {
  id: string;
  sequenceNumber: number;
  minute: number | null;
  second: number | null;
  teamId: string | null;
  playerId: string | null;
  playerName: string | null;
  jerseyNumber: string | null;
  eventType: string;
  eventLabel: string;
  detail: string;
  x: number;
  y: number;
  endX: number | null;
  endY: number | null;
  zone: string | null;
  provider: string;
  icon: string;
  color: string;
  createdAt: string;
};

type AnimationState = {
  ok: boolean;
  mode: string;
  matchId: string;
  title: string;
  phase: 'scheduled' | 'live' | 'halftime' | 'finished' | string;
  status: string;
  minute: number | null;
  score: { home: number; away: number };
  teams: { home: Team; away: Team };
  lastSequence: number;
  events: AnimationEvent[];
  source: string;
  lastUpdatedAt: string;
};

function phaseLabel(phase: string) {
  if (phase === 'live') return 'مباشر';
  if (phase === 'halftime') return 'استراحة';
  if (phase === 'finished') return 'انتهت';
  return 'قبل المباراة';
}

function eventTone(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return 'from-[#F8C846]/25 to-[#F8C846]/5 border-[#F8C846]/30';
  if (key.includes('red')) return 'from-red-500/25 to-red-500/5 border-red-400/30';
  if (key.includes('yellow')) return 'from-[#F8C846]/20 to-[#F8C846]/5 border-[#F8C846]/25';
  if (key.includes('sub')) return 'from-sky-400/20 to-sky-400/5 border-sky-300/25';
  return 'from-[#18E58F]/20 to-[#18E58F]/5 border-[#18E58F]/25';
}

function pitchPlayerPositions(team: 'home' | 'away') {
  const home = [
    [10, 50, 'GK'], [23, 22, '2'], [24, 42, '4'], [24, 58, '5'], [23, 78, '3'],
    [39, 30, '6'], [42, 50, '8'], [39, 70, '10'],
    [57, 26, '7'], [61, 50, '9'], [57, 74, '11'],
  ];
  const away = home.map(([x, y, n]) => [100 - Number(x), Number(y), n] as [number, number, string]);
  return (team === 'home' ? home : away) as [number, number, string][];
}

function EventOverlay({ event, teams }: { event: AnimationEvent | null; teams: AnimationState['teams'] }) {
  if (!event) return null;
  const team = event.teamId === teams.home.id ? teams.home : event.teamId === teams.away.id ? teams.away : null;
  return (
    <div className={`absolute right-4 top-4 z-20 max-w-[75%] rounded-3xl border bg-gradient-to-br p-4 shadow-2xl backdrop-blur ${eventTone(event.eventType)}`}>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{event.icon}</span>
        <div>
          <p className="text-xs font-black text-slate-300">{event.minute !== null ? `${event.minute}'` : '—'} · {team?.name || 'حدث عام'}</p>
          <h2 className="text-2xl font-black text-white">{event.eventLabel}</h2>
          <p className="mt-1 text-sm font-bold text-slate-200">
            {event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function VirtualPitch({ state, activeEvent }: { state: AnimationState; activeEvent: AnimationEvent | null }) {
  const visibleEvents = state.events.slice(-28);
  const ballX = activeEvent?.endX ?? activeEvent?.x ?? 50;
  const ballY = activeEvent?.endY ?? activeEvent?.y ?? 50;

  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a3b25] shadow-2xl shadow-black/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_42%)]" />
      <div className="absolute inset-4 rounded-[1.5rem] border-2 border-white/25" />
      <div className="absolute inset-y-4 left-1/2 w-0.5 bg-white/25" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
      <div className="absolute left-4 top-[31%] h-[38%] w-[14%] rounded-r-2xl border-2 border-white/25" />
      <div className="absolute right-4 top-[31%] h-[38%] w-[14%] rounded-l-2xl border-2 border-white/25" />
      <div className="absolute left-4 top-[42%] h-[16%] w-[5%] rounded-r-xl border-2 border-white/20" />
      <div className="absolute right-4 top-[42%] h-[16%] w-[5%] rounded-l-xl border-2 border-white/20" />

      {pitchPlayerPositions('home').map(([x, y, n], index) => (
        <div key={`h-${index}`} className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white text-[10px] font-black text-black shadow-lg" style={{ left: `${x}%`, top: `${y}%` }}>{n}</div>
      ))}
      {pitchPlayerPositions('away').map(([x, y, n], index) => (
        <div key={`a-${index}`} className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#18E58F]/70 bg-[#18E58F] text-[10px] font-black text-black shadow-lg" style={{ left: `${x}%`, top: `${y}%` }}>{n}</div>
      ))}

      {visibleEvents.map((event, index) => (
        <div key={`${event.id}-${index}`} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${event.x}%`, top: `${event.y}%` }} title={`${event.eventLabel} · ${event.playerName || event.detail}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/70 text-lg shadow-2xl" style={{ boxShadow: `0 0 24px ${event.color}66` }}>{event.icon}</div>
        </div>
      ))}

      {activeEvent?.endX !== null && activeEvent?.endY !== null && (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1={activeEvent.x} y1={activeEvent.y} x2={activeEvent.endX || activeEvent.x} y2={activeEvent.endY || activeEvent.y} stroke={activeEvent.color} strokeWidth="0.65" strokeDasharray="2 1.5" />
        </svg>
      )}

      <div className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${ballX}%`, top: `${ballY}%` }}>
        <div className="h-4 w-4 rounded-full border border-white bg-white shadow-[0_0_24px_rgba(255,255,255,0.85)]" />
      </div>

      <EventOverlay event={activeEvent} teams={state.teams} />
    </div>
  );
}

export default function LiveAnimationPitch({ initialState }: { initialState: AnimationState }) {
  const [state, setState] = useState<AnimationState>(initialState);
  const [events, setEvents] = useState<AnimationEvent[]>(initialState.events || []);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, (initialState.events || []).length - 1));
  const lastSeqRef = useRef(initialState.lastSequence || 0);

  const activeEvent = useMemo(() => events[activeIndex] || events[events.length - 1] || null, [events, activeIndex]);
  const shouldPoll = state.phase === 'live' || state.phase === 'halftime';

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/matches/${state.matchId}/animation-state?afterSeq=${lastSeqRef.current}&limit=40`, { cache: 'no-store' });
        const payload = await res.json();
        if (!payload?.ok) return;
        setState(payload);
        if (payload.events?.length) {
          setEvents((prev) => {
            const merged = [...prev, ...payload.events].slice(-80);
            return merged;
          });
          lastSeqRef.current = Math.max(lastSeqRef.current, Number(payload.lastSequence || 0));
          setActiveIndex((prev) => Math.max(prev, events.length + payload.events.length - 1));
        }
      } catch {
        // Keep existing state; the next polling tick can recover.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [events.length, shouldPoll, state.matchId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black md:text-3xl">الملعب التفاعلي المباشر</h1>
              <p className="mt-1 text-sm font-bold text-slate-400">{state.title} · {phaseLabel(state.phase)} · مصدر: {state.source}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-3xl font-black">
              {state.score.home} - {state.score.away}
            </div>
          </div>
        </div>
        <VirtualPitch state={{ ...state, events }} activeEvent={activeEvent} />
      </section>

      <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">الأحداث</h2>
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{events.length} حدث</span>
        </div>
        <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
          {events.slice().reverse().map((event, reverseIndex) => {
            const originalIndex = events.length - reverseIndex - 1;
            const active = originalIndex === activeIndex;
            return (
              <button key={`${event.id}-${reverseIndex}`} onClick={() => setActiveIndex(originalIndex)} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-[#18E58F]/40 bg-[#18E58F]/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.06]'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{event.icon}</span>
                  <div>
                    <p className="text-xs font-black text-slate-400">{event.minute !== null ? `${event.minute}'` : '—'} · {event.eventLabel}</p>
                    <h3 className="mt-1 font-black text-white">{event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{event.provider}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {!events.length && (
            <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm font-bold text-slate-400">
              لا توجد أحداث محفوظة بعد. عند وصول أحداث من Worker ستظهر هنا تلقائيًا.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
