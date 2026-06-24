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
  return 'Heuristic';
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

function CrowdStand({ side, theme, active }: { side: 'top' | 'bottom'; theme: TeamVisualTheme; active: boolean }) {
  const rows = Array.from({ length: 6 });
  return (
    <div
      className={`absolute left-2 right-2 z-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/40 ${side === 'top' ? 'top-2 h-[11%]' : 'bottom-2 h-[11%]'} ${active ? 'animate-pulse' : ''}`}
      style={{ boxShadow: active ? `0 0 42px ${theme.crowdPrimary}66` : undefined }}
    >
      <div className="absolute inset-0 opacity-70" style={{ background: `linear-gradient(90deg, ${theme.crowdPrimary}, ${theme.crowdSecondary}, ${theme.crowdPrimary})` }} />
      <div className="absolute inset-0 grid grid-cols-24 gap-px opacity-60">
        {Array.from({ length: 96 }).map((_, index) => (
          <span
            key={index}
            className="rounded-full"
            style={{
              backgroundColor: index % 3 === 0 ? theme.crowdSecondary : theme.crowdPrimary,
              opacity: 0.35 + ((index % 5) * 0.11),
              transform: `translateY(${(index % rows.length) * 2}px)`,
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

function EventOverlay({ event, teams }: { event: AnimationEvent | null; teams: AnimationState['teams'] }) {
  if (!event) return null;
  const team = event.teamId === teams.home.id ? teams.home : event.teamId === teams.away.id ? teams.away : null;
  const theme = team ? teamTheme(team) : fallbackTheme;
  return (
    <div className={`absolute right-4 top-4 z-30 max-w-[78%] rounded-3xl border bg-gradient-to-br p-4 shadow-2xl backdrop-blur ${eventTone(event.eventType)}`}>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{event.icon}</span>
        <div>
          <p className="text-xs font-black text-slate-300">{event.minute !== null ? `${event.minute}'` : '—'} · {team?.name || 'حدث عام'} {team ? teamTheme(team).flagEmoji : ''}</p>
          <h2 className="text-2xl font-black text-white">{event.eventLabel}</h2>
          <p className="mt-1 text-sm font-bold text-slate-200">
            {event.playerName ? `${event.playerName}${event.jerseyNumber ? ` #${event.jerseyNumber}` : ''}` : event.detail}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black">
            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-slate-200">{sourceLabel(event.coordinateSource)}</span>
            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-slate-200">{confidenceLabel(event.coordinateConfidence)}</span>
            {event.anchorZone && <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-slate-200">{event.anchorZone}</span>}
          </div>
        </div>
      </div>
      {event.eventType.includes('goal') && (
        <div className="mt-3 rounded-2xl px-3 py-2 text-xs font-black text-black" style={{ backgroundColor: theme.crowdPrimary }}>
          تفاعل جماهير {team?.name || 'الفريق'}
        </div>
      )}
    </div>
  );
}

function VirtualPitch({ state, activeEvent }: { state: AnimationState; activeEvent: AnimationEvent | null }) {
  const visibleEvents = state.events.slice(-32).sort((a, b) => Number(a.displayPriority || 0) - Number(b.displayPriority || 0));
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

        {pitchPlayerPositions('home').map(([x, y, n], index) => (
          <div key={`h-${index}`} className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 text-[10px] font-black shadow-lg" style={{ left: `${x}%`, top: `${y}%`, backgroundColor: homeTheme.shirtPrimary, color: homeTheme.shirtSecondary }}>{n}</div>
        ))}
        {pitchPlayerPositions('away').map(([x, y, n], index) => (
          <div key={`a-${index}`} className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 text-[10px] font-black shadow-lg" style={{ left: `${x}%`, top: `${y}%`, backgroundColor: awayTheme.shirtPrimary, color: awayTheme.shirtSecondary }}>{n}</div>
        ))}

        {visibleEvents.map((event, index) => (
          <div key={`${event.id}-${index}`} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${event.x}%`, top: `${event.y}%` }} title={`${event.eventLabel} · ${event.playerName || event.detail} · ${sourceLabel(event.coordinateSource)}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/75 text-lg shadow-2xl" style={{ boxShadow: `0 0 24px ${event.color}66` }}>{event.icon}</div>
            <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.coordinateConfidence === 'HIGH' ? '#18E58F' : event.coordinateConfidence === 'MEDIUM' ? '#F8C846' : '#94A3B8' }} />
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
          setEvents((prev) => [...prev, ...payload.events].slice(-80));
          lastSeqRef.current = Math.max(lastSeqRef.current, Number(payload.lastSequence || 0));
          setActiveIndex(events.length + payload.events.length - 1);
        }
      } catch {
        // Keep existing state; the next polling tick can recover.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [events.length, shouldPoll, state.matchId]);

  const homeTheme = teamTheme(state.teams.home);
  const awayTheme = teamTheme(state.teams.away);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black md:text-3xl">الملعب التفاعلي المباشر</h1>
              <p className="mt-1 text-sm font-bold text-slate-400">{state.title} · {phaseLabel(state.phase)} · مصدر: {state.source}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">{homeTheme.flagEmoji} {state.teams.home.name}</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">{awayTheme.flagEmoji} {state.teams.away.name}</span>
              </div>
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
            const team = event.teamId === state.teams.home.id ? state.teams.home : event.teamId === state.teams.away.id ? state.teams.away : null;
            return (
              <button key={`${event.id}-${reverseIndex}`} onClick={() => setActiveIndex(originalIndex)} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-[#18E58F]/40 bg-[#18E58F]/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.06]'}`}>
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
