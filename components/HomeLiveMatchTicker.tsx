'use client';

import { useEffect, useMemo, useState } from 'react';
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
function minuteLabel(match: TickerMatch) { return null; }
function liveStatusText(match: TickerMatch) {
  if (isHalfTime(match)) return 'استراحة';
  const status = matchStatus(match);
  if (status === '1H') return 'الشوط الأول';
  if (status === '2H') return 'الشوط الثاني';
  if (status === 'ET') return 'وقت إضافي';
  if (status === 'P' || status === 'PEN') return 'ركلات الترجيح';
  return 'جارية الآن';
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
function timeLabel(match: TickerMatch) {
  if (!match.matchDate) return 'قريبًا';
  const date = new Date(match.matchDate);
  if (!Number.isFinite(date.getTime())) return 'قريبًا';
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date);
}
function statusBadge(match: TickerMatch) {
  if (isFinished(match)) return 'انتهت';
  if (isLive(match)) return liveStatusText(match);
  return timeLabel(match);
}

export default function HomeLiveMatchTicker({ matches = [] }: Props) {
  const safeMatches = Array.isArray(matches) ? (matches as TickerMatch[]) : [];
  const [apiMatches, setApiMatches] = useState<TickerMatch[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');

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

  const displayMatches = useMemo(() => mergeById(safeMatches, apiMatches).slice(0, 8), [safeMatches, apiMatches]);

  useEffect(() => {
    if (!displayMatches.length) return;
    if (!activeKey) setActiveKey(matchKey(displayMatches[0]));
    const timer = window.setInterval(() => {
      setActiveKey((current) => {
        const index = Math.max(0, displayMatches.findIndex((match) => matchKey(match) === current));
        return matchKey(displayMatches[(index + 1) % displayMatches.length]);
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [displayMatches, activeKey]);

  if (displayMatches.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#03110d]/80 p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-xl">
      <motion.div className="pointer-events-none absolute inset-0 opacity-60" animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} style={{ backgroundImage: 'linear-gradient(90deg, rgba(15,240,252,.13), rgba(255,215,0,.10), rgba(0,255,136,.10), rgba(15,240,252,.13))', backgroundSize: '240% 240%' }} />
      <div className="relative flex gap-2 overflow-x-auto pb-1 scrollbar-none" dir="rtl">
        {displayMatches.map((match) => {
          const key = matchKey(match);
          const active = key === activeKey;
          const finished = isFinished(match);
          const live = isLive(match);
          const homeFlag = match.homeTeam?.image || getTeamFlagUrl({ code: match.homeTeam?.code, name: match.homeTeam?.name }, 40);
          const awayFlag = match.awayTeam?.image || getTeamFlagUrl({ code: match.awayTeam?.code, name: match.awayTeam?.name }, 40);
          const href = match.id ? `/match-center/${match.id}` : '/matches';
          return (
            <Link key={key} href={href} onMouseEnter={() => setActiveKey(key)} className="shrink-0">
              <motion.div layout whileHover={{ y: -3, scale: 1.01 }} className={`relative flex h-[84px] w-[248px] items-center gap-3 rounded-2xl border px-3 transition ${active ? 'border-[#FFD700]/45 bg-black/55 shadow-[0_0_24px_rgba(255,215,0,.10)]' : 'border-white/10 bg-black/30 hover:border-[#0FF0FC]/35'} ${live ? 'ring-1 ring-[#00FF88]/20' : ''}`}>
                {active ? <motion.span layoutId="smartTickerGlow" className="absolute inset-x-5 -top-px h-px bg-gradient-to-r from-transparent via-[#FFD700] to-transparent" /> : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-[#00FF88]' : finished ? 'bg-gray-500' : 'bg-[#0FF0FC]'}`} />
                    <span suppressHydrationWarning className={`truncate text-[10px] font-black ${live ? 'text-[#00FF88]' : finished ? 'text-gray-400' : 'text-[#0FF0FC]'}`}>{statusBadge(match)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-white">
                    <span className="flex min-w-0 items-center gap-1.5"><img src={homeFlag || undefined} alt="" className="h-5 w-5 rounded-md object-cover" /><span className="truncate">{match.homeTeam?.name || 'Home'}</span></span>
                    {(live || finished) ? <b className="text-[#FFD700]">{match.homeScore ?? 0}</b> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-white">
                    <span className="flex min-w-0 items-center gap-1.5"><img src={awayFlag || undefined} alt="" className="h-5 w-5 rounded-md object-cover" /><span className="truncate">{match.awayTeam?.name || 'Away'}</span></span>
                    {(live || finished) ? <b className="text-[#FFD700]">{match.awayScore ?? 0}</b> : null}
                  </div>
                </div>
                <span className="hidden rounded-xl border border-white/10 bg-white/[.05] px-2 py-1 text-[9px] font-black text-gray-300 sm:block">{groupNumberLabel(match)}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
