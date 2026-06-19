'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string | number | null; name?: string | null; code?: string | null; image?: string | null };

type TickerMatch = {
  id?: string | number | null;
  animationMatchId?: string | number | null;
  matchDate?: string | Date | null;
  status?: string | null;
  displayStatus?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  isLiveNow?: boolean;
  isHalfTime?: boolean;
  isLikelyLiveByTime?: boolean;
  isStaleAutoFinished?: boolean;
  minute?: number | null;
  groupPhase?: string | null;
  group?: string | null;
  stage?: string | null;
};

type Props = { matches: TickerMatch[] | unknown[] };

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');
const TICKER_REFRESH_MS = 15_000;

function normalizeStatus(status?: string | null) { return String(status || '').toUpperCase(); }
function formatCount(value: number) { return new Intl.NumberFormat('ar-EG').format(value); }
function groupNumberLabel(match: TickerMatch) {
  const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase();
  const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || raw.match(/المجموعة\s*([A-L])/i)?.[1]?.toUpperCase() || (/^[A-L]$/.test(raw) ? raw : '');
  if (letter) return `المجموعة ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`;
  const number = raw.match(/(?:GROUP|المجموعة)?[_\s-]*(\d{1,2})/)?.[1];
  if (number) return `المجموعة ${formatCount(Number(number))}`;
  return 'كأس العالم';
}
function matchStatus(match: TickerMatch) { return normalizeStatus(match.displayStatus || match.status); }
function isHalfTime(match: TickerMatch) { return ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'].includes(matchStatus(match)) || Boolean(match.isHalfTime); }
function isFinished(match: TickerMatch) { return ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'].includes(matchStatus(match)) || Boolean(match.isStaleAutoFinished); }
function isLive(match: TickerMatch) { if (isFinished(match)) return false; const status = matchStatus(match); return ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'].includes(status) || Boolean(match.isLiveNow) || isHalfTime(match); }
function minuteLabel(match: TickerMatch) { const minute = Number(match.minute); return Number.isFinite(minute) && minute > 0 ? formatCount(Math.floor(minute)) : null; }
function liveStatusText(match: TickerMatch) {
  if (isHalfTime(match)) return 'استراحة';
  const minute = minuteLabel(match);
  const status = matchStatus(match);
  if (status === '1H') return minute ? `الشوط الأول — د${minute}` : 'الشوط الأول';
  if (status === '2H') return minute ? `الشوط الثاني — د${minute}` : 'الشوط الثاني';
  if (status === 'ET') return minute ? `وقت إضافي — د${minute}` : 'وقت إضافي';
  if (status === 'P' || status === 'PEN') return 'ركلات الترجيح';
  return minute ? `جارية الآن — د${minute}` : 'جارية';
}
function matchKey(match?: TickerMatch | null) { return String(match?.id || match?.animationMatchId || `${match?.homeTeam?.name || ''}-${match?.awayTeam?.name || ''}-${match?.matchDate || ''}`); }
function mergeById(baseMatches: TickerMatch[], updates: TickerMatch[]) {
  const updateMap = new Map<string, TickerMatch>();
  for (const update of updates) {
    if (update.id) updateMap.set(`id:${update.id}`, update);
    if (update.animationMatchId) updateMap.set(`animation:${update.animationMatchId}`, update);
  }
  const merged = baseMatches.map((match) => {
    const update = (match.id && updateMap.get(`id:${match.id}`)) || (match.animationMatchId && updateMap.get(`animation:${match.animationMatchId}`));
    return update ? { ...match, ...update } : match;
  });
  for (const update of updates) if (!merged.some((match) => matchKey(match) === matchKey(update))) merged.unshift(update);
  return merged;
}

export default function HomeLiveMatchTicker({ matches = [] }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const safeMatches = Array.isArray(matches) ? (matches as TickerMatch[]) : [];
  const [apiMatches, setApiMatches] = useState<TickerMatch[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshTickerState() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/matches/live-card', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data?.matches) ? data.matches : Array.isArray(data) ? data : [];
        if (!cancelled) setApiMatches(list);
      } catch {}
    }
    refreshTickerState();
    const timer = window.setInterval(refreshTickerState, TICKER_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const displayMatches = useMemo(() => mergeById(safeMatches, apiMatches).slice(0, 15), [safeMatches, apiMatches]);
  if (displayMatches.length === 0) return null;

  return (
    <div className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-hidden py-1 sm:mx-0 sm:w-full">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-6 bg-gradient-to-r from-[#04110D] to-transparent sm:w-8" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-6 bg-gradient-to-l from-[#04110D] to-transparent sm:w-8" />
      <div ref={scrollContainerRef} className="scrollbar-none flex cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 py-2 active:cursor-grabbing sm:gap-3 sm:px-4">
        {displayMatches.map((match) => {
          const finished = isFinished(match);
          const live = isLive(match);
          const halfTime = isHalfTime(match) && !finished;
          const homeFlag = match.homeTeam?.image || getTeamFlagUrl({ code: match.homeTeam?.code, name: match.homeTeam?.name }, 40);
          const awayFlag = match.awayTeam?.image || getTeamFlagUrl({ code: match.awayTeam?.code, name: match.awayTeam?.name }, 40);
          const matchHref = match.id ? `/matches/${match.id}` : '/matches';
          return (
            <Link key={matchKey(match)} href={matchHref} className="shrink-0 snap-center">
              <motion.div whileHover={{ y: -2 }} className={`relative flex min-h-[104px] w-[min(17.25rem,calc(100vw-2rem))] items-center justify-between gap-3 rounded-2xl border bg-black/45 p-3 backdrop-blur-md transition-all duration-300 sm:w-64 ${live ? 'border-[#00FF88]/40 shadow-[0_0_12px_rgba(0,255,136,0.06)]' : 'border-white/10 hover:border-[#0FF0FC]/30'}`}>
                <div className="flex min-w-[4.7rem] flex-col gap-1.5">
                  {live ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black tracking-wide ${halfTime ? 'text-[#FFD700]' : 'text-[#00FF88]'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${halfTime ? 'bg-[#FFD700]' : 'animate-pulse bg-[#00FF88]'}`} />
                      {liveStatusText(match)}
                    </span>
                  ) : finished ? <span className="text-[10px] font-bold text-gray-500">انتهت</span> : (
                    <span className="text-[10px] font-bold text-[#0FF0FC]">{match.matchDate ? new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(match.matchDate)) : 'قريباً'}</span>
                  )}
                  <span className="max-w-[5.1rem] truncate text-[9px] font-bold text-gray-400">{groupNumberLabel(match)}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5"><img src={homeFlag || undefined} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" /><span className="truncate text-[12px] font-bold text-white">{match.homeTeam?.name}</span></div>
                    {(live || finished) && <span className="text-sm font-black text-white">{match.homeScore}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5"><img src={awayFlag || undefined} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" /><span className="truncate text-[12px] font-bold text-white">{match.awayTeam?.name}</span></div>
                    {(live || finished) && <span className="text-sm font-black text-white">{match.awayScore}</span>}
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
