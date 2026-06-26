'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  liveLabel?: string | null;
  groupPhase?: string | null;
  group?: string | null;
  stage?: string | null;
};

type Props = { matches: TickerMatch[] | unknown[] };

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];
const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'PEN', 'IN_PLAY', 'LIVE'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function normalizeStatus(status?: string | null) { return String(status || '').toUpperCase(); }
function formatCount(value: number) { return new Intl.NumberFormat('ar-EG').format(value); }
function formatScore(value?: number | null) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '0'; }
function teamName(team?: Team | null) { return team ? getArabicTeamName(team.code, team.name) : 'منتخب'; }
function teamCode(team?: Team | null) { return team?.code || team?.name?.slice(0, 3) || '---'; }
function teamFlag(team?: Team | null) { const name = teamName(team); return getTeamFlagUrl({ code: team?.code, name, image: null }, 64) || team?.image || null; }
function matchStatus(match: TickerMatch) { return normalizeStatus(match.displayStatus || match.status); }
function isHalfTime(match: TickerMatch) { return ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'].includes(matchStatus(match)) || Boolean(match.isHalfTime); }
function isFinished(match: TickerMatch) { return FINISHED_STATUSES.includes(matchStatus(match)) || Boolean(match.isStaleAutoFinished); }
function isScheduled(match: TickerMatch) { return !isFinished(match) && SCHEDULED_STATUSES.includes(matchStatus(match)); }
function isLive(match: TickerMatch) { return !isFinished(match) && (LIVE_STATUSES.includes(matchStatus(match)) || Boolean(match.isLiveNow) || Boolean(match.isLikelyLiveByTime) || isHalfTime(match)); }
function matchKey(match?: TickerMatch | null) { return String(match?.id || match?.animationMatchId || `${teamName(match?.homeTeam)}-${teamName(match?.awayTeam)}-${match?.matchDate || ''}`); }
function matchTime(match: TickerMatch) { const date = match.matchDate ? new Date(match.matchDate) : null; return date && Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER; }
function getCenterHref(match: TickerMatch) { return match.id ? `/live-animation/${encodeURIComponent(String(match.id))}` : '/animation-live'; }
function getMatchHref(match: TickerMatch) { return match.id ? `/matches/${encodeURIComponent(String(match.id))}` : '/matches'; }

function groupNumberLabel(match: TickerMatch) {
  const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase();
  const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || raw.match(/المجموعة\s*([A-L])/i)?.[1]?.toUpperCase() || (/^[A-L]$/.test(raw) ? raw : '');
  if (letter) return `المجموعة ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`;
  const number = raw.match(/(?:GROUP|المجموعة)?[_\s-]*(\d{1,2})/)?.[1];
  if (number) return `المجموعة ${formatCount(Number(number))}`;
  if (raw.includes('ROUND') || raw.includes('32')) return 'دور الـ٣٢';
  if (raw.includes('16')) return 'دور الـ١٦';
  if (raw.includes('QUARTER')) return 'ربع النهائي';
  if (raw.includes('SEMI')) return 'نصف النهائي';
  if (raw.includes('FINAL')) return 'النهائي';
  return 'كأس العالم';
}

function liveStatusText(match: TickerMatch) {
  if (match.liveLabel) return match.liveLabel;
  if (isHalfTime(match)) return 'استراحة';
  const current = matchStatus(match);
  if (current === '1H') return 'الشوط الأول';
  if (current === '2H') return 'الشوط الثاني';
  if (current === 'ET') return 'وقت إضافي';
  const minute = Number(match.minute);
  if (Number.isFinite(minute) && minute > 0) return `د ${formatCount(Math.floor(minute))}`;
  return 'جارية الآن';
}

function statusBadge(match: TickerMatch, mounted: boolean) {
  if (isFinished(match)) return 'انتهت';
  if (isLive(match)) return liveStatusText(match);
  if (!match.matchDate || !mounted) return 'قريبًا';
  const date = new Date(match.matchDate);
  if (!Number.isFinite(date.getTime())) return 'قريبًا';
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function dateLabel(match: TickerMatch, mounted: boolean) {
  if (!match.matchDate || !mounted) return '';
  const date = new Date(match.matchDate);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(date);
}

function TeamLine({ team, score, showScore }: { team?: Team | null; score?: number | null; showScore: boolean }) {
  const flag = teamFlag(team);
  const name = teamName(team);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_32px] items-center gap-2 text-right">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/35 sm:h-6 sm:w-8">
          {flag ? <img src={flag} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-[7px] text-[#FFD700]">{teamCode(team)}</b>}
        </span>
        <span className="team-name-full min-w-0 truncate text-[11px] font-black leading-4 text-white sm:text-xs">{name}</span>
      </div>
      {showScore ? <b className="rounded-lg border border-[#FFD700]/25 bg-[#FFD700]/10 px-1.5 py-1 text-center text-sm font-black leading-none text-[#FFD700]" dir="ltr">{formatScore(score)}</b> : <span className="text-center text-[10px] font-black text-gray-600">—</span>}
    </div>
  );
}

export default function HomeLiveMatchTicker({ matches = [] }: Props) {
  const [mounted, setMounted] = useState(false);
  const safeMatches = Array.isArray(matches) ? (matches as TickerMatch[]) : [];
  const [activeKey, setActiveKey] = useState<string>('');
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { setMounted(true); }, []);

  const displayMatches = useMemo(() => [...safeMatches].sort((a, b) => {
    const liveDelta = Number(isLive(b)) - Number(isLive(a));
    if (liveDelta) return liveDelta;
    const finishedDelta = Number(isFinished(a)) - Number(isFinished(b));
    if (finishedDelta) return finishedDelta;
    return matchTime(a) - matchTime(b);
  }).slice(0, 10), [safeMatches]);

  const liveCount = displayMatches.filter(isLive).length;
  const finishedCount = displayMatches.filter(isFinished).length;

  useEffect(() => {
    if (!displayMatches.length) return;
    if (!activeKey || !displayMatches.some((match) => matchKey(match) === activeKey)) setActiveKey(matchKey(displayMatches[0]));
  }, [displayMatches, activeKey]);

  useEffect(() => {
    if (displayMatches.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveKey((current) => {
        const index = Math.max(0, displayMatches.findIndex((match) => matchKey(match) === current));
        return matchKey(displayMatches[(index + 1) % displayMatches.length]);
      });
    }, 5500);
    return () => window.clearInterval(timer);
  }, [displayMatches]);

  useEffect(() => {
    const card = activeKey ? cardRefs.current[activeKey] : null;
    const strip = stripRef.current;
    if (!card || !strip) return;
    const cardLeft = card.offsetLeft;
    const targetLeft = Math.max(0, cardLeft - (strip.clientWidth - card.clientWidth) / 2);
    strip.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [activeKey]);

  if (!displayMatches.length) return null;

  return (
    <section className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,.12),transparent_32%),linear-gradient(135deg,rgba(3,17,13,.96),rgba(5,7,10,.98))] p-2.5 text-white shadow-[0_18px_50px_rgba(0,0,0,.30)] backdrop-blur-xl sm:rounded-[1.8rem] sm:p-3" aria-label="شريط مباريات كأس العالم">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(90deg, rgba(15,240,252,.10), rgba(255,215,0,.08), rgba(0,255,136,.08), rgba(15,240,252,.10))', backgroundSize: '240% 240%' }} />
      <div className="relative mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-sm">⚽</span><div><h2 className="text-sm font-black leading-none text-white">شريط المباريات</h2><p className="mt-1 text-[9px] font-bold text-gray-500">مباشر، نتائج، والقادم</p></div></div>
        <div className="flex items-center gap-1.5 text-[9px] font-black">
          {liveCount ? <span className="rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-2 py-1 text-[#00FF88]"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00FF88]" /> مباشر {formatCount(liveCount)}</span> : null}
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-gray-400">المعروض {formatCount(displayMatches.length)}</span>
          {finishedCount ? <span className="hidden rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-gray-400 sm:inline-flex">انتهت {formatCount(finishedCount)}</span> : null}
        </div>
      </div>
      <div ref={stripRef} className="relative flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 mobile-scrollbar" dir="rtl">
        {displayMatches.map((match) => {
          const key = matchKey(match);
          const active = key === activeKey;
          const live = isLive(match);
          const finished = isFinished(match);
          const scheduled = isScheduled(match);
          const showScore = live || finished;
          const tone = live ? 'live' : finished ? 'finished' : 'upcoming';
          const date = dateLabel(match, mounted);
          return (
            <article key={key} ref={(node) => { cardRefs.current[key] = node; }} onMouseEnter={() => setActiveKey(key)} className={`relative h-[132px] w-[254px] shrink-0 snap-center overflow-hidden rounded-2xl border px-3 py-2.5 transition duration-200 hover:-translate-y-0.5 sm:h-[138px] sm:w-[292px] ${active ? 'border-[#FFD700]/45 bg-black/60 shadow-[0_0_26px_rgba(255,215,0,.12)]' : 'border-white/10 bg-black/28 hover:border-[#0FF0FC]/35'} ${live ? 'ring-1 ring-[#00FF88]/25' : ''}`}>
              {active ? <span className="absolute inset-x-5 -top-px h-px bg-gradient-to-r from-transparent via-[#FFD700] to-transparent" /> : null}
              {live ? <span className="absolute -left-5 -top-5 h-16 w-16 rounded-full bg-[#00FF88]/12 blur-2xl" /> : null}
              <div className="mb-2 flex items-center justify-between gap-2">
                <span suppressHydrationWarning className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-black ${tone === 'live' ? 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' : tone === 'finished' ? 'border-white/10 bg-white/[0.06] text-gray-300' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}><span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-[#00FF88]' : finished ? 'bg-gray-500' : 'bg-[#0FF0FC]'}`} />{statusBadge(match, mounted)}</span>
                <span className="truncate rounded-full border border-white/10 bg-white/[.05] px-2 py-1 text-[8px] font-black text-gray-400">{groupNumberLabel(match)}</span>
              </div>
              <div className="grid gap-1.5"><TeamLine team={match.homeTeam} score={match.homeScore} showScore={showScore} /><TeamLine team={match.awayTeam} score={match.awayScore} showScore={showScore} /></div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[9px] font-bold text-gray-500">
                <span suppressHydrationWarning>{date || (scheduled ? 'موعد المباراة' : 'تفاصيل المباراة')}</span>
                <div className="grid grid-cols-2 gap-1.5"><Link href={getCenterHref(match)} className="mobile-tap rounded-lg bg-[#0FF0FC] px-2 py-1 text-center text-[8px] font-black text-black transition hover:bg-[#4AFAFF]">الملعب</Link><Link href={getMatchHref(match)} className="mobile-tap rounded-lg border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-1 text-center text-[8px] font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">المباراة</Link></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
