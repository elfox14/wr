'use client';

import Link from 'next/link';

type Team = { name?: string | null; code?: string | null };
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

type Props = { matches?: HomeMatch[]; now?: Date };

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'];
const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');
const T = {
  title: '\u062c\u062f\u0648\u0644 \u0627\u0644\u0645\u0628\u0627\u0631\u064a\u0627\u062a',
  hint: '\u0627\u0644\u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0627\u0644\u0642\u0627\u062f\u0645\u0629 \u0648\u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629',
  all: '\u0639\u0631\u0636 \u0627\u0644\u062c\u062f\u0648\u0644',
  match: '\u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629',
  time: '\u0627\u0644\u0645\u0648\u0639\u062f',
  status: '\u0627\u0644\u062d\u0627\u0644\u0629',
  score: '\u0627\u0644\u0646\u062a\u064a\u062c\u0629',
  group: '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629',
  worldCup: '\u0643\u0623\u0633 \u0627\u0644\u0639\u0627\u0644\u0645 2026',
  live: '\u062c\u0627\u0631\u064a\u0629',
  ended: '\u0627\u0646\u062a\u0647\u062a',
  halfTime: '\u0627\u0633\u062a\u0631\u0627\u062d\u0629',
  upcoming: '\u0642\u0627\u062f\u0645\u0629',
  unknownTeam: '\u0645\u0646\u062a\u062e\u0628 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f',
  empty: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0642\u0631\u064a\u0628\u0629 \u0644\u0644\u0639\u0631\u0636.',
};

function formatCount(value: number) { return new Intl.NumberFormat('ar-EG').format(value); }
function formatScore(value?: number | null) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '—'; }
function normalizeStatus(match?: HomeMatch | null) { return String(match?.displayStatus || match?.status || '').toUpperCase(); }
function isFinished(match?: HomeMatch | null) { return FINISHED_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isStaleAutoFinished); }
function isHalfTime(match?: HomeMatch | null) { return HALF_TIME_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isHalfTime); }
function isLive(match?: HomeMatch | null) { const status = normalizeStatus(match); return !isFinished(match) && !isHalfTime(match) && (LIVE_STATUSES.includes(status) || Boolean(match?.isLiveNow) || Boolean(match?.isLikelyLiveByTime)); }
function teamLabel(team?: Team | null) { return team?.name || team?.code || T.unknownTeam; }
function getHref(match: HomeMatch) { return match.id ? `/match-center/${encodeURIComponent(String(match.id))}` : '/matches'; }
function formatKickoffTime(value?: string | Date | null) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date) : '—'; }
function groupLabel(match: HomeMatch) { const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase(); const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || (/^[A-L]$/.test(raw) ? raw : ''); if (letter) return `${T.group} ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`; const number = raw.match(/(?:GROUP)?[_\s-]*(\d{1,2})/)?.[1]; if (number) return `${T.group} ${formatCount(Number(number))}`; return T.worldCup; }
function statusText(match: HomeMatch) { if (isFinished(match)) return T.ended; if (isHalfTime(match)) return T.halfTime; if (isLive(match)) return T.live; return T.upcoming; }
function scoreText(match: HomeMatch) { return isFinished(match) || isHalfTime(match) || isLive(match) ? `${formatScore(match.homeScore)} - ${formatScore(match.awayScore)}` : 'VS'; }

export default function HomeMatchScheduleTable({ matches = [] }: Props) {
  return (
    <aside className="min-w-0 rounded-[1.35rem] border border-[#0FF0FC]/15 bg-black/25 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-white">{T.title}</h2>
          <p className="mt-0.5 text-[10px] font-bold text-gray-500">{T.hint}</p>
        </div>
        <Link href="/matches" className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">{T.all}</Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div className="grid grid-cols-[minmax(0,1.35fr)_4.5rem_4rem_3.4rem] gap-1 border-b border-white/10 px-2 py-2 text-[9px] font-black text-gray-500">
          <span>{T.match}</span><span className="text-center">{T.time}</span><span className="text-center">{T.status}</span><span className="text-center">{T.score}</span>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {matches.length ? matches.map((match) => (
            <Link key={String(match.id || match.animationMatchId || `${teamLabel(match.homeTeam)}-${teamLabel(match.awayTeam)}-${match.matchDate || ''}`)} href={getHref(match)} className="grid grid-cols-[minmax(0,1.35fr)_4.5rem_4rem_3.4rem] items-center gap-1 border-b border-white/5 px-2 py-2 text-[10px] transition last:border-b-0 hover:bg-white/[0.04]">
              <span className="min-w-0"><span className="block truncate font-black text-white">{teamLabel(match.homeTeam)} × {teamLabel(match.awayTeam)}</span><span className="mt-0.5 block truncate text-[8px] font-bold text-gray-500">{groupLabel(match)}</span></span>
              <span className="text-center font-black text-[#0FF0FC]">{formatKickoffTime(match.matchDate)}</span>
              <span className="truncate rounded-lg border border-white/10 bg-white/[0.05] px-1 py-1 text-center font-black text-gray-300">{statusText(match)}</span>
              <span className="rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/10 px-1 py-1 text-center font-black text-[#FFD700]" dir="ltr">{scoreText(match)}</span>
            </Link>
          )) : <div className="p-4 text-center text-[11px] font-bold text-gray-500">{T.empty}</div>}
        </div>
      </div>
    </aside>
  );
}
