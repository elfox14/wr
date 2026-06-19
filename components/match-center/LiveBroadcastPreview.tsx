'use client';

import { useMemo, useState } from 'react';
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

function numberText(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ar-EG') : '—';
}

function clean(value: unknown) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function eventText(event: MatchEventLike | null) {
  return clean(`${event?.type || ''} ${event?.detail || ''}`);
}

function has(event: MatchEventLike | null, english: string, arabic: string) {
  const text = eventText(event);
  return text.includes(english) || text.includes(arabic);
}

function isGoal(event: MatchEventLike | null) {
  const text = eventText(event);
  if (!text || text.includes('goal kick') || text.includes('disallowed') || text.includes('no goal')) return false;
  return text.includes('goal') || text.includes('هدف');
}

function isCorner(event: MatchEventLike | null) {
  return has(event, 'corner', 'ركنية');
}

function isCard(event: MatchEventLike | null) {
  return has(event, 'card', 'بطاقة') || has(event, 'yellow', 'صفراء') || has(event, 'red', 'حمراء');
}

function isShot(event: MatchEventLike | null) {
  if (isGoal(event)) return false;
  const text = eventText(event);
  return text.includes('shot') || text.includes('attempt') || text.includes('تسديدة') || text.includes('محاولة');
}

function isSub(event: MatchEventLike | null) {
  return has(event, 'sub', 'تبديل') || has(event, 'substitution', 'تغيير');
}

function isVar(event: MatchEventLike | null) {
  return has(event, 'var', 'فار') || has(event, 'var', 'حكم الفيديو');
}

function isDanger(event: MatchEventLike | null) {
  return isGoal(event) || isShot(event) || isVar(event) || has(event, 'danger', 'خطورة') || has(event, 'attack', 'هجمة');
}

function isImportant(event: MatchEventLike) {
  return isGoal(event) || isCorner(event) || isCard(event) || isShot(event) || isSub(event) || isVar(event) || has(event, 'injury', 'إصابة');
}

function matchFilter(event: MatchEventLike, filter: FilterKey) {
  if (filter === 'important') return isImportant(event);
  if (filter === 'all') return true;
  if (filter === 'goals') return isGoal(event);
  if (filter === 'danger') return isDanger(event);
  if (filter === 'shots') return isShot(event);
  if (filter === 'corners') return isCorner(event);
  if (filter === 'cards') return isCard(event);
  if (filter === 'subs') return isSub(event);
  if (filter === 'var') return isVar(event);
  return true;
}

function eventIcon(event: MatchEventLike | null) {
  if (isGoal(event)) return '⚽';
  if (isCorner(event)) return '🚩';
  if (isCard(event)) return '🟨';
  if (isSub(event)) return '🔁';
  if (isVar(event)) return 'VAR';
  if (isShot(event)) return '🎯';
  if (isDanger(event)) return '🔥';
  return '•';
}

function eventLabel(event: MatchEventLike | null) {
  if (isGoal(event)) return 'هدف';
  if (isCorner(event)) return 'ركنية';
  if (isCard(event)) return 'بطاقة';
  if (isSub(event)) return 'تبديل';
  if (isVar(event)) return 'VAR';
  if (isShot(event)) return 'تسديدة';
  if (isDanger(event)) return 'خطورة';
  return event?.type || 'حدث';
}

function eventMinute(event: MatchEventLike | null) {
  return event?.minute !== null && event?.minute !== undefined ? `د${numberText(event.minute)}` : '—';
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

function goalsFromScore(homeScore?: number | null, awayScore?: number | null) {
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (!Number.isFinite(home) && !Number.isFinite(away)) return null;
  return Math.max(0, Number.isFinite(home) ? home : 0) + Math.max(0, Number.isFinite(away) ? away : 0);
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

export default function LiveBroadcastPreview({ events, homeTeam, awayTeam, homeScore, awayScore }: Props) {
  const [filter, setFilter] = useState<FilterKey>('important');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const sorted = useMemo(() => [...events].sort((a, b) => Number(a.minute ?? 0) - Number(b.minute ?? 0)), [events]);
  const visible = useMemo(() => sorted.filter((event) => matchFilter(event, filter)), [sorted, filter]);
  const currentIndex = visible.length ? Math.max(0, Math.min(visible.length - 1, selectedIndex ?? visible.length - 1)) : -1;
  const currentEvent = currentIndex >= 0 ? visible[currentIndex] : sorted[sorted.length - 1] || null;
  const ball = ballPosition(currentEvent);
  const goals = goalsFromScore(homeScore, awayScore) ?? events.filter(isGoal).length;
  const corners = events.filter(isCorner).length;
  const cards = events.filter(isCard).length;

  function selectIndex(index: number) {
    if (!visible.length) return;
    setSelectedIndex(Math.max(0, Math.min(visible.length - 1, index)));
  }

  return (
    <section className="rounded-[1.6rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.055] p-4 shadow-card" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">البث الحي</h2>
          <p className="mt-1 text-sm font-bold text-gray-400">ملعب تفاعلي للأحداث مع عرض لحظة المباراة الحالية.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الأحداث</p><p className="mt-1 text-2xl font-black text-white">{numberText(events.length)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الأهداف</p><p className="mt-1 text-2xl font-black text-[#FFD700]">{numberText(goals)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الركنيات</p><p className="mt-1 text-2xl font-black text-[#0FF0FC]">{numberText(corners)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">البطاقات</p><p className="mt-1 text-2xl font-black text-[#ff6b7a]">{numberText(cards)}</p></div>
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
          <button type="button" disabled={!visible.length} onClick={() => selectIndex(currentIndex - 1)} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-300 transition hover:border-[#0FF0FC]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">السابق</button>
          <button type="button" disabled={!visible.length} onClick={() => selectIndex(currentIndex + 1)} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-300 transition hover:border-[#0FF0FC]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">التالي</button>
          <span className="px-2 text-[10px] font-black text-gray-500">{visible.length ? `${numberText(currentIndex + 1)} / ${numberText(visible.length)}` : 'لا توجد أحداث'}</span>
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
            <TeamFlag team={homeTeam} side="home" />
            <TeamFlag team={awayTeam} side="away" />
            <div className="absolute z-30 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white text-lg shadow-xl shadow-black transition-all duration-500" style={{ left: `${ball.left}%`, top: `${ball.top}%` }}>⚽</div>
            <div className="absolute bottom-3 left-3 right-3 z-30 rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur">
              <div className="text-[10px] font-black text-[#FFD700]">{currentEvent ? `${eventMinute(currentEvent)} · ${eventLabel(currentEvent)}` : 'لا توجد أحداث'}</div>
              <div className="mt-1 text-sm font-bold leading-6 text-white">{currentEvent?.detail || 'عند وصول الأحداث ستظهر حركة الكرة هنا.'}</div>
            </div>
          </div>
        </div>

        <aside className="flex h-full max-h-[592px] min-h-0 flex-col overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/25 p-3">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs font-black text-[#0FF0FC]">أحداث المباراة</p>
              <p className="mt-1 text-xl font-black text-white">{numberText(events.length)} حدث</p>
            </div>
            <div className="text-center">
              <p className="text-2xl">{currentEvent ? eventIcon(currentEvent) : '•'}</p>
              <p className="text-[10px] font-black text-[#FFD700]">{visible.length ? `${numberText(currentIndex + 1)} / ${numberText(visible.length)}` : '—'}</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {visible.length ? visible.slice().reverse().map((event) => {
              const index = visible.indexOf(event);
              const active = event === currentEvent;
              return (
                <button key={`${event.id || index}-${event.minute || 0}`} type="button" onClick={() => selectIndex(index)} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-[#FFD700]/40 bg-[#FFD700]/10' : 'border-white/10 bg-black/25 hover:border-[#0FF0FC]/40'}`}>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black">
                    <span className="text-[#FFD700]">{eventMinute(event)}</span>
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
