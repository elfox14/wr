'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type MatchEventLike = {
  id?: string | null;
  type?: string | null;
  detail?: string | null;
  minute?: number | null;
};

type TeamLike = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
};

type PlayerLike = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
  teamId?: string | null;
};

type FilterKey = 'important' | 'all' | 'goals' | 'danger' | 'shots' | 'corners' | 'cards' | 'subs' | 'var';

type Props = {
  matchId: string;
  events: MatchEventLike[];
  homeTeam: TeamLike;
  awayTeam: TeamLike;
  homePlayers: PlayerLike[];
  awayPlayers: PlayerLike[];
  homeScore?: number | null;
  awayScore?: number | null;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'important', label: 'المهمة' },
  { key: 'all', label: 'الكل' },
  { key: 'goals', label: 'الأهداف' },
  { key: 'danger', label: 'الخطورة' },
  { key: 'shots', label: 'التسديدات' },
  { key: 'corners', label: 'الركنيات' },
  { key: 'cards', label: 'البطاقات' },
  { key: 'subs', label: 'التبديلات' },
  { key: 'var', label: 'VAR' },
];

const REPLAY_MS = 950;
const HOME_POSITIONS = [
  [8, 50],
  [18, 18], [18, 38], [18, 62], [18, 82],
  [31, 28], [31, 50], [31, 72],
  [43, 22], [45, 50], [43, 78],
] as const;
const AWAY_POSITIONS = [
  [92, 50],
  [82, 18], [82, 38], [82, 62], [82, 82],
  [69, 28], [69, 50], [69, 72],
  [57, 22], [55, 50], [57, 78],
] as const;

function toNumberText(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ar-EG') : '—';
}

function cleanText(value: unknown) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]+/g, ' ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreGoalCount(homeScore?: number | null, awayScore?: number | null) {
  const home = Number(homeScore);
  const away = Number(awayScore);
  const hasHome = Number.isFinite(home);
  const hasAway = Number.isFinite(away);
  if (!hasHome && !hasAway) return null;
  return Math.max(0, hasHome ? home : 0) + Math.max(0, hasAway ? away : 0);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
}

function shortName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function eventType(event: MatchEventLike | null) {
  return cleanText(event?.type || '');
}

function eventText(event: MatchEventLike | null) {
  return cleanText(`${event?.type || ''} ${event?.detail || ''}`);
}

function isStrictGoalType(value: string) {
  if (!value) return false;
  if (/(goal kick|goal attempt|shot on goal|saved goal|goalkeeper|goalkeeper save|disallowed goal|no goal|goal line)/.test(value)) return false;
  return value === 'goal' || value === 'penalty goal' || value === 'own goal' || value === 'penalty scored' || value === 'goal scored';
}

function has(event: MatchEventLike | null, english: string, arabic: string) {
  const text = eventText(event);
  return text.includes(english) || text.includes(arabic);
}

function isGoal(event: MatchEventLike | null) {
  const type = eventType(event);
  if (isStrictGoalType(type)) return true;
  if (/(goal kick|goal attempt|shot on goal|saved goal|goalkeeper|disallowed goal|no goal|goal line)/.test(eventText(event))) return false;
  return type === 'goal' || type === 'penalty goal' || type === 'own goal';
}

function isCorner(event: MatchEventLike | null) {
  return has(event, 'corner', 'ركنية');
}

function isCard(event: MatchEventLike | null) {
  return has(event, 'card', 'بطاقة') || has(event, 'yellow', 'صفراء') || has(event, 'red', 'حمراء');
}

function isShot(event: MatchEventLike | null) {
  const text = eventText(event);
  if (isGoal(event)) return false;
  return text.includes('shot') || text.includes('تسديدة') || text.includes('attempt') || text.includes('محاولة');
}

function isSubstitution(event: MatchEventLike | null) {
  return !!event && (has(event, 'sub', 'تبديل') || has(event, 'substitution', 'تغيير'));
}

function isVar(event: MatchEventLike | null) {
  return has(event, 'var', 'فار') || has(event, 'var', 'حكم الفيديو');
}

function isInjury(event: MatchEventLike | null) {
  return has(event, 'injury', 'إصابة') || has(event, 'injury', 'اصابة');
}

function isDanger(event: MatchEventLike | null) {
  return has(event, 'danger', 'خطورة') || has(event, 'attack', 'هجمة') || isGoal(event) || isShot(event) || isVar(event);
}

function isImportantEvent(event: MatchEventLike) {
  if (isGoal(event) || isSubstitution(event) || isCard(event) || isCorner(event) || isShot(event) || isVar(event) || isInjury(event)) return true;
  const type = eventType(event);
  return type.includes('penalty') || type.includes('offside');
}

function eventMatchesFilter(event: MatchEventLike, filter: FilterKey) {
  if (filter === 'important') return isImportantEvent(event);
  if (filter === 'all') return true;
  if (filter === 'goals') return isGoal(event);
  if (filter === 'danger') return isDanger(event);
  if (filter === 'shots') return isShot(event);
  if (filter === 'corners') return isCorner(event);
  if (filter === 'cards') return isCard(event);
  if (filter === 'subs') return isSubstitution(event);
  if (filter === 'var') return isVar(event);
  return true;
}

function eventIcon(event: MatchEventLike | null) {
  if (isGoal(event)) return '⚽';
  if (isCorner(event)) return '🚩';
  if (isCard(event)) return eventType(event).includes('red') ? '🟥' : '🟨';
  if (isSubstitution(event)) return '🔁';
  if (isVar(event)) return '📺';
  if (isShot(event)) return '🎯';
  if (isDanger(event)) return '🔥';
  return '•';
}

function eventLabel(event: MatchEventLike | null) {
  if (isGoal(event)) return eventType(event).includes('penalty') ? 'هدف من ركلة جزاء' : 'هدف';
  if (isCorner(event)) return 'ركنية';
  if (isCard(event)) return 'بطاقة';
  if (isSubstitution(event)) return 'تبديل';
  if (isVar(event)) return 'VAR';
  if (isShot(event)) return 'تسديدة';
  if (isDanger(event)) return 'خطورة';
  return event?.type || 'حدث';
}

function eventMinuteLabel(event: MatchEventLike | null) {
  if (!event) return '—';
  const detail = String(event.detail || '');
  const stoppage = detail.match(/(?:د|minute|min)?\s*(45|90|105)\s*\+\s*(\d+)/i);
  if (stoppage) return `د${toNumberText(stoppage[1])}+${toNumberText(stoppage[2])}`;
  return event.minute !== null && event.minute !== undefined ? `د${toNumberText(event.minute)}` : '—';
}

function minuteLeft(minute?: number | null) {
  const safe = Math.max(0, Math.min(105, Number(minute ?? 0)));
  return Math.min(96, Math.max(4, (safe / 105) * 100));
}

function ballPosition(event: MatchEventLike | null) {
  if (!event) return { left: 50, top: 50 };
  const left = minuteLeft(event.minute);
  if (isGoal(event)) return { left: Math.max(8, Math.min(92, left)), top: 50 };
  if (isCorner(event)) return { left: left > 50 ? 92 : 8, top: 16 };
  if (isCard(event)) return { left, top: 72 };
  if (isShot(event)) return { left: Math.max(18, Math.min(82, left)), top: 40 };
  if (isDanger(event)) return { left: Math.max(16, Math.min(84, left)), top: 32 };
  return { left, top: 56 };
}

function playerMentioned(player: PlayerLike, event: MatchEventLike | null) {
  if (!event || !player.name) return false;
  const playerKey = cleanText(player.name);
  const eventKey = cleanText(event.detail || event.type);
  if (!playerKey || !eventKey) return false;
  return eventKey.includes(playerKey) || playerKey.split(' ').some((part) => part.length > 3 && eventKey.includes(part));
}

function TeamFlag({ team, side }: { team: TeamLike; side: 'home' | 'away' }) {
  const flagUrl = getTeamFlagUrl({ code: team.code, name: team.name, image: team.image }, 80);
  return (
    <div className={`absolute top-3 z-20 flex max-w-[42%] items-center gap-2 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur ${side === 'home' ? 'left-[25%] -translate-x-1/2' : 'right-[25%] translate-x-1/2'}`}>
      <div className="flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/40">
        {flagUrl ? <img src={flagUrl} alt={team.name || 'علم المنتخب'} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[10px] font-black text-[#FFD700]">{team.code || '---'}</span>}
      </div>
      <p className="truncate text-xs font-black text-white">{team.name || team.code || 'منتخب'}</p>
    </div>
  );
}

function PitchPlayer({ player, currentEvent, x, y, side }: { player: PlayerLike; currentEvent: MatchEventLike | null; x: number; y: number; side: 'home' | 'away' }) {
  const name = player.name || 'غير متوفر';
  const active = playerMentioned(player, currentEvent);
  const border = side === 'home' ? 'border-[#0FF0FC]/80' : 'border-[#FFD700]/80';
  return (
    <div className="absolute z-10 flex w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 bg-black/65 shadow-[0_0_18px_rgba(0,0,0,.55)] ${active ? 'border-[#ff3b57] ring-4 ring-[#FFD700]/25' : border}`}>
        {player.image ? <img src={player.image} alt={name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[10px] font-black text-white">{initials(name)}</span>}
        {player.code ? <span className="absolute -bottom-1 -left-1 rounded-full bg-[#FFD700] px-1.5 text-[8px] font-black text-black">{player.code}</span> : null}
      </div>
      <p className="max-w-[82px] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-black leading-4 text-white shadow-black [text-shadow:0_1px_2px_black]">{shortName(name)}</p>
    </div>
  );
}

function TeamHalfLineup({ team, players, currentEvent, side }: { team: TeamLike; players: PlayerLike[]; currentEvent: MatchEventLike | null; side: 'home' | 'away' }) {
  const positions = side === 'home' ? HOME_POSITIONS : AWAY_POSITIONS;
  const visiblePlayers = players.slice(0, 11);
  return (
    <>
      <TeamFlag team={team} side={side} />
      {visiblePlayers.map((player, index) => {
        const [x, y] = positions[index] || positions[positions.length - 1];
        return <PitchPlayer key={player.id || `${player.name}-${index}`} player={player} currentEvent={currentEvent} x={x} y={y} side={side} />;
      })}
    </>
  );
}

export default function LiveBroadcastPreview({ matchId, events, homeTeam, awayTeam, homePlayers, awayPlayers, homeScore, awayScore }: Props) {
  const [filter, setFilter] = useState<FilterKey>('important');
  const sorted = useMemo(() => [...events].sort((a, b) => Number(a.minute ?? 0) - Number(b.minute ?? 0)), [events]);
  const visible = useMemo(() => sorted.filter((event) => eventMatchesFilter(event, filter)), [sorted, filter]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentIndex = visible.length ? Math.max(0, Math.min(visible.length - 1, selectedIndex ?? visible.length - 1)) : -1;
  const currentEvent = currentIndex >= 0 ? visible[currentIndex] : sorted[sorted.length - 1] || null;
  const ball = ballPosition(currentEvent);
  const eventGoals = events.filter(isGoal).length;
  const goals = scoreGoalCount(homeScore, awayScore) ?? eventGoals;
  const corners = events.filter(isCorner).length;
  const cards = events.filter(isCard).length;
  const canNavigate = visible.length > 0;

  useEffect(() => {
    setSelectedIndex(null);
    setIsPlaying(false);
  }, [filter, events.length]);

  useEffect(() => {
    if (!isPlaying || !visible.length) return undefined;
    const timer = window.setTimeout(() => {
      setSelectedIndex((index) => {
        const current = index ?? 0;
        const next = current + 1;
        if (next >= visible.length) {
          setIsPlaying(false);
          return current;
        }
        return next;
      });
    }, REPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [isPlaying, selectedIndex, visible.length]);

  function selectIndex(index: number) {
    if (!visible.length) return;
    setIsPlaying(false);
    setSelectedIndex(Math.max(0, Math.min(visible.length - 1, index)));
  }

  function playEvents() {
    if (!visible.length) return;
    setSelectedIndex(0);
    setIsPlaying(true);
  }

  return (
    <section className="rounded-[1.6rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.055] p-4 shadow-card" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">البث الحي</h2>
          <p className="mt-1 text-sm font-bold text-gray-400">ملعب تفاعلي للأحداث مع تمركز لاعبي كل منتخب داخل نصف ملعبه.</p>
        </div>
        <Link href={`/match-live/${encodeURIComponent(matchId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black">
          فتح الصفحة الكاملة
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الأحداث</p><p className="mt-1 text-2xl font-black text-white">{toNumberText(events.length)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الأهداف</p><p className="mt-1 text-2xl font-black text-[#FFD700]">{toNumberText(goals)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الركنيات</p><p className="mt-1 text-2xl font-black text-[#0FF0FC]">{toNumberText(corners)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">البطاقات</p><p className="mt-1 text-2xl font-black text-[#ff6b7a]">{toNumberText(cards)}</p></div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full border px-3 py-1 text-[10px] font-black transition ${filter === item.key ? 'border-[#FFD700]/40 bg-[#FFD700]/15 text-[#FFD700]' : 'border-white/10 bg-black/25 text-gray-400 hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
          <button type="button" disabled={!canNavigate} onClick={() => selectIndex(currentIndex - 1)} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-300 transition hover:border-[#0FF0FC]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">السابق</button>
          <button type="button" disabled={!canNavigate} onClick={playEvents} className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700] transition hover:bg-[#FFD700]/20 disabled:cursor-not-allowed disabled:opacity-40">تشغيل الأحداث</button>
          <button type="button" disabled={!canNavigate} onClick={() => selectIndex(currentIndex + 1)} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-300 transition hover:border-[#0FF0FC]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">التالي</button>
          <span className="px-2 text-[10px] font-black text-gray-500">{canNavigate ? `${toNumberText(currentIndex + 1)} / ${toNumberText(visible.length)}` : 'لا توجد أحداث'}</span>
        </div>
      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="relative min-h-[500px] overflow-hidden rounded-[28px] border border-emerald-400/20 bg-emerald-950/60 shadow-inner shadow-black">
            <div className="absolute inset-4 rounded-[22px] border border-white/20" />
            <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] w-px bg-white/20" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
            <div className="absolute left-4 top-1/2 h-36 w-20 -translate-y-1/2 rounded-r-2xl border border-l-0 border-white/20" />
            <div className="absolute right-4 top-1/2 h-36 w-20 -translate-y-1/2 rounded-l-2xl border border-r-0 border-white/20" />

            <TeamHalfLineup team={homeTeam} players={homePlayers} currentEvent={currentEvent} side="home" />
            <TeamHalfLineup team={awayTeam} players={awayPlayers} currentEvent={currentEvent} side="away" />

            {isSubstitution(currentEvent) ? (
              <div className="absolute left-1/2 top-14 z-30 max-w-[360px] -translate-x-1/2 rounded-2xl border border-[#FFD700]/30 bg-black/75 px-4 py-2 text-center text-xs font-black text-[#FFD700] backdrop-blur">
                🔁 تبديل: {currentEvent?.detail || 'غير متوفر أسماء اللاعبين'}
              </div>
            ) : null}

            <div className={`absolute z-30 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white text-lg shadow-xl shadow-black transition-all duration-500 ${isPlaying ? 'scale-110 ring-4 ring-[#FFD700]/30' : ''}`} style={{ left: `${ball.left}%`, top: `${ball.top}%` }}>⚽</div>
            <div className="absolute bottom-3 left-3 right-3 z-30 rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur">
              <div className="text-[10px] font-black text-[#FFD700]">{currentEvent ? `${eventMinuteLabel(currentEvent)} · ${eventLabel(currentEvent)}` : 'لا توجد أحداث'}</div>
              <div className="mt-1 text-sm font-bold leading-6 text-white">{currentEvent?.detail || 'عند وصول الأحداث ستظهر حركة الكرة هنا.'}</div>
            </div>
          </div>

          <div className="relative mt-4 h-20 rounded-2xl border border-white/10 bg-black/25 px-3">
            <div className="absolute left-3 right-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
            {[0, 15, 30, 45, 60, 75, 90].map((minute) => (
              <div key={minute} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2" style={{ left: `${minuteLeft(minute)}%` }}>
                <span className="h-3 w-px bg-white/20" />
                <span className="text-[9px] font-black text-gray-500">{minute}</span>
              </div>
            ))}
            {visible.slice(-22).map((event) => {
              const index = visible.indexOf(event);
              const active = event === currentEvent;
              return (
                <button key={`${event.id || index}-${event.minute || 0}`} type="button" onClick={() => selectIndex(index)} className={`absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition ${active ? 'border-[#FFD700] bg-[#FFD700] text-black' : 'border-white/20 bg-black text-white hover:border-[#0FF0FC]'}`} style={{ left: `${minuteLeft(event.minute)}%` }} title={`${eventMinuteLabel(event)} · ${eventLabel(event)}`}>
                  {eventIcon(event)}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex h-full max-h-[592px] min-h-0 flex-col overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/25 p-3">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs font-black text-[#0FF0FC]">أحداث المباراة</p>
              <p className="mt-1 text-xl font-black text-white">{toNumberText(events.length)} حدث</p>
            </div>
            <div className="text-center">
              <p className="text-2xl">{currentEvent ? eventIcon(currentEvent) : '•'}</p>
              <p className="text-[10px] font-black text-[#FFD700]">{canNavigate ? `${toNumberText(currentIndex + 1)} / ${toNumberText(visible.length)}` : '—'}</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {visible.length ? visible.slice().reverse().map((event) => {
              const index = visible.indexOf(event);
              const active = event === currentEvent;
              return (
                <button key={`${event.id || index}-${event.minute || 0}`} type="button" onClick={() => selectIndex(index)} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-[#FFD700]/40 bg-[#FFD700]/10' : 'border-white/10 bg-black/25 hover:border-[#0FF0FC]/40'}`}>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black">
                    <span className="text-[#FFD700]">{eventMinuteLabel(event)}</span>
                    <span className="text-gray-500">{eventIcon(event)} {eventLabel(event)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-5 text-gray-200">{event.detail || eventLabel(event)}</div>
                </button>
              );
            }) : <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-xs font-bold text-gray-500">لا توجد أحداث مطابقة لهذا الفلتر.</div>}
          </div>
        </aside>
      </div>
    </section>
  );
}
