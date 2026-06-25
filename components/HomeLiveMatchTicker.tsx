'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

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
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];

function normalizeStatus(status?: string | null) { return String(status || '').toUpperCase(); }
function formatCount(value: number) { return new Intl.NumberFormat('ar-EG').format(value); }
function teamName(team?: Team | null) { return team ? getArabicTeamName(team.code, team.name) : 'منتخب'; }
function teamFlag(team?: Team | null) { const name = teamName(team); return getTeamFlagUrl({ code: team?.code, name, image: null }, 40) || team?.image || null; }
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
function isFinished(match: TickerMatch) { return FINISHED_STATUSES.includes(matchStatus(match)) || Boolean(match.isStaleAutoFinished); }
function isLive(match: TickerMatch) { if (isFinished(match)) return false; const status = matchStatus(match); return ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'].includes(status) || Boolean(match.isLiveNow) || isHalfTime(match); }
function liveStatusText(match: TickerMatch) {
  if (isHalfTime(match)) return 'استراحة';
  const status = matchStatus(match);
  if (status === '1H') return 'الشوط الأول';
  if (status === '2H') return 'الشوط الثاني';
  if (status === 'ET') return 'وقت إضافي';
  if (status === 'P' || status === 'PEN') return 'ركلات الترجيح';
  return 'جارية الآن';
}
function matchKey(match?: TickerMatch | null) { return String(match?.id || match?.animationMatchId || `${teamName(match?.homeTeam)}-${teamName(match?.awayTeam)}-${match?.matchDate || ''}`); }
function timeLabel(match: TickerMatch, mounted: boolean) {
  if (!match.matchDate) return 'قريبًا';
  if (!mounted) return 'قريبًا';
  const date = new Date(match.matchDate);
  if (!Number.isFinite(date.getTime())) return 'قريبًا';
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date);
}
function statusBadge(match: TickerMatch, mounted: boolean) {
  if (isFinished(match)) return 'انتهت';
  if (isLive(match)) return liveStatusText(match);
  return timeLabel(match, mounted);
}

export default function HomeLiveMatchTicker({ matches = [] }: Props) {
  const [mounted, setMounted] = useState(false);
  const safeMatches = Array.isArray(matches) ? (matches as TickerMatch[]) : [];
  const [activeKey, setActiveKey] = useState<string>('');

  useEffect(() => { setMounted(true); }, []);

  const displayMatches = useMemo(() => safeMatches.slice(0, 8), [safeMatches]);

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
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(90deg, rgba(15,240,252,.13), rgba(255,215,0,.10), rgba(0,255,136,.10), rgba(15,240,252,.13))', backgroundSize: '240% 240%' }} />
      <div className="relative flex gap-2 overflow-x-auto pb-1 scrollbar-none" dir="rtl">
        {displayMatches.map((match) => {
          const key = matchKey(match);
          const active = key === activeKey;
          const finished = isFinished(match);
          const live = isLive(match);
          const homeFlag = teamFlag(match.homeTeam);
          const awayFlag = teamFlag(match.awayTeam);
          const href = match.id ? `/match-center/${match.id}` : '/matches';
          return (
            <Link key={key} href={href} onMouseEnter={() => setActiveKey(key)} className="shrink-0">
              <div className={`relative flex h-[90px] w-[270px] items-center gap-3 rounded-2xl border px-3 transition hover:-translate-y-1 ${active ? 'border-[#FFD700]/45 bg-black/55 shadow-[0_0_24px_rgba(255,215,0,.10)]' : 'border-white/10 bg-black/30 hover:border-[#0FF0FC]/35'} ${live ? 'ring-1 ring-[#00FF88]/20' : ''}`}>
                {active ? <span className="absolute inset-x-5 -top-px h-px bg-gradient-to-r from-transparent via-[#FFD700] to-transparent" /> : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-[#00FF88]' : finished ? 'bg-gray-500' : 'bg-[#0FF0FC]'}`} /><span suppressHydrationWarning className={`text-[10px] font-black ${live ? 'text-[#00FF88]' : finished ? 'text-gray-400' : 'text-[#0FF0FC]'}`}>{statusBadge(match, mounted)}</span></div>
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-white"><span className="flex min-w-0 items-center gap-1.5">{homeFlag ? <img src={homeFlag} alt={`علم ${teamName(match.homeTeam)}`} className="h-5 w-7 rounded object-cover" /> : null}<span className="team-name-full">{teamName(match.homeTeam)}</span></span>{(live || finished) ? <b className="text-[#FFD700]">{match.homeScore ?? 0}</b> : null}</div>
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-white"><span className="flex min-w-0 items-center gap-1.5">{awayFlag ? <img src={awayFlag} alt={`علم ${teamName(match.awayTeam)}`} className="h-5 w-7 rounded object-cover" /> : null}<span className="team-name-full">{teamName(match.awayTeam)}</span></span>{(live || finished) ? <b className="text-[#FFD700]">{match.awayScore ?? 0}</b> : null}</div>
                </div>
                <span className="hidden rounded-xl border border-white/10 bg-white/[.05] px-2 py-1 text-[9px] font-black text-gray-300 sm:block">{groupNumberLabel(match)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
