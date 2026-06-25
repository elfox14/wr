'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarDays, FileText, Flag, Layers, List, MapPin, Radio, RefreshCw, Share2, Shield, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerStatItem, MatchStatMetric, OfficialLineupPlayer, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

type TabId = 'overview' | 'stats' | 'events' | 'lineups' | 'players' | 'interactive' | 'analysis' | 'group' | 'articles';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'overview', label: 'نظرة عامة', icon: Layers },
  { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
  { id: 'events', label: 'الأحداث', icon: Radio },
  { id: 'lineups', label: 'التشكيلات', icon: Users },
  { id: 'players', label: 'أداء اللاعبين', icon: Shield },
  { id: 'interactive', label: 'الملعب التفاعلي', icon: MapPin },
  { id: 'analysis', label: 'تحليل تكتيكي', icon: FileText },
  { id: 'group', label: 'المجموعة', icon: Trophy },
  { id: 'articles', label: 'المقالات', icon: List },
];

const statusClasses: Record<string, string> = {
  scheduled: 'border-white/15 bg-white/10 text-white',
  live: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  halftime: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  finished: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
  delayed: 'border-rose-300/35 bg-rose-400/10 text-rose-100',
};

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number.isInteger(value) ? ar.format(value) : Number(value).toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function gd(value: number) {
  return value > 0 ? `+${ar.format(value)}` : ar.format(value);
}

function percent(home: number | null, away: number | null) {
  const h = Math.max(0, Number(home || 0));
  const a = Math.max(0, Number(away || 0));
  const total = h + a;
  if (!total) return { home: 50, away: 50 };
  const homeWidth = Math.max(6, Math.min(94, (h / total) * 100));
  return { home: homeWidth, away: 100 - homeWidth };
}

function displayTeamName(team: { code?: string | null; name?: string | null }) {
  return getArabicTeamName(team.code, team.name);
}

function displayTeamFlagUrl(team: { code?: string | null; name?: string | null; image?: string | null }, width = 160) {
  return getTeamFlagUrl({ code: team.code, name: displayTeamName(team), image: team.image }, width) || team.image || null;
}

function FlagImg({ team, small = false }: { team: MatchPageData['homeTeam']; small?: boolean }) {
  const image = displayTeamFlagUrl(team, small ? 80 : 160);
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-5 w-7 rounded' : 'h-14 w-16 rounded-2xl sm:h-20 sm:w-24'}`}>{image ? <img src={image} alt={`علم ${displayTeamName(team)}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || displayTeamName(team).slice(0, 3)}</b>}</span>;
}

function TeamSide({ team }: { team: MatchPageData['homeTeam'] }) {
  return <div className="flex min-w-0 flex-col items-center gap-2"><FlagImg team={team} /><div className="min-w-0 text-center"><p className="team-name-full text-base font-black text-white sm:text-2xl">{displayTeamName(team)}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{team.code || '—'}{team.fifaRank ? ` · تصنيف ${ar.format(team.fifaRank)}` : ''}</p></div></div>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex items-center gap-2 text-[#18E58F]"><span>{icon}</span><span className="text-[11px] font-black">{label}</span></div><p className="text-sm font-bold leading-6 text-white">{value || '—'}</p></div>;
}

function Hero({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) {
  return <header className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#04110D] p-3 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:rounded-[2rem] sm:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(24,229,143,.18),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(248,200,70,.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_42%)]" /><div className="relative"><div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-black"><span className={`rounded-full border px-3 py-1.5 ${statusClasses[data.status.kind] || statusClasses.finished}`}>{data.status.label}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-slate-300">{data.competition}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-slate-300">{data.groupLabel || data.stageLabel}</span></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5" dir="rtl"><TeamSide team={data.homeTeam} /><div className="space-y-2"><div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 shadow-inner sm:gap-5 sm:px-7 sm:py-3"><span className="text-3xl font-black text-[#F8C846] tabular-nums sm:text-6xl">{fmt(data.score.home)}</span><span className="text-2xl font-black text-white/70 sm:text-5xl">-</span><span className="text-3xl font-black text-white tabular-nums sm:text-6xl">{fmt(data.score.away)}</span></div><p className="text-xs font-bold text-slate-400">{data.status.isScheduled ? `موعد المباراة: ${fullDate(data.matchDate)}` : data.status.isFinished ? 'نهاية المباراة' : data.status.shortLabel}</p></div><TeamSide team={data.awayTeam} /></div><div className="mt-5 grid grid-cols-2 gap-2 text-right lg:grid-cols-4"><Info icon={<CalendarDays size={15} />} label="الموعد" value={fullDate(data.matchDate)} /><Info icon={<MapPin size={15} />} label="الملعب" value={data.venue} /><Info icon={<Flag size={15} />} label="الحكم" value={data.referee} /><Info icon={<Trophy size={15} />} label="الدور" value={data.groupLabel || data.stageLabel} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center"><button onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black sm:text-sm"><RefreshCw size={16} /> تحديث</button><button onClick={onShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white sm:text-sm"><Share2 size={16} /> مشاركة</button>{data.digest?.href ? <Link href={data.digest.href} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/12 px-3 py-2 text-xs font-black text-[#F8C846] sm:col-span-1 sm:text-sm"><FileText size={16} /> تقرير المباراة</Link> : null}</div></div></header>;
}

function TabsNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return <nav className="sticky top-0 z-30 rounded-2xl border border-white/10 bg-[#04110D]/95 p-2 shadow-xl backdrop-blur"><div className="flex gap-2 overflow-x-auto pb-1">{TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${active === tab.id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]'}`}><Icon size={15} />{tab.label}</button>; })}</div></nav>;
}

function Panel({ title, icon, children, hint }: { title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F] sm:h-11 sm:w-11">{icon}</span><div className="min-w-0"><h2 className="team-name-full text-lg font-black text-white sm:text-2xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div></div>{children}</section>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>;
}

function StatCard({ metric, data }: { metric: MatchStatMetric; data: MatchPageData }) {
  const p = percent(metric.home, metric.away);
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="grid grid-cols-[70px_1fr_70px] items-center gap-3 text-center"><b className="text-base font-black text-[#F8C846] tabular-nums">{fmt(metric.home, metric.suffix)}</b><div><p className="text-xs font-black text-white sm:text-sm">{metric.label}</p></div><b className="text-base font-black text-[#18E58F] tabular-nums">{fmt(metric.away, metric.suffix)}</b></div>{metric.available ? <div className="mt-3 flex items-center gap-2" dir="ltr"><div className="flex h-2 flex-1 justify-end overflow-hidden rounded-full bg-white/10"><span className="h-full rounded-full bg-[#18E58F]" style={{ width: `${p.away}%` }} /></div><div className="flex h-2 flex-1 justify-start overflow-hidden rounded-full bg-white/10"><span className="h-full rounded-full bg-[#F8C846]" style={{ width: `${p.home}%` }} /></div></div> : null}<div className="mt-2 grid grid-cols-2 text-[10px] font-bold text-slate-500"><span>{displayTeamName(data.homeTeam)}</span><span className="text-left">{displayTeamName(data.awayTeam)}</span></div></article>;
}

function OverviewPanel({ data }: { data: MatchPageData }) {
  const quickStats = data.stats.filter((m) => ['possession', 'shots', 'shotsOnTarget', 'corners'].includes(m.key)).slice(0, 4);
  return <Panel title="نظرة عامة" icon={<Layers size={22} />} hint="ملخص سريع للمباراة وروابط العمل المهمة"><div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{quickStats.length ? quickStats.map((metric) => <StatCard key={metric.key} metric={metric} data={data} />) : <Empty title="لا توجد إحصائيات أساسية" body="ستظهر هنا بعد حفظ إحصائيات المباراة في قاعدة البيانات." />}</div>{data.digest?.summary ? <div className="rounded-2xl border border-[#F8C846]/20 bg-[#F8C846]/10 p-4"><h3 className="mb-2 text-lg font-black text-[#F8C846]">ملخص التقرير</h3><p className="text-sm font-bold leading-8 text-white">{data.digest.summary}</p></div> : null}</div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">روابط المباراة</h3><div className="grid gap-2"><Link href={`/live-animation/${data.id}`} className="rounded-xl border border-sky-300/30 bg-sky-300/10 px-4 py-3 text-center text-sm font-black text-sky-100">فتح الملعب التفاعلي</Link><Link href={`/watch/${data.id}`} className="rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-4 py-3 text-center text-sm font-black text-[#F8C846]">مشاهدة البث</Link>{data.digest?.href ? <Link href={data.digest.href} className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white">قراءة تقرير المباراة</Link> : null}</div></div></div></Panel>;
}

function StatsPanel({ data }: { data: MatchPageData }) {
  return <Panel title="إحصائيات المباراة" icon={<BarChart3 size={22} />} hint="مقارنة مباشرة بين المنتخبين من البيانات المحفوظة"><div className="grid gap-3 lg:grid-cols-2">{data.stats.length ? data.stats.map((metric) => <StatCard key={metric.key} metric={metric} data={data} />) : <Empty title="لا توجد إحصائيات محفوظة" body="استخدم استيراد الإحصائيات الأساسية للمباريات السابقة ثم أعد فتح الصفحة." />}</div></Panel>;
}

function EventsPanel({ data }: { data: MatchPageData }) {
  return <Panel title="أحداث المباراة" icon={<Radio size={22} />} hint="أهداف، بطاقات، تبديلات، وأهم اللقطات المحفوظة"><div className="space-y-3">{data.events.length ? data.events.map((event: MatchEventView) => <article key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-lg">{event.icon}</span><b className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">{event.minuteLabel || '—'}</b><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-xs font-black text-[#F8C846]">{event.type}</span>{event.playerName ? <span className="text-sm font-black text-white">{event.playerName}</span> : null}</div><p className="text-sm font-bold leading-7 text-slate-200">{event.detail || 'حدث محفوظ في قاعدة البيانات.'}</p></article>) : <Empty title="لا توجد أحداث محفوظة" body="ستظهر الأحداث بعد مزامنة Timeline أو Live Events." />}</div></Panel>;
}

function LineupList({ title, players }: { title: string; players: OfficialLineupPlayer[] }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><h3 className="mb-3 text-lg font-black text-white">{title}</h3><div className="grid gap-2">{players.length ? players.map((player, index) => <div key={`${player.id || player.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{player.name}{player.isCaptain ? ' ©' : ''}</b><span className="text-[11px] font-bold text-slate-500">{player.position || '—'}</span></div>{player.number ? <span className="rounded-full bg-black/35 px-2 py-1 text-xs font-black text-slate-200">#{player.number}</span> : null}</div>) : <Empty title="غير متوفر" body="لم يصل التشكيل بعد." />}</div></div>;
}

function LineupsPanel({ data }: { data: MatchPageData }) {
  const home = data.officialLineup?.home;
  const away = data.officialLineup?.away;
  return <Panel title="التشكيلات" icon={<Users size={22} />} hint="الأساسيون والبدلاء عند توفر التشكيل"><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><div className="rounded-xl bg-[#F8C846]/10 px-3 py-2 text-sm font-black text-[#F8C846]">{displayTeamName(data.homeTeam)} {home?.formation ? `· ${home.formation}` : ''}</div><LineupList title="الأساسيون" players={home?.startingXi || []} /><LineupList title="البدلاء" players={home?.substitutes || []} /></div><div className="space-y-3"><div className="rounded-xl bg-[#18E58F]/10 px-3 py-2 text-sm font-black text-[#18E58F]">{displayTeamName(data.awayTeam)} {away?.formation ? `· ${away.formation}` : ''}</div><LineupList title="الأساسيون" players={away?.startingXi || []} /><LineupList title="البدلاء" players={away?.substitutes || []} /></div></div></Panel>;
}

function PlayerRow({ player }: { player: MatchPlayerStatItem }) {
  return <article className="grid min-w-[760px] grid-cols-[minmax(220px,1.6fr)_repeat(7,70px)] items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.045] p-2 text-center"><div className="min-w-0 text-right"><b className="block truncate text-sm text-white">{player.playerName || 'لاعب'}</b><span className="text-[11px] font-bold text-slate-500">{player.teamName || '—'} · {player.position || '—'}</span></div><span>{fmt(player.rating)}</span><span>{fmt(player.minutes)}</span><span>{fmt(player.goals)}</span><span>{fmt(player.assists)}</span><span>{fmt(player.shots)}</span><span>{fmt(player.passes)}</span><span>{fmt(player.saves)}</span></article>;
}

function PlayersPanel({ data }: { data: MatchPageData }) {
  const players = data.advanced.playerStats || [];
  return <Panel title="أداء اللاعبين" icon={<Shield size={22} />} hint="يظهر عند توفر إحصائيات اللاعبين بعد المباراة"><div className="overflow-x-auto"><div className="space-y-2">{players.length ? players.map((player, index) => <PlayerRow key={`${player.playerId || player.playerName}-${index}`} player={player} />) : <Empty title="إحصائيات اللاعبين غير متوفرة" body="سنضيفها لاحقًا للمباريات المهمة بعد ملء الإحصائيات الأساسية." />}</div></div></Panel>;
}

function InteractivePanel({ data }: { data: MatchPageData }) {
  return <Panel title="الملعب التفاعلي" icon={<MapPin size={22} />} hint="لا يتم تحميل الملعب داخل صفحة المباراة لتقليل الضغط"><div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-5 text-center"><p className="text-lg font-black text-white">افتح عرض الملعب التفاعلي في صفحة مستقلة</p><p className="mt-2 text-sm font-bold leading-7 text-slate-300">هذا يحافظ على سرعة صفحة المباراة ويجعل العرض التفاعلي مستقلًا.</p><Link href={`/live-animation/${data.id}`} className="mt-4 inline-flex rounded-xl bg-sky-300 px-5 py-3 text-sm font-black text-black">فتح الملعب التفاعلي</Link></div></Panel>;
}

function AnalysisPanel({ data }: { data: MatchPageData }) {
  return <Panel title="تحليل تكتيكي" icon={<FileText size={22} />} hint="نقاط محفوظة تصلح كبداية لكتابة المقال"><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">مفاتيح المباراة</h3><div className="space-y-2">{data.tacticalKeys.length ? data.tacticalKeys.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>) : <p className="text-sm font-bold text-slate-400">أضف ملاحظات تكتيكية محفوظة لهذه المباراة.</p>}</div></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">تأثير المباراة</h3><div className="space-y-2">{data.matchImpact.length ? data.matchImpact.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>) : <p className="text-sm font-bold text-slate-400">سيظهر التأثير بعد اكتمال بيانات المجموعة.</p>}</div></div></div></Panel>;
}

function StandingCard({ row }: { row: StandingRow }) {
  const name = getArabicTeamName(row.code, row.teamName);
  const image = getTeamFlagUrl({ code: row.code, name, image: row.image }, 80) || row.image || null;
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F8C846]/25 bg-[#F8C846]/10 text-sm font-black text-[#F8C846]">{ar.format(row.rank)}</span>{image ? <img src={image} alt={`علم ${name}`} className="h-8 w-11 shrink-0 rounded-lg border border-white/10 object-cover" loading="lazy" /> : null}<div className="min-w-0"><p className="team-name-full text-sm font-black text-white">{name}</p><p className="text-[10px] font-bold text-slate-500">{row.code || '—'}</p></div></div><b className="text-xl font-black text-[#18E58F]">{ar.format(row.points)}</b></div><div className="grid grid-cols-4 gap-2 text-center text-xs"><span>لعب {ar.format(row.played)}</span><span>فاز {ar.format(row.won)}</span><span>فارق {gd(row.goalDifference)}</span><span>له {ar.format(row.goalsFor)}</span></div></article>;
}

function GroupPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المجموعة" icon={<Trophy size={22} />} hint="ترتيب المجموعة وموقف التأهل"><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><h3 className="text-lg font-black text-white">ترتيب المجموعة</h3>{data.groupStandings.length ? data.groupStandings.map((row) => <StandingCard key={`${row.teamId}-${row.rank}`} row={row} />) : <Empty title="الترتيب غير متوفر" body="سيظهر بعد حفظ مباريات المجموعة." />}</div><div className="space-y-2"><h3 className="text-lg font-black text-white">أفضل الثوالث</h3>{data.thirdPlaceTable.length ? data.thirdPlaceTable.slice(0, 8).map((row) => <StandingCard key={`${row.teamId}-${row.rank}-third`} row={row} />) : <Empty title="غير متوفر" body="سيظهر لاحقًا عند توفر جدول الثوالث." />}</div></div></Panel>;
}

function ArticlesPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المقالات" icon={<List size={22} />} hint="روابط المقالات والتحليلات المرتبطة بالمباراة"><div className="grid gap-3">{data.digest?.href ? <Link href={data.digest.href} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4 text-right"><p className="font-black text-[#F8C846]">تقرير المباراة</p><p className="mt-2 text-sm font-bold leading-7 text-white">{data.digest.summary || data.digest.turningPoint || 'افتح تقرير المباراة الكامل.'}</p></Link> : null}{data.relatedArticles.length ? data.relatedArticles.map((article) => <Link key={article.id} href={article.href} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-right"><p className="text-xs font-black text-[#18E58F]">{article.label}</p><h3 className="mt-1 font-black text-white">{article.title}</h3><p className="mt-2 text-sm font-bold leading-7 text-slate-300">{article.summary}</p></Link>) : null}{!data.digest?.href && !data.relatedArticles.length ? <Empty title="لا توجد مقالات بعد" body="ابدأ بكتابة تقرير المباراة أو التحليل التكتيكي وسيظهر هنا." /> : null}</div></Panel>;
}

function ActivePanel({ active, data }: { active: TabId; data: MatchPageData }) {
  if (active === 'overview') return <OverviewPanel data={data} />;
  if (active === 'stats') return <StatsPanel data={data} />;
  if (active === 'events') return <EventsPanel data={data} />;
  if (active === 'lineups') return <LineupsPanel data={data} />;
  if (active === 'players') return <PlayersPanel data={data} />;
  if (active === 'interactive') return <InteractivePanel data={data} />;
  if (active === 'analysis') return <AnalysisPanel data={data} />;
  if (active === 'group') return <GroupPanel data={data} />;
  return <ArticlesPanel data={data} />;
}

export default function ProfessionalMatchTabsPage({ data }: { data: MatchPageData }) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const refreshMs = data.status.kind === 'live' ? 25000 : 120000;
  const pageTitle = useMemo(() => `${displayTeamName(data.homeTeam)} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${displayTeamName(data.awayTeam)}`, [data.homeTeam.name, data.homeTeam.code, data.awayTeam.name, data.awayTeam.code, data.score.home, data.score.away]);
  function refresh() { window.location.reload(); }
  async function share() {
    if (typeof window === 'undefined') return;
    const nav = window.navigator as Navigator & { share?: (shareData: ShareData) => Promise<void>; clipboard?: Clipboard };
    const text = `${pageTitle} — ${data.status.label}`;
    if (typeof nav.share === 'function') {
      await nav.share({ title: pageTitle, text, url: window.location.href }).catch(() => undefined);
      return;
    }
    if (nav.clipboard) await nav.clipboard.writeText(`${text}\n${window.location.href}`).catch(() => undefined);
  }

  return <main className="min-h-screen bg-[#04110D] px-2 pb-20 pt-3 text-white sm:px-4 sm:pt-4" dir="rtl"><MatchAutoRefresh intervalMs={refreshMs} /><div className="mx-auto max-w-7xl space-y-4 sm:space-y-5"><Hero data={data} onRefresh={refresh} onShare={share} /><TabsNav active={activeTab} onChange={setActiveTab} /><ActivePanel active={activeTab} data={data} /></div></main>;
}
