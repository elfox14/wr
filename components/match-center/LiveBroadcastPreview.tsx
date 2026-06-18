'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type MatchEventLike = {
  id?: string | null;
  type?: string | null;
  detail?: string | null;
  minute?: number | null;
};

type FilterKey = 'all' | 'goals' | 'danger' | 'shots' | 'corners' | 'cards';

type Props = {
  matchId: string;
  events: MatchEventLike[];
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'goals', label: 'الأهداف' },
  { key: 'danger', label: 'الخطورة' },
  { key: 'shots', label: 'التسديدات' },
  { key: 'corners', label: 'الركنيات' },
  { key: 'cards', label: 'البطاقات' },
];

function toNumberText(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ar-EG') : '—';
}

function eventText(event: MatchEventLike) {
  return `${event.type || ''} ${event.detail || ''}`.toLowerCase();
}

function has(event: MatchEventLike, english: string, arabic: string) {
  const text = eventText(event);
  return text.includes(english) || text.includes(arabic);
}

function isGoal(event: MatchEventLike) {
  return has(event, 'goal', 'هدف');
}

function isCorner(event: MatchEventLike) {
  return has(event, 'corner', 'ركنية');
}

function isCard(event: MatchEventLike) {
  return has(event, 'card', 'بطاقة') || has(event, 'yellow', 'صفراء') || has(event, 'red', 'حمراء');
}

function isShot(event: MatchEventLike) {
  return has(event, 'shot', 'تسديدة') || has(event, 'attempt', 'محاولة');
}

function isDanger(event: MatchEventLike) {
  return has(event, 'danger', 'خطورة') || has(event, 'attack', 'هجمة') || isGoal(event) || isShot(event);
}

function eventMatchesFilter(event: MatchEventLike, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'goals') return isGoal(event);
  if (filter === 'danger') return isDanger(event);
  if (filter === 'shots') return isShot(event);
  if (filter === 'corners') return isCorner(event);
  if (filter === 'cards') return isCard(event);
  return true;
}

function eventIcon(event: MatchEventLike) {
  if (isGoal(event)) return '⚽';
  if (isCorner(event)) return '🚩';
  if (isCard(event)) return '🟨';
  if (has(event, 'sub', 'تبديل')) return '🔁';
  if (isShot(event)) return '🎯';
  if (isDanger(event)) return '🔥';
  return '•';
}

function eventLabel(event: MatchEventLike) {
  if (isGoal(event)) return 'هدف';
  if (isCorner(event)) return 'ركنية';
  if (isCard(event)) return 'بطاقة';
  if (has(event, 'sub', 'تبديل')) return 'تبديل';
  if (isShot(event)) return 'تسديدة';
  if (isDanger(event)) return 'خطورة';
  return event.type || 'حدث';
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

export default function LiveBroadcastPreview({ matchId, events }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const sorted = useMemo(() => [...events].sort((a, b) => Number(a.minute ?? 0) - Number(b.minute ?? 0)), [events]);
  const visible = useMemo(() => sorted.filter((event) => eventMatchesFilter(event, filter)), [sorted, filter]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentEvent = visible.find((event) => event.id === selectedId) || visible[visible.length - 1] || sorted[sorted.length - 1] || null;
  const ball = ballPosition(currentEvent);
  const goals = events.filter(isGoal).length;
  const corners = events.filter(isCorner).length;
  const cards = events.filter(isCard).length;

  return (
    <section className="rounded-[1.6rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.055] p-4 shadow-card" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">البث الحي</h2>
          <p className="mt-1 text-sm font-bold text-gray-400">ملعب تفاعلي للأحداث داخل صفحة المباراة.</p>
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

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full border px-3 py-1 text-[10px] font-black transition ${filter === item.key ? 'border-[#FFD700]/40 bg-[#FFD700]/15 text-[#FFD700]' : 'border-white/10 bg-black/25 text-gray-400 hover:text-white'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="relative aspect-[16/8] min-h-[260px] overflow-hidden rounded-[28px] border border-emerald-400/20 bg-emerald-950/60 shadow-inner shadow-black">
            <div className="absolute inset-4 rounded-[22px] border border-white/20" />
            <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] w-px bg-white/20" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
            <div className="absolute left-4 top-1/2 h-36 w-20 -translate-y-1/2 rounded-r-2xl border border-l-0 border-white/20" />
            <div className="absolute right-4 top-1/2 h-36 w-20 -translate-y-1/2 rounded-l-2xl border border-r-0 border-white/20" />
            <div className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white text-lg shadow-xl shadow-black transition-all duration-500" style={{ left: `${ball.left}%`, top: `${ball.top}%` }}>⚽</div>
            <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur">
              <div className="text-[10px] font-black text-[#FFD700]">{currentEvent ? `د${toNumberText(currentEvent.minute)} · ${eventLabel(currentEvent)}` : 'لا توجد أحداث'}</div>
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
            {visible.slice(-22).map((event, index) => (
              <button key={event.id || `${event.minute}-${index}`} type="button" onClick={() => setSelectedId(event.id || `${event.minute}-${index}`)} className={`absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition ${event.id === currentEvent?.id ? 'border-[#FFD700] bg-[#FFD700] text-black' : 'border-white/20 bg-black text-white hover:border-[#0FF0FC]'}`} style={{ left: `${minuteLeft(event.minute)}%` }} title={`د${toNumberText(event.minute)} · ${eventLabel(event)}`}>
                {eventIcon(event)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-full max-h-full min-h-0 flex-col justify-center overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/25 p-4 text-center">
          <p className="text-xs font-black text-[#0FF0FC]">أحداث المباراة</p>
          <p className="mt-1 text-2xl font-black text-white">{toNumberText(events.length)} حدث</p>
          <div className="my-4 h-px bg-white/10" />
          <p className="text-xs font-bold text-gray-400">الحدث المختار</p>
          <p className="mt-2 text-4xl">{currentEvent ? eventIcon(currentEvent) : '•'}</p>
          <p className="mt-2 text-lg font-black text-white">{currentEvent ? eventLabel(currentEvent) : 'لا توجد أحداث'}</p>
          <p className="mt-2 max-h-24 overflow-hidden text-sm font-bold leading-6 text-gray-400">{currentEvent?.detail || 'اختر حدثًا من شريط الملعب لمتابعة موضعه.'}</p>
        </div>
      </div>
    </section>
  );
}
