'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TeamVisualTheme = {
  code: string;
  flagEmoji: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  crowdPrimary: string;
  crowdSecondary: string;
  shirtPrimary: string;
  shirtSecondary: string;
};

type Team = { id: string; name: string; code?: string | null; image?: string | null; theme?: TeamVisualTheme };

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
  coordinateSource?: 'EXACT_PROVIDER' | 'INFERRED_ZONE' | 'HEURISTIC' | string;
  coordinateConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  eventSide?: 'HOME_ATTACK' | 'AWAY_ATTACK' | 'NEUTRAL' | string;
  isInferred?: boolean;
  anchorZone?: string | null;
  displayPriority?: number;
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
  visualTheme?: { home: TeamVisualTheme; away: TeamVisualTheme };
  lastSequence: number;
  events: AnimationEvent[];
  source: string;
  lastUpdatedAt: string;
};

const fallbackTheme: TeamVisualTheme = {
  code: 'TEAM',
  flagEmoji: '🏳️',
  primaryColor: '#E5E7EB',
  secondaryColor: '#94A3B8',
  accentColor: '#18E58F',
  crowdPrimary: '#E5E7EB',
  crowdSecondary: '#94A3B8',
  shirtPrimary: '#E5E7EB',
  shirtSecondary: '#111827',
};

function teamTheme(team: Team): TeamVisualTheme {
  return team.theme || fallbackTheme;
}

function phaseLabel(phase: string) {
  if (phase === 'live') return 'مباشر';
  if (phase === 'halftime') return 'استراحة';
  if (phase === 'finished') return 'انتهت';
  return 'قبل المباراة';
}

function confidenceLabel(value?: string) {
  if (value === 'HIGH') return 'دقة عالية';
  if (value === 'MEDIUM') return 'تقدير منطقي';
  return 'تقدير بصري';
}

function sourceLabel(value?: string) {
  if (value === 'EXACT_PROVIDER') return 'إحداثيات حقيقية';
  if (value === 'INFERRED_ZONE') return 'منطقة مستنتجة';
  return 'تقدير بصري';
}

function eventTone(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return 'border-[#F8C846]/30 bg-[#F8C846]/10';
  if (key.includes('red')) return 'border-red-400/30 bg-red-500/10';
  if (key.includes('yellow')) return 'border-[#F8C846]/25 bg-[#F8C846]/10';
  if (key.includes('sub')) return 'border-sky-300/25 bg-sky-400/10';
  return 'border-[#18E58F]/25 bg-[#18E58F]/10';
}

function pitchPlayerPositions(team: 'home' | 'away') {
  const home = [
    [10, 50], [23, 22], [24, 42], [24, 58], [23, 78],
    [39, 30], [42, 50], [39, 70],
    [57, 26], [61, 50], [57, 74],
  ];
  const away = home.map(([x, y]) => [100 - Number(x), Number(y)] as [number, number]);
  return (team === 'home' ? home : away) as [number, number][];
}

function CrowdStand({ side, theme, active }: { side: 'top' | 'bottom'; theme: TeamVisualTheme; active: boolean }) {
  return (
    <div
      className={`absolute left-2 right-2 z-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/40 ${side === 'top' ? 'top-2 h-[11%]' : 'bottom-2 h-[11%]'} ${active ? 'animate-pulse' : ''}`}
      style={{ boxShadow: active ? `0 0 42px ${theme.crowdPrimary}66` : undefined }}
    >
      <div className="absolute inset-0 opacity-70" style={{ background: `linear-gradient(90deg, ${theme.crowdPrimary}, ${theme.crowdSecondary}, ${theme.crowdPrimary})` }} />
      <div className="absolute inset-0 grid grid-cols-12 gap-px opacity-60 md:grid-cols-24">
        {Array.from({ length: 96 }).map((_, index) => (
          <span
            key={index}
            className="rounded-full"
            style={{
              backgroundColor: index % 3 === 0 ? theme.crowdSecondary : theme.crowdPrimary,
              opacity: 0.35 + ((index % 5) * 0.11),
              transform: `translateY(${(index % 6) * 2}px)`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 top-1 text-center text-[10px] font-black tracking-[0.25em] text-white/70">{theme.flagEmoji} {theme.code}</div>
    </div>
  );
}

function FlagWatermark({ team, side }: { team: Team; side: 'left' | 'right' }) {
  const theme = teamTheme(team);
  return (
    <div className={`pointer-events-none absolute top-[18%] z-[1] flex h-[64%] w-[42%] items-center justify-center opacity-[0.12] ${side === 'left' ? 'left-[6%]' : 'right-[6%]'}`}>
      <div className="text-center">
        <div className="text-[8rem] leading-none md:text-[11rem]">{theme.flagEmoji}</div>
        <div className="mt-2 text-5xl font-black tracking-[0.25em] text-white">{team.code || theme.code}</div>
      </div>
    </div>
  );
}

function ActiveEventBar({ event, teams, isPlaying }: { event: AnimationEvent | null; teams: AnimationState['teams']; isPlaying: boolean }) {
  if (!event) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-400">
        لا يوجد حدث محدد بعد.
      </div>
    );
  }

  const team = event.teamId === teams.home.id ? teams.home : event.teamId === teams.away.id ? teams.away : null;
  const theme = team ? teamTheme(team) : fallbackTheme;

  return (
    <div className={`rounded-[1.5rem] border px-4 py-3 shadow-xl ${eventTone(event.eventType)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/40 text-3xl" style={{ boxShadow: `0 0 22px ${event.color}55` }}>
            {event.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-300">
              {isPlaying ? 'تشغيل تلقائي' : 'حدث محدد'} · {event.minute !== null ? `${event.minute}'` : '—'} · {team?.name || 'حدث عام'} {team ? teamTheme(team).flagEmoji : ''}
            </p>
            <h2 className="truncate text-2xl font-black text-white">{event.eventLabel}</h2>
            <p className="truncate text-sm font-bold text-slate-200">
              {event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black">
          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-slate-200">{sourceLabel(event.coordinateSource)}</span>
          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-slate-200">{confidenceLabel(event.coordinateConfidence)}</span>
          {event.anchorZone && <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-slate-200">{event.anchorZone}</span>}
          {event.eventType.includes('goal') && <span className="rounded-full px-2 py-1 text-black" style={{ backgroundColor: theme.crowdPrimary }}>تفاعل جماهير {team?.name || 'الفريق'}</span>}
        </div>
      </div>
    </div>
  );
}

function VirtualPitch({ state, activeEvent, isPlaying }: { state: AnimationState; activeEvent: AnimationEvent | null; isPlaying: boolean }) {
  const ballX = activeEvent?.endX ?? activeEvent?.x ?? 50;
  const ballY = activeEvent?.endY ?? activeEvent?.y ?? 50;
  const homeTheme = teamTheme(state.teams.home);
  const awayTheme = teamTheme(state.teams.away);
  const activeTeamId = activeEvent?.teamId || null;
  const homeActive = activeEvent?.eventType?.includes('goal') && activeTeamId === state.teams.home.id;
  const awayActive = activeEvent?.eventType?.includes('goal') && activeTeamId === state.teams.away.id;

  return (
    <div className="relative aspect-[16/11] overflow-hidden rounded-[2rem] border border-white/10 bg-[#06110d] p-[12%_3%] shadow-2xl shadow-black/40 md:aspect-[16/10] md:p-[8%_3%]">
      <CrowdStand side="top" theme={awayTheme} active={Boolean(awayActive)} />
      <CrowdStand side="bottom" theme={homeTheme} active={Boolean(homeActive)} />

      <div className="relative h-full overflow-hidden rounded-[2rem] border border-white/15 bg-[#0a3b25]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_42%)]" />
        <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg, ${homeTheme.primaryColor}22, transparent 45%, transparent 55%, ${awayTheme.primaryColor}22)` }} />
        <FlagWatermark team={state.teams.home} side="left" />
        <FlagWatermark team={state.teams.away} side="right" />

        <div className="absolute inset-4 z-[2] rounded-[1.5rem] border-2 border-white/25" />
        <div className="absolute inset-y-4 left-1/2 z-[2] w-0.5 bg-white/25" />
        <div className="absolute left-1/2 top-1/2 z-[2] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
        <div className="absolute left-4 top-[31%] z-[2] h-[38%] w-[14%] rounded-r-2xl border-2 border-white/25" />
        <div className="absolute right-4 top-[31%] z-[2] h-[38%] w-[14%] rounded-l-2xl border-2 border-white/25" />
        <div className="absolute left-4 top-[42%] z-[2] h-[16%] w-[5%] rounded-r-xl border-2 border-white/20" />
        <div className="absolute right-4 top-[42%] z-[2] h-[16%] w-[5%] rounded-l-xl border-2 border-white/20" />

        {pitchPlayerPositions('home').map(([x, y], index) => (
          <div key={`h-${index}`} aria-label="home player" className="absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 shadow-lg" style={{ left: `${x}%`, top: `${y}%`, backgroundColor: homeTheme.shirtPrimary }} />
        ))}
        {pitchPlayerPositions('away').map(([x, y], index) => (
          <div key={`a-${index}`} aria-label="away player" className="absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 shadow-lg" style={{ left: `${x}%`, top: `${y}%`, backgroundColor: awayTheme.shirtPrimary }} />
        ))}

        {activeEvent?.endX !== null && activeEvent?.endY !== null && activeEvent && (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={activeEvent.x} y1={activeEvent.y} x2={activeEvent.endX || activeEvent.x} y2={activeEvent.endY || activeEvent.y} stroke={activeEvent.color} strokeWidth="0.65" strokeDasharray="2 1.5" />
          </svg>
        )}

        {activeEvent && (
          <div className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${activeEvent.x}%`, top: `${activeEvent.y}%` }} title={`${activeEvent.eventLabel} · ${activeEvent.playerName || activeEvent.detail} · ${sourceLabel(activeEvent.coordinateSource)}`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-black/80 text-2xl shadow-2xl ${isPlaying ? 'animate-pulse' : ''}`} style={{ boxShadow: `0 0 34px ${activeEvent.color}88` }}>{activeEvent.icon}</div>
            <div className="mx-auto mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: activeEvent.coordinateConfidence === 'HIGH' ? '#18E58F' : activeEvent.coordinateConfidence === 'MEDIUM' ? '#F8C846' : '#94A3B8' }} />
          </div>
        )}

        <div className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${ballX}%`, top: `${ballY}%` }}>
          <div className="h-4 w-4 rounded-full border border-white bg-white shadow-[0_0_24px_rgba(255,255,255,0.85)]" />
        </div>
      </div>
    </div>
  );
}

function PlaybackButton({ isPlaying, disabled, onClick }: { isPlaying: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-black transition ${isPlaying ? 'border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400 hover:text-black' : 'border-[#18E58F]/30 bg-[#18E58F]/10 text-[#18E58F] hover:bg-[#18E58F] hover:text-black'} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {isPlaying ? 'إيقاف الأحداث' : 'تشغيل الأحداث'}
    </button>
  );
}

export default function LiveAnimationPitch({ initialState }: { initialState: AnimationState }) {
  const [state, setState] = useState<AnimationState>(initialState);
  const [events, setEvents] = useState<AnimationEvent[]>(initialState.events || []);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, (initialState.events || []).length - 1));
  const [isPlaying, setIsPlaying] = useState(false);
  const lastSeqRef = useRef(initialState.lastSequence || 0);

  const activeEvent = useMemo(() => events[activeIndex] || events[events.length - 1] || null, [events, activeIndex]);
  const shouldPoll = state.phase === 'live' || state.phase === 'halftime';

  useEffect(() => {
    if (!events.length) {
      setIsPlaying(false);
      setActiveIndex(0);
      return;
    }
    if (activeIndex > events.length - 1) setActiveIndex(events.length - 1);
  }, [activeIndex, events.length]);

  useEffect(() => {
    if (!isPlaying || events.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current >= events.length - 1 ? 0 : current + 1));
    }, 2600);
    return () => window.clearInterval(timer);
  }, [events.length, isPlaying]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/matches/${state.matchId}/animation-state?afterSeq=${lastSeqRef.current}&limit=40`, { cache: 'no-store' });
        const payload = await res.json();
        if (!payload?.ok) return;
        setState(payload);
        if (payload.events?.length) {
          setEvents((prev) => [...prev, ...payload.events].slice(-160));
          lastSeqRef.current = Math.max(lastSeqRef.current, Number(payload.lastSequence || 0));
          if (!isPlaying) setActiveIndex((current) => Math.max(current, events.length + payload.events.length - 1));
        }
      } catch {
        // Keep existing state; the next polling tick can recover.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [events.length, isPlaying, shouldPoll, state.matchId]);

  const homeTheme = teamTheme(state.teams.home);
  const awayTheme = teamTheme(state.teams.away);

  function togglePlayback() {
    if (!events.length) return;
    setIsPlaying((current) => {
      if (!current && activeIndex >= events.length - 1) setActiveIndex(0);
      return !current;
    });
  }

  function selectEvent(index: number) {
    setIsPlaying(false);
    setActiveIndex(index);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="space-y-3">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black md:text-3xl">الملعب التفاعلي المباشر</h1>
              <p className="mt-1 text-sm font-bold text-slate-400">{state.title} · {phaseLabel(state.phase)} · مصدر: {state.source}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">{homeTheme.flagEmoji} {state.teams.home.name}</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">{awayTheme.flagEmoji} {state.teams.away.name}</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">يعرض حدثًا واحدًا فقط على الملعب</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-3xl font-black">
              {state.score.home} - {state.score.away}
            </div>
          </div>
        </div>

        <ActiveEventBar event={activeEvent} teams={state.teams} isPlaying={isPlaying} />
        <VirtualPitch state={{ ...state, events }} activeEvent={activeEvent} isPlaying={isPlaying} />
      </section>

      <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">الأحداث</h2>
          <div className="flex items-center gap-2">
            <PlaybackButton isPlaying={isPlaying} disabled={!events.length} onClick={togglePlayback} />
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{events.length} حدث</span>
          </div>
        </div>
        <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold leading-6 text-slate-400">
          اضغط على أي حدث لعرضه وحده على الملعب. زر التشغيل يعرض الأحداث بالتتابع حدثًا بعد حدث.
        </div>
        <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
          {events.slice().reverse().map((event, reverseIndex) => {
            const originalIndex = events.length - reverseIndex - 1;
            const active = originalIndex === activeIndex;
            const team = event.teamId === state.teams.home.id ? state.teams.home : event.teamId === state.teams.away.id ? state.teams.away : null;
            return (
              <button key={`${event.id}-${reverseIndex}`} onClick={() => selectEvent(originalIndex)} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-[#18E58F]/40 bg-[#18E58F]/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.06]'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{event.icon}</span>
                  <div>
                    <p className="text-xs font-black text-slate-400">{event.minute !== null ? `${event.minute}'` : '—'} · {event.eventLabel} {team ? teamTheme(team).flagEmoji : ''}</p>
                    <h3 className="mt-1 font-black text-white">{event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{event.provider} · {sourceLabel(event.coordinateSource)} · {confidenceLabel(event.coordinateConfidence)}</p>
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
