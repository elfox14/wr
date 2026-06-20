'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeLastUpdatedStrip from '@/components/home/HomeLastUpdatedStrip';

type Team = { id?: string | number | null; name?: string | null; code?: string | null };
type HomeMatch = {
  id?: string | number | null;
  animationMatchId?: string | number | null;
  matchDate?: string | Date | null;
  status?: string | null;
  displayStatus?: string | null;
  stage?: string | null;
  group?: string | null;
  groupPhase?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  isLiveNow?: boolean;
  isHalfTime?: boolean;
  isLikelyLiveByTime?: boolean;
  isStaleAutoFinished?: boolean;
  minute?: number | null;
};

type Props = { matches?: HomeMatch[] | unknown[]; updatedAt?: Date | string | null };

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'];
const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');
const LABELS = {
  live: '\u062c\u0627\u0631\u064a\u0629 \u0627\u0644\u0622\u0646',
  upcoming: '\u0642\u0627\u062f\u0645\u0629 \u0627\u0644\u064a\u0648\u0645',
  ended: '\u0627\u0646\u062a\u0647\u062a',
  kicker: '\u0645\u062e\u062a\u0635\u0631 \u0633\u0631\u064a\u0639',
  title: '\u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0627\u0644\u064a\u0648\u0645',
  emptySection: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062a\u0635\u0646\u064a\u0641.',
  emptyDay: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0645\u0633\u062c\u0644\u0629 \u0644\u0644\u064a\u0648\u0645 \u062d\u062a\u0649 \u0627\u0644\u0622\u0646.',
  waiting: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0628\u062f\u0627\u064a\u0629',
  firstHalf: '\u0627\u0644\u0634\u0648\u0637 \u0627\u0644\u0623\u0648\u0644',
  secondHalf: '\u0627\u0644\u0634\u0648\u0637 \u0627\u0644\u062b\u0627\u0646\u064a',
  extraTime: '\u0648\u0642\u062a \u0625\u0636\u0627\u0641\u064a',
  penalties: '\u0631\u0643\u0644\u0627\u062a \u0627\u0644\u062a\u0631\u062c\u064a\u062d',
  halfTime: '\u0627\u0633\u062a\u0631\u0627\u062d\u0629',
  unknownTeam: '\u0645\u0646\u062a\u062e\u0628 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f',
  group: '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629',
  worldCup: '\u0643\u0623\u0633 \u0627\u0644\u0639\u0627\u0644\u0645 2026',
};

function formatCount(value: number) { return new Intl.NumberFormat('ar-EG').format(value); }
function normalizeStatus(match?: HomeMatch | null) { return String(match?.displayStatus || match?.status || '').toUpperCase(); }
function teamLabel(team?: Team | null) { return team?.name || team?.code || LABELS.unknownTeam; }
function matchKey(match?: HomeMatch | null) { return String(match?.id || match?.animationMatchId || `${teamLabel(match?.homeTeam)}-${teamLabel(match?.awayTeam)}-${match?.matchDate || ''}`); }
function matchTime(match: HomeMatch) { const date = match.matchDate ? new Date(match.matchDate) : null; return date && Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER; }
function isFinished(match?: HomeMatch | null) { return FINISHED_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isStaleAutoFinished); }
function isHalfTime(match?: HomeMatch | null) { return HALF_TIME_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isHalfTime); }
function isLive(match?: HomeMatch | null) { const status = normalizeStatus(match); return !isFinished(match) && (LIVE_STATUSES.includes(status) || Boolean(match?.isLiveNow) || Boolean(match?.isLikelyLiveByTime) || isHalfTime(match)); }
function formatScore(value?: number | null) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '—'; }
function getBroadcastHref(match: HomeMatch) { return match.id ? `/match-center/${encodeURIComponent(String(match.id))}` : '/matches'; }
function isSameLocalDay(value: string | Date | null | undefined, now: Date) { const date = value ? new Date(value) : null; return Boolean(date && Number.isFinite(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()); }
function formatKickoffTime(value?: string | Date | null) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date) : '—'; }
function uniqueMatches(list: HomeMatch[]) { const seen = new Set<string>(); return list.filter((match) => { const key = matchKey(match); if (seen.has(key)) return false; seen.add(key); return true; }); }
function groupNumberLabel(match: HomeMatch) { const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase(); const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || (/^[A-L]$/.test(raw) ? raw : ''); if (letter) return `${LABELS.group} ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`; const number = raw.match(/(?:GROUP|المجموعة)?[_\s-]*(\d{1,2})/)?.[1]; if (number) return `${LABELS.group} ${formatCount(Number(number))}`; return LABELS.worldCup; }
function liveText(match: HomeMatch) { if (isHalfTime(match)) return LABELS.halfTime; const minute = Number(match.minute); const min = Number.isFinite(minute) && minute > 0 ? ` — د${formatCount(Math.floor(minute))}` : ''; const status = normalizeStatus(match); if (status === '1H') return `${LABELS.firstHalf}${min}`; if (status === '2H') return `${LABELS.secondHalf}${min}`; if (status === 'ET') return `${LABELS.extraTime}${min}`; if (status === 'P' || status === 'PEN') return LABELS.penalties; return `${LABELS.live}${min}`; }

function MiniMatchLine({ match }: { match: HomeMatch }) {
  const live = isLive(match);
  const finished = isFinished(match);
  const score = live || finished ? `${formatScore(match.homeScore)} - ${formatScore(match.awayScore)}` : 'VS';
  const status = live ? liveText(match) : finished ? LABELS.ended : LABELS.upcoming;

  return (
    <Link href={getBroadcastHref(match)} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 transition hover:border-[#0FF0FC]/30 hover:bg-white/[0.045]">
      <span className="truncate text-right text-[11px] font-black text-white">{teamLabel(match.homeTeam)}</span>
      <span className={`rounded-xl px-2 py-1 text-[10px] font-black ${score === 'VS' ? 'border border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`} dir="ltr">{score}</span>
      <span className="truncate text-left text-[11px] font-black text-white">{teamLabel(match.awayTeam)}</span>
      <span className="col-span-3 text-center text-[9px] font-bold text-gray-500">{groupNumberLabel(match)} • {formatKickoffTime(match.matchDate)} • {status}</span>
    </Link>
  );
}

export default function HomeTodayMatchesCard({ matches = [], updatedAt }: Props) {
  const safeMatches = Array.isArray(matches) ? (matches as HomeMatch[]) : [];
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);

  const todayMatches = useMemo(() => uniqueMatches(safeMatches).filter((match) => isSameLocalDay(match.matchDate, now)).sort((a, b) => matchTime(a) - matchTime(b)), [safeMatches, now]);
  const sections = [
    { title: LABELS.live, tone: 'text-[#00FF88]', items: todayMatches.filter((match) => isLive(match)) },
    { title: LABELS.upcoming, tone: 'text-[#0FF0FC]', items: todayMatches.filter((match) => !isFinished(match) && !isLive(match)) },
    { title: LABELS.ended, tone: 'text-gray-300', items: todayMatches.filter((match) => isFinished(match)) },
  ];

  return (
    <section id="today-matches" className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black text-[#FFD700]">{LABELS.kicker}</p>
          <h2 className="text-base font-black sm:text-xl">{LABELS.title}</h2>
        </div>
        <HomeLastUpdatedStrip updatedAt={updatedAt} compact />
      </div>

      {todayMatches.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-white/10 bg-black/20 p-2.5">
              <div className={`mb-2 text-[11px] font-black ${section.tone}`}>{section.title}</div>
              <div className="space-y-2">
                {section.items.length ? section.items.slice(0, 4).map((match) => <MiniMatchLine key={matchKey(match)} match={match} />) : <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-center text-[10px] font-bold text-gray-500">{LABELS.emptySection}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-black text-gray-400">{LABELS.emptyDay}</div>
      )}
    </section>
  );
}
