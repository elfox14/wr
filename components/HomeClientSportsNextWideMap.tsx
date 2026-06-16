'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeTournamentStatsCard from '@/components/HomeTournamentStatsCard';
import HomeLiveMatchTicker from '@/components/HomeLiveMatchTicker';
import HomeGroupStandingsWidget from '@/components/HomeGroupStandingsWidget';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
};

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
  minute?: number | null;
  liveLabel?: string | null;
};

type Props = {
  upcomingMatches?: HomeMatch[] | unknown[];
  tickerMatches?: HomeMatch[] | unknown[];
  nextMarqueeMatch?: HomeMatch | null | unknown;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

type RegionalTeam = {
  name: string;
  code: string;
  flag: string;
  x: number;
  y: number;
};

type TeamRegion = {
  title: string;
  subtitle: string;
  viewBox: string;
  paths: string[];
  teams: RegionalTeam[];
};

const MATCH_REFRESH_MS = 60_000;
const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');

const teamRegions: TeamRegion[] = [
  {
    title: 'المستضيفون',
    subtitle: 'أمريكا الشمالية: كندا، الولايات المتحدة، والمكسيك.',
    viewBox: '0 0 360 190',
    paths: [
      'M59 25 L87 17 L119 19 L143 34 L166 35 L190 48 L202 67 L193 87 L165 83 L147 100 L120 97 L97 84 L79 87 L60 70 L49 48 Z',
      'M97 91 L122 103 L142 120 L157 142 L150 158 L124 152 L105 130 L91 109 Z',
    ],
    teams: [
      { name: 'كندا', code: 'CAN', flag: '🇨🇦', x: 27, y: 25 },
      { name: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', x: 45, y: 48 },
      { name: 'المكسيك', code: 'MEX', flag: '🇲🇽', x: 38, y: 70 },
    ],
  },
  {
    title: 'العرب',
    subtitle: 'شمال أفريقيا والشرق الأوسط بمواقع نسبية على الخريطة.',
    viewBox: '0 0 360 190',
    paths: [
      'M31 86 L54 72 L88 69 L116 74 L151 76 L171 88 L161 110 L124 117 L87 111 L55 103 Z',
      'M176 83 L207 80 L230 92 L242 115 L230 139 L205 132 L190 108 Z',
      'M238 104 L268 111 L294 133 L279 155 L246 147 L231 125 Z',
    ],
    teams: [
      { name: 'المغرب', code: 'MAR', flag: '🇲🇦', x: 13, y: 57 },
      { name: 'الجزائر', code: 'ALG', flag: '🇩🇿', x: 28, y: 50 },
      { name: 'تونس', code: 'TUN', flag: '🇹🇳', x: 42, y: 43 },
      { name: 'مصر', code: 'EGY', flag: '🇪🇬', x: 52, y: 61 },
      { name: 'الأردن', code: 'JOR', flag: '🇯🇴', x: 61, y: 51 },
      { name: 'العراق', code: 'IRQ', flag: '🇮🇶', x: 69, y: 42 },
      { name: 'السعودية', code: 'KSA', flag: '🇸🇦', x: 71, y: 72 },
      { name: 'قطر', code: 'QAT', flag: '🇶🇦', x: 84, y: 62 },
    ],
  },
  {
    title: 'أوروبا',
    subtitle: 'خريطة أوروبية مصغرة تشمل الجزر والشمال والبلقان.',
    viewBox: '0 0 360 190',
    paths: [
      'M111 63 L130 45 L163 37 L201 43 L228 58 L242 81 L233 108 L209 125 L174 122 L145 110 L121 91 Z',
      'M84 52 L100 43 L111 55 L102 77 L85 80 L76 66 Z',
      'M181 18 L212 15 L229 31 L214 48 L187 43 Z',
      'M226 106 L260 116 L284 139 L263 151 L233 135 Z',
    ],
    teams: [
      { name: 'اسكتلندا', code: 'SCO', flag: '🏴', x: 22, y: 29 },
      { name: 'إنجلترا', code: 'ENG', flag: '🏴', x: 28, y: 46 },
      { name: 'فرنسا', code: 'FRA', flag: '🇫🇷', x: 38, y: 61 },
      { name: 'إسبانيا', code: 'ESP', flag: '🇪🇸', x: 31, y: 78 },
      { name: 'البرتغال', code: 'POR', flag: '🇵🇹', x: 18, y: 77 },
      { name: 'هولندا', code: 'NED', flag: '🇳🇱', x: 42, y: 39 },
      { name: 'بلجيكا', code: 'BEL', flag: '🇧🇪', x: 48, y: 52 },
      { name: 'ألمانيا', code: 'GER', flag: '🇩🇪', x: 56, y: 43 },
      { name: 'سويسرا', code: 'SUI', flag: '🇨🇭', x: 51, y: 66 },
      { name: 'النمسا', code: 'AUT', flag: '🇦🇹', x: 64, y: 60 },
      { name: 'كرواتيا', code: 'CRO', flag: '🇭🇷', x: 66, y: 75 },
      { name: 'تركيا', code: 'TUR', flag: '🇹🇷', x: 83, y: 79 },
    ],
  },
  {
    title: 'أمريكا الجنوبية',
    subtitle: 'امتداد القارة من كولومبيا حتى الأرجنتين وأوروغواي.',
    viewBox: '0 0 360 190',
    paths: [
      'M154 16 L187 24 L207 45 L207 68 L193 86 L184 111 L171 139 L149 178 L127 163 L136 132 L121 104 L110 75 L119 44 Z',
      'M111 57 L92 69 L102 88 L124 82 Z',
    ],
    teams: [
      { name: 'كولومبيا', code: 'COL', flag: '🇨🇴', x: 30, y: 33 },
      { name: 'الإكوادور', code: 'ECU', flag: '🇪🇨', x: 25, y: 47 },
      { name: 'البرازيل', code: 'BRA', flag: '🇧🇷', x: 58, y: 48 },
      { name: 'باراغواي', code: 'PAR', flag: '🇵🇾', x: 54, y: 65 },
      { name: 'أوروغواي', code: 'URU', flag: '🇺🇾', x: 62, y: 78 },
      { name: 'الأرجنتين', code: 'ARG', flag: '🇦🇷', x: 42, y: 84 },
    ],
  },
  {
    title: 'أفريقيا',
    subtitle: 'شكل القارة مع شمال وغرب ووسط وجنوب أفريقيا.',
    viewBox: '0 0 360 190',
    paths: [
      'M143 13 L188 18 L223 41 L235 77 L219 103 L202 138 L177 177 L145 166 L123 132 L103 107 L90 74 L105 43 Z',
      'M238 133 L255 150 L248 169 L230 156 Z',
      'M70 78 L88 73 L95 91 L78 98 Z',
    ],
    teams: [
      { name: 'المغرب', code: 'MAR', flag: '🇲🇦', x: 28, y: 20 },
      { name: 'الجزائر', code: 'ALG', flag: '🇩🇿', x: 42, y: 31 },
      { name: 'تونس', code: 'TUN', flag: '🇹🇳', x: 57, y: 23 },
      { name: 'مصر', code: 'EGY', flag: '🇪🇬', x: 67, y: 38 },
      { name: 'السنغال', code: 'SEN', flag: '🇸🇳', x: 20, y: 51 },
      { name: 'كوت ديفوار', code: 'CIV', flag: '🇨🇮', x: 30, y: 64 },
      { name: 'غانا', code: 'GHA', flag: '🇬🇭', x: 44, y: 60 },
      { name: 'الكونغو الديمقراطية', code: 'COD', flag: '🇨🇩', x: 61, y: 67 },
      { name: 'جنوب أفريقيا', code: 'RSA', flag: '🇿🇦', x: 52, y: 88 },
    ],
  },
  {
    title: 'آسيا',
    subtitle: 'الخليج ووسط آسيا وشرق القارة على خريطة واحدة.',
    viewBox: '0 0 360 190',
    paths: [
      'M53 70 L88 43 L138 27 L196 25 L252 39 L311 69 L293 101 L235 111 L191 96 L148 112 L105 103 L74 90 Z',
      'M86 91 L117 100 L125 129 L99 141 L76 119 Z',
      'M300 78 L322 87 L315 103 L294 99 Z',
    ],
    teams: [
      { name: 'الأردن', code: 'JOR', flag: '🇯🇴', x: 15, y: 56 },
      { name: 'العراق', code: 'IRQ', flag: '🇮🇶', x: 27, y: 49 },
      { name: 'إيران', code: 'IRN', flag: '🇮🇷', x: 39, y: 52 },
      { name: 'السعودية', code: 'KSA', flag: '🇸🇦', x: 26, y: 72 },
      { name: 'قطر', code: 'QAT', flag: '🇶🇦', x: 42, y: 68 },
      { name: 'أوزبكستان', code: 'UZB', flag: '🇺🇿', x: 49, y: 34 },
      { name: 'كوريا الجنوبية', code: 'KOR', flag: '🇰🇷', x: 78, y: 42 },
      { name: 'اليابان', code: 'JPN', flag: '🇯🇵', x: 88, y: 54 },
    ],
  },
  {
    title: 'أوقيانوسيا',
    subtitle: 'أستراليا ونيوزيلندا في موضعهما الطبيعي.',
    viewBox: '0 0 360 190',
    paths: [
      'M91 91 L121 76 L164 82 L192 105 L181 134 L138 146 L96 130 L75 111 Z',
      'M234 124 L250 132 L243 147 L225 141 Z',
      'M258 150 L278 158 L267 174 L247 165 Z',
    ],
    teams: [
      { name: 'أستراليا', code: 'AUS', flag: '🇦🇺', x: 35, y: 62 },
      { name: 'نيوزيلندا', code: 'NZL', flag: '🇳🇿', x: 72, y: 82 },
    ],
  },
];

function formatCount(value?: number | null, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}

function formatScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '0';
}

function teamLabel(team?: Team | null) {
  return team?.name || team?.code || 'منتخب غير محدد';
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function getTeamHref(team?: Team | null) {
  return team?.id ? `/teams/${encodeURIComponent(String(team.id))}` : '/teams';
}

function getMatchHref(match: HomeMatch) {
  return match.id ? `/matches/${encodeURIComponent(String(match.id))}` : '/matches';
}

function getBroadcastHref(match: HomeMatch) {
  return match.id ? `/match-center/${encodeURIComponent(String(match.id))}` : getMatchHref(match);
}

function normalizeStatus(match?: HomeMatch | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function matchTime(match: HomeMatch) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function isOfficialFinished(match?: HomeMatch | null) {
  return ['FINISHED', 'FT', 'AET', 'PEN'].includes(normalizeStatus(match));
}

function isScheduled(match?: HomeMatch | null) {
  return ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(normalizeStatus(match));
}

function isHalfTime(match?: HomeMatch | null) {
  return normalizeStatus(match) === 'HT' || Boolean(match?.isHalfTime);
}

function isLive(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return ['IN_PLAY', 'LIVE', 'HT'].includes(status) || Boolean(match?.isLiveNow);
}

function matchKey(match?: HomeMatch | null) {
  return String(match?.id || `${teamLabel(match?.homeTeam)}-${teamLabel(match?.awayTeam)}-${match?.matchDate || ''}`);
}

function uniqueMatches(list: HomeMatch[]) {
  const seen = new Set<string>();
  return list.filter((match) => {
    const key = matchKey(match);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupNumberLabel(match: HomeMatch) {
  const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase();
  const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || (/^[A-L]$/.test(raw) ? raw : '');
  if (letter) return `المجموعة ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`;
  const number = raw.match(/(?:GROUP|المجموعة)?[_\s-]*(\d{1,2})/)?.[1];
  if (number) return `المجموعة ${formatCount(Number(number))}`;
  return 'كأس العالم 2026';
}

function formatMatchDate(value?: string | Date | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'موعد غير متوفر';
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function formatKickoffTime(value?: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function countdownParts(match: HomeMatch, now: Date) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  const diffMs = date && !Number.isNaN(date.getTime()) ? date.getTime() - now.getTime() : 0;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  return {
    active: diffMs > 0,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function TeamBadge({ team, align }: { team?: Team | null; align: 'right' | 'left' }) {
  const src = team?.image?.startsWith('http') ? team.image : getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);

  return (
    <Link href={getTeamHref(team)} className={`flex min-w-0 items-center gap-2 rounded-xl border border-transparent p-1.5 transition hover:border-[#FFD700]/25 hover:bg-white/[0.055] ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="h-8 w-8 shrink-0 rounded-lg border border-white/10 bg-cover bg-center bg-no-repeat" style={src ? { backgroundImage: `url(${src})` } : undefined}>
        {!src ? <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#FFD700]">{teamCode(team)}</span> : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black text-white">{teamLabel(team)}</span>
        <span className="mt-0.5 block text-[9px] font-bold text-gray-500">{teamCode(team)}</span>
      </span>
    </Link>
  );
}

function ScoreBox({ value }: { value?: number | null }) {
  return <span className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#FFD700]/35 bg-[#FFD700]/10 px-2 text-lg font-black leading-none text-[#FFD700]" dir="ltr">{formatScore(value)}</span>;
}

function MatchScore({ match }: { match: HomeMatch }) {
  return (
    <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/35 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" dir="rtl" aria-label="النتيجة: صاحب الأرض يمين والضيف يسار">
      <ScoreBox value={match.homeScore} />
      <span className="h-6 w-px rounded-full bg-white/15" />
      <ScoreBox value={match.awayScore} />
    </div>
  );
}

function MatchStatePill({ match, now }: { match: HomeMatch; now: Date }) {
  if (isHalfTime(match)) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">استراحة</span>;
  if (isLive(match)) {
    const label = typeof match.minute === 'number' && Number.isFinite(match.minute) && match.minute > 0 ? `${Math.floor(match.minute)}′` : 'جارية';
    return <span className="rounded-xl border border-[#00FF88]/25 bg-[#00FF88]/10 px-2.5 py-1.5 text-[11px] font-black text-[#00FF88]">{label}</span>;
  }

  const parts = countdownParts(match, now);
  if (!parts.active) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">بانتظار البداية</span>;
  const visibleParts = parts.days > 0
    ? `${formatCount(parts.days)}ي ${formatCount(parts.hours)}س`
    : parts.hours > 0
      ? `${formatCount(parts.hours)}س ${formatCount(parts.minutes)}د`
      : `${formatCount(parts.minutes)}د ${formatCount(parts.seconds)}ث`;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2.5 py-1.5 text-[11px] font-black text-[#0FF0FC]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#0FF0FC] shadow-[0_0_12px_rgba(15,240,252,0.8)]" /> بعد {visibleParts}
    </span>
  );
}

function MatchRow({ match, now, variant = 'normal' }: { match: HomeMatch; now: Date; variant?: 'live' | 'normal' }) {
  return (
    <article className={`relative overflow-hidden rounded-2xl border p-2.5 transition ${variant === 'live' ? 'border-[#00FF88]/25 bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.10),transparent_34%),rgba(0,0,0,0.25)]' : 'border-white/10 bg-black/25 hover:border-[#0FF0FC]/30'}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">{groupNumberLabel(match)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-gray-200">{formatMatchDate(match.matchDate)}</span>
        <span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2.5 py-1 text-[11px] font-black text-[#0FF0FC]">{formatKickoffTime(match.matchDate)}</span>
        <MatchStatePill match={match} now={now} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        <TeamBadge team={match.homeTeam} align="right" />
        <MatchScore match={match} />
        <TeamBadge team={match.awayTeam} align="left" />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link href={getMatchHref(match)} className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-center text-[10px] font-black text-gray-200 transition hover:bg-white/[0.1]">تفاصيل</Link>
        <Link href={getBroadcastHref(match)} className="rounded-lg bg-[#0FF0FC] px-2.5 py-1.5 text-center text-[10px] font-black text-black transition hover:bg-[#4AFAFF]">بث المباراة</Link>
      </div>
    </article>
  );
}

function MatchCenter({ fallbackMatches = [], nextMatch = null }: { fallbackMatches?: HomeMatch[]; nextMatch?: HomeMatch | null }) {
  const [matches, setMatches] = useState<HomeMatch[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMatches() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/matches', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.matches) ? data.matches : [];
        if (!cancelled) setMatches(list);
      } catch {
        // Keep server fallback matches if the full matches endpoint is unavailable.
      }
    }
    loadMatches();
    const timer = window.setInterval(loadMatches, MATCH_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const mergedMatches = useMemo(() => uniqueMatches([...(nextMatch ? [nextMatch] : []), ...(matches.length ? matches : fallbackMatches)]), [nextMatch, matches, fallbackMatches]);
  const sortedMatches = useMemo(() => [...mergedMatches].sort((a, b) => matchTime(a) - matchTime(b)), [mergedMatches]);
  const liveMatch = sortedMatches.find((match) => isLive(match) && !isOfficialFinished(match)) || null;
  const upcomingMatches = sortedMatches.filter((match) => isScheduled(match) && !isOfficialFinished(match)).slice(0, 2);

  return (
    <section className="flex h-full min-h-[330px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur" aria-label="مركز المباريات">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FFD700]">Match Center</p>
          <h1 className="mt-1 text-lg font-black text-white md:text-xl">مركز المباريات</h1>
        </div>
        <Link href="/matches" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.14]">جدول المباريات</Link>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {liveMatch ? <MatchRow match={liveMatch} now={now} variant="live" /> : null}
        <div className="grid flex-1 gap-3 md:grid-cols-2">
          {upcomingMatches.map((match) => <MatchRow key={matchKey(match)} match={match} now={now} />)}
          {!upcomingMatches.length && !liveMatch ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400 md:col-span-2">لا توجد مباريات جاهزة للعرض الآن.</div> : null}
        </div>
      </div>
    </section>
  );
}

function ContentHubCard() {
  const items = [
    ['الأخبار والتحليل', 'تقارير وتحليلات رياضية منفصلة عن الجانب الترفيهي.', '/news'],
    ['الإحصائيات', 'ملخصات مباشرة للأهداف والبطاقات وحالة المباريات.', '/matches'],
    ['المنتخبات', 'بطاقات المنتخبات، اللاعبين، والمعلومات الأساسية.', '/teams'],
  ] as const;
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-card backdrop-blur">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Content Hub</p>
        <h2 className="mt-1 text-2xl font-black text-white">مركز المحتوى</h2>
        <p className="mt-1 text-sm font-semibold text-gray-400">كل ما يخص البطولة من مباريات، منتخبات، وتحليل.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(([title, body, href]) => (
          <Link key={title} href={href} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-0.5 hover:border-[#0FF0FC]/30 hover:bg-white/[0.07]">
            <h3 className="font-black text-white">{title}</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-gray-400">{body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TeamMapLabel({ team }: { team: RegionalTeam }) {
  const flagUrl = getTeamFlagUrl({ code: team.code, name: team.name }, 80);
  return (
    <Link href={`/teams?search=${encodeURIComponent(team.name)}`} title={team.name} className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-2.5 py-1.5 text-[11px] font-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.48)] backdrop-blur transition hover:z-20 hover:scale-110 hover:border-[#FFD700]/70 hover:bg-[#111827]" style={{ left: `${team.x}%`, top: `${team.y}%` }}>
      <span className="h-4 w-6 shrink-0 rounded-[3px] border border-white/20 bg-cover bg-center shadow-sm" style={flagUrl ? { backgroundImage: `url(${flagUrl})` } : undefined} aria-hidden="true">{!flagUrl ? team.flag : null}</span>
      <span className="whitespace-nowrap leading-none">{team.name}</span>
    </Link>
  );
}

function RegionalMapCard({ region }: { region: TeamRegion }) {
  return (
    <article className="group/map overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055] xl:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#FFD700]">{region.title}</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-400">{region.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-gray-300">{formatCount(region.teams.length)} منتخبات</span>
      </div>
      <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.045),rgba(0,0,0,0.28))] md:min-h-[420px]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
        <svg viewBox={region.viewBox} className="absolute inset-0 h-full w-full p-7 opacity-95" role="img" aria-label={`خريطة ${region.title}`}>
          {region.paths.map((path, index) => (
            <path key={path} d={path} fill={index === 0 ? 'rgba(15,240,252,0.23)' : 'rgba(255,215,0,0.12)'} stroke={index === 0 ? 'rgba(15,240,252,0.78)' : 'rgba(255,255,255,0.30)'} strokeWidth="2.4" strokeLinejoin="round" />
          ))}
        </svg>
        {region.teams.map((team) => <TeamMapLabel key={`${region.title}-${team.name}`} team={team} />)}
      </div>
    </article>
  );
}

function FullWidthTournamentMap() {
  return (
    <section className="mx-auto max-w-7xl px-3 pb-6 sm:px-4 lg:px-6" dir="rtl" aria-label="خريطة البطولة بالعرض">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.15),transparent_28%),rgba(255,255,255,0.04)] p-4 shadow-card backdrop-blur md:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0FF0FC]">Tournament Map</p>
            <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">خريطة البطولة</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-gray-400">كل منطقة أصبحت خريطة عريضة بمسافات أكبر بين المنتخبات، مع اسم المنتخب والعلم الحقيقي للدولة فوق موقعه النسبي.</p>
          </div>
          <Link href="/teams" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-gray-200 transition hover:bg-white/[0.08]">كل المنتخبات</Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {teamRegions.map((region) => <RegionalMapCard key={region.title} region={region} />)}
        </div>
      </div>
    </section>
  );
}

export default function HomeClientSportsNextWideMap({
  upcomingMatches = [],
  tickerMatches = [],
  nextMarqueeMatch = null,
  playersCount = 0,
  teamsCount = 0,
  upcomingMatchesCount = 0,
}: Props) {
  const safeUpcomingMatches = Array.isArray(upcomingMatches) ? (upcomingMatches as HomeMatch[]) : [];
  const safeTickerMatches = Array.isArray(tickerMatches) ? (tickerMatches as HomeMatch[]) : [];
  const safeNextMatch = nextMarqueeMatch as HomeMatch | null;

  return (
    <div className="bg-[#05070b]">
      <main dir="rtl" className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-4 lg:px-6">
        <HomeLiveMatchTicker matches={safeTickerMatches} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          <div className="lg:col-span-2"><MatchCenter fallbackMatches={safeUpcomingMatches} nextMatch={safeNextMatch} /></div>
          <div className="lg:col-span-1"><HomeGroupStandingsWidget /></div>
        </div>
        <HomeTournamentStatsCard playersCount={playersCount} teamsCount={teamsCount} upcomingMatchesCount={upcomingMatchesCount} />
        <ContentHubCard />
      </main>
      <FullWidthTournamentMap />
    </div>
  );
}
