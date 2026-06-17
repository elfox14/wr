'use client';

import type { EventFilterKey, EventSide, MatchEvent, Team } from '../types';
import { ar } from '../formatters';
import { cleanEventDetail, eventIcon, eventLabel, eventMatchesFilter, eventMinute, eventSide, sortEventsByMinute } from '../eventUtils';
import { ballPosition, timelineLeft } from '../pitchUtils';

const EVENT_FILTERS: { key: EventFilterKey; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'goals', label: 'الأهداف' },
  { key: 'danger', label: 'الخطورة' },
  { key: 'shots', label: 'التسديدات' },
  { key: 'corners', label: 'الركنيات' },
  { key: 'cards', label: 'البطاقات' },
];

type LivePitchTimelinePanelProps = {
  events: MatchEvent[];
  home: Team;
  away: Team;
  activeEvent?: MatchEvent | null;
  selectedEventId?: string | null;
  eventFilter: EventFilterKey;
  onFilterChange: (filter: EventFilterKey) => void;
  onSelectEvent: (id: string) => void;
};

function sideLabel(side: EventSide, home: Team, away: Team) {
  if (side === 'home') return home?.name || 'الفريق الأول';
  if (side === 'away') return away?.name || 'الفريق الثاني';
  return 'حدث عام';
}

function eventMinuteLabel(event: MatchEvent) {
  const minute = eventMinute(event);
  return minute === null ? '—' : `د${ar(minute)}`;
}

export default function LivePitchTimelinePanel({
  events,
  home,
  away,
  activeEvent,
  selectedEventId,
  eventFilter,
  onFilterChange,
  onSelectEvent,
}: LivePitchTimelinePanelProps) {
  const sortedEvents = [...events].sort(sortEventsByMinute);
  const visibleEvents = sortedEvents.filter((event) => eventMatchesFilter(event, eventFilter));
  const selectedEvent = sortedEvents.find((event) => event.id === selectedEventId) || null;
  const currentEvent = selectedEvent || activeEvent || visibleEvents[visibleEvents.length - 1] || sortedEvents[sortedEvents.length - 1] || null;
  const ball = ballPosition(currentEvent, home, away);
  const currentSide = eventSide(currentEvent, home, away);

  return (
    <section className="order-2 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">Live Animation</div>
          <h2 className="mt-1 text-xl font-black text-white">ملعب تفاعلي للأحداث</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">
          الأحداث المعروضة: <span className="text-white">{ar(visibleEvents.length)}</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {EVENT_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onFilterChange(filter.key)}
            className={`rounded-full border px-3 py-1 text-[10px] font-black transition ${eventFilter === filter.key ? 'border-[#FFD700]/40 bg-[#FFD700]/15 text-[#FFD700]' : 'border-white/10 bg-black/25 text-gray-400 hover:text-white'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] border border-emerald-400/20 bg-emerald-950/60 shadow-inner shadow-black">
            <div className="absolute inset-4 rounded-[22px] border border-white/20" />
            <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] w-px bg-white/20" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
            <div className="absolute left-4 top-1/2 h-36 w-20 -translate-y-1/2 rounded-r-2xl border border-l-0 border-white/20" />
            <div className="absolute right-4 top-1/2 h-36 w-20 -translate-y-1/2 rounded-l-2xl border border-r-0 border-white/20" />

            <div
              className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white text-lg shadow-xl shadow-black transition-all duration-500"
              style={{ left: `${ball.left}%`, top: `${ball.top}%` }}
              title={ball.label}
            >
              ⚽
            </div>

            <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black text-[#FFD700]">{currentEvent ? `${eventMinuteLabel(currentEvent)} · ${eventLabel(currentEvent.type)}` : 'لا توجد أحداث'}</div>
                  <div className="mt-1 text-sm font-bold leading-6 text-white">
                    {currentEvent ? cleanEventDetail(currentEvent.detail) || eventLabel(currentEvent.type) : 'عند وصول الأحداث ستظهر حركة الكرة هنا.'}
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-300">
                  {sideLabel(currentSide, home, away)}
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-4 h-16 rounded-2xl border border-white/10 bg-black/25 px-3">
            <div className="absolute left-3 right-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
            {[0, 15, 30, 45, 60, 75, 90].map((minute) => (
              <div key={minute} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2" style={{ left: `${timelineLeft(minute)}%` }}>
                <span className="h-3 w-px bg-white/20" />
                <span className="text-[9px] font-black text-gray-500">{minute}</span>
              </div>
            ))}
            {visibleEvents.slice(-18).map((event) => {
              const minute = eventMinute(event) ?? 0;
              const active = event.id === currentEvent?.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelectEvent(event.id)}
                  className={`absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition ${active ? 'border-[#FFD700] bg-[#FFD700] text-black' : 'border-white/20 bg-black text-white hover:border-[#0FF0FC]'}`}
                  style={{ left: `${timelineLeft(minute)}%` }}
                  title={`${eventMinuteLabel(event)} · ${eventLabel(event.type)}`}
                >
                  {eventIcon(event.type)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[430px] overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="mb-3 text-[10px] font-black text-gray-400">قائمة الأحداث</div>
          <div className="space-y-2">
            {visibleEvents.length ? visibleEvents.slice().reverse().map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event.id)}
                className={`w-full rounded-2xl border p-3 text-right transition ${event.id === currentEvent?.id ? 'border-[#FFD700]/40 bg-[#FFD700]/10' : 'border-white/10 bg-black/25 hover:border-[#0FF0FC]/40'}`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-black">
                  <span className="text-[#FFD700]">{eventMinuteLabel(event)}</span>
                  <span className="text-gray-500">{eventIcon(event.type)} {eventLabel(event.type)}</span>
                </div>
                <div className="mt-1 text-[11px] font-bold leading-5 text-gray-200">
                  {cleanEventDetail(event.detail) || eventLabel(event.type)}
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-xs font-bold text-gray-500">
                لا توجد أحداث مطابقة لهذا الفلتر.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
