'use client';

type Team = { id?: string; name?: string; code?: string; image?: string } | null;
type PressureSide = 'home' | 'away' | 'balanced' | 'unknown';
type EventFilterKey = 'all' | 'goals' | 'corners' | 'shots' | 'cards' | 'danger';
type EventCategory = Exclude<EventFilterKey, 'all'> | 'other';
type MatchEvent = { id: string; minute?: number | null; type: string; detail: string; playerName?: string | null; sourceName?: string | null; createdAt?: string | null };
type MomentumSegment = {
  key: string;
  label: string;
  start: number;
  end: number;
  available: boolean;
  home: number;
  away: number;
  homeEvents: number;
  awayEvents: number;
  homeDangerEvents: number;
  awayDangerEvents: number;
  leader: PressureSide;
  rating: string;
  topEvent: MatchEvent | null;
};

type MomentumCardProps = {
  segment: MomentumSegment;
  home: Team;
  away: Team;
  onSelectEvent: (id: string) => void;
};

function ar(value: number | null | undefined, fallback = '٠') {
  return value === null || value === undefined ? fallback : value.toLocaleString('ar-EG');
}

function eventCategory(type: string): EventCategory {
  const value = type.toLowerCase();
  if (value.includes('goal')) return 'goals';
  if (value.includes('corner')) return 'corners';
  if (value.includes('yellow') || value.includes('red') || value.includes('card')) return 'cards';
  if (value.includes('danger')) return 'danger';
  if (value.includes('shot') || value.includes('on-target') || value.includes('off-target')) return 'shots';
  return 'other';
}

function eventIcon(type: string) {
  const category = eventCategory(type);
  if (category === 'goals') return '⚽';
  if (category === 'corners') return '🚩';
  if (type.toLowerCase().includes('yellow')) return '🟨';
  if (type.toLowerCase().includes('red')) return '🟥';
  if (category === 'danger') return '🔥';
  if (category === 'shots') return '🎯';
  if (type.toLowerCase().includes('substitution')) return '🔁';
  return '•';
}

function eventLabel(type: string) {
  const category = eventCategory(type);
  if (category === 'goals') return 'هدف';
  if (category === 'corners') return 'ركنية';
  if (type.toLowerCase().includes('yellow')) return 'بطاقة صفراء';
  if (type.toLowerCase().includes('red')) return 'بطاقة حمراء';
  if (category === 'danger') return 'هجمة خطيرة';
  if (category === 'shots') return 'تسديدة';
  if (type.toLowerCase().includes('substitution')) return 'تبديل';
  return 'حدث';
}

function sideName(side: PressureSide, home?: Team, away?: Team) {
  if (side === 'home') return home?.name || 'الفريق الأول';
  if (side === 'away') return away?.name || 'الفريق الثاني';
  if (side === 'balanced') return 'متوازن';
  return 'غير متوفر';
}

export default function MomentumCard({ segment, home, away, onSelectEvent }: MomentumCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-[#FFD700]">د {segment.label}</span>
        <span className="text-[10px] font-black text-gray-500">{segment.rating}</span>
      </div>
      <div className="text-sm font-black text-white">
        الأكثر ضغطًا: <span className="text-[#FFD700]">{sideName(segment.leader, home, away)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400">
        <div>أحداث ضغط: <span className="text-white">{segment.available ? `${ar(segment.homeEvents)} - ${ar(segment.awayEvents)}` : 'غير متوفر'}</span></div>
        <div>هجمات خطيرة: <span className="text-white">{segment.available ? `${ar(segment.homeDangerEvents)} - ${ar(segment.awayDangerEvents)}` : 'غير متوفر'}</span></div>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-5 text-gray-300">
        <span className="font-black text-gray-500">أهم حدث: </span>
        {segment.topEvent ? (
          <button type="button" onClick={() => segment.topEvent && onSelectEvent(segment.topEvent.id)} className="text-right font-bold text-[#0FF0FC] hover:text-[#FFD700]">
            {segment.topEvent.minute ? `د${segment.topEvent.minute} - ` : ''}{eventIcon(segment.topEvent.type)} {eventLabel(segment.topEvent.type)}
          </button>
        ) : 'غير متوفر'}
      </div>
    </div>
  );
}
