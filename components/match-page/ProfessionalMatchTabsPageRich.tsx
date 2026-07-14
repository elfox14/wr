'use client';

import { useMemo, useState } from 'react';
import type { HeatmapPoint, HeatmapSource } from '@/lib/match-page/types';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerStatItem, OfficialLineupPlayer } from '@/lib/match-page/types';

import TeamHeatmap from '@/components/match-center/visuals/TeamHeatmap';
import CompactStatCell from '@/components/match-center/visuals/CompactStatCell';
import PlayerHeatmapModal from '@/components/match-center/visuals/PlayerHeatmapModal';

type Tab = 'overview' | 'momentum' | 'events' | 'lineups' | 'history' | 'group' | 'articles';
const ar = new Intl.NumberFormat('ar-EG');
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'momentum', label: 'الزخم والخريطة' },
  { id: 'events', label: 'الأحداث' },
  { id: 'lineups', label: 'التشكيلات' },
  { id: 'history', label: 'التاريخ' },
  { id: 'group', label: 'المجموعة' },
  { id: 'articles', label: 'بعد المباراة' },
];

function f(v: any, s = '') { 
  if (v === null || v === undefined || v === '') return '—'; 
  const n = Number(v); 
  return Number.isFinite(n) ? `${Number.isInteger(n) ? ar.format(n) : n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${s}` : String(v); 
}
function tn(t: { code?: string | null; name?: string | null }) { return getArabicTeamName(t.code, t.name); }
function dt(v: string) { return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v)); }
function flag(t: MatchPageData['homeTeam'], width = 120) { return getTeamFlagUrl({ code: t.code, name: tn(t), image: t.image }, width) || t.image || null; }
function clean(v?: string | number | null) { return String(v || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function k(e: MatchEventView) { 
  const x = `${e.type} ${e.detail}`.toLowerCase(); 
  if (x.includes('goal') || x.includes('هدف')) return ['هدف', '⚽']; 
  if (x.includes('red') || x.includes('حمراء')) return ['بطاقة حمراء', '🟥']; 
  if (x.includes('yellow') || x.includes('صفراء')) return ['بطاقة صفراء', '🟨']; 
  if (x.includes('sub') || x.includes('تبديل')) return ['تبديل', '🔁']; 
  if (x.includes('pen')) return ['ركلة جزاء', '🎯']; 
  if (x.includes('var')) return ['مراجعة VAR', '📺']; 
  if (x.includes('foul')) return ['مخالفة', '🧱']; 
  if (x.includes('added')) return ['وقت بدل ضائع', '⏱️']; 
  if (x.includes('period')) return ['نهاية الشوط', '⌛']; 
  return ['حدث', e.icon || '●']; 
}
function side(e: MatchEventView, d: MatchPageData) { 
  if (e.teamId === d.homeTeam.id || e.teamId === d.homeTeam.code) return 'home'; 
  if (e.teamId === d.awayTeam.id || e.teamId === d.awayTeam.code) return 'away'; 
  return 'neutral'; 
}
function historyOf(d: MatchPageData) { 
  return d.history || { homeRecentForm: [], awayRecentForm: [], headToHead: [], homeWorldCupHistory: `تاريخ مشاركات ${tn(d.homeTeam)} في كأس العالم غير متوفر.`, awayWorldCupHistory: `تاريخ مشاركات ${tn(d.awayTeam)} في كأس العالم غير متوفر.` }; 
}

function Box({ title, children, hint }: { title?: string; children: React.ReactNode; hint?: string }) { 
  return (
    <section className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_48px_rgba(0,0,0,.18)]">
      {title && (
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">{title}</h2>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function TeamFlag({ team, small = false }: { team: MatchPageData['homeTeam']; small?: boolean }) { 
  const src = flag(team, small ? 64 : 140); 
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-7 w-9 rounded-lg' : 'h-14 w-16 rounded-2xl sm:h-20 sm:w-24'}`}>
      {src ? <img src={src} alt={tn(team)} className="h-full w-full object-cover" /> : <b className="text-xs text-[#F8C846]">{team.code || '—'}</b>}
    </span>
  ); 
}

function Avatar({ name, image, number }: { name?: string | null; image?: string | null; number?: any }) { 
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">
      {image ? <img src={image} alt={name || 'player'} className="h-full w-full object-cover" /> : <b className="text-xs text-[#F8C846]">{String(name || '؟').slice(0, 2)}</b>}
      {number && <i className="absolute bottom-0 left-0 rounded-full bg-[#F8C846] px-1 text-[9px] not-italic text-black">{number}</i>}
    </span>
  ); 
}

function Header({ d }: { d: MatchPageData }) { 
  return (
    <header className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-[#18E58F]/30 bg-[#18E58F]/10 px-3 py-1.5 text-xs font-black text-[#18E58F]">{d.status.shortLabel || d.status.label}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold text-slate-400">آخر تحديث: {dt(d.lastUpdatedAt)}</span>
          <a href={`/api/admin/matches/${d.id}/extras-snapshot`} target="_blank" className="rounded-full border border-[#F8C846]/30 bg-[#F8C846]/10 px-3 py-1.5 text-xs font-black text-[#F8C846] hover:bg-[#F8C846]/20 transition-colors">تحديث مباشر للبيانات</a>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">
        <div className="flex min-w-0 items-center gap-3 text-right">
          <TeamFlag team={d.homeTeam} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-white sm:text-2xl">{tn(d.homeTeam)}</h1>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{d.homeTeam.code || '—'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-center sm:px-6 sm:py-3">
          <div className="flex items-center justify-center gap-2 tabular-nums sm:gap-4">
            <b className="text-4xl font-black text-[#F8C846] sm:text-6xl">{f(d.score.home)}</b>
            <span className="text-2xl font-black text-white/60 sm:text-5xl">-</span>
            <b className="text-4xl font-black text-white sm:text-6xl">{f(d.score.away)}</b>
          </div>
          <p className="mt-1 text-[11px] font-bold text-slate-400">{d.groupLabel || d.stageLabel}</p>
        </div>
        <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-left">
          <TeamFlag team={d.awayTeam} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-white sm:text-2xl">{tn(d.awayTeam)}</h1>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{d.awayTeam.code || '—'}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-300 sm:grid-cols-3">
        <span><b className="text-[#18E58F]">الموعد:</b> {dt(d.matchDate)}</span>
        <span><b className="text-[#18E58F]">الملعب:</b> {d.venue || 'غير متوفر'}</span>
        <span><b className="text-[#18E58F]">الحكم:</b> {d.referee || 'غير متوفر'}</span>
      </div>
    </header>
  ); 
}

function playerSide(p: MatchPlayerStatItem, d: MatchPageData): 'home' | 'away' | null {
  if (p.teamId && (p.teamId === d.homeTeam.id || p.teamId === d.homeTeam.code)) return 'home';
  if (p.teamId && (p.teamId === d.awayTeam.id || p.teamId === d.awayTeam.code)) return 'away';
  const teamName = clean(p.teamName);
  if (teamName && (teamName === clean(d.homeTeam.name) || teamName === clean(d.homeTeam.code))) return 'home';
  if (teamName && (teamName === clean(d.awayTeam.name) || teamName === clean(d.awayTeam.code))) return 'away';

  const playerName = clean(p.playerName);
  if (!playerName) return null;
  if (d.officialLineup?.home?.startingXi.some((player) => clean(player.name) === playerName) || d.officialLineup?.home?.substitutes.some((player) => clean(player.name) === playerName)) return 'home';
  if (d.officialLineup?.away?.startingXi.some((player) => clean(player.name) === playerName) || d.officialLineup?.away?.substitutes.some((player) => clean(player.name) === playerName)) return 'away';
  return null;
}

function isHomePlayer(p: MatchPlayerStatItem, d: MatchPageData) {
  return playerSide(p, d) === 'home';
}

function isStarterPlayer(p: any, d: MatchPageData) {
  const pn = String(p.playerName || '').toLowerCase().trim();
  if (pn && d.officialLineup) {
     const homeStarting = d.officialLineup.home?.startingXi || [];
     const awayStarting = d.officialLineup.away?.startingXi || [];
     if (homeStarting.some(hp => String(hp.name).toLowerCase().trim() === pn)) return true;
     if (awayStarting.some(hp => String(hp.name).toLowerCase().trim() === pn)) return true;

     const homeSubs = d.officialLineup.home?.substitutes || [];
     const awaySubs = d.officialLineup.away?.substitutes || [];
     if (homeSubs.some(hp => String(hp.name).toLowerCase().trim() === pn)) return false;
     if (awaySubs.some(hp => String(hp.name).toLowerCase().trim() === pn)) return false;
  }
  return p.started === true;
}

function getTeamHeatmapPoints(isHome: boolean, d: MatchPageData) {
  return d.advanced.teamHeatmaps?.[isHome ? 'home' : 'away']?.points || [];
}

function officialPlayerStat(player: OfficialLineupPlayer, stats: MatchPlayerStatItem[], teamId: string, teamName: string, started: boolean): MatchPlayerStatItem {
  const stat = stats.find((row) =>
    (player.id && row.playerId === player.id) ||
    (player.name && clean(row.playerName) === clean(player.name))
  );
  return {
    ...(stat || {}),
    playerId: player.id || stat?.playerId || null,
    playerName: player.name || stat?.playerName || 'لاعب غير معروف',
    teamId,
    teamName,
    position: player.position || stat?.position || null,
    number: player.number ?? stat?.number ?? null,
    image: player.image || stat?.image || null,
    rating: player.rating ?? stat?.rating ?? null,
    isCaptain: player.isCaptain ?? stat?.isCaptain ?? false,
    started,
    played: started ? true : stat?.played ?? true,
  };
}

function formationLines(players: MatchPlayerStatItem[], formation?: string | null) {
  if (!players.length) return [];
  const goalkeeper = players.find((player) => /^(g|gk|goalkeeper)$/i.test(String(player.position || ''))) || players[0];
  const outfield = players.filter((player) => player !== goalkeeper);
  const shape = String(formation || '').match(/\d+/g)?.map(Number) || [];
  if (shape.length >= 2 && shape.reduce((sum, count) => sum + count, 0) === outfield.length) {
    const lines: MatchPlayerStatItem[][] = [[goalkeeper]];
    let cursor = 0;
    for (const count of shape) {
      lines.push(outfield.slice(cursor, cursor + count));
      cursor += count;
    }
    return lines.filter((line) => line.length > 0);
  }
  const gks: MatchPlayerStatItem[] = [], defs: MatchPlayerStatItem[] = [], mids: MatchPlayerStatItem[] = [], fwds: MatchPlayerStatItem[] = [], others: MatchPlayerStatItem[] = [];
  players.forEach((player) => {
    const position = String(player.position || '').toUpperCase();
    if (/^(G|GK)$/.test(position)) gks.push(player);
    else if (/^(D|CB|LB|RB|LWB|RWB)$/.test(position)) defs.push(player);
    else if (/^(M|DM|CM|AM|CDM|CAM|LM|RM)$/.test(position)) mids.push(player);
    else if (/^(F|FW|CF|ST|LW|RW)$/.test(position)) fwds.push(player);
    else others.push(player);
  });
  mids.push(...others);
  return [gks, defs, mids, fwds].filter((line) => line.length > 0);
}

function PostMatchCoverage({ d, compact = false }: { d: MatchPageData; compact?: boolean }) {
  const { article, infographic } = d.postMatchContent || { article: null, infographic: null };
  if (!article && !infographic) return null;
  return (
    <Box title="تغطية ما بعد المباراة" hint="لا يظهر هنا إلا المحتوى الذي اكتملت مراجعته واعتماده.">
      <div className={`grid gap-3 ${article && infographic ? 'lg:grid-cols-2' : ''}`}>
        {article && (
          <a href={`/articles/${article.slug}`} className="group flex flex-col justify-between rounded-3xl border border-[#18E58F]/20 bg-gradient-to-br from-[#18E58F]/10 to-transparent p-5 transition hover:-translate-y-0.5 hover:border-[#18E58F]/40">
            <div>
              <span className="rounded-full bg-[#18E58F]/10 px-3 py-1 text-[10px] font-black text-[#18E58F]">المقال التحليلي المعتمد</span>
              <h3 className="mt-4 text-xl font-black leading-8 text-white group-hover:text-[#18E58F]">{article.title}</h3>
              {!compact && <p className="mt-3 line-clamp-3 text-sm font-bold leading-7 text-slate-400">{article.excerpt}</p>}
            </div>
            <span className="mt-5 text-sm font-black text-[#18E58F]">اقرأ التحليل الكامل ←</span>
          </a>
        )}
        {infographic && (
          <a href={infographic.href} className="group relative min-h-52 overflow-hidden rounded-3xl border border-[#F8C846]/20 bg-[#08140f] p-5 transition hover:-translate-y-0.5 hover:border-[#F8C846]/40">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(248,200,70,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,240,252,.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <span className="rounded-full bg-[#F8C846]/10 px-3 py-1 text-[10px] font-black text-[#F8C846]">الإنفوجرافيك المعتمد</span>
                <h3 className="mt-4 text-2xl font-black text-white">قصة المباراة بالأرقام</h3>
                <p className="mt-2 text-xs font-bold leading-6 text-slate-400">الزخم، xG، المقارنات، خرائط التمركز وأعلى اللاعبين تقييمًا من البيانات الموثقة.</p>
              </div>
              <span className="mt-5 text-sm font-black text-[#F8C846]">افتح الإنفوجرافيك ←</span>
            </div>
          </a>
        )}
      </div>
    </Box>
  );
}

function Overview({ d }: { d: MatchPageData }) { 
  const rows = d.stats.filter((m) => m.available); 
  const homeHeatmapPoints = getTeamHeatmapPoints(true, d);
  const awayHeatmapPoints = getTeamHeatmapPoints(false, d);
  const hasVerifiedHeatmaps = homeHeatmapPoints.length > 0 || awayHeatmapPoints.length > 0;
  
  return (
    <div className="space-y-4">
      {/* Verified heatmaps only */}
      {hasVerifiedHeatmaps && (
        <Box title="الخريطة الحرارية الموثقة" hint="إحداثيات مباشرة من المزود أو مشتقة من أحداث مكانية موثقة؛ لا توجد نقاط تقديرية.">
          <div className="flex justify-center gap-4">
            {homeHeatmapPoints.length > 0 && <div className="w-1/2 max-w-[200px]"><TeamHeatmap teamName={tn(d.homeTeam)} isHome={true} points={homeHeatmapPoints} source={d.advanced.teamHeatmaps?.home?.source} /></div>}
            {awayHeatmapPoints.length > 0 && <div className="w-1/2 max-w-[200px]"><TeamHeatmap teamName={tn(d.awayTeam)} isHome={false} points={awayHeatmapPoints} source={d.advanced.teamHeatmaps?.away?.source} /></div>}
          </div>
        </Box>
      )}

      {/* Stats Grid */}
      <Box title="إحصائيات المواجهة">
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((m) => (
            <CompactStatCell key={m.key} label={m.label} h={f(m.home, m.suffix)} a={f(m.away, m.suffix)} />
          ))}
        </div>
      </Box>
      <PostMatchCoverage d={d} compact />
    </div>
  ); 
}

function Momentum({ d }: { d: MatchPageData }) {
  const points = d.advanced.momentum || [];
  const homeHeatmap = d.advanced.teamHeatmaps?.home;
  const awayHeatmap = d.advanced.teamHeatmaps?.away;
  const max = points.length ? Math.max(1, ...points.flatMap((point) => [point.home, point.away])) : 1;
  const provider = points.some((point) => point.source === 'PROVIDER');
  return (
    <div className="space-y-6">
      <Box title="زخم المباراة" hint={points.length >= 2 ? (provider ? 'سلسلة الزخم كما وردت من مزود البيانات.' : 'محسوب من التسديدات وxG الموثقة في نوافذ زمنية مدتها ٥ دقائق.') : 'لا نعرض منحنى تقديريًا عند غياب بيانات زمنية موثقة.'}>
        {points.length >= 2 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-black">
              <span className="text-[#0FF0FC]">{tn(d.homeTeam)}</span>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-slate-400">{provider ? 'المصدر: مزود البيانات' : 'المصدر: تسديدات المباراة الموثقة'}</span>
              <span className="text-[#F8C846]">{tn(d.awayTeam)}</span>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex h-64 min-w-[680px] items-center gap-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
                {points.map((point) => {
                  const homeHeight = Math.max(2, (point.home / max) * 104);
                  const awayHeight = Math.max(2, (point.away / max) * 104);
                  return (
                    <div key={point.minute} className="group relative flex min-w-0 flex-1 flex-col items-center justify-center">
                      <div className="flex h-[108px] w-full items-end justify-center"><div className="w-[72%] rounded-t bg-[#0FF0FC] transition group-hover:brightness-125" style={{ height: homeHeight }} /></div>
                      <div className="my-1 text-[9px] font-black text-slate-500">{point.minute}′</div>
                      <div className="flex h-[108px] w-full items-start justify-center"><div className="w-[72%] rounded-b bg-[#F8C846] transition group-hover:brightness-125" style={{ height: awayHeight }} /></div>
                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#07110D] px-2 py-1 text-[10px] font-black shadow-xl group-hover:block">
                        {tn(d.homeTeam)} {f(point.home)} · {tn(d.awayTeam)} {f(point.away)} · {ar.format(point.sampleSize)} تسديدة
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-sm font-bold text-slate-500">لا تتوفر بيانات كافية لإنشاء مؤشر زخم موثق لهذه المباراة.</div>}
      </Box>

      <Box title="الخرائط الحرارية للمنتخبين" hint="تظهر خريطة المباراة أولًا، أو خريطة البطولة المجمعة عند غيابها مع وسم المصدر بوضوح.">
        {(homeHeatmap?.points.length || awayHeatmap?.points.length) ? (
          <div className="grid gap-4 md:grid-cols-2">
            {homeHeatmap?.points.length ? <article className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 p-3"><div className="mb-3 flex items-center justify-between gap-2"><b className="text-sm text-[#0FF0FC]">{tn(d.homeTeam)}</b><span className="text-[9px] font-black text-slate-500">{homeHeatmap.scope === 'SEASON' ? 'البطولة المجمعة' : 'هذه المباراة'}</span></div><div className="flex justify-center"><TeamHeatmap teamName={tn(d.homeTeam)} isHome points={homeHeatmap.points} source={homeHeatmap.source} /></div></article> : null}
            {awayHeatmap?.points.length ? <article className="rounded-2xl border border-[#F8C846]/20 bg-[#F8C846]/5 p-3"><div className="mb-3 flex items-center justify-between gap-2"><b className="text-sm text-[#F8C846]">{tn(d.awayTeam)}</b><span className="text-[9px] font-black text-slate-500">{awayHeatmap.scope === 'SEASON' ? 'البطولة المجمعة' : 'هذه المباراة'}</span></div><div className="flex justify-center"><TeamHeatmap teamName={tn(d.awayTeam)} isHome={false} points={awayHeatmap.points} source={awayHeatmap.source} /></div></article> : null}
          </div>
        ) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-sm font-bold text-slate-500">لم تصل نقاط موثقة تكفي لإظهار خريطة أي منتخب.</div>}
      </Box>
    </div>
  );
}
function Events({ d, e }: { d: MatchPageData; e: MatchEventView[] }) {
  if (!e.length) return <Box title="أحداث المباراة"><p className="py-8 text-center text-sm font-bold text-slate-500">لم تصل أحداث موثقة لهذه المباراة.</p></Box>;
  return (
    <Box title="كل أحداث المنتخبين">
      <div className="mb-5 flex flex-wrap justify-center gap-3 text-xs font-black">
        <span className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[#0FF0FC]">{tn(d.homeTeam)}</span>
        <span className="rounded-full border border-[#F8C846]/25 bg-[#F8C846]/10 px-3 py-1 text-[#F8C846]">{tn(d.awayTeam)}</span>
      </div>
      <div className="relative space-y-4 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-5">
        <div className="absolute inset-y-0 left-1/2 hidden w-px bg-white/10 md:block" />
        {e.map((event) => {
          const [label, icon] = k(event);
          const eventSide = side(event, d);
          const color = eventSide === 'home' ? '#0FF0FC' : eventSide === 'away' ? '#F8C846' : '#18E58F';
          const teamName = eventSide === 'home' ? tn(d.homeTeam) : eventSide === 'away' ? tn(d.awayTeam) : 'المباراة';
          const card = (
            <div className="rounded-2xl border bg-black/40 p-3 shadow-lg" style={{ borderColor: `${color}45`, boxShadow: `0 10px 35px ${color}10` }}>
              <div className="flex items-center gap-3">
                <Avatar name={event.playerName} image={event.playerImage} number={event.playerNumber} />
                <div className="min-w-0">
                  <b className="block truncate text-sm text-white">{label}{event.playerName ? ` — ${event.playerName}` : ''}</b>
                  <p className="mt-1 text-xs font-black" style={{ color }}>{teamName}</p>
                  {event.detail && event.detail !== event.type && <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{event.detail}</p>}
                </div>
              </div>
            </div>
          );
          return (
            <article key={event.id} className="relative grid items-center gap-3 md:grid-cols-[1fr_58px_1fr]">
              <div className={eventSide === 'away' ? 'hidden md:block md:invisible' : ''}>{card}</div>
              <div className="z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 bg-[#070b18] text-lg" style={{ borderColor: color }}>{icon}</div>
              <div className={eventSide === 'home' ? 'hidden md:block md:invisible' : eventSide === 'away' ? '' : 'hidden md:block md:invisible'}>{card}</div>
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-[#07110D] px-2 py-0.5 text-xs font-black" style={{ borderColor: `${color}55`, color }}>{event.minuteLabel}</span>
            </article>
          );
        })}
      </div>
    </Box>
  );
}
function teamRows(d: MatchPageData, team: 'home' | 'away') { 
  const t = team === 'home' ? d.homeTeam : d.awayTeam; 
  const all = d.advanced.playerStats || []; 
  return all.filter((p) => playerSide(p, d) === team); 
}


function PitchPlayer({ p, isHome, color, d, onHeatmap, isSubstitute = false }: { p: MatchPlayerStatItem, isHome: boolean, color: string, d: MatchPageData, isSubstitute?: boolean, onHeatmap: (name: string, image: string | null | undefined, isHome: boolean, points: HeatmapPoint[], source: HeatmapSource | undefined, stats: MatchPlayerStatItem) => void }) {
  const playerHeatmaps = d.advanced.playerHeatmaps?.filter((heatmap) =>
    (p.playerId && heatmap.playerId === p.playerId) ||
    (heatmap.playerName && clean(heatmap.playerName) === clean(p.playerName))
  ) || [];
  const heatmap = playerHeatmaps.find((item) => item.scope !== 'SEASON' && item.source !== 'PROVIDER_SEASON_HEATMAP') || playerHeatmaps.find((item) => item.scope === 'SEASON' || item.source === 'PROVIDER_SEASON_HEATMAP');
  const heatmapPoints = heatmap?.points || [];
  const hasVerifiedHeatmap = heatmapPoints.length > 0;
  return (
    <button type="button" className="group relative flex min-w-[58px] cursor-pointer flex-col items-center transition-transform hover:scale-105" onClick={() => onHeatmap(p.playerName || '', p.image, isHome, heatmapPoints, heatmap?.source, p)} aria-label={`عرض إحصاءات ${p.playerName || 'اللاعب'}${hasVerifiedHeatmap ? ' وخريطته الحرارية' : ''}`}>
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 bg-black/60 shadow-lg md:h-12 md:w-12" style={{ borderColor: color }}>
          <Avatar name={p.playerName} image={p.image} number={p.number} />
        </div>
        {p.number !== null && p.number !== undefined && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full border border-white/20 bg-[#07110d] px-1 text-[9px] font-black text-white">{p.number}</span>}
        {Number(p.goals || 0) > 0 && <span className="absolute -left-2 -top-2 text-xs drop-shadow">⚽</span>}
        {p.rating && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded border border-white/20 bg-black/90 px-1 text-[8px] text-white">{p.rating.toFixed(1)}</span>}
      </div>
      <div className="mt-2 max-w-[76px] rounded-lg border border-white/10 bg-black/75 px-1.5 py-1 text-center">
        <p className="truncate text-[9px] font-black text-white md:text-[10px]">{p.playerName}</p>
        <p className="mt-0.5 text-[7px] font-bold text-white/55">{p.position || '—'}{isSubstitute ? ' · بديل مشارك' : ''}</p>
      </div>
    </button>
  );
}

function Lineups({ d, onHeatmap }: { d: MatchPageData, onHeatmap: (name: string, img: string|null|undefined, isHome: boolean, points: HeatmapPoint[], source: HeatmapSource | undefined, stats: MatchPlayerStatItem) => void }) {
  const allStats = d.advanced.playerStats || [];
  const official = d.officialLineup;
  const homeStats = allStats.filter((player) => playerSide(player, d) === 'home');
  const awayStats = allStats.filter((player) => playerSide(player, d) === 'away');

  const homeStarters = official?.home.startingXi.length
    ? official.home.startingXi.map((player) => officialPlayerStat(player, homeStats, d.homeTeam.id, d.homeTeam.name, true))
    : homeStats.filter((player) => isStarterPlayer(player, d)).slice(0, 11);
  const awayStarters = official?.away.startingXi.length
    ? official.away.startingXi.map((player) => officialPlayerStat(player, awayStats, d.awayTeam.id, d.awayTeam.name, true))
    : awayStats.filter((player) => isStarterPlayer(player, d)).slice(0, 11);
  const homeSubs = official?.home.substitutes.length
    ? official.home.substitutes.map((player) => officialPlayerStat(player, homeStats, d.homeTeam.id, d.homeTeam.name, false))
    : homeStats.filter((player) => !isStarterPlayer(player, d) && (player.played === true || Number(player.minutes || 0) > 0 || player.playerSubbedOn));
  const awaySubs = official?.away.substitutes.length
    ? official.away.substitutes.map((player) => officialPlayerStat(player, awayStats, d.awayTeam.id, d.awayTeam.name, false))
    : awayStats.filter((player) => !isStarterPlayer(player, d) && (player.played === true || Number(player.minutes || 0) > 0 || player.playerSubbedOn));

  const homeLines = formationLines(homeStarters, official?.home.formation);
  const awayLines = formationLines(awayStarters, official?.away.formation);
  const homeHeatmapPoints = getTeamHeatmapPoints(true, d);
  const awayHeatmapPoints = getTeamHeatmapPoints(false, d);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-black/20 p-4">
      <div className="mb-5 w-full rounded-2xl border border-[#18E58F]/20 bg-[#18E58F]/5 p-3 text-center text-xs font-bold text-slate-300">التوزيع مطابق للخطة الرسمية، ويعرض الأساسيين والبدلاء الذين ثبتت مشاركتهم فقط. اضغط على اللاعب لإحصاءاته وخريطته.</div>
      <div className="mb-4 grid w-full max-w-2xl grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 p-2 text-xs font-black text-[#0FF0FC]">{tn(d.homeTeam)} · {official?.home.formation || 'الخطة غير متوفرة'}</div>
        <div className="rounded-xl border border-[#F8C846]/20 bg-[#F8C846]/5 p-2 text-xs font-black text-[#F8C846]">{tn(d.awayTeam)} · {official?.away.formation || 'الخطة غير متوفرة'}</div>
      </div>
      {!homeStarters.length && !awayStarters.length && <div className="mb-5 w-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">لم يصل تشكيل أساسي موثق، لذلك لا نعرض توزيعًا تقديريًا للاعبين.</div>}

      {awaySubs.length > 0 && <div className="mb-6 flex w-full flex-wrap justify-center gap-3 px-2">
        <div className="mb-2 w-full text-center"><span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-gray-400">بدلاء {tn(d.awayTeam)} المشاركون</span></div>
        {awaySubs.map((player) => <PitchPlayer key={player.playerId || player.playerName} p={player} isHome={false} isSubstitute color="#9CA3AF" d={d} onHeatmap={onHeatmap} />)}
      </div>}

      <div className="relative mx-auto flex h-[860px] w-full max-w-2xl flex-col overflow-visible rounded-xl border-[3px] border-white/70 bg-gradient-to-b from-[#316a2b] to-[#2b5e25] shadow-2xl sm:h-[940px] md:h-[1020px] md:border-4">
        <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/50" />
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 md:h-24 md:w-24" />
        <div className="absolute left-1/2 top-0 h-20 w-32 -translate-x-1/2 border-2 border-t-0 border-white/50 md:h-32 md:w-48" />
        <div className="absolute bottom-0 left-1/2 h-20 w-32 -translate-x-1/2 border-2 border-b-0 border-white/50 md:h-32 md:w-48" />

        <div className="z-10 flex min-h-0 flex-1 flex-col justify-evenly gap-2 py-5 md:gap-3 md:py-7">
          {awayLines.map((line, index) => <div key={index} className="flex w-full justify-around px-1 md:px-7">{line.map((player) => <PitchPlayer key={player.playerId || player.playerName} p={player} isHome={false} color="#F8C846" d={d} onHeatmap={onHeatmap} />)}</div>)}
        </div>
        <div className="z-10 flex min-h-0 flex-1 flex-col justify-evenly gap-2 py-5 md:gap-3 md:py-7">
          {[...homeLines].reverse().map((line, index) => <div key={index} className="flex w-full justify-around px-1 md:px-7">{line.map((player) => <PitchPlayer key={player.playerId || player.playerName} p={player} isHome color="#0FF0FC" d={d} onHeatmap={onHeatmap} />)}</div>)}
        </div>
      </div>

      {homeSubs.length > 0 && <div className="mt-6 flex w-full flex-wrap justify-center gap-3 px-2">
        <div className="mb-2 w-full text-center"><span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-gray-400">بدلاء {tn(d.homeTeam)} المشاركون</span></div>
        {homeSubs.map((player) => <PitchPlayer key={player.playerId || player.playerName} p={player} isHome isSubstitute color="#9CA3AF" d={d} onHeatmap={onHeatmap} />)}
      </div>}

      {(homeHeatmapPoints.length > 0 || awayHeatmapPoints.length > 0) && (
        <div className="mt-8 grid w-full gap-4 md:grid-cols-2">
          {homeHeatmapPoints.length > 0 && <Box title={`تمركز ${tn(d.homeTeam)}`}><TeamHeatmap teamName="" isHome points={homeHeatmapPoints} source={d.advanced.teamHeatmaps?.home?.source} /></Box>}
          {awayHeatmapPoints.length > 0 && <Box title={`تمركز ${tn(d.awayTeam)}`}><TeamHeatmap teamName="" isHome={false} points={awayHeatmapPoints} source={d.advanced.teamHeatmaps?.away?.source} /></Box>}
        </div>
      )}
    </div>
  );
}

function History({ d }: { d: MatchPageData }) {
  const history = historyOf(d);
  const recentCard = (side: 'home' | 'away') => {
    const team = side === 'home' ? d.homeTeam : d.awayTeam;
    const rows = side === 'home' ? history.homeRecentForm : history.awayRecentForm;
    const color = side === 'home' ? '#0FF0FC' : '#F8C846';
    return (
      <article className="rounded-3xl border bg-black/25 p-4" style={{ borderColor: `${color}35` }}>
        <div className="mb-4 flex items-center gap-3"><TeamFlag team={team} small /><div><h3 className="text-sm font-black" style={{ color }}>آخر ٥ مباريات</h3><p className="text-xs font-bold text-slate-500">{tn(team)}</p></div></div>
        <div className="space-y-2">
          {rows.length ? rows.map((row) => <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.035] p-3"><div><b className="block text-xs text-white">{row.opponentName}</b><span className="mt-1 block text-[10px] text-slate-500">{dt(row.date)}</span></div><strong className="rounded-lg bg-black/30 px-3 py-1 text-sm">{f(row.teamScore)} - {f(row.opponentScore)}</strong></div>) : <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">لا توجد مباريات سابقة موثقة في قاعدة البيانات.</p>}
        </div>
      </article>
    );
  };
  return (
    <div className="space-y-6">
      <Box title="تاريخ لقاءات المنتخبين" hint="النتائج أدناه مأخوذة فقط من المباريات المحفوظة والمنتهية قبل هذه المباراة.">
        {history.headToHead.length ? <div className="grid gap-3 md:grid-cols-2">{history.headToHead.map((row) => <article key={row.id} className="rounded-2xl border border-[#18E58F]/15 bg-[#18E58F]/5 p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{row.homeTeamName}</b><b className="mt-2 block truncate text-sm">{row.awayTeamName}</b></div><div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center text-xl font-black">{f(row.homeScore)}<span className="px-2 text-white/30">-</span>{f(row.awayScore)}</div></div><div className="mt-3 flex justify-between text-[10px] font-bold text-slate-500"><span>{dt(row.date)}</span><span>{row.stage || 'مباراة موثقة'}</span></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-sm font-bold text-slate-500">لا توجد مواجهات مباشرة موثقة في قاعدة البيانات الحالية.</div>}
      </Box>

      <section className="grid gap-4 lg:grid-cols-2">{recentCard('home')}{recentCard('away')}</section>

      <Box title="تاريخ المنتخبين في كأس العالم" hint="لا يظهر رقم مشاركات إلا إذا كان محفوظًا في سجل المنتخب داخل قاعدة البيانات.">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 p-5"><div className="mb-4 flex items-center gap-3"><TeamFlag team={d.homeTeam} /><h3 className="text-lg font-black text-[#0FF0FC]">{tn(d.homeTeam)}</h3></div><p className="text-sm font-bold leading-7 text-slate-300">{history.homeWorldCupHistory}</p><span className="mt-4 inline-flex rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black text-slate-500">المصدر: سجل المنتخب في قاعدة البيانات</span></article>
          <article className="rounded-3xl border border-[#F8C846]/20 bg-[#F8C846]/5 p-5"><div className="mb-4 flex items-center gap-3"><TeamFlag team={d.awayTeam} /><h3 className="text-lg font-black text-[#F8C846]">{tn(d.awayTeam)}</h3></div><p className="text-sm font-bold leading-7 text-slate-300">{history.awayWorldCupHistory}</p><span className="mt-4 inline-flex rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black text-slate-500">المصدر: سجل المنتخب في قاعدة البيانات</span></article>
        </div>
      </Box>
    </div>
  );
}
function Group({ d }: { d: MatchPageData }) { 
  return (
    <Box title="موقف المجموعة">
      <table className="w-full text-xs text-center">
        <thead>
          <tr className="border-b border-white/20 text-gray-400">
            <th className="p-2">#</th>
            <th className="p-2 text-right">المنتخب</th>
            <th className="p-2">لعب</th>
            <th className="p-2 text-[#F8C846]">نقاط</th>
          </tr>
        </thead>
        <tbody>
          {d.groupStandings.map((r) => (
            <tr key={r.teamId} className="border-b border-white/5">
              <td className="p-2 font-bold">{r.rank}</td>
              <td className="p-2 text-right font-bold">{r.teamName}</td>
              <td className="p-2">{r.played}</td>
              <td className="p-2 font-bold text-[#F8C846]">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  ); 
}

function Articles({ d }: { d: MatchPageData }) {
  const hasApprovedCoverage = Boolean(d.postMatchContent?.article || d.postMatchContent?.infographic);
  return (
    <div className="space-y-4">
      {hasApprovedCoverage ? <PostMatchCoverage d={d} /> : (
        <Box title="تغطية ما بعد المباراة">
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-sm font-bold text-slate-500">لم يتم نشر مقال أو اعتماد إنفوجرافيك لهذه المباراة بعد.</div>
        </Box>
      )}
      {d.relatedArticles.length > 0 && (
        <Box title="أخبار مرتبطة">
          <div className="grid gap-2">
            {d.relatedArticles.map((article) => <a key={article.id} href={article.href} className="rounded-xl border border-white/10 p-3 font-bold transition hover:bg-white/5">{article.title}</a>)}
          </div>
        </Box>
      )}
    </div>
  );
}

export default function ProfessionalMatchTabsPageRich({ data }: { data: MatchPageData }) { 
  const [tab, setTab] = useState<Tab>('overview'); 
  const events = useMemo(() => data.events || [], [data.events]); 
  
  const [heatmapModal, setHeatmapModal] = useState<{isOpen: boolean, name: string, img?: string|null, isHome: boolean, points: HeatmapPoint[], source?: HeatmapSource, stats: MatchPlayerStatItem | null}>({ isOpen: false, name: '', isHome: true, points: [], stats: null });

  const openHeatmap = (name: string, img: string|null|undefined, isHome: boolean, points: HeatmapPoint[], source: HeatmapSource | undefined, stats: MatchPlayerStatItem) => {
     setHeatmapModal({ isOpen: true, name, img, isHome, points, source, stats });
  };

  return (
    <main className="min-h-screen bg-[#07110D] px-3 py-3 text-white" dir="rtl">
      <MatchAutoRefresh intervalMs={data.status.isLive ? 25000 : 90000} />
      <div className="mx-auto max-w-7xl space-y-4">
        <Header d={data} />
        
        <nav className="sticky top-0 z-30 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#07110D]/95 p-2 backdrop-blur scrollbar-hide">
          {tabs.map((x) => (
            <button 
              key={x.id} 
              onClick={() => setTab(x.id)} 
              className={`h-10 shrink-0 rounded-xl px-4 text-xs font-black transition-colors ${tab === x.id ? 'bg-[#18E58F] text-black' : 'bg-white/[0.05] hover:bg-white/10 text-gray-300'}`}
            >
              {x.label}
            </button>
          ))}
        </nav>
        
        {tab === 'overview' && <Overview d={data} />}
        {tab === 'momentum' && <Momentum d={data} />}
        {tab === 'events' && <Events d={data} e={events} />}
        {tab === 'lineups' && <Lineups d={data} onHeatmap={openHeatmap} />}
        {tab === 'history' && <History d={data} />}
        {tab === 'group' && <Group d={data} />}
        {tab === 'articles' && <Articles d={data} />}
      </div>
      
      <PlayerHeatmapModal 
         isOpen={heatmapModal.isOpen} 
         onClose={() => setHeatmapModal(prev => ({ ...prev, isOpen: false }))} 
         playerName={heatmapModal.name}
         playerImage={heatmapModal.img}
         isHome={heatmapModal.isHome}
         points={heatmapModal.points}
         heatmapSource={heatmapModal.source}
         stats={heatmapModal.stats}
      />
    </main>
  ); 
}

