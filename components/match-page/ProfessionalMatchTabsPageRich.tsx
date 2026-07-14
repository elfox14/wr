'use client';

import { useMemo, useState } from 'react';
import type { HeatmapPoint, HeatmapSource } from '@/lib/match-page/types';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerStatItem, OfficialLineupPlayer } from '@/lib/match-page/types';

import TeamHeatmap from '@/components/match-center/visuals/TeamHeatmap';
import CompactStatCell from '@/components/match-center/visuals/CompactStatCell';
import InteractiveShotmap from '@/components/match-center/visuals/InteractiveShotmap';
import PlayerHeatmapModal from '@/components/match-center/visuals/PlayerHeatmapModal';

type Tab = 'overview' | 'momentum' | 'events' | 'lineups' | 'analysis' | 'group' | 'articles';
const ar = new Intl.NumberFormat('ar-EG');
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'momentum', label: 'الزخم' },
  { id: 'events', label: 'الأحداث' },
  { id: 'lineups', label: 'التشكيلات' },
  { id: 'analysis', label: 'التحليل' },
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

      <div className="relative mx-auto flex aspect-[2/3] w-full max-w-2xl flex-col overflow-hidden rounded-md border-[3px] border-white/70 bg-gradient-to-b from-[#316a2b] to-[#2b5e25] shadow-2xl md:border-4">
        <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/50" />
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 md:h-24 md:w-24" />
        <div className="absolute left-1/2 top-0 h-20 w-32 -translate-x-1/2 border-2 border-t-0 border-white/50 md:h-32 md:w-48" />
        <div className="absolute bottom-0 left-1/2 h-20 w-32 -translate-x-1/2 border-2 border-b-0 border-white/50 md:h-32 md:w-48" />

        <div className="z-10 flex flex-1 flex-col justify-evenly py-2 md:py-5">
          {awayLines.map((line, index) => <div key={index} className="flex w-full justify-around px-1 md:px-7">{line.map((player) => <PitchPlayer key={player.playerId || player.playerName} p={player} isHome={false} color="#F8C846" d={d} onHeatmap={onHeatmap} />)}</div>)}
        </div>
        <div className="z-10 flex flex-1 flex-col justify-evenly py-2 md:py-5">
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

function Analysis({ d }: { d: MatchPageData }) { 
  const h = historyOf(d); 
  return (
    <div className="space-y-4">
      <InteractiveShotmap homeTeamName={tn(d.homeTeam)} awayTeamName={tn(d.awayTeam)} shots={d.advanced?.shotmap} homeTeamId={d.homeTeam.id} />
      
      <Box title="المواجهات السابقة وتحليل الأداء">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="font-black text-sm mb-2 text-[#0FF0FC]">آخر ٥ مباريات: {tn(d.homeTeam)}</h3>
            {h.homeRecentForm.length ? h.homeRecentForm.map((r) => <p key={r.id} className="text-xs text-slate-300 bg-white/5 p-2 rounded mb-1">{r.opponentName} · {f(r.teamScore)}-{f(r.opponentScore)} · {dt(r.date)}</p>) : <p className="text-xs text-slate-500">لا توجد مباريات.</p>}
            
            <h3 className="mt-4 font-black text-sm mb-2 text-[#F8C846]">آخر ٥ مباريات: {tn(d.awayTeam)}</h3>
            {h.awayRecentForm.length ? h.awayRecentForm.map((r) => <p key={r.id} className="text-xs text-slate-300 bg-white/5 p-2 rounded mb-1">{r.opponentName} · {f(r.teamScore)}-{f(r.opponentScore)} · {dt(r.date)}</p>) : <p className="text-xs text-slate-500">لا توجد مباريات.</p>}
          </div>
          <div>
            <h3 className="font-black text-sm mb-2 text-[#18E58F]">المواجهات المباشرة (H2H)</h3>
            {h.headToHead.length ? h.headToHead.map((x) => <p key={x.id} className="text-xs text-slate-300 bg-white/5 p-2 rounded mb-1">{x.homeTeamName} {f(x.homeScore)}-{f(x.awayScore)} {x.awayTeamName}</p>) : <p className="text-xs text-slate-500">لا توجد مواجهات مباشرة.</p>}
            
            <h3 className="mt-4 font-black text-sm mb-2">تاريخ كأس العالم</h3>
            <p className="text-xs text-slate-300 bg-white/5 p-2 rounded mb-1">{h.homeWorldCupHistory}</p>
            <p className="text-xs text-slate-300 bg-white/5 p-2 rounded">{h.awayWorldCupHistory}</p>
          </div>
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
        {tab === 'analysis' && <Analysis d={data} />}
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

