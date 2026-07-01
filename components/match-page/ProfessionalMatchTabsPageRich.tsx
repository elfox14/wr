'use client';

import { useMemo, useState } from 'react';
import type { HeatmapPoint } from '@/lib/match-page/types';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerStatItem } from '@/lib/match-page/types';

import TeamHeatmap from '@/components/match-center/visuals/TeamHeatmap';
import MatchMomentumChart from '@/components/match-center/visuals/MatchMomentumChart';
import CompactStatCell from '@/components/match-center/visuals/CompactStatCell';
import InteractiveShotmap from '@/components/match-center/visuals/InteractiveShotmap';
import PlayerHeatmapModal from '@/components/match-center/visuals/PlayerHeatmapModal';
import { MatchAnalyticsPanel } from '@/components/match-center/MatchAnalyticsPanel';
import type { MatchInsightsInput } from '@/lib/analytics/match-analytics.types';

type Tab = 'overview' | 'events' | 'lineups' | 'analysis' | 'group' | 'articles';
const ar = new Intl.NumberFormat('ar-EG');
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'events', label: 'الأحداث' },
  { id: 'lineups', label: 'التشكيلات' },
  { id: 'analysis', label: 'التحليل' },
  { id: 'group', label: 'المجموعة' },
  { id: 'articles', label: 'المقالات' },
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

function buildAnalyticsInput(d: MatchPageData): any {
  // Mapping MatchPageData into MatchInsightsInput shape expected by match-insights.ts
  const homeTeamName = tn(d.homeTeam);
  const awayTeamName = tn(d.awayTeam);

  const stats = d.stats
    .filter((s) => s.available && s.home !== null && s.away !== null)
    .map((s) => ({
      key: s.key,
      label: s.label,
      home: Number(s.home ?? 0),
      away: Number(s.away ?? 0),
      suffix: s.suffix || '',
    }));

  const events = (d.events || []).map((e: any) => {
    const rawType = String(e.type || '').toLowerCase();
    const type = ['goal', 'yellow', 'red', 'substitution'].includes(rawType) ? rawType : 'substitution';
    return {
      minute: Number(e.minute || 0),
      team: side(e, d) === 'home' ? 'home' : 'away',
      type,
      label: String(e.playerName || e.detail || e.type || ''),
    };
  });

  const shots = (d.advanced?.shotmap || []).map((s: any, i: number) => {
    const isHome = s.teamId === d.homeTeam.id || s.teamName === d.homeTeam.name || s.teamName === d.homeTeam.code;
    return {
      id: String(s.id || i),
      minute: Number(s.minute || 0),
      team: isHome ? 'home' : 'away',
      x: Number(s.x || 50),
      y: Number(s.y || 50),
      xg: Number(s.xg || s.npxg || 0),
      outcome: s.isGoal ? 'goal' : s.isOnTarget ? 'onTarget' : s.isBlocked ? 'blocked' : 'offTarget',
      insideBox: s.situation !== 'Free Kick' && s.situation !== 'Direct Free Kick', // generic approximation if insideBox missing
      player: s.playerName || undefined,
    };
  });

  return {
    stats,
    momentum: [],
    xgFlow: [],
    shots,
    events,
    homeTeamName,
    awayTeamName,
  };
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

function isHomePlayer(p: any, d: MatchPageData) {
  if (p.teamId && (p.teamId === d.homeTeam.id || p.teamId === d.homeTeam.code)) return true;
  if (p.teamName && (p.teamName === d.homeTeam.name || p.teamName === d.homeTeam.code)) return true;
  
  const pn = String(p.playerName || '').toLowerCase().trim();
  if (pn && d.homePlayers.some(hp => String(hp.name).toLowerCase().trim() === pn)) return true;
  if (pn && d.officialLineup?.home) {
     if (d.officialLineup.home.startingXi.some(hp => String(hp.name).toLowerCase().trim() === pn)) return true;
     if (d.officialLineup.home.substitutes.some(hp => String(hp.name).toLowerCase().trim() === pn)) return true;
  }
  return false;
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
  const allStats = d.advanced.playerStats || [];
  const playerHeatmaps = d.advanced.playerHeatmaps || [];
  return playerHeatmaps.filter(h => {
     const p = allStats.find(s => s.playerId === h.playerId || s.playerName === h.playerName);
     return p ? (isHome ? isHomePlayer(p, d) : !isHomePlayer(p, d)) : (h.side === (isHome ? 'home' : 'away'));
  }).flatMap(h => h.points);
}


function Overview({ d }: { d: MatchPageData }) { 
  const rows = d.stats.filter((m) => m.available); 
  const analyticsInput = buildAnalyticsInput(d);
  
  return (
    <div className="space-y-4">
      <MatchAnalyticsPanel input={analyticsInput} />
      
      {/* Momentum */}
      <Box title="زخم المباراة (Match Momentum)" hint="يوضح سيطرة الفريقين خلال أوقات المباراة">
        <div className="h-32">
          <MatchMomentumChart matchId={d.id} events={d.events} homeTeamId={d.homeTeam.id} />
        </div>
      </Box>

      {/* Heatmaps */}
      <Box title="الخريطة الحرارية (Heatmaps)">
        <div className="flex justify-center gap-4">
          <div className="w-1/2 max-w-[200px]">
             <TeamHeatmap teamName={tn(d.homeTeam)} isHome={true} points={getTeamHeatmapPoints(true, d)} />
          </div>
          <div className="w-1/2 max-w-[200px]">
             <TeamHeatmap teamName={tn(d.awayTeam)} isHome={false} points={getTeamHeatmapPoints(false, d)} />
          </div>
        </div>
      </Box>

      {/* Stats Grid */}
      <Box title="إحصائيات المواجهة">
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((m) => (
            <CompactStatCell key={m.key} label={m.label} h={f(m.home, m.suffix)} a={f(m.away, m.suffix)} />
          ))}
        </div>
      </Box>
    </div>
  ); 
}

function Events({ d, e }: { d: MatchPageData; e: MatchEventView[] }) { 
  return (
    <Box title="خط أحداث المباراة (Timeline)">
      <div className="relative space-y-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
        {e.map((ev) => { 
          const [label, icon] = k(ev);
          const s = side(ev, d); 
          const card = (
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="flex items-center gap-3">
                <Avatar name={ev.playerName} image={ev.playerImage} number={ev.playerNumber} />
                <div>
                  <b className="text-sm">{label}{ev.playerName ? ` — ${ev.playerName}` : ''}</b>
                  <p className="text-xs text-slate-400">{s === 'home' ? tn(d.homeTeam) : s === 'away' ? tn(d.awayTeam) : 'المباراة'}</p>
                </div>
              </div>
            </div>
          ); 
          return (
            <article key={ev.id} className="relative grid items-center gap-3 md:grid-cols-[1fr_56px_1fr]">
              <div className={s === 'away' ? 'invisible' : ''}>{card}</div>
              <div className="z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#070b18] border-2 border-white/5">{icon}</div>
              <div className={s === 'home' ? 'invisible' : ''}>{card}</div>
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#07110D] px-2 py-0.5 text-xs font-bold text-[#F8C846]">
                {ev.minuteLabel}
              </span>
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
  let rows = all.filter((p) => p.teamId === t.id || p.teamId === t.code || clean(p.teamName).includes(clean(t.name)) || clean(p.teamName).includes(clean(t.code))); 
  if (!rows.length && all.length) { 
    const half = Math.ceil(all.length / 2); 
    rows = team === 'home' ? all.slice(0, half) : all.slice(half); 
  } 
  return rows; 
}

function groupPlayersByLine(players: any[]) {
  const gks: any[] = [], defs: any[] = [], mids: any[] = [], fwds: any[] = [], others: any[] = [];
  players.forEach(p => {
    const pos = String(p.position || '').toLowerCase();
    if (pos.includes('gk') || pos.includes('حارس') || pos.includes('goalkeeper')) gks.push(p);
    else if (pos.includes('d') || pos.includes('مدافع') || pos.includes('back')) defs.push(p);
    else if (pos.includes('m') || pos.includes('وسط')) mids.push(p);
    else if (pos.includes('f') || pos.includes('a') || pos.includes('مهاجم') || pos.includes('wing')) fwds.push(p);
    else others.push(p);
  });
  
  if (others.length > 0) mids.push(...others);
  return [gks, defs, mids, fwds];
}

function PitchPlayer({ p, isHome, color, d, onHeatmap }: { p: any, isHome: boolean, color: string, d: MatchPageData, onHeatmap: any }) {
  return (
    <div className="flex flex-col items-center group relative cursor-pointer hover:scale-110 transition-transform" onClick={() => onHeatmap(p.playerName || '', p.image, isHome, d.advanced.playerHeatmaps?.find((h:any) => h.playerId === p.playerId)?.points || [])}>
       <div className="relative">
          <div className="w-8 h-8 md:w-10 md:h-10 border-2 shadow-lg bg-black/50 rounded-full flex items-center justify-center overflow-hidden" style={{ borderColor: color }}>
             <Avatar name={p.playerName} image={p.image} number={p.number} />
          </div>
          {p.goals > 0 && <span className="absolute -top-2 -right-2 text-xs md:text-sm drop-shadow">⚽</span>}
          {p.rating && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/90 border border-white/20 text-[8px] md:text-[9px] px-1 rounded text-white">{p.rating.toFixed(1)}</span>}
       </div>
       <div className="mt-1 md:mt-1.5 bg-black/70 px-1.5 py-0.5 rounded border border-white/10 text-center max-w-[60px] md:max-w-[70px]">
          <p className="text-[8px] md:text-[10px] font-bold text-white truncate">{p.playerName}</p>
       </div>
    </div>
  )
}


function Lineups({ d, onHeatmap }: { d: MatchPageData, onHeatmap: (name: string, img: string|null|undefined, isHome: boolean, points: HeatmapPoint[]) => void }) { 
  const allStats = d.advanced.playerStats || [];
  const homeStats = allStats.filter(p => isHomePlayer(p, d));
  const awayStats = allStats.filter(p => !isHomePlayer(p, d));
  const homeStarters = homeStats.filter(p => isStarterPlayer(p, d)).length ? homeStats.filter(p => isStarterPlayer(p, d)) : homeStats.slice(0, 11);
  const homeSubs = homeStats.filter(p => !isStarterPlayer(p, d) && (p.played === true || (p.minutes && p.minutes > 0) || p.playerSubbedOn));

  const awayStarters = awayStats.filter(p => isStarterPlayer(p, d)).length ? awayStats.filter(p => isStarterPlayer(p, d)) : awayStats.slice(0, 11);
  const awaySubs = awayStats.filter(p => !isStarterPlayer(p, d) && (p.played === true || (p.minutes && p.minutes > 0) || p.playerSubbedOn));

  const homeLines = groupPlayersByLine(homeStarters).filter(l => l.length > 0);
  const awayLines = groupPlayersByLine(awayStarters).filter(l => l.length > 0);

  const homeHeatmapPoints = getTeamHeatmapPoints(true, d);
  const awayHeatmapPoints = getTeamHeatmapPoints(false, d);

  return (
    <div className="flex flex-col items-center bg-black/20 rounded-2xl p-4 border border-white/5">
      
      {/* Away Subs */}
      <div className="mb-6 w-full flex flex-wrap justify-center gap-3 px-2">
         <div className="w-full text-center mb-2">
            <span className="text-xs font-black text-gray-400 bg-black/40 px-3 py-1 rounded-full border border-white/10">بدلاء {tn(d.awayTeam)} المشاركين</span>
         </div>
         {awaySubs.map(p => <PitchPlayer key={p.playerId || p.playerName} p={p} isHome={false} color="#9CA3AF" d={d} onHeatmap={onHeatmap} />)}
      </div>
      
      {/* The Pitch */}
      <div className="relative w-full max-w-2xl mx-auto bg-gradient-to-b from-[#316a2b] to-[#2b5e25] border-[3px] md:border-4 border-white/70 rounded-md aspect-[2/3] overflow-hidden shadow-2xl flex flex-col">
        {/* Field Markings */}
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/50 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-16 h-16 md:w-24 md:h-24 border-2 border-white/50 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-1 h-1 md:w-2 md:h-2 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-0 left-1/2 w-32 h-20 md:w-48 md:h-32 border-2 border-white/50 border-t-0 -translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 w-32 h-20 md:w-48 md:h-32 border-2 border-white/50 border-b-0 -translate-x-1/2" />
        
        {/* Away Half (Top) - Defends top */}
        <div className="flex-1 flex flex-col justify-evenly py-2 md:py-6 z-10 w-full">
          {awayLines.map((line, i) => (
             <div key={i} className="flex justify-around w-full px-2 md:px-8">
               {line.map(p => <PitchPlayer key={p.playerId || p.playerName} p={p} isHome={false} color="#F8C846" d={d} onHeatmap={onHeatmap} />)}
             </div>
          ))}
        </div>

        {/* Home Half (Bottom) - Defends bottom */}
        <div className="flex-1 flex flex-col justify-evenly py-2 md:py-6 z-10 w-full">
          {[...homeLines].reverse().map((line, i) => (
             <div key={i} className="flex justify-around w-full px-2 md:px-8">
               {line.map(p => <PitchPlayer key={p.playerId || p.playerName} p={p} isHome={true} color="#0FF0FC" d={d} onHeatmap={onHeatmap} />)}
             </div>
          ))}
        </div>
      </div>

      {/* Home Subs */}
      <div className="mt-6 w-full flex flex-wrap justify-center gap-3 px-2">
         <div className="w-full text-center mb-2">
            <span className="text-xs font-black text-gray-400 bg-black/40 px-3 py-1 rounded-full border border-white/10">بدلاء {tn(d.homeTeam)} المشاركين</span>
         </div>
         {homeSubs.map(p => <PitchPlayer key={p.playerId || p.playerName} p={p} isHome={true} color="#9CA3AF" d={d} onHeatmap={onHeatmap} />)}
      </div>

      {/* Team Heatmaps */}
      <div className="w-full grid md:grid-cols-2 gap-4 mt-8">
         <Box title={`تمركز ${tn(d.homeTeam)}`}>
            <div className="w-full flex justify-center">
               <TeamHeatmap teamName="" isHome={true} points={homeHeatmapPoints} />
            </div>
         </Box>
         <Box title={`تمركز ${tn(d.awayTeam)}`}>
            <div className="w-full flex justify-center">
               <TeamHeatmap teamName="" isHome={false} points={awayHeatmapPoints} />
            </div>
         </Box>
      </div>
    </div>
  ); 
}

function Analysis({ d }: { d: MatchPageData }) { 
  const h = historyOf(d); 
  return (
    <div className="space-y-4">
      <InteractiveShotmap matchId={d.id} homeTeamName={tn(d.homeTeam)} awayTeamName={tn(d.awayTeam)} shots={d.advanced?.shotmap} homeTeamId={d.homeTeam.id} />
      
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
  return (
    <Box title="المقالات والأخبار">
      {d.relatedArticles.map((a) => (
        <a key={a.id} href={a.href} className="block rounded-xl border border-white/10 p-3 mb-2 hover:bg-white/5 transition">
          {a.title}
        </a>
      ))}
    </Box>
  ); 
}

export default function ProfessionalMatchTabsPageRich({ data }: { data: MatchPageData }) { 
  const [tab, setTab] = useState<Tab>('overview'); 
  const events = useMemo(() => data.events || [], [data.events]); 
  
  const [heatmapModal, setHeatmapModal] = useState<{isOpen: boolean, name: string, img?: string|null, isHome: boolean, points: HeatmapPoint[]}>({ isOpen: false, name: '', isHome: true, points: [] });

  const openHeatmap = (name: string, img: string|null|undefined, isHome: boolean, points: HeatmapPoint[]) => {
     setHeatmapModal({ isOpen: true, name, img, isHome, points });
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
      />
    </main>
  ); 
}
