'use client';

import { useRef } from 'react';
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
  isHalfTime?: boolean;
  minute?: number | null;
  liveLabel?: string | null;
  groupPhase?: string | null;
  group?: string | null;
  stage?: string | null;
};

type Props = {
  matches: TickerMatch[] | unknown[];
};

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');

function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function groupNumberLabel(match: TickerMatch) {
  const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase();
  const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || raw.match(/المجموعة\s*([A-L])/i)?.[1]?.toUpperCase() || (/^[A-L]$/.test(raw) ? raw : '');
  if (letter) return `المجموعة ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`;
  const number = raw.match(/(?:GROUP|المجموعة)?[_\s-]*(\d{1,2})/)?.[1];
  if (number) return `المجموعة ${formatCount(Number(number))}`;
  return 'كأس العالم';
}

function matchStatus(match: TickerMatch) {
  return normalizeStatus(match.displayStatus || match.status);
}

function isHalfTime(match: TickerMatch) {
  return matchStatus(match) === 'HT' || Boolean(match.isHalfTime);
}

function isLive(match: TickerMatch) {
  const status = matchStatus(match);
  return ['IN_PLAY', 'LIVE', 'HT'].includes(status) || Boolean(match.isLiveNow);
}

function isFinished(match: TickerMatch) {
  return ['FINISHED', 'FT', 'AET', 'PEN'].includes(matchStatus(match));
}

function liveStatusText(match: TickerMatch) {
  if (isHalfTime(match)) return 'استراحة';
  const label = String(match.liveLabel || '').trim();
  if (label && !/^الدقيقة\s*\d+$/i.test(label) && label !== 'مباشر الآن') return label;
  if (typeof match.minute === 'number' && Number.isFinite(match.minute) && match.minute > 0) return `${Math.floor(match.minute)}′`;
  return 'جارية';
}

export default function HomeLiveMatchTicker({ matches = [] }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const safeMatches = Array.isArray(matches) ? (matches as TickerMatch[]) : [];

  if (safeMatches.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden py-1">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-black/80 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-black/80 to-transparent" />

      <div
        ref={scrollContainerRef}
        className="scrollbar-none flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-2 active:cursor-grabbing"
      >
        {safeMatches.map((match) => {
          const live = isLive(match);
          const halfTime = isHalfTime(match);
          const finished = isFinished(match);
          const homeFlag = match.homeTeam?.image || getTeamFlagUrl({ code: match.homeTeam?.code, name: match.homeTeam?.name }, 40);
          const awayFlag = match.awayTeam?.image || getTeamFlagUrl({ code: match.awayTeam?.code, name: match.awayTeam?.name }, 40);
          const matchHref = match.id ? `/matches/${match.id}` : '/matches';

          return (
            <Link key={match.id} href={matchHref} className="flex-shrink-0 snap-center">
              <motion.div
                whileHover={{ y: -2 }}
                className={`relative flex w-60 items-center justify-between gap-4 rounded-xl border bg-black/40 p-3 backdrop-blur-md transition-all duration-300 ${
                  live
                    ? 'border-[#00FF88]/40 shadow-[0_0_12px_rgba(0,255,136,0.06)]'
                    : 'border-white/10 hover:border-[#0FF0FC]/30'
                }`}
              >
                <div className="flex min-w-[3.8rem] flex-col gap-1.5">
                  {live ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${halfTime ? 'text-[#FFD700]' : 'text-[#00FF88]'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${halfTime ? 'bg-[#FFD700]' : 'animate-pulse bg-[#00FF88]'}`} />
                      {liveStatusText(match)}
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
                  <span className="max-w-[4.2rem] truncate text-[9px] font-bold text-gray-400">
                    {groupNumberLabel(match)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <img src={homeFlag || undefined} alt="" className="h-4 w-4 rounded-sm object-cover" />
                      <span className="truncate text-xs font-bold text-white">{match.homeTeam?.name}</span>
                    </div>
                    {(live || finished) && (
                      <span className="text-xs font-black text-white">{match.homeScore}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <img src={awayFlag || undefined} alt="" className="h-4 w-4 rounded-sm object-cover" />
                      <span className="truncate text-xs font-bold text-white">{match.awayTeam?.name}</span>
                    </div>
                    {(live || finished) && (
                      <span className="text-xs font-black text-white">{match.awayScore}</span>
                    )}
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
