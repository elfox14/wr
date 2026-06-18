import Link from 'next/link';

type MatchEventLike = {
  id?: string | null;
  type?: string | null;
  detail?: string | null;
  minute?: number | null;
};

type Props = {
  matchId: string;
  events: MatchEventLike[];
};

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

function eventIcon(event: MatchEventLike) {
  if (has(event, 'goal', 'هدف')) return '⚽';
  if (has(event, 'corner', 'ركنية')) return '🚩';
  if (has(event, 'card', 'بطاقة')) return '🟨';
  if (has(event, 'sub', 'تبديل')) return '🔁';
  return '•';
}

export default function LiveBroadcastPreview({ matchId, events }: Props) {
  const sorted = [...events].sort((a, b) => Number(b.minute ?? -1) - Number(a.minute ?? -1));
  const latest = sorted[0] || null;
  const goals = events.filter((event) => has(event, 'goal', 'هدف')).length;
  const corners = events.filter((event) => has(event, 'corner', 'ركنية')).length;
  const cards = events.filter((event) => has(event, 'card', 'بطاقة')).length;
  const miniEvents = [...events].sort((a, b) => Number(a.minute ?? 0) - Number(b.minute ?? 0)).slice(-18);

  return (
    <section className="rounded-[1.6rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.055] p-4 shadow-card" dir="rtl">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">البث الحي</h2>
              <p className="mt-1 text-sm font-bold text-gray-400">ملعب تفاعلي للأحداث في مساحة مختصرة لا تؤثر على تنسيق الصفحة.</p>
            </div>
            <Link href={`/match-live/${encodeURIComponent(matchId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black">
              فتح الملعب التفاعلي
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الأحداث</p><p className="mt-1 text-2xl font-black text-white">{toNumberText(events.length)}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الأهداف</p><p className="mt-1 text-2xl font-black text-[#FFD700]">{toNumberText(goals)}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">الركنيات</p><p className="mt-1 text-2xl font-black text-[#0FF0FC]">{toNumberText(corners)}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-gray-400">البطاقات</p><p className="mt-1 text-2xl font-black text-[#ff6b7a]">{toNumberText(cards)}</p></div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black text-white">مؤشر الزمن: {latest?.minute === null || latest?.minute === undefined ? 'غير متوفر' : `د${toNumberText(latest.minute)}`}</p>
              <div className="flex flex-wrap gap-1 text-lg">{miniEvents.length ? miniEvents.map((event, index) => <span key={`${event.id || index}-${event.minute || 0}`}>{eventIcon(event)}</span>) : <span className="text-xs font-bold text-gray-500">لا توجد أحداث</span>}</div>
            </div>
            <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-black text-gray-500" dir="ltr"><span>0</span><span>15</span><span>30</span><span>45</span><span>60</span><span>75</span><span>90</span></div>
          </div>
        </div>

        <aside className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
          <h3 className="mb-3 text-lg font-black text-white">قائمة الأحداث</h3>
          <div className="space-y-2">
            {sorted.slice(0, 5).map((event, index) => (
              <div key={event.id || `${event.minute}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{eventIcon(event)} {event.type || 'حدث'}</p><span className="text-xs font-black text-[#0FF0FC]">{event.minute === null || event.minute === undefined ? '—' : `د${toNumberText(event.minute)}`}</span></div>
                <p className="mt-1 text-xs font-bold leading-6 text-gray-400">{event.detail || 'حدث محفوظ'}</p>
              </div>
            ))}
            {!sorted.length ? <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center text-sm font-bold text-gray-400">لا توجد أحداث محفوظة بعد.</div> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
