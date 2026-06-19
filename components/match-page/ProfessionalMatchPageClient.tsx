'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, CalendarDays, Clock, FileText, Flag, Radio, RefreshCw, Share2, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchStatMetric, OfficialLineupPlayer, OfficialLineupTeam, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');
const tabs = [
  ['overview', 'نظرة عامة', Sparkles],
  ['events', 'الأحداث', Radio],
  ['stats', 'الإحصائيات', BarChart3],
  ['lineups', 'التشكيل', Users],
  ['standings', 'الترتيب', Trophy],
  ['analysis', 'التحليل', FileText],
] as const;

const statusClasses = {
  scheduled: 'border-white/15 bg-white/10 text-white',
  live: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_32px_rgba(24,229,143,.18)]',
  halftime: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  finished: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
  delayed: 'border-rose-300/35 bg-rose-400/10 text-rose-100',
};

type TabId = (typeof tabs)[number][0];
type VoteTotals = { home: number; draw: number; away: number; total: number };

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return 'غير متوفر';
  return `${Number.isInteger(value) ? ar.format(value) : value.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}
function shortDate(value: string) { return new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function fullDate(value: string) { return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value)); }
function pct(home: number | null, away: number | null) { const h = Math.max(0, Number(home || 0)); const a = Math.max(0, Number(away || 0)); const total = h + a; if (!total) return { home: 50, away: 50 }; const width = Math.max(6, Math.min(94, (h / total) * 100)); return { home: width, away: 100 - width }; }

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>;
}

function Section({ id, title, icon, hint, children }: { id: TabId; title: string; icon: ReactNode; hint?: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-28 rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F] sm:h-11 sm:w-11">{icon}</span><div className="min-w-0"><h2 className="truncate text-lg font-black text-white sm:text-2xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div></div>{children}</section>;
}

function FlagImg({ team, small = false }: { team: MatchPageData['homeTeam']; small?: boolean }) {
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-5 w-7 rounded' : 'h-14 w-16 rounded-2xl sm:h-24 sm:w-28'}`}>{team.image ? <img src={team.image} alt={`علم ${team.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || team.name.slice(0, 3)}</b>}</span>;
}

function TeamSide({ team }: { team: MatchPageData['homeTeam'] }) {
  return <div className="flex min-w-0 flex-col items-center gap-2 sm:gap-3"><FlagImg team={team} /><div className="min-w-0 text-center"><p className="truncate text-base font-black text-white sm:text-3xl">{team.name}</p><div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[10px] font-bold text-slate-400 sm:text-xs">{team.code ? <span>{team.code}</span> : null}{team.fifaRank ? <span>تصنيف {ar.format(team.fifaRank)}</span> : null}</div></div></div>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex items-center gap-2 text-[#18E58F]">{icon}<span className="text-xs font-black">{label}</span></div><p className="text-sm font-bold leading-6 text-white">{value}</p></div>;
}

function Hero({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) {
  return <header className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#04110D] p-3 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:rounded-[2rem] sm:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(24,229,143,.20),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(248,200,70,.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_42%)]" /><div className="relative"><div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-black sm:text-xs"><span className={`rounded-full border px-3 py-1.5 sm:px-4 sm:py-2 ${statusClasses[data.status.kind]}`}>{data.status.label}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-slate-300 sm:px-4 sm:py-2">{data.groupLabel || data.stageLabel}</span></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5" dir="rtl"><TeamSide team={data.homeTeam} /><div className="space-y-2"><div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 shadow-inner sm:gap-5 sm:px-7 sm:py-3"><span className="text-3xl font-black text-[#F8C846] tabular-nums sm:text-7xl">{fmt(data.score.home)}</span><span className="text-2xl font-black text-white/70 sm:text-6xl">-</span><span className="text-3xl font-black text-white tabular-nums sm:text-7xl">{fmt(data.score.away)}</span></div><p className="hidden text-xs font-bold text-slate-400 sm:block">مصدر النتيجة: {data.score.source}</p></div><TeamSide team={data.awayTeam} /></div><div className="mt-5 grid gap-2 text-right sm:grid-cols-3"><Info icon={<CalendarDays size={17} />} label="الموعد" value={fullDate(data.matchDate)} /><Info icon={<Flag size={17} />} label="الملعب" value={data.venue || 'غير متوفر في المصادر'} /><Info icon={<Clock size={17} />} label="آخر تحديث" value={shortDate(data.lastUpdatedAt)} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center"><button onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black sm:text-sm"><RefreshCw size={16} /> تحديث</button><button onClick={onShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white sm:text-sm"><Share2 size={16} /> مشاركة</button>{data.digest?.href ? <Link href={data.digest.href} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/12 px-3 py-2 text-xs font-black text-[#F8C846] sm:col-span-1 sm:text-sm"><FileText size={16} /> تقرير المباراة</Link> : null}</div></div></header>;
}

function StickyTabs({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  return <nav className="sticky top-0 z-20 -mx-2 border-y border-white/10 bg-[#04110D]/95 px-2 py-2 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-3"><div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">{tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => onSelect(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition sm:text-xs ${active === id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Icon size={15} />{label}</button>)}</div></nav>;
}

function PredictionWidget({ data }: { data: MatchPageData }) {
  const [vote, setVote] = useState<string | null>(null);
  const [totals, setTotals] = useState<VoteTotals>({ home: 0, draw: 0, away: 0, total: 0 });
  const opts = [{ id: 'home', label: data.homeTeam.name }, { id: 'draw', label: 'تعادل' }, { id: 'away', label: data.awayTeam.name }] as const;
  useEffect(() => { let cancelled = false; fetch(data.voteEndpoint, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((body) => { if (!cancelled && body?.ok) { setVote(body.myVote || null); setTotals(body.totals || totals); } }).catch(() => undefined); return () => { cancelled = true; }; }, [data.voteEndpoint]);
  async function choose(id: string) { setVote(id); const res = await fetch(data.voteEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choice: id }) }).catch(() => null); const body = res?.ok ? await res.json().catch(() => null) : null; if (body?.ok) setTotals(body.totals); }
  return <div className="rounded-2xl border border-[#F8C846]/20 bg-[#F8C846]/10 p-4"><h3 className="mb-3 text-lg font-black text-[#F8C846]">توقع الجمهور</h3><div className="grid gap-2 sm:grid-cols-3">{opts.map((o) => { const value = totals[o.id] || 0; const percent = totals.total ? Math.round((value / totals.total) * 100) : 0; return <button key={o.id} onClick={() => choose(o.id)} className={`rounded-xl border px-3 py-3 text-sm font-black ${vote === o.id ? 'border-[#18E58F] bg-[#18E58F] text-black' : 'border-white/10 bg-black/25 text-white'}`}><span className="block truncate">{o.label}</span><span className="mt-1 block text-[11px] opacity-75">{ar.format(percent)}%</span></button>; })}</div><p className="mt-3 text-xs font-bold text-slate-400">إجمالي الأصوات: {ar.format(totals.total)}</p></div>;
}

function Overview({ data }: { data: MatchPageData }) {
  return <Section id="overview" title="نظرة عامة" icon={<Sparkles size={22} />} hint="ملخص سريع قبل وأثناء وبعد المباراة"><div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="mb-3 text-lg font-black text-white">مفاتيح المباراة</h3><ul className="space-y-2">{data.tacticalKeys.map((item) => <li key={item} className="flex gap-2 rounded-xl bg-white/[0.04] p-3 text-sm font-bold leading-7 text-slate-200"><Shield className="mt-1 shrink-0 text-[#18E58F]" size={16} />{item}</li>)}</ul></div>{data.digest?.summary ? <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-4"><h3 className="mb-2 text-lg font-black text-sky-100">ملخص التقرير</h3><p className="text-sm font-bold leading-8 text-slate-200">{data.digest.summary}</p></div> : null}</div><PredictionWidget data={data} /></div></Section>;
}

function EventsPanel({ events }: { events: MatchEventView[] }) {
  return <Section id="events" title="الأحداث المباشرة" icon={<Radio size={22} />} hint="TheStatsAPI و iSport يعملان تلقائيًا أثناء وبعد المباراة"><div className="relative space-y-3 before:absolute before:right-[22px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-[#18E58F]/30">{events.length ? events.map((event) => <article key={event.id} className="relative pr-12"><div className="absolute right-0 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-[#18E58F]/30 bg-[#18E58F]/12 text-sm font-black"><span>{event.icon}</span></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><b className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">{event.minuteLabel}</b><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-xs font-black text-[#F8C846]">{event.type}</span>{event.playerName ? <span className="text-sm font-black text-white">{event.playerName}</span> : null}</div><p className="text-sm font-bold leading-7 text-slate-200">{event.detail}</p></div></article>) : <Empty title="لا توجد أحداث بعد" body="الأحداث ستظهر تلقائيًا فور وصولها من مزودي البيانات أثناء البث المباشر." />}</div></Section>;
}

function StatRow({ metric, homeName, awayName }: { metric: MatchStatMetric; homeName: string; awayName: string }) {
  const width = pct(metric.home, metric.away);
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 grid grid-cols-[58px_1fr_58px] items-center gap-2 sm:grid-cols-[64px_1fr_64px]"><b className="text-center text-base text-white tabular-nums sm:text-lg">{fmt(metric.home, metric.suffix)}</b><div className="text-center"><p className="text-sm font-black text-white">{metric.label}</p><p className="text-[10px] font-bold text-slate-500">{metric.source}</p></div><b className="text-center text-base text-white tabular-nums sm:text-lg">{fmt(metric.away, metric.suffix)}</b></div><div className="grid grid-cols-2 overflow-hidden rounded-full bg-white/10"><div title={homeName} className="h-2.5 bg-[#18E58F]" style={{ width: `${width.home * 2}%`, maxWidth: '100%' }} /><div title={awayName} className="h-2.5 justify-self-end bg-[#F8C846]" style={{ width: `${width.away * 2}%`, maxWidth: '100%' }} /></div></div>;
}

function StatsPanel({ data }: { data: MatchPageData }) {
  const count = data.stats.filter((m) => m.available).length;
  return <Section id="stats" title="إحصائيات المباراة" icon={<BarChart3 size={22} />} hint={`${ar.format(count)} من ${ar.format(data.stats.length)} مؤشر متوفر`}><div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-xs font-black text-slate-300"><span>{data.homeTeam.name}</span><span>المؤشر</span><span>{data.awayTeam.name}</span></div><div className="grid gap-3 lg:grid-cols-2">{data.stats.map((metric) => <StatRow key={metric.key} metric={metric} homeName={data.homeTeam.name} awayName={data.awayTeam.name} />)}</div></Section>;
}

function PlayerPill({ player }: { player: OfficialLineupPlayer | MatchPlayerLite }) {
  const number = 'number' in player ? player.number : null;
  return <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2"><span className="min-w-0 truncate text-sm font-bold text-white">{number ? <b className="ml-2 text-[#F8C846]">{number}</b> : null}{player.name}</span><span className="shrink-0 text-xs font-bold text-slate-500">{player.position || 'غير محدد'}</span></div>;
}

function OfficialLineupColumn({ title, team }: { title: string; team: OfficialLineupTeam | null }) {
  if (!team) return <Empty title="التشكيل لم يصل بعد" body="سيظهر تلقائيًا هنا عند وصوله من TheStatsAPI أو iSport Lineups." />;
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-lg font-black text-white">{team.teamName || title}</h3>{team.formation ? <span className="rounded-full bg-[#18E58F]/15 px-2 py-1 text-xs font-black text-[#18E58F]">{team.formation}</span> : null}</div><div className="space-y-3"><div><p className="mb-2 text-xs font-black text-[#F8C846]">الأساسي</p><div className="grid gap-2">{team.startingXi.map((p, i) => <PlayerPill key={`${p.name}-${i}`} player={p} />)}</div></div>{team.substitutes.length ? <div><p className="mb-2 text-xs font-black text-slate-400">البدلاء</p><div className="grid gap-2">{team.substitutes.map((p, i) => <PlayerPill key={`${p.name}-sub-${i}`} player={p} />)}</div></div> : null}</div></div>;
}

function FallbackPlayersColumn({ title, team, players }: { title: string; team: MatchPageData['homeTeam']; players: MatchPlayerLite[] }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex items-center gap-2"><FlagImg team={team} small /><h3 className="text-lg font-black text-white">{title}</h3></div>{players.length ? <div className="grid gap-2">{players.map((p) => <PlayerPill key={p.id} player={p} />)}</div> : <Empty title="التشكيل الرسمي غير متوفر الآن" body="سيتم جلبه تلقائيًا بمجرد ظهوره في مزودي البيانات، بدون تدخل يدوي." />}</div>;
}

function LineupsPanel({ data }: { data: MatchPageData }) {
  const official = data.officialLineup;
  return <Section id="lineups" title="التشكيل والقوائم" icon={<Users size={22} />} hint={official ? `تشكيل رسمي من ${official.source}` : 'يتم تحديث التشكيل تلقائيًا عند توفره'}>{official ? <div className="grid gap-4 lg:grid-cols-2"><OfficialLineupColumn title={data.homeTeam.name} team={official.home} /><OfficialLineupColumn title={data.awayTeam.name} team={official.away} /></div> : <div className="grid gap-4 lg:grid-cols-2"><FallbackPlayersColumn title={data.homeTeam.name} team={data.homeTeam} players={data.homePlayers} /><FallbackPlayersColumn title={data.awayTeam.name} team={data.awayTeam} players={data.awayPlayers} /></div>}</Section>;
}

function StandingsTable({ rows, compact = false }: { rows: StandingRow[]; compact?: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-separate border-spacing-y-2 text-right text-sm"><thead><tr className="text-xs text-slate-500"><th className="px-3">#</th><th className="px-3">المنتخب</th><th className="px-3">لعب</th><th className="px-3">ف</th><th className="px-3">ت</th><th className="px-3">خ</th><th className="px-3">له</th><th className="px-3">عليه</th><th className="px-3">فارق</th><th className="px-3">نقاط</th>{compact ? <th className="px-3">الحالة</th> : null}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.teamId}-${row.rank}`} className="bg-black/25 text-white"><td className="rounded-r-xl px-3 py-3 font-black text-[#F8C846]">{ar.format(row.rank)}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-black">{row.image ? <img src={row.image} alt="" className="h-4 w-6 rounded object-cover" /> : null}{row.teamName}</span></td><td className="px-3">{ar.format(row.played)}</td><td className="px-3">{ar.format(row.won)}</td><td className="px-3">{ar.format(row.drawn)}</td><td className="px-3">{ar.format(row.lost)}</td><td className="px-3">{ar.format(row.goalsFor)}</td><td className="px-3">{ar.format(row.goalsAgainst)}</td><td className="px-3">{ar.format(row.goalDifference)}</td><td className="px-3 font-black text-[#18E58F]">{ar.format(row.points)}</td>{compact ? <td className="rounded-l-xl px-3"><span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.qualifies ? 'bg-[#18E58F] text-black' : 'bg-white/10 text-slate-300'}`}>{row.qualifies ? 'يتأهل' : 'ينتظر'}</span></td> : <td className="rounded-l-xl" />}</tr>)}</tbody></table>{rows.length ? null : <Empty title="الترتيب غير متوفر" body="سيظهر ترتيب المجموعة بعد توفر مباريات المجموعة ونتائجها." />}</div>;
}

function StandingsPanel({ data }: { data: MatchPageData }) {
  return <Section id="standings" title="الترتيب وتأثير النتيجة" icon={<Trophy size={22} />} hint="يحسب من نتائج المجموعة وأفضل الثوالث"><div className="grid gap-4 xl:grid-cols-[1fr_.9fr]"><div><h3 className="mb-3 text-lg font-black text-white">{data.groupLabel || 'ترتيب المجموعة'}</h3><StandingsTable rows={data.groupStandings} /></div><div className="space-y-4"><div className="rounded-2xl border border-[#18E58F]/20 bg-[#18E58F]/10 p-4"><h3 className="mb-3 text-lg font-black text-[#18E58F]">تأثير النتيجة</h3><ul className="space-y-2">{data.matchImpact.map((item) => <li key={item} className="rounded-xl bg-black/25 p-3 text-sm font-bold leading-7 text-slate-200">{item}</li>)}</ul></div><div><h3 className="mb-3 text-lg font-black text-white">أفضل الثوالث</h3><StandingsTable rows={data.thirdPlaceTable.slice(0, 8)} compact /></div></div></div></Section>;
}

function AnalysisPanel({ data }: { data: MatchPageData }) {
  return <Section id="analysis" title="التحليل والمقالات" icon={<FileText size={22} />} hint="بعد المباراة تتحول الصفحة إلى تقرير وتحليل"><div className="grid gap-4 lg:grid-cols-2">{data.relatedArticles.length ? data.relatedArticles.map((a) => <Link key={a.id} href={a.href} className="rounded-2xl border border-white/10 bg-black/25 p-4"><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-[11px] font-black text-[#F8C846]">{a.label}</span><h3 className="mt-3 text-lg font-black text-white">{a.title}</h3><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{a.summary}</p></Link>) : <Empty title="لا توجد مقالات مرتبطة بعد" body="سيظهر التحليل تلقائيًا عند نشر تقرير المباراة." />}</div></Section>;
}

export default function ProfessionalMatchPageClient({ data }: { data: MatchPageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const lockRef = useRef<number | null>(null);
  const refreshMs = data.status.isLive ? 25000 : 90000;
  const pageTitle = useMemo(() => `${data.homeTeam.name} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${data.awayTeam.name}`, [data]);
  function refresh() { router.refresh(); }
  function selectTab(id: TabId) { setActiveTab(id); const target = document.getElementById(id); if (!target) return; if (lockRef.current) window.clearTimeout(lockRef.current); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); lockRef.current = window.setTimeout(() => { lockRef.current = null; }, 750); }
  useEffect(() => { const observer = new IntersectionObserver((entries) => { if (lockRef.current) return; const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (visible?.target?.id) setActiveTab(visible.target.id as TabId); }, { rootMargin: '-18% 0px -70% 0px', threshold: [0.1, 0.35, 0.6] }); tabs.forEach(([id]) => { const el = document.getElementById(id); if (el) observer.observe(el); }); return () => observer.disconnect(); }, []);
  async function share() { const text = `${pageTitle} — ${data.status.label}`; if (typeof window === 'undefined') return; const nav = window.navigator as Navigator & { share?: (shareData: ShareData) => Promise<void>; clipboard?: Clipboard }; if (typeof nav.share === 'function') { await nav.share({ title: data.title, text, url: window.location.href }).catch(() => undefined); return; } if (nav.clipboard) await nav.clipboard.writeText(`${text}\n${window.location.href}`).catch(() => undefined); }
  return <main className="min-h-screen bg-[#04110D] px-2 pb-20 pt-3 text-white sm:px-4 sm:pt-4" dir="rtl"><MatchAutoRefresh intervalMs={refreshMs} /><div className="mx-auto max-w-7xl space-y-4 sm:space-y-5"><Hero data={data} onRefresh={refresh} onShare={share} /><StickyTabs active={activeTab} onSelect={selectTab} /><Overview data={data} /><EventsPanel events={data.events} /><StatsPanel data={data} /><LineupsPanel data={data} /><StandingsPanel data={data} /><AnalysisPanel data={data} /></div></main>;
}
