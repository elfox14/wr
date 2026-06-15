'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
};

type TickerMatch = {
  id?: string | number | null;
  matchDate?: string | Date | null;
  status?: string | null;
  displayStatus?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  isLiveNow?: boolean;
  minute?: number | null;
  groupPhase?: string | null;
  events?: any[] | null;
};

type Props = {
  matches: TickerMatch[] | unknown[];
};

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function isLive(match: TickerMatch) {
  const status = normalizeStatus(match.displayStatus || match.status);
  return ['IN_PLAY', 'LIVE', 'HT'].includes(status) || Boolean(match.isLiveNow);
}

function isFinished(match: TickerMatch) {
  const status = normalizeStatus(match.displayStatus || match.status);
  return ['FINISHED', 'FT', 'AET', 'PEN'].includes(status);
}

function TickerGoalscorers({ match }: { match: TickerMatch }) {
  const events = match.events || [];
  const goalEvents = events.filter(
    (e: any) => e.type === 'goal' || e.type === 'goal_inferred'
  );
  if (goalEvents.length === 0) return null;

  const homeGoals = goalEvents.filter((e: any) => {
    if (e.teamId) return String(e.teamId) === String(match.homeTeam?.id);
    if (e.teamName) return e.teamName === match.homeTeam?.name;
    return match.homeTeam?.name && e.detail?.includes(match.homeTeam.name);
  });

  const awayGoals = goalEvents.filter((e: any) => {
    if (e.teamId) return String(e.teamId) === String(match.awayTeam?.id);
    if (e.teamName) return e.teamName === match.awayTeam?.name;
    return match.awayTeam?.name && e.detail?.includes(match.awayTeam.name);
  });

  const formatShort = (e: any) => {
    const name = e.playerName || 'هدف';
    const minStr = e.minute ? ` ${e.minute}'` : '';
    return `${name}${minStr}`;
  };

  const homeText = homeGoals.map(formatShort).join(', ');
  const awayText = awayGoals.map(formatShort).join(', ');

  if (!homeText && !awayText) return null;

  return (
    <div className="mt-2 border-t border-white/5 pt-1.5 text-[9px] text-gray-400 space-y-0.5 w-full">
      {homeText && (
        <div className="truncate text-right" title={homeText}>
          ⚽ {homeText}
        </div>
      )}
      {awayText && (
        <div className="truncate text-left" title={awayText}>
          ⚽ {awayText}
        </div>
      )}
    </div>
  );
}

export default function HomeLiveMatchTicker({ matches = [] }: Props) {
  const [now, setNow] = useState(() => new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const safeMatches = Array.isArray(matches) ? (matches as TickerMatch[]) : [];

  if (safeMatches.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden py-1">
      {/* Glow effects */}
      <div className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-black/80 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />

      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto px-4 py-2 scrollbar-none snap-x snap-mandatory cursor-grab active:cursor-grabbing"
      >
        {safeMatches.map((match) => {
          const live = isLive(match);
          const finished = isFinished(match);
          const homeFlag = match.homeTeam?.image || getTeamFlagUrl({ code: match.homeTeam?.code, name: match.homeTeam?.name }, 40);
          const awayFlag = match.awayTeam?.image || getTeamFlagUrl({ code: match.awayTeam?.code, name: match.awayTeam?.name }, 40);
          const matchHref = match.id ? `/matches/${match.id}` : '/matches';

          return (
            <Link 
              key={match.id} 
              href={matchHref}
              className="flex-shrink-0 snap-center"
            >
              <motion.div 
                whileHover={{ y: -2 }}
                className={`relative flex flex-col w-60 rounded-xl border p-3 bg-black/40 backdrop-blur-md transition-all duration-300 ${
                  live 
                    ? 'border-[#00FF88]/40 shadow-[0_0_12px_rgba(0,255,136,0.06)]' 
                    : 'border-white/10 hover:border-[#0FF0FC]/30'
                }`}
              >
                <div className="flex items-center justify-between gap-4 w-full">
                  {/* Status bar */}
                  <div className="flex flex-col gap-1.5 min-w-[3.5rem]">
                    {live ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#00FF88] uppercase tracking-wide">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] animate-pulse" />
                        مباشر {match.minute ? `${match.minute}'` : ''}
                      </span>
                    ) : finished ? (
                      <span className="text-[10px] font-bold text-gray-500">انتهت</span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#0FF0FC]">
                        {match.matchDate ? new Intl.DateTimeFormat('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(match.matchDate)) : 'قريباً'}
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-gray-400 truncate max-w-[4rem]">
                      {match.groupPhase ? match.groupPhase.replace('Group ', 'المجموعة ') : 'كأس العالم'}
                    </span>
                  </div>

                  {/* Teams and Scores */}
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img src={homeFlag || undefined} alt="" className="h-4 w-4 rounded-sm object-cover" />
                        <span className="text-xs font-bold text-white truncate">{match.homeTeam?.name}</span>
                      </div>
                      {(live || finished) && (
                        <span className="text-xs font-black text-white">{match.homeScore}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img src={awayFlag || undefined} alt="" className="h-4 w-4 rounded-sm object-cover" />
                        <span className="text-xs font-bold text-white truncate">{match.awayTeam?.name}</span>
                      </div>
                      {(live || finished) && (
                        <span className="text-xs font-black text-white">{match.awayScore}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Goalscorers */}
                <TickerGoalscorers match={match} />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
