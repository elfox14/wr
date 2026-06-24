'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, FileText, Flag, MapPin, Radio, RefreshCw, Share2, Shield, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchPlayerStatItem, MatchShotMapItem, MatchStatMetric, OfficialLineupPlayer, OfficialLineupTeam, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    setIsMobile(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  return isMobile;
}
const tabs = [
  ['events', 'الأحداث', Radio],
  ['stats', 'الإحصائيات', BarChart3],
  ['lineups', 'التشكيل', Users],
  ['standings', 'الترتيب', Trophy],
  ['analysis', 'التحليل', FileText],
] as const;

type TabId = (typeof tabs)[number][0];
type PitchSide = 'home' | 'away';
type PitchPlayer = OfficialLineupPlayer | MatchPlayerLite;
type PitchSlot = { player: PitchPlayer; x: number; y: number; side: PitchSide };
type PlayerRole = 'starter' | 'substitute';
type PlayerStatRow = { player: PitchPlayer; stat: MatchPlayerStatItem | null; role: PlayerRole; index: number };

const statusClasses = {
  scheduled: 'border-white/15 bg-white/10 text-white',
  live: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  halftime: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  finished: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
  delayed: 'border-rose-300/35 bg-rose-400/10 text-rose-100',
};

const eventArabicMap: Record<string, string> = {
  goal: 'هدف', shot_on_target: 'تسديدة على المرمى', shot_off_target: 'تسديدة خارج المرمى', shot_blocked: 'تسديدة محجوبة',
  corner_kick: 'ركلة ركنية', foul: 'خطأ', yellow_card: 'بطاقة صفراء', red_card: 'بطاقة حمراء', substitution: 'تبديل',
  var: 'مراجعة VAR', offside: 'تسلل', added_time: 'وقت بدل ضائع', period_start: 'بداية شوط', period_end: 'نهاية شوط',
  save: 'تصدي', penalty: 'ركلة جزاء', own_goal: 'هدف عكسي',
};

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number.isInteger(value) ? ar.format(value) : value.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}
function fullDate(value: string) { return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function gd(value: number) { return value > 0 ? `+${ar.format(value)}` : ar.format(value); }
function pct(home: number | null, away: number | null) { const h = Math.max(0, Number(home || 0)); const a = Math.max(0, Number(away || 0)); const total = h + a; if (!total) return { home: 50, away: 50 }; const width = Math.max(6, Math.min(94, (h / total) * 100)); return { home: width, away: 100 - width }; }
function initials(name?: string | null) { return String(name || 'لاعب').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function clamp(value: number, min = 4, max = 96) { return Math.max(min, Math.min(max, value)); }
function normalizeName(value?: string | null) { return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function playerNumber(player: PitchPlayer) { return 'number' in player ? player.number : null; }
function playerCaptain(player: PitchPlayer) { return 'isCaptain' in player ? Boolean(player.isCaptain) : false; }
function playerId(player: PitchPlayer) { return 'id' in player && player.id ? String(player.id) : null; }
function playedStat(stat: MatchPlayerStatItem | null | undefined) { return Boolean(stat?.played) || Number(stat?.minutes || 0) > 0 || Boolean(stat?.started); }
function matchClockLabel(data: MatchPageData) { if (data.status.isScheduled) return `موعد المباراة: ${fullDate(data.matchDate)}`; if (data.status.isFinished) return 'نهاية المباراة'; return data.status.label || 'زمن المباراة'; }
function eventArabic(type?: string | null) {
  const raw = String(type || '').trim();
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (eventArabicMap[key]) return eventArabicMap[key];
  for (const [needle, label] of Object.entries(eventArabicMap)) if (key.includes(needle)) return label;
  return raw || 'حدث مباراة';
}

function findLocalPlayer(player: PitchPlayer, localPlayers: MatchPlayerLite[]) {
  const id = playerId(player);
  const name = normalizeName(player.name);
  return localPlayers.find((item) => {
    const localName = normalizeName(item.name);
    const localCode = normalizeName(item.code);
    return Boolean((id && item.id === id) || (name && localName && (localName === name || localName.includes(name) || name.includes(localName))) || (name && localCode && localCode === name));
  });
}
function playerWithRealImage(player: PitchPlayer, localPlayers: MatchPlayerLite[]): PitchPlayer {
  const local = findLocalPlayer(player, localPlayers);
  return { ...player, image: player.image || local?.image || null, position: player.position || local?.position || null } as PitchPlayer;
}
function allOfficialPlayers(data: MatchPageData) {
  return [...(data.officialLineup?.home?.startingXi || []), ...(data.officialLineup?.home?.substitutes || []), ...(data.officialLineup?.away?.startingXi || []), ...(data.officialLineup?.away?.substitutes || []), ...data.homePlayers, ...data.awayPlayers];
}
function playerStatFor(player: PitchPlayer, stats: MatchPlayerStatItem[]) {
  const id = playerId(player);
  const name = normalizeName(player.name);
  return stats.find((item) => {
    const statId = item.playerId ? String(item.playerId) : null;
    const statName = normalizeName(item.playerName);
    return Boolean((id && statId && id === statId) || (name && statName && (statName === name || statName.includes(name) || name.includes(statName))));
  }) || null;
}
function teamSideForId(data: MatchPageData, teamId?: string | null): PitchSide | null { if (teamId === data.homeTeam.id || teamId === data.homeTeam.code) return 'home'; if (teamId === data.awayTeam.id || teamId === data.awayTeam.code) return 'away'; return null; }
function eventText(event: MatchEventView) { return `${event.type} ${event.detail} ${event.playerName || ''}`.toLowerCase(); }
function eventPoint(event: MatchEventView, data: MatchPageData, index: number) {
  if (event.x !== null && event.x !== undefined && event.y !== null && event.y !== undefined) return { x: clamp(Number(event.x)), y: clamp(Number(event.y)) };
  const side = teamSideForId(data, event.teamId);
  const seed = (index * 37 + String(event.id).length * 11) % 100;
  const y = 18 + (seed % 64);
  const text = eventText(event);
  if (text.includes('corner') || text.includes('ركنية')) return { x: side === 'away' ? 8 : 92, y: seed % 2 ? 12 : 88 };
  if (text.includes('shot') || text.includes('goal') || text.includes('تسديدة') || text.includes('هدف')) return { x: side === 'away' ? 18 : 82, y };
  if (text.includes('sub') || text.includes('تبديل')) return { x: side === 'away' ? 9 : 91, y };
  return { x: side === 'away' ? 38 : side === 'home' ? 62 : 50, y };
}
function shotPoint(shot: MatchShotMapItem) { return { x: clamp(Number(shot.x ?? 50)), y: clamp(Number(shot.y ?? 50)) }; }
function isChangeEvent(event: MatchEventView) { const text = normalizeName(`${event.type} ${event.detail}`); return text.includes('substitution') || text.includes('sub') || text.includes('تبديل') || text.includes('دخول') || text.includes('خروج'); }
function eventTeamPlayers(event: MatchEventView, data: MatchPageData) { if (event.teamId === data.homeTeam.id) return data.homePlayers; if (event.teamId === data.awayTeam.id) return data.awayPlayers; return [...data.homePlayers, ...data.awayPlayers]; }
function playerFromChange(event: MatchEventView, data: MatchPageData): PitchPlayer | null { const name = event.playerName || event.detail?.split(' - ').pop() || null; if (!name) return null; return playerWithRealImage({ name }, eventTeamPlayers(event, data)); }
function playerForEvent(event: MatchEventView | null, data: MatchPageData): PitchPlayer | null {
  if (!event?.playerName) return null;
  const key = normalizeName(event.playerName);
  const local = allOfficialPlayers(data).find((player) => { const name = normalizeName(player.name); return name && key && (name === key || name.includes(key) || key.includes(name)); });
  return playerWithRealImage(local || { name: event.playerName }, [...data.homePlayers, ...data.awayPlayers]);
}
function shotForEvent(event: MatchEventView | null, shots: MatchShotMapItem[]) {
  if (!event || !shots.length) return null;
  const eventName = normalizeName(event.playerName);
  return shots.find((shot) => { const sameMinute = Math.abs(Number(shot.minute || 0) - Number(event.minute || 0)) <= 1; const shotName = normalizeName(shot.playerName); return sameMinute && (!eventName || !shotName || shotName === eventName || shotName.includes(eventName) || eventName.includes(shotName)); }) || null;
}
function teamByText(data: MatchPageData, value?: string | null) { const key = normalizeName(value); if (!key) return null; const home = normalizeName(`${data.homeTeam.name} ${data.homeTeam.code || ''}`); const away = normalizeName(`${data.awayTeam.name} ${data.awayTeam.code || ''}`); if (home.includes(key) || key.includes(normalizeName(data.homeTeam.name))) return data.homeTeam; if (away.includes(key) || key.includes(normalizeName(data.awayTeam.name))) return data.awayTeam; return null; }
function teamForEvent(event: MatchEventView | null, shot: MatchShotMapItem | null, data: MatchPageData) {
  const side = teamSideForId(data, shot?.teamId || event?.teamId || null);
  if (side === 'home') return data.homeTeam;
  if (side === 'away') return data.awayTeam;
  return teamByText(data, shot?.teamName) || null;
}

function Empty({ title, body }: { title: string; body: string }) { return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>; }
function Section({ id, title, icon, hint, children }: { id: TabId; title: string; icon: ReactNode; hint?: string; children: ReactNode }) { return <section id={id} className="scroll-mt-[132px] rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5 lg:scroll-mt-[156px]"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F] sm:h-11 sm:w-11">{icon}</span><div className="min-w-0"><h2 className="truncate text-lg font-black text-white sm:text-2xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div></div>{children}</section>; }
function FlagImg({ team, small = false }: { team: MatchPageData['homeTeam']; small?: boolean }) { return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-5 w-7 rounded' : 'h-14 w-16 rounded-2xl sm:h-24 sm:w-28'}`}>{team.image ? <img src={team.image} alt={`علم ${team.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || team.name.slice(0, 3)}</b>}</span>; }
function TeamSide({ team }: { team: MatchPageData['homeTeam'] }) { return <div className="flex min-w-0 flex-col items-center gap-2 sm:gap-3"><FlagImg team={team} /><div className="min-w-0 text-center"><p className="truncate text-base font-black text-white sm:text-3xl">{team.name}</p><div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[10px] font-bold text-slate-400 sm:text-xs">{team.code ? <span>{team.code}</span> : null}{team.fifaRank ? <span>تصنيف {ar.format(team.fifaRank)}</span> : null}</div></div></div>; }
function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-2.5 text-center sm:p-3 sm:text-right"><div className="mb-1 flex items-center justify-center gap-1.5 text-[#18E58F] sm:justify-start">{icon}<span className="text-[10px] font-black sm:text-xs">{label}</span></div><p className="line-clamp-2 min-h-[2.35rem] text-[10px] font-black leading-5 text-white sm:min-h-0 sm:text-sm sm:font-bold sm:leading-6">{value || '—'}</p></div>; }

function Hero({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) {
  return <header className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#04110D] p-3 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:rounded-[2rem] sm:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(24,229,143,.20),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(248,200,70,.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_42%)]" /><div className="relative"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5" dir="rtl"><TeamSide team={data.homeTeam} /><div className="space-y-2"><div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 shadow-inner sm:gap-5 sm:px-7 sm:py-3"><span className="text-3xl font-black text-[#F8C846] tabular-nums sm:text-7xl">{fmt(data.score.home)}</span><span className="text-2xl font-black text-white/70 sm:text-6xl">-</span><span className="text-3xl font-black text-white tabular-nums sm:text-7xl">{fmt(data.score.away)}</span></div><p className={`mx-auto inline-flex rounded-full border px-3 py-1.5 text-xs font-black sm:px-4 sm:py-2 ${statusClasses[data.status.kind]}`}>{matchClockLabel(data)}</p></div><TeamSide team={data.awayTeam} /></div><div className="mt-5 grid grid-cols-2 gap-2 text-right lg:grid-cols-4"><Info icon={<MapPin size={15} />} label="الملعب" value={data.venue || 'جاري جلب اسم الملعب'} /><Info icon={<Shield size={15} />} label="المدينة" value={data.city || '—'} /><Info icon={<Flag size={15} />} label="الحكم" value={data.referee || '—'} /><Info icon={<Trophy size={15} />} label="المجموعة" value={data.groupLabel || data.stageLabel} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center"><button onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black sm:text-sm"><RefreshCw size={16} /> تحديث</button><button onClick={onShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white sm:text-sm"><Share2 size={16} /> مشاركة</button>{data.digest?.href ? <Link href={data.digest.href} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/12 px-3 py-2 text-xs font-black text-[#F8C846] sm:col-span-1 sm:text-sm"><FileText size={16} /> تقرير المباراة</Link> : null}</div></div></header>;
}
function StickyTabs({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) { const content = <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-2 pb-1 pt-2 scrollbar-none sm:px-4">{tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => onSelect(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition sm:text-xs ${active === id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Icon size={15} />{label}</button>)}</div>; return <><div className="h-[54px] lg:h-[58px]" /><nav className="fixed inset-x-0 top-[64px] z-40 border-y border-white/10 bg-[#04110D]/96 shadow-[0_12px_32px_rgba(0,0,0,.36)] backdrop-blur-xl lg:top-[84px]">{content}</nav></>; }

function ActiveEventMarker({ event, shot, player, team, point }: { event: MatchEventView; shot: MatchShotMapItem | null; player: PitchPlayer | null; team: MatchPageData['homeTeam'] | null; point: { x: number; y: number } }) {
  const isMobile = useIsMobile();
  const number = player ? playerNumber(player) : null;
  const playerName = player?.name || event.playerName || shot?.playerName || 'لاعب غير محدد';
  const label = eventArabic(event.type);
  const positionStyle = isMobile
    ? { left: `${point.y}%`, top: `${point.x}%` }
    : { left: `${point.x}%`, top: `${point.y}%` };

  return <div className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={positionStyle}><span className="absolute h-20 w-20 animate-ping rounded-full bg-[#F8C846]/20" /><div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#F8C846] bg-black/75 shadow-xl">{player?.image ? <img src={player.image} alt={playerName} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-sm font-black text-white">{initials(playerName)}</span>}{number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[9px] font-black text-black">{number}</b> : null}</div><div className="mt-1 flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[10px] font-black text-white backdrop-blur">{team ? <FlagImg team={team} small /> : null}<span>{event.minuteLabel}</span>{number ? <span>#{number}</span> : null}</div><span className="mt-1 max-w-[150px] rounded-xl bg-[#F8C846] px-2 py-1 text-[10px] font-black leading-4 text-black">{event.icon} {label}</span><span className="mt-1 max-w-[150px] rounded-xl bg-black/75 px-2 py-1 text-[10px] font-bold leading-4 text-white">{playerName}</span></div>;
}
function LiveEventPitch({ data, activeIndex }: { data: MatchPageData; activeIndex: number }) {
  const isMobile = useIsMobile();
  const active = data.events[activeIndex] || null;
  const shots = data.advanced.shotmap || [];
  const matchedShot = shotForEvent(active, shots);
  const point = active ? (matchedShot ? shotPoint(matchedShot) : eventPoint(active, data, activeIndex)) : null;
  const player = active ? playerForEvent(active, data) : null;
  const team = teamForEvent(active, matchedShot, data);
  return (
    <div className="relative overflow-hidden rounded-[1.4rem] border border-[#18E58F]/25 bg-[#0c3f2b] p-3 shadow-inner">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-black/25 px-3 py-2 text-xs font-black text-white">
        <span>{data.awayTeam.name}</span>
        <span className="text-[#F8C846]">ملعب البث التفاعلي</span>
        <span>{data.homeTeam.name}</span>
      </div>
      <div 
        className={`relative overflow-hidden rounded-[1.1rem] border-2 border-white/35 transition-all duration-300 ${
          isMobile 
            ? 'aspect-[9/16] min-h-[500px] w-full bg-[linear-gradient(180deg,rgba(255,255,255,.04)_0_50%,rgba(255,255,255,.08)_50%_100%)]' 
            : 'aspect-[16/9] min-h-[300px] bg-[linear-gradient(90deg,rgba(255,255,255,.04)_0_50%,rgba(255,255,255,.08)_50%_100%)]'
        }`}
      >
        <div 
          className={`absolute bg-white/45 ${
            isMobile 
              ? 'inset-x-0 top-1/2 h-px -translate-y-1/2' 
              : 'inset-y-0 left-1/2 w-px -translate-x-1/2'
          }`} 
        />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
        <div 
          className={`absolute border-white/30 ${
            isMobile 
              ? 'top-0 left-1/2 h-14 w-32 -translate-x-1/2 rounded-b-3xl border-x-2 border-b-2' 
              : 'left-0 top-1/2 h-32 w-14 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2'
          }`} 
        />
        <div 
          className={`absolute border-white/30 ${
            isMobile 
              ? 'bottom-0 left-1/2 h-14 w-32 -translate-x-1/2 rounded-t-3xl border-x-2 border-t-2' 
              : 'right-0 top-1/2 h-32 w-14 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2'
          }`} 
        />
        {active && point ? <ActiveEventMarker event={active} shot={matchedShot} player={player} team={team} point={point} /> : <div className="absolute inset-0 grid place-items-center p-6"><Empty title="لا يوجد حدث محدد" body="اضغط تشغيل العرض أو اختر حدثًا من القائمة لعرضه وحده على الملعب." /></div>}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-[#F8C846]">{team ? <FlagImg team={team} small /> : null}<span>{active ? `${active.minuteLabel} — ${eventArabic(active.type)}` : 'لا يوجد حدث محدد'}</span></div>
        <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-white">{active ? `${player?.name || active.playerName || 'لاعب غير محدد'} · ${active.detail || eventArabic(active.type)}${matchedShot ? ` · xG ${fmt(matchedShot.xg)}` : ''}` : 'عند تشغيل العرض سيظهر كل حدث وحده بصورة اللاعب أو رقمه والدقيقة.'}</p>
      </div>
    </div>
  );
}
function EventsPanel({ data }: { data: MatchPageData }) { const [activeIndex, setActiveIndex] = useState(0); const [playing, setPlaying] = useState(false); const total = data.events.length; useEffect(() => { setActiveIndex((current) => Math.min(current, Math.max(0, total - 1))); }, [total]); useEffect(() => { if (!playing || total <= 1) return; const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % total), 2200); return () => window.clearInterval(timer); }, [playing, total]); return <Section id="events" title="أحداث المباراة" icon={<Radio size={22} />} hint="الملعب يعرض حدثًا واحدًا في كل مرة بدل تكديس كل الأحداث"><div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><LiveEventPitch data={data} activeIndex={activeIndex} /><div className="rounded-[1.4rem] border border-white/10 bg-black/25 p-3"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-black text-white">تسلسل الأحداث</h3><button onClick={() => setPlaying((v) => !v)} className="rounded-full border border-[#18E58F]/30 bg-[#18E58F]/10 px-3 py-1 text-[11px] font-black text-[#18E58F]">{playing ? 'إيقاف العرض' : 'تشغيل العرض'}</button></div>{data.events.length ? <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{data.events.map((event, index) => <button key={event.id} onClick={() => setActiveIndex(index)} className={`w-full rounded-2xl border p-3 text-right transition ${index === activeIndex ? 'border-[#F8C846]/50 bg-[#F8C846]/10' : 'border-white/10 bg-white/[0.045] hover:bg-white/[0.07]'}`}><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/35 text-lg">{event.icon}</span><div className="min-w-0 flex-1"><p className="text-xs font-black text-[#F8C846]">{event.minuteLabel} · {eventArabic(event.type)}</p><p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-white">{event.playerName ? `${event.playerName} — ` : ''}{event.detail || eventArabic(event.type)}</p></div></div></button>)}</div> : <Empty title="لا توجد أحداث" body="ستظهر الأحداث عند وصولها من TheStats أو iSports." />}</div></div></Section>; }

function StatComparisonRow({ metric }: { metric: MatchStatMetric }) {
  const pcts = pct(metric.home, metric.away);
  const homeVal = Number(metric.home || 0);
  const awayVal = Number(metric.away || 0);
  const isHomeHigher = homeVal > awayVal;
  const isAwayHigher = awayVal > homeVal;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-white/20">
      {/* Values & Label row */}
      <div className="grid grid-cols-[64px_1fr_64px] items-center gap-3 text-center sm:grid-cols-[80px_1fr_80px]">
        {/* Home Team Value (Right side in RTL) */}
        <b className={`text-base font-black tabular-nums sm:text-lg ${isHomeHigher ? 'text-[#F8C846]' : 'text-white/70'}`}>
          {fmt(metric.home, metric.suffix)}
        </b>

        {/* Metric Label (Center) */}
        <div className="min-w-0">
          <p className="text-xs font-black text-white sm:text-sm">{metric.label}</p>
          {metric.source ? (
            <p className="mt-0.5 text-[9px] font-bold text-slate-500 sm:text-[10px]">{metric.source}</p>
          ) : null}
        </div>

        {/* Away Team Value (Left side in RTL) */}
        <b className={`text-base font-black tabular-nums sm:text-lg ${isAwayHigher ? 'text-[#18E58F]' : 'text-white/70'}`}>
          {fmt(metric.away, metric.suffix)}
        </b>
      </div>

      {/* Progress Bars comparison */}
      <div className="mt-2.5 flex items-center gap-2" dir="ltr">
        {/* Left Bar (Away) - grows from center (right edge) to left */}
        <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden flex justify-end">
          {metric.available && (
            <div
              className="h-full rounded-full bg-[#18E58F] transition-all duration-500"
              style={{ width: `${pcts.away}%` }}
            />
          )}
        </div>
        {/* Right Bar (Home) - grows from center (left edge) to right */}
        <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden flex justify-start">
          {metric.available && (
            <div
              className="h-full rounded-full bg-[#F8C846] transition-all duration-500"
              style={{ width: `${pcts.home}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatsPanel({ data }: { data: MatchPageData }) {
  const available = data.stats.filter((m) => m.available);
  return (
    <Section
      id="stats"
      title="إحصائيات المباراة"
      icon={<BarChart3 size={22} />}
      hint={`${ar.format(available.length)} من ${ar.format(data.stats.length)} مؤشر متوفر · مقارنة مباشرة بين المنتخبين`}
    >
      <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3 sm:p-4">
        {/* Header showing teams */}
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/5 pb-4">
          {/* Home Team (Right side in RTL) */}
          <div className="flex items-center gap-2 justify-start min-w-0">
            <span className="truncate text-sm font-black text-white sm:text-base">{data.homeTeam.name}</span>
            <FlagImg team={data.homeTeam} small />
          </div>

          {/* Center separator */}
          <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black text-slate-400">
            المقارنة
          </span>

          {/* Away Team (Left side in RTL) */}
          <div className="flex items-center gap-2 justify-end min-w-0">
            <FlagImg team={data.awayTeam} small />
            <span className="truncate text-sm font-black text-white sm:text-base">{data.awayTeam.name}</span>
          </div>
        </div>

        {/* Stats Rows */}
        <div className="grid gap-3 lg:grid-cols-2">
          {data.stats.map((metric) => (
            <StatComparisonRow key={metric.key} metric={metric} />
          ))}
        </div>
      </div>
    </Section>
  );
}

function formationLines(formation: string | null | undefined, count: number) { const raw = String(formation || '').match(/\d+/g)?.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0) || []; if (raw.length && raw.reduce((sum, value) => sum + value, 1) <= Math.max(count, 11) + 1) return [1, ...raw]; if (count >= 11) return [1, 4, 3, 3]; if (count >= 7) return [1, 3, 2, count - 6]; if (count >= 4) return [1, 2, count - 3]; return [Math.max(1, count)]; }
function slotsFor(players: PitchPlayer[], formation: string | null | undefined, side: PitchSide): PitchSlot[] { const starters = players.slice(0, 11); const lines = formationLines(formation, starters.length); const slots: PitchSlot[] = []; let cursor = 0; const totalLines = Math.max(1, lines.length - 1); lines.forEach((lineCount, lineIndex) => { const actual = Math.max(1, Math.min(lineCount, starters.length - cursor)); for (let i = 0; i < actual; i += 1) { const player = starters[cursor++]; if (!player) continue; const progress = totalLines ? lineIndex / totalLines : 0; const x = side === 'home' ? 86 - progress * 30 : 14 + progress * 30; const y = actual === 1 ? 50 : 14 + (72 * (i + 0.5)) / actual; slots.push({ player, x, y, side }); } }); return slots; }
function PitchPlayerToken({ slot }: { slot: PitchSlot }) {
  const isMobile = useIsMobile();
  const image = slot.player.image;
  const number = playerNumber(slot.player);
  const captain = playerCaptain(slot.player);
  const positionStyle = isMobile
    ? { left: `${slot.y}%`, top: `${slot.x}%` }
    : { left: `${slot.x}%`, top: `${slot.y}%` };

  return (
    <div className="absolute z-20 flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center sm:w-20" style={positionStyle} title={slot.player.name}>
      <div className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 shadow-xl sm:h-12 sm:w-12 ${slot.side === 'home' ? 'border-[#F8C846] bg-[#F8C846]/20' : 'border-[#18E58F] bg-[#18E58F]/20'}`}>
        {image ? <img src={image} alt={slot.player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-xs font-black text-white">{initials(slot.player.name)}</span>}
        {number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white">{number}</b> : null}
        {captain ? <b className="absolute -left-1 -top-1 rounded-full bg-[#F8C846] px-1 text-[9px] text-black">C</b> : null}
      </div>
      <span className="mt-1 line-clamp-2 rounded-lg bg-black/55 px-1.5 py-0.5 text-[9px] font-black leading-3 text-white backdrop-blur sm:text-[10px]">{slot.player.name}</span>
    </div>
  );
}

function ChangePlayerToken({ event, data, side, index, total }: { event: MatchEventView; data: MatchPageData; side: PitchSide; index: number; total: number }) {
  const isMobile = useIsMobile();
  const player = playerFromChange(event, data);
  const rows = Math.min(6, Math.max(1, total));
  const y = rows === 1 ? 50 : 18 + (64 * (index % rows)) / Math.max(1, rows - 1);
  const column = Math.floor(index / rows);
  const x = side === 'home' ? 95 - column * 5 : 5 + column * 5;
  const image = player?.image || null;
  const positionStyle = isMobile
    ? { left: `${y}%`, top: `${x}%` }
    : { left: `${x}%`, top: `${y}%` };

  return (
    <div className="absolute z-30 flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={positionStyle} title={event.detail}>
      <div className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 shadow-xl ${side === 'home' ? 'border-[#F8C846] bg-black/50' : 'border-[#18E58F] bg-black/50'}`}>
        {image ? <img src={image} alt={player?.name || event.playerName || 'تبديل'} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[10px] font-black text-white">{initials(player?.name || event.playerName || 'تبديل')}</span>}
      </div>
      <span className="mt-1 line-clamp-2 rounded-md bg-black/65 px-1 py-0.5 text-[8px] font-black leading-3 text-white backdrop-blur">{player?.name || event.playerName || 'تبديل'}</span>
      <span className="mt-0.5 rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[8px] font-black text-black">{event.minuteLabel}</span>
    </div>
  );
}

function OfficialPitch({ data }: { data: MatchPageData }) {
  const isMobile = useIsMobile();
  const official = data.officialLineup;
  const homePlayersSource: PitchPlayer[] = official?.home?.startingXi?.length ? official.home.startingXi : data.homePlayers.slice(0, 11);
  const awayPlayersSource: PitchPlayer[] = official?.away?.startingXi?.length ? official.away.startingXi : data.awayPlayers.slice(0, 11);
  const homePlayers = homePlayersSource.map((player) => playerWithRealImage(player, data.homePlayers));
  const awayPlayers = awayPlayersSource.map((player) => playerWithRealImage(player, data.awayPlayers));
  const homeFormation = official?.home?.formation || '4-3-3';
  const awayFormation = official?.away?.formation || '4-3-3';
  const homeChanges = data.events.filter((event) => isChangeEvent(event) && event.teamId === data.homeTeam.id);
  const awayChanges = data.events.filter((event) => isChangeEvent(event) && event.teamId === data.awayTeam.id);
  const slots = [...slotsFor(awayPlayers, awayFormation, 'away'), ...slotsFor(homePlayers, homeFormation, 'home')];

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-[#18E58F]/25 bg-[#0b3b28] p-3">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-black/25 px-3 py-2 text-xs font-black text-white">
        <span>{data.awayTeam.name} · {awayFormation}</span>
        <span className="text-[#F8C846]">التشكيلة الرسمية على الملعب</span>
        <span>{data.homeTeam.name} · {homeFormation}</span>
      </div>
      <div 
        className={`relative overflow-hidden rounded-[1.35rem] border-2 border-white/35 transition-all duration-300 ${
          isMobile 
            ? 'h-[620px] w-full bg-[linear-gradient(180deg,rgba(255,255,255,.05)_0_50%,rgba(255,255,255,.08)_50%_100%)]' 
            : 'h-[620px] sm:h-[680px] lg:h-[560px] bg-[linear-gradient(90deg,rgba(255,255,255,.05)_0_50%,rgba(255,255,255,.08)_50%_100%)]'
        }`}
      >
        <div 
          className={`absolute bg-white/45 ${
            isMobile 
              ? 'inset-x-0 top-1/2 h-px -translate-y-1/2' 
              : 'inset-y-0 left-1/2 w-px -translate-x-1/2'
          }`} 
        />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
        <div 
          className={`absolute border-white/30 ${
            isMobile 
              ? 'top-0 left-1/2 h-16 w-40 -translate-x-1/2 rounded-b-3xl border-x-2 border-b-2' 
              : 'left-0 top-1/2 h-40 w-16 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2'
          }`} 
        />
        <div 
          className={`absolute border-white/30 ${
            isMobile 
              ? 'bottom-0 left-1/2 h-16 w-40 -translate-x-1/2 rounded-t-3xl border-x-2 border-t-2' 
              : 'right-0 top-1/2 h-40 w-16 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2'
          }`} 
        />
        {awayChanges.length ? <div className="absolute left-2 top-2 z-20 rounded-full border border-[#18E58F]/30 bg-black/45 px-2 py-1 text-[9px] font-black text-[#18E58F]">تغييرات {data.awayTeam.name}</div> : null}
        {homeChanges.length ? <div className="absolute right-2 top-2 z-20 rounded-full border border-[#F8C846]/30 bg-black/45 px-2 py-1 text-[9px] font-black text-[#F8C846]">تغييرات {data.homeTeam.name}</div> : null}
        {awayChanges.map((event, index) => <ChangePlayerToken key={`away-change-${event.id}`} event={event} data={data} side="away" index={index} total={awayChanges.length} />)}
        {homeChanges.map((event, index) => <ChangePlayerToken key={`home-change-${event.id}`} event={event} data={data} side="home" index={index} total={homeChanges.length} />)}
        {slots.length ? slots.map((slot, index) => <PitchPlayerToken key={`${slot.side}-${slot.player.name}-${index}`} slot={slot} />) : <div className="absolute inset-0 grid place-items-center p-6"><Empty title="التشكيل لم يصل بعد" body="业务..." /></div>}
      </div>
    </div>
  );
}

function lineupRows(team: OfficialLineupTeam | null | undefined, localPlayers: MatchPlayerLite[], stats: MatchPlayerStatItem[]) { const starters = (team?.startingXi || []).map((player, index) => ({ player: playerWithRealImage(player, localPlayers), stat: playerStatFor(player, stats), role: 'starter' as PlayerRole, index })); const usedSubstitutes = (team?.substitutes || []).map((player, index) => ({ player: playerWithRealImage(player, localPlayers), stat: playerStatFor(player, stats), role: 'substitute' as PlayerRole, index })).filter((row) => playedStat(row.stat)); return { starters, usedSubstitutes, total: starters.length + usedSubstitutes.length, withStats: [...starters, ...usedSubstitutes].filter((row) => row.stat).length }; }
function PlayerAvatar({ player, accent }: { player: PitchPlayer; accent: 'home' | 'away' }) { const number = playerNumber(player); const border = accent === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]'; return <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${border} bg-black/45 shadow-lg`}>{player.image ? <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-black text-white">{initials(player.name)}</span>}{number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white ring-1 ring-white/20">{number}</b> : null}</div>; }
function StatHeader() { const labels = ['تقييم', 'دقائق', 'أهداف', 'أسيست', 'تسديد', 'تمرير', 'مفتاح', 'تصدي']; return <div className="grid min-w-[820px] grid-cols-[minmax(210px,1.5fr)_repeat(8,64px)] gap-1 rounded-2xl border border-white/10 bg-black/40 px-2 py-2 text-center text-[10px] font-black text-slate-400"><span className="text-right">اللاعب</span>{labels.map((label) => <span key={label}>{label}</span>)}</div>; }
function PlayerNumberCell({ value }: { value: ReactNode }) { return <span className="rounded-xl bg-black/25 px-1.5 py-2 text-center text-xs font-black text-white tabular-nums">{value}</span>; }
function PlayerStatLine({ row, accent }: { row: PlayerStatRow; accent: 'home' | 'away' }) { const stat = row.stat; const player = row.player; return <article className="grid min-w-[820px] grid-cols-[minmax(210px,1.5fr)_repeat(8,64px)] items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.045] p-2"><div className="flex min-w-0 items-center gap-2"><PlayerAvatar player={player} accent={accent} /><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-black text-white">{player.name}</p>{playerCaptain(player) ? <span className="rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[9px] font-black text-black">C</span> : null}</div><p className="mt-0.5 text-[10px] font-bold text-slate-400">#{playerNumber(player) || '—'} · {player.position || stat?.position || '—'} · {row.role === 'starter' ? 'أساسي' : 'بديل شارك'}</p></div></div><PlayerNumberCell value={fmt(stat?.rating)} /><PlayerNumberCell value={fmt(stat?.minutes)} /><PlayerNumberCell value={fmt(stat?.goals)} /><PlayerNumberCell value={fmt(stat?.assists)} /><PlayerNumberCell value={fmt(stat?.shots)} /><PlayerNumberCell value={fmt(stat?.passes)} /><PlayerNumberCell value={fmt(stat?.keyPasses)} /><PlayerNumberCell value={fmt(stat?.saves)} /></article>; }
function PlayerGroup({ title, rows, accent }: { title: string; rows: PlayerStatRow[]; accent: 'home' | 'away' }) { if (!rows.length) return null; return <div><h4 className="mb-2 text-xs font-black text-[#F8C846]">{title}</h4><div className="overflow-x-auto"><div className="space-y-2"><StatHeader />{rows.map((row) => <PlayerStatLine key={`${title}-${row.player.name}-${row.index}`} row={row} accent={accent} />)}</div></div></div>; }
function TeamPlayerStatsCard({ team, lineup, localPlayers, stats, accent }: { team: MatchPageData['homeTeam']; lineup: OfficialLineupTeam | null | undefined; localPlayers: MatchPlayerLite[]; stats: MatchPlayerStatItem[]; accent: 'home' | 'away' }) { const rows = lineupRows(lineup, localPlayers, stats); const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10'; return <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FlagImg team={team} small /><div className="min-w-0"><h3 className="truncate text-lg font-black text-white">{team.name}</h3><p className="mt-1 text-[10px] font-bold text-slate-500">{lineup?.formation ? `الخطة ${lineup.formation}` : 'التشكيل الرسمي'}</p></div></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${color}`}>{ar.format(rows.withStats)} / {ar.format(rows.total)} لاعب</span></div><div className="space-y-5"><PlayerGroup title="الأساسيون" rows={rows.starters} accent={accent} /><PlayerGroup title="البدلاء المشاركون فقط" rows={rows.usedSubstitutes} accent={accent} />{!rows.total ? <Empty title="جاري جلب إحصائيات اللاعبين" body="لم تصل إحصائيات اللاعبين بعد. ستظهر هنا تلقائيًا فور حفظ بيانات ما بعد المباراة." /> : null}</div></div>; }
function PlayerStatsCard({ data }: { data: MatchPageData }) { const stats = data.advanced.playerStats || []; const official = data.officialLineup; return <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/15 p-3"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-black text-white">إحصائيات اللاعبين</h3><p className="mt-1 text-xs font-bold text-slate-400">الأساسيون + البدلاء الذين شاركوا فقط. لا نعرض كل دكة البدلاء غير المشاركة.</p></div><span className="rounded-full border border-[#F8C846]/30 bg-[#F8C846]/10 px-3 py-1 text-xs font-black text-[#F8C846]">{stats.length ? `${ar.format(stats.length)} سجل خام من TheStats` : 'جاري جلب إحصائيات اللاعبين'}</span></div>{official?.home || official?.away ? <div className="grid gap-4"><TeamPlayerStatsCard team={data.homeTeam} lineup={official.home} localPlayers={data.homePlayers} stats={stats} accent="home" /><TeamPlayerStatsCard team={data.awayTeam} lineup={official.away} localPlayers={data.awayPlayers} stats={stats} accent="away" /></div> : <Empty title="جاري جلب إحصائيات اللاعبين" body="لم تصل إحصائيات اللاعبين بعد. ستظهر هنا تلقائيًا فور حفظ بيانات ما بعد المباراة." />}</div>; }
function LineupsPanel({ data }: { data: MatchPageData }) { const official = data.officialLineup; return <Section id="lineups" title="التشكيل الرسمي وإحصائيات اللاعبين" icon={<Users size={22} />} hint={official ? `خطة ${data.homeTeam.name}: ${official.home?.formation || 'غير متوفر'} · خطة ${data.awayTeam.name}: ${official.away?.formation || 'غير متوفر'}` : 'سيتم جلب التشكيل الرسمي تلقائيًا عند توفره'}><OfficialPitch data={data} /><PlayerStatsCard data={data} /></Section>; }

function StatMini({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) { return <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-center"><span className="block text-[10px] font-black text-slate-500">{label}</span><b className={`mt-1 block text-sm font-black tabular-nums ${accent ? 'text-[#18E58F]' : 'text-white'}`}>{value}</b></div>; }
function StandingCard({ row, compact = false }: { row: StandingRow; compact?: boolean }) { const gdPositive = row.goalDifference > 0; return <article className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-inner transition hover:border-[#18E58F]/30 hover:bg-white/[0.055]"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F8C846]/25 bg-[#F8C846]/10 text-sm font-black text-[#F8C846]">{ar.format(row.rank)}</span><div className="min-w-0"><p className="truncate text-sm font-black text-white sm:text-base">{row.teamName}</p><p className="mt-0.5 text-[10px] font-bold text-slate-500">{compact ? 'ترتيب الثوالث' : 'ترتيب المجموعة'}</p></div></div><div className="rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-2 text-center"><span className="block text-[10px] font-black text-[#18E58F]/80">نقاط</span><b className="text-xl font-black text-[#18E58F] tabular-nums">{ar.format(row.points)}</b></div></div><div className="grid grid-cols-4 gap-2 sm:grid-cols-8"><StatMini label="لعب" value={ar.format(row.played)} /><StatMini label="فاز" value={ar.format(row.won)} /><StatMini label="تعادل" value={ar.format(row.drawn)} /><StatMini label="خسر" value={ar.format(row.lost)} /><StatMini label="له" value={ar.format(row.goalsFor)} /><StatMini label="عليه" value={ar.format(row.goalsAgainst)} /><StatMini label="فارق" value={<span className={gdPositive ? 'text-[#18E58F]' : row.goalDifference < 0 ? 'text-rose-300' : 'text-white'}>{gd(row.goalDifference)}</span>} /><StatMini label="نقاط" value={ar.format(row.points)} accent /></div></article>; }
function StandingsList({ rows, compact = false }: { rows: StandingRow[]; compact?: boolean }) { if (!rows.length) return <Empty title="غير متاح الآن" body="لن يظهر ترتيب غير موثوق حتى تتوفر بيانات المجموعة بشكل صحيح." />; return <div className="space-y-2">{rows.map((row) => <StandingCard key={`${row.teamId}-${row.rank}-${row.teamName}`} row={row} compact={compact} />)}</div>; }
function StandingsPanel({ data }: { data: MatchPageData }) { if (!data.groupStandings.length && !data.thirdPlaceTable.length) return null; const thirdRows = data.thirdPlaceTable.slice(0, 8); return <Section id="standings" title="الترتيب والتأهل" icon={<Trophy size={22} />} hint="ترتيب واضح بدون سكرول أفقي: النقاط والفارق والأهداف في بطاقات منفصلة"><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-black text-white">ترتيب المجموعة</h3><span className="rounded-full bg-[#18E58F]/10 px-3 py-1 text-[11px] font-black text-[#18E58F]">{data.groupLabel || 'مجموعة المباراة'}</span></div><StandingsList rows={data.groupStandings} /></div><div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-black text-white">أفضل الثوالث</h3><span className="rounded-full bg-[#F8C846]/10 px-3 py-1 text-[11px] font-black text-[#F8C846]">أفضل ٨</span></div><StandingsList rows={thirdRows} compact /></div></div></Section>; }
function AnalysisPanel({ data }: { data: MatchPageData }) { return <Section id="analysis" title="التحليل والتقرير" icon={<FileText size={22} />}><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">مفاتيح تكتيكية</h3><div className="space-y-2">{data.tacticalKeys.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>)}</div></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">تأثير المباراة</h3><div className="space-y-2">{data.matchImpact.length ? data.matchImpact.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>) : <p className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-400">سيظهر تأثير المباراة عند توفر ترتيب مجموعة موثوق.</p>}</div></div></div>{data.digest ? <Link href={data.digest.href || '#'} className="mt-4 block rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4 text-right"><p className="font-black text-[#F8C846]">تقرير المباراة</p><p className="mt-2 text-sm font-bold leading-7 text-white">{data.digest.summary || data.digest.turningPoint || 'افتح تقرير المباراة الكامل.'}</p></Link> : null}</Section>; }

export default function ProfessionalMatchPageClient({ data }: { data: MatchPageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const lockRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const refreshMs = data.status.kind === 'live' ? 25000 : 90000;
  const pageTitle = useMemo(() => `${data.homeTeam.name} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${data.awayTeam.name}`, [data]);
  if (!mounted) return <main className="min-h-screen bg-[#04110D] p-6 text-center text-white" dir="rtl">Loading match page...</main>;
  function refresh() { router.refresh(); }
  function selectTab(id: TabId) { setActiveTab(id); const target = document.getElementById(id); if (!target || typeof window === 'undefined') return; if (lockRef.current) window.clearTimeout(lockRef.current); const offset = window.innerWidth < 1024 ? 126 : 150; const top = target.getBoundingClientRect().top + window.scrollY - offset; window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); lockRef.current = window.setTimeout(() => { lockRef.current = null; }, 900); }
  useEffect(() => { const observer = new IntersectionObserver((entries) => { if (lockRef.current) return; const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (visible?.target?.id) setActiveTab(visible.target.id as TabId); }, { rootMargin: '-34% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] }); tabs.forEach(([id]) => { const el = document.getElementById(id); if (el) observer.observe(el); }); return () => observer.disconnect(); }, []);
  async function share() { const text = `${pageTitle} — ${data.status.label}`; if (typeof window === 'undefined') return; const nav = window.navigator as Navigator & { share?: (shareData: ShareData) => Promise<void>; clipboard?: Clipboard }; if (typeof nav.share === 'function') { await nav.share({ title: data.title, text, url: window.location.href }).catch(() => undefined); return; } if (nav.clipboard) await nav.clipboard.writeText(`${text}\n${window.location.href}`).catch(() => undefined); }
  return <main className="min-h-screen bg-[#04110D] px-2 pb-20 pt-3 text-white sm:px-4 sm:pt-4" dir="rtl"><MatchAutoRefresh intervalMs={refreshMs} /><div className="mx-auto max-w-7xl space-y-4 sm:space-y-5"><Hero data={data} onRefresh={refresh} onShare={share} /><StickyTabs active={activeTab} onSelect={selectTab} /><EventsPanel data={data} /><StatsPanel data={data} /><LineupsPanel data={data} /><StandingsPanel data={data} /><AnalysisPanel data={data} /></div></main>;
}
