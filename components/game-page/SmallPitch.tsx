'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CalendarDays, Clock, FileText, Flag, Radio, RefreshCw, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchStatMetric, OfficialLineupPlayer, StandingRow } from '@/lib/match-page/types';

type TabId = 'events' | 'stats' | 'lineups' | 'standings' | 'analysis';
type Side = 'home' | 'away';
type AnyPlayer = OfficialLineupPlayer | MatchPlayerLite;
type Slot = { player: AnyPlayer; side: Side; x: number; y: number };

const ar = new Intl.NumberFormat('ar-EG');
const tabs: Array<[TabId, string, any]> = [
  ['events', '\u0627\u0644\u0623\u062d\u062f\u0627\u062b', Radio],
  ['stats', '\u0627\u0644\u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a', BarChart3],
  ['lineups', '\u0627\u0644\u062a\u0634\u0643\u064a\u0644', Users],
  ['standings', '\u0627\u0644\u062a\u0631\u062a\u064a\u0628', Trophy],
  ['analysis', '\u0627\u0644\u062a\u062d\u0644\u064a\u0644', FileText],
];

function clean(v: unknown) {
  return String(v || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function fmt(v: number | null | undefined, suffix = '') { return v === null || v === undefined || Number.isNaN(v) ? '\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631' : `${Number.isInteger(v) ? ar.format(v) : v.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`; }
function dt(v: string) { return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v)); }
function sd(v: string) { return new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)); }
function clamp(n: number, a = 4, b = 96) { return Math.max(a, Math.min(b, n)); }
function gd(v: number) { return v > 0 ? `+${ar.format(v)}` : ar.format(v); }
function initials(name?: string | null) { return String(name || 'P').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase(); }
function numberOf(p: AnyPlayer) { return 'number' in p ? p.number : null; }
function captainOf(p: AnyPlayer) { return 'isCaptain' in p ? Boolean(p.isCaptain) : false; }
function imageFor(p: AnyPlayer, locals: MatchPlayerLite[]) {
  if (p.image) return p.image;
  const target = clean(p.name);
  const local = locals.find((x) => { const name = clean(x.name || x.code); return Boolean(name && target && (name === target || name.includes(target) || target.includes(name))); });
  return local?.image || null;
}
function enriched(p: AnyPlayer, locals: MatchPlayerLite[]): AnyPlayer {
  const img = imageFor(p, locals);
  const local = locals.find((x) => clean(x.name) === clean(p.name));
  return { ...p, image: img, position: p.position || local?.position || null } as AnyPlayer;
}

function eventPoint(e: MatchEventView, data: MatchPageData, index: number) {
  const raw: any = e as any;
  const realX = Number(raw.x ?? raw.pitchX ?? raw.location?.x ?? raw.coordinates?.x ?? raw.position?.x);
  const realY = Number(raw.y ?? raw.pitchY ?? raw.location?.y ?? raw.coordinates?.y ?? raw.position?.y);
  if (Number.isFinite(realX) && Number.isFinite(realY)) return { x: clamp(realX, 2, 98), y: clamp(realY, 2, 98), exact: true, note: 'exact' };
  const isHome = e.teamId === data.homeTeam.id;
  const isAway = e.teamId === data.awayTeam.id;
  const label = clean(`${e.type} ${e.detail}`);
  const attackX = isHome ? 88 : isAway ? 12 : 50;
  const defendX = isHome ? 12 : isAway ? 88 : 50;
  const sx = ((index % 3) - 1) * 3;
  const sy = ((index % 5) - 2) * 4;
  if (label.includes('corner') || label.includes('\u0631\u0643\u0646\u064a')) return { x: isHome ? 94 : isAway ? 6 : 50, y: index % 2 === 0 ? 9 : 91, exact: false, note: 'corner-zone' };
  if (label.includes('penalty') || label.includes('\u062c\u0632\u0627\u0621')) return { x: attackX, y: 50, exact: false, note: 'penalty-zone' };
  if (label.includes('goal') || label.includes('\u0647\u062f\u0641')) return { x: clamp(attackX + sx, 8, 92), y: clamp(50 + sy, 28, 72), exact: false, note: 'goal-zone' };
  if (label.includes('shot') || label.includes('attempt') || label.includes('\u062a\u0633\u062f\u064a\u062f')) return { x: clamp(attackX + (isHome ? -8 : 8) + sx, 14, 86), y: clamp(50 + sy, 22, 78), exact: false, note: 'shot-zone' };
  if (label.includes('save') || label.includes('\u062a\u0635\u062f')) return { x: defendX, y: clamp(50 + sy, 28, 72), exact: false, note: 'save-zone' };
  if (label.includes('sub') || label.includes('\u062a\u0628\u062f\u064a\u0644')) return { x: 50, y: isHome ? 92 : 8, exact: false, note: 'touchline-zone' };
  if (label.includes('offside') || label.includes('\u062a\u0633\u0644\u0644')) return { x: clamp(attackX + (isHome ? -15 : 15), 18, 82), y: clamp(50 + sy, 24, 76), exact: false, note: 'offside-zone' };
  if (label.includes('foul') || label.includes('card') || label.includes('yellow') || label.includes('red') || label.includes('\u0628\u0637\u0627\u0642') || label.includes('\u062e\u0637')) return { x: clamp(isHome ? 58 + sx : isAway ? 42 + sx : 50, 30, 70), y: clamp(50 + sy, 26, 74), exact: false, note: 'foul-zone' };
  if (label.includes('var')) return { x: 50, y: 50, exact: false, note: 'var-zone' };
  return { x: clamp(isHome ? 60 + sx : isAway ? 40 + sx : 50, 24, 76), y: clamp(50 + sy, 20, 80), exact: false, note: 'estimated' };
}

function FieldLines() {
  return <><div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/45" /><div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" /><div className="absolute left-0 top-1/2 h-32 w-14 -translate-y-1/2 rounded-r-3xl border-y-2 border-r-2 border-white/30" /><div className="absolute right-0 top-1/2 h-32 w-14 -translate-y-1/2 rounded-l-3xl border-y-2 border-l-2 border-white/30" /></>;
}
function Section({ id, title, icon, children }: { id: TabId; title: string; icon: ReactNode; children: ReactNode }) {
  return <section id={id} className="scroll-mt-[132px] rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5 lg:scroll-mt-[156px]"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F]">{icon}</span><h2 className="text-lg font-black text-white sm:text-2xl">{title}</h2></div>{children}</section>;
}

function Hero({ data, onRefresh }: { data: MatchPageData; onRefresh: () => void }) {
  return <header className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#04110D] p-3 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:rounded-[2rem] sm:p-6"><div className="relative"><div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-black sm:text-xs"><span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 text-emerald-100">{data.status.label}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-slate-300">{data.groupLabel || data.stageLabel}</span></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"><b className="truncate text-white">{data.homeTeam.name}</b><div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-2 text-3xl font-black text-[#F8C846]">{fmt(data.score.home)} - {fmt(data.score.away)}</div><b className="truncate text-white">{data.awayTeam.name}</b></div><div className="mt-5 grid grid-cols-3 gap-2 text-xs font-bold"><span><CalendarDays size={14} className="inline" /> {dt(data.matchDate)}</span><span><Flag size={14} className="inline" /> {data.venue || '\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631'}</span><span><Clock size={14} className="inline" /> {sd(data.lastUpdatedAt)}</span></div><button onClick={onRefresh} className="mt-4 rounded-xl bg-[#18E58F] px-4 py-2 text-xs font-black text-black"><RefreshCw size={14} className="inline" /> \u062a\u062d\u062f\u064a\u062b</button></div></header>;
}

function StickyTabs({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  return <><div className="h-[54px] lg:h-[58px]" /><nav className="fixed inset-x-0 top-[64px] z-40 border-y border-white/10 bg-[#04110D]/96 shadow-[0_12px_32px_rgba(0,0,0,.36)] backdrop-blur-xl lg:top-[84px]"><div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-2 py-2 sm:px-4">{tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => onSelect(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black ${active === id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Icon size={15} />{label}</button>)}</div></nav></>;
}

function EventsPanel({ data }: { data: MatchPageData }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = data.events.length;
  useEffect(() => { setActiveIndex((current) => Math.min(current, Math.max(0, total - 1))); }, [total]);
  useEffect(() => { if (!playing || total <= 1) return; const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % total), 1800); return () => window.clearInterval(timer); }, [playing, total]);
  const active = data.events[activeIndex] || null;
  const activePoint = active ? eventPoint(active, data, activeIndex) : null;
  const next = () => total && setActiveIndex((activeIndex + 1) % total);
  const prev = () => total && setActiveIndex((activeIndex - 1 + total) % total);
  return <Section id="events" title="\u0627\u0644\u0623\u062d\u062f\u0627\u062b \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629" icon={<Radio size={22} />}><div className="grid gap-4 xl:grid-cols-[minmax(300px,.5fr)_minmax(560px,1.5fr)]"><div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><b className="text-sm">\u0639\u062f\u062f \u0627\u0644\u0623\u062d\u062f\u0627\u062b: {ar.format(total)}</b><div className="flex gap-1.5"><button onClick={prev} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black">\u0627\u0644\u0633\u0627\u0628\u0642</button><button onClick={() => setPlaying((value) => !value)} className="rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black">{playing ? '\u0625\u064a\u0642\u0627\u0641' : '\u062a\u0634\u063a\u064a\u0644'}</button><button onClick={next} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black">\u0627\u0644\u062a\u0627\u0644\u064a</button></div></div><div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">{data.events.length ? data.events.map((event, index) => <button key={event.id} onClick={() => { setPlaying(false); setActiveIndex(index); }} className={`block w-full rounded-2xl border p-3 text-right ${index === activeIndex ? 'border-[#F8C846]/70 bg-[#F8C846]/12' : 'border-white/10 bg-black/25'}`}><div className="mb-1 flex flex-wrap items-center gap-2"><b>{event.icon}</b><b className="text-[#F8C846]">{event.minuteLabel}</b><span className="text-xs">{event.type}</span></div><p className="line-clamp-2 text-sm font-bold leading-6 text-slate-200">{event.detail}</p></button>) : <p className="p-4 text-center text-slate-400">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b</p>}</div></div><div className="rounded-2xl border border-[#18E58F]/25 bg-[#0c3f2b] p-3"><div className="mb-2 flex justify-between text-xs font-black"><span>{data.awayTeam.name}</span><span>\u0645\u0644\u0639\u0628 \u0627\u0644\u0628\u062b \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a</span><span>{data.homeTeam.name}</span></div><div className="relative aspect-[16/9] min-h-[300px] overflow-hidden rounded-2xl border-2 border-white/35"><FieldLines />{data.events.map((event, index) => { const p = eventPoint(event, data, index); const selected = index === activeIndex; const home = event.teamId === data.homeTeam.id; return <button key={`${event.id}-dot`} className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-black shadow ${selected ? 'h-12 w-12 bg-[#F8C846] text-black ring-4 ring-[#F8C846]/30' : `h-7 w-7 ${p.exact ? 'bg-sky-300 text-black' : home ? 'bg-[#F8C846] text-black' : 'bg-[#18E58F] text-black'}`}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>{event.icon}</button>; })}{activePoint ? <span className="pointer-events-none absolute z-30 h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#F8C846]/25" style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }} /> : null}</div><div className="mt-3 rounded-2xl bg-black/45 p-3"><b className="text-xs text-[#F8C846]">{active ? `${active.minuteLabel} - ${active.type}` : '\u0627\u062e\u062a\u0631 \u062d\u062f\u062b\u0627'}</b><p className="mt-1 line-clamp-2 text-xs text-white">{active?.detail || ''}</p><p className="mt-1 text-[10px] text-slate-400">{activePoint?.note}</p></div></div></div></Section>;
}

function StatRow({ m }: { m: MatchStatMetric }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><b>{m.label}</b><p className="mt-1 text-sm text-slate-300">{fmt(m.home, m.suffix)} - {fmt(m.away, m.suffix)}</p></div>; }
function StatsPanel({ data }: { data: MatchPageData }) { return <Section id="stats" title="\u0627\u0644\u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a" icon={<BarChart3 size={22} />}><div className="grid gap-3 lg:grid-cols-2">{data.stats.map((m) => <StatRow key={m.key} m={m} />)}</div></Section>; }

function formationRows(formation: string | null | undefined, count: number) { const raw = String(formation || '').match(/\d+/g)?.map(Number).filter(Boolean) || []; if (raw.length) return [1, ...raw]; if (count >= 11) return [1, 4, 3, 3]; if (count >= 7) return [1, 3, 2, count - 6]; return [Math.max(1, count)]; }
function makeSlots(players: AnyPlayer[], formation: string | null | undefined, side: 'home' | 'away'): Slot[] { const starters = players.slice(0, 11); const rows = formationRows(formation, starters.length); const slots: Slot[] = []; let cursor = 0; const maxLine = Math.max(1, rows.length - 1); rows.forEach((count, line) => { const actual = Math.max(1, Math.min(count, starters.length - cursor)); for (let i = 0; i < actual; i += 1) { const player = starters[cursor++]; if (!player) continue; const x = side === 'home' ? 94 - (line / maxLine) * 42 : 6 + (line / maxLine) * 42; const y = actual === 1 ? 50 : 16 + (68 * i) / (actual - 1); slots.push({ player, side, x, y }); } }); return slots; }
function PlayerDot({ slot }: { slot: Slot }) { const n = numberOf(slot.player); const c = captainOf(slot.player); return <div className="absolute z-20 flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center sm:w-20" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}><div className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 shadow-xl sm:h-12 sm:w-12 ${slot.side === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]'}`}>{slot.player.image ? <img src={slot.player.image} alt={slot.player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-xs font-black text-white">{initials(slot.player.name)}</span>}{n ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white">{n}</b> : null}{c ? <b className="absolute -left-1 -top-1 rounded-full bg-[#F8C846] px-1 text-[9px] text-black">C</b> : null}</div><span className="mt-1 line-clamp-2 rounded-lg bg-black/55 px-1.5 py-0.5 text-[9px] font-black leading-3 text-white">{slot.player.name}</span></div>; }
function SubCard({ player, locals }: { player: AnyPlayer; locals: MatchPlayerLite[] }) { const p = enriched(player, locals); const n = numberOf(p); return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2"><div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">{p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center text-[10px] text-white">{initials(p.name)}</span>}</div><p className="truncate text-xs font-black text-white">{n ? <span className="ml-1 text-[#F8C846]">{n}</span> : null}{p.name}</p></div>; }
function Subs({ title, players, locals }: { title: string; players: AnyPlayer[]; locals: MatchPlayerLite[] }) { return <aside className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3"><h4 className="mb-3 text-center text-sm font-black text-[#F8C846]">\u0628\u062f\u0644\u0627\u0621 {title}</h4><div className="grid max-h-[540px] gap-2 overflow-y-auto pr-1">{players.length ? players.map((p, i) => <SubCard key={`${title}-${p.name}-${i}`} player={p} locals={locals} />) : <p className="rounded-xl bg-white/[0.04] p-3 text-center text-xs font-bold text-slate-400">\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631</p>}</div></aside>; }
function LineupsPanel({ data }: { data: MatchPageData }) { const o = data.officialLineup; const homeFormation = o?.home?.formation || '4-3-3'; const awayFormation = o?.away?.formation || '4-3-3'; const homeStarters = (o?.home?.startingXi?.length ? o.home.startingXi : data.homePlayers.slice(0, 11)).map((p) => enriched(p, data.homePlayers)); const awayStarters = (o?.away?.startingXi?.length ? o.away.startingXi : data.awayPlayers.slice(0, 11)).map((p) => enriched(p, data.awayPlayers)); const homeSubs = (o?.home?.substitutes?.length ? o.home.substitutes : data.homePlayers.slice(11)).map((p) => enriched(p, data.homePlayers)); const awaySubs = (o?.away?.substitutes?.length ? o.away.substitutes : data.awayPlayers.slice(11)).map((p) => enriched(p, data.awayPlayers)); const slots = [...makeSlots(awayStarters, awayFormation, 'away'), ...makeSlots(homeStarters, homeFormation, 'home')]; return <Section id="lineups" title="\u0627\u0644\u062a\u0634\u0643\u064a\u0644 \u0627\u0644\u0631\u0633\u0645\u064a" icon={<Users size={22} />}><div className="rounded-[1.6rem] border border-[#18E58F]/25 bg-[#0b3b28] p-3"><div className="mb-3 flex justify-between text-xs font-black"><span>{data.awayTeam.name} - {awayFormation}</span><span>\u0627\u0644\u062a\u0634\u0643\u064a\u0644 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0639\u0628</span><span>{data.homeTeam.name} - {homeFormation}</span></div><div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_180px]"><Subs title={data.awayTeam.name} players={awaySubs} locals={data.awayPlayers} /><div className="relative h-[620px] overflow-hidden rounded-[1.35rem] border-2 border-white/35 bg-[linear-gradient(90deg,rgba(255,255,255,.05)_0_50%,rgba(255,255,255,.08)_50%_100%)] sm:h-[680px] lg:h-[560px]"><FieldLines />{slots.length ? slots.map((slot, i) => <PlayerDot key={`${slot.side}-${slot.player.name}-${i}`} slot={slot} />) : <p className="absolute inset-0 grid place-items-center text-slate-300">\u0627\u0644\u062a\u0634\u0643\u064a\u0644 \u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631</p>}</div><Subs title={data.homeTeam.name} players={homeSubs} locals={data.homePlayers} /></div><p className="mt-3 text-center text-xs font-bold text-slate-300">\u0627\u0644\u0635\u0648\u0631 \u0645\u0646 \u0627\u0644\u062a\u0634\u0643\u064a\u0644 \u0627\u0644\u0631\u0633\u0645\u064a \u0623\u0648 \u0645\u0646 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0644\u0627\u0639\u0628\u064a\u0646 \u0627\u0644\u0645\u062d\u0644\u064a\u0629.</p></div></Section>; }

function StandingsPanel({ data }: { data: MatchPageData }) { return <Section id="standings" title="\u0627\u0644\u062a\u0631\u062a\u064a\u0628" icon={<Trophy size={22} />}><div className="grid gap-3 md:grid-cols-2">{data.groupStandings.map((r: StandingRow) => <div key={r.teamId} className="rounded-2xl bg-black/25 p-3"><b>{r.rank}. {r.teamName}</b><p className="text-sm text-slate-300">{r.points} pts - GD {gd(r.goalDifference)}</p></div>)}</div></Section>; }
function AnalysisPanel({ data }: { data: MatchPageData }) { return <Section id="analysis" title="\u0627\u0644\u062a\u062d\u0644\u064a\u0644" icon={<FileText size={22} />}><p className="text-slate-300">{data.relatedArticles.length ? data.relatedArticles[0].summary : data.title}</p></Section>; }

export default function ProfessionalMatchPageClientV2({ data }: { data: MatchPageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const pageTitle = useMemo(() => `${data.homeTeam.name} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${data.awayTeam.name}`, [data]);
  function selectTab(id: TabId) { setActiveTab(id); const el = typeof document !== 'undefined' ? document.getElementById(id) : null; if (!el) return; window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 145), behavior: 'smooth' }); }
  return <main className="min-h-screen bg-[#04110D] px-2 pb-20 pt-3 text-white sm:px-4 sm:pt-4" dir="rtl"><MatchAutoRefresh intervalMs={data.status.kind === 'live' ? 25000 : 90000} /><div className="mx-auto max-w-7xl space-y-4 sm:space-y-5"><Hero data={data} onRefresh={() => router.refresh()} /><StickyTabs active={activeTab} onSelect={selectTab} /><EventsPanel data={data} /><StatsPanel data={data} /><LineupsPanel data={data} /><StandingsPanel data={data} /><AnalysisPanel data={data} /><span className="sr-only">{pageTitle}</span></div></main>;
}
