'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeTournamentStatsCard from '@/components/HomeTournamentStatsCard';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import HomeLiveMatchTicker from '@/components/HomeLiveMatchTicker';
import HomeGroupStandingsWidget from '@/components/HomeGroupStandingsWidget';

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
  flag: string;
  x: number;
  y: number;
};

type TeamRegion = {
  title: string;
  subtitle: string;
  mapPath: string;
  teams: RegionalTeam[];
};

const MATCH_REFRESH_MS = 60_000;

const teamRegions: TeamRegion[] = [
  {
    title: 'المستضيفون',
    subtitle: 'مركز البطولة بين أمريكا، كندا، والمكسيك',
    mapPath: 'M16 38 C24 18 52 12 78 22 C99 30 111 49 101 70 C88 99 52 101 27 83 C10 71 7 54 16 38Z',
    teams: [
      { name: 'المكسيك', flag: '🇲🇽', x: 50, y: 67 },
      { name: 'كندا', flag: '🇨🇦', x: 45, y: 30 },
      { name: 'الولايات المتحدة', flag: '🇺🇸', x: 52, y: 49 },
    ],
  },
  {
    title: 'العرب',
    subtitle: 'قوس عربي ممتد من شمال أفريقيا إلى غرب آسيا',
    mapPath: 'M8 58 C22 38 43 30 61 37 C74 42 82 31 99 35 C113 40 115 62 101 74 C81 92 48 86 28 77 C17 73 4 70 8 58Z',
    teams: [
      { name: 'المغرب', flag: '🇲🇦', x: 18, y: 54 },
      { name: 'الجزائر', flag: '🇩🇿', x: 29, y: 55 },
      { name: 'تونس', flag: '🇹🇳', x: 38, y: 49 },
      { name: 'مصر', flag: '🇪🇬', x: 50, y: 58 },
      { name: 'السعودية', flag: '🇸🇦', x: 67, y: 63 },
      { name: 'قطر', flag: '🇶🇦', x: 73, y: 58 },
      { name: 'العراق', flag: '🇮🇶', x: 66, y: 48 },
      { name: 'الأردن', flag: '🇯🇴', x: 60, y: 52 },
    ],
  },
  {
    title: 'أوروبا',
    subtitle: 'كتلة تنافسية كثيفة في قلب الخريطة',
    mapPath: 'M20 28 C36 14 64 10 83 22 C101 33 107 55 95 72 C80 94 48 95 28 80 C9 65 6 43 20 28Z',
    teams: [
      { name: 'إنجلترا', flag: '🏴', x: 34, y: 39 },
      { name: 'فرنسا', flag: '🇫🇷', x: 43, y: 54 },
      { name: 'إسبانيا', flag: '🇪🇸', x: 36, y: 67 },
      { name: 'البرتغال', flag: '🇵🇹', x: 28, y: 68 },
      { name: 'ألمانيا', flag: '🇩🇪', x: 53, y: 46 },
      { name: 'هولندا', flag: '🇳🇱', x: 48, y: 36 },
      { name: 'بلجيكا', flag: '🇧🇪', x: 45, y: 43 },
      { name: 'سويسرا', flag: '🇨🇭', x: 53, y: 57 },
      { name: 'النمسا', flag: '🇦🇹', x: 61, y: 56 },
      { name: 'كرواتيا', flag: '🇭🇷', x: 66, y: 63 },
      { name: 'التشيك', flag: '🇨🇿', x: 59, y: 47 },
      { name: 'النرويج', flag: '🇳🇴', x: 55, y: 23 },
      { name: 'السويد', flag: '🇸🇪', x: 65, y: 24 },
      { name: 'تركيا', flag: '🇹🇷', x: 78, y: 72 },
      { name: 'اسكتلندا', flag: '🏴', x: 31, y: 28 },
      { name: 'البوسنة والهرسك', flag: '🇧🇦', x: 70, y: 65 },
    ],
  },
  {
    title: 'أمريكا الجنوبية',
    subtitle: 'عمود هجومي طويل من البرازيل إلى الأرجنتين',
    mapPath: 'M50 11 C69 15 82 28 82 45 C82 63 66 70 62 87 C58 102 44 111 34 98 C25 86 34 72 30 58 C26 43 30 21 50 11Z',
    teams: [
      { name: 'البرازيل', flag: '🇧🇷', x: 59, y: 38 },
      { name: 'الأرجنتين', flag: '🇦🇷', x: 49, y: 77 },
      { name: 'أوروغواي', flag: '🇺🇾', x: 61, y: 72 },
      { name: 'كولومبيا', flag: '🇨🇴', x: 38, y: 30 },
      { name: 'الإكوادور', flag: '🇪🇨', x: 30, y: 38 },
      { name: 'باراغواي', flag: '🇵🇾', x: 53, y: 61 },
    ],
  },
  {
    title: 'أفريقيا',
    subtitle: 'قارة واسعة بحضور عربي وغرب أفريقي قوي',
    mapPath: 'M51 9 C77 14 91 38 83 61 C76 81 67 101 48 105 C28 109 20 84 16 62 C11 34 25 11 51 9Z',
    teams: [
      { name: 'المغرب', flag: '🇲🇦', x: 33, y: 24 },
      { name: 'الجزائر', flag: '🇩🇿', x: 45, y: 30 },
      { name: 'تونس', flag: '🇹🇳', x: 57, y: 27 },
      { name: 'مصر', flag: '🇪🇬', x: 66, y: 35 },
      { name: 'السنغال', flag: '🇸🇳', x: 24, y: 48 },
      { name: 'غانا', flag: '🇬🇭', x: 37, y: 56 },
      { name: 'كوت ديفوار', flag: '🇨🇮', x: 31, y: 57 },
      { name: 'الكونغو الديمقراطية', flag: '🇨🇩', x: 56, y: 63 },
      { name: 'جنوب أفريقيا', flag: '🇿🇦', x: 56, y: 88 },
      { name: 'الرأس الأخضر', flag: '🇨🇻', x: 15, y: 41 },
    ],
  },
  {
    title: 'آسيا',
    subtitle: 'امتداد شرقي كبير من الخليج حتى اليابان وكوريا',
    mapPath: 'M14 43 C27 17 67 12 92 25 C114 36 111 66 91 79 C66 96 30 91 16 70 C10 61 9 52 14 43Z',
    teams: [
      { name: 'إيران', flag: '🇮🇷', x: 43, y: 50 },
      { name: 'السعودية', flag: '🇸🇦', x: 33, y: 62 },
      { name: 'قطر', flag: '🇶🇦', x: 39, y: 61 },
      { name: 'العراق', flag: '🇮🇶', x: 35, y: 50 },
      { name: 'الأردن', flag: '🇯🇴', x: 29, y: 53 },
      { name: 'أوزبكستان', flag: '🇺🇿', x: 50, y: 39 },
      { name: 'اليابان', flag: '🇯🇵', x: 86, y: 49 },
      { name: 'كوريا الجنوبية', flag: '🇰🇷', x: 79, y: 43 },
    ],
  },
  {
    title: 'أمريكا الشمالية والكاريبي',
    subtitle: 'الاستضافة مع حضور كاريبي ووسط أمريكي',
    mapPath: 'M14 30 C31 11 69 10 93 25 C109 35 105 58 88 69 C67 83 38 82 19 66 C6 55 4 41 14 30Z',
    teams: [
      { name: 'كندا', flag: '🇨🇦', x: 45, y: 27 },
      { name: 'الولايات المتحدة', flag: '🇺🇸', x: 48, y: 45 },
      { name: 'المكسيك', flag: '🇲🇽', x: 42, y: 63 },
      { name: 'بنما', flag: '🇵🇦', x: 57, y: 76 },
      { name: 'هايتي', flag: '🇭🇹', x: 70, y: 67 },
      { name: 'كوراساو', flag: '🇨🇼', x: 76, y: 72 },
    ],
  },
  {
    title: 'أوقيانوسيا',
    subtitle: 'نيوزيلندا ومعها أستراليا على أطراف الخريطة',
    mapPath: 'M23 61 C32 49 54 44 72 51 C88 58 92 78 78 88 C61 99 31 91 20 77 C16 71 17 66 23 61Z',
    teams: [
      { name: 'أستراليا', flag: '🇦🇺', x: 47, y: 66 },
      { name: 'نيوزيلندا', flag: '🇳🇿', x: 75, y: 82 },
    ],
  },
];

function formatCount(value?: number | null, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}

function formatScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '—';
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

function formatMatchDate(value?: string | Date | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'موعد غير متوفر';

  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeStatus(match?: HomeMatch | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function formatGroupLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'كأس العالم 2026';
  const groupLetter = raw.match(/^group[_\s-]*([a-z])$/i);
  if (groupLetter?.[1]) return `المجموعة ${groupLetter[1].toUpperCase()}`;
  if (/^[A-L]$/i.test(raw)) return `المجموعة ${raw.toUpperCase()}`;
  return raw.replace('GROUP_', 'المجموعة ');
}

function matchGroup(match: HomeMatch) {
  return formatGroupLabel(match.groupPhase || match.group || match.stage);
}

function matchTime(match: HomeMatch) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function elapsedMinutes(match: HomeMatch, now: Date) {
  const start = match.matchDate ? new Date(match.matchDate) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  return Math.floor((now.getTime() - start.getTime()) / 60_000);
}

function isGroupStage(match: HomeMatch) {
  const group = String(match.groupPhase || match.group || match.stage || '').toUpperCase();
  return group.includes('GROUP') || /^[A-L]$/.test(group);
}

function isOfficialFinished(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return ['FINISHED', 'FT', 'AET', 'PEN'].includes(status);
}

function isScheduled(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(status);
}

function isStaleLive(match: HomeMatch, now: Date) {
  const elapsed = elapsedMinutes(match, now);
  if (elapsed === null) return false;
  const maxMinutes = isGroupStage(match) ? 115 : 150;
  return elapsed >= maxMinutes || (typeof match.minute === 'number' && match.minute >= maxMinutes);
}

function isLive(match: HomeMatch, now: Date) {
  if (isOfficialFinished(match) || isStaleLive(match, now)) return false;
  const status = normalizeStatus(match);
  return status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' || Boolean(match.isLiveNow && !match.isLikelyLiveByTime);
}

function isFinished(match: HomeMatch, now: Date) {
  return isOfficialFinished(match) || isStaleLive(match, now);
}

function isSameCalendarDay(value?: string | Date | null, target = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function countdownParts(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function compactCountdownLabel(diffMs: number) {
  const parts = countdownParts(diffMs);
  if (parts.days > 0) return `بعد ${formatCount(parts.days)}ي ${formatCount(parts.hours)}س`;
  if (parts.hours > 0) return `بعد ${formatCount(parts.hours)}س ${formatCount(parts.minutes)}د`;
  return `بعد ${formatCount(parts.minutes)}د ${formatCount(parts.seconds)}ث`;
}

function matchTiming(match: HomeMatch, now: Date) {
  if (isFinished(match, now)) return { label: 'انتهت', live: false, waiting: false };
  if (isLive(match, now)) return { label: normalizeStatus(match) === 'HT' ? 'استراحة' : match.liveLabel || 'مباشر الآن', live: true, waiting: false };

  const date = match.matchDate ? new Date(match.matchDate) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
  if (!validDate) return { label: 'بانتظار المصدر', live: false, waiting: true };

  const diffMs = validDate.getTime() - now.getTime();
  if (diffMs > 0) return { label: compactCountdownLabel(diffMs), live: false, waiting: false };

  return { label: 'بانتظار تأكيد البداية', live: false, waiting: true };
}

function matchClock(match: HomeMatch, now: Date) {
  if (!isLive(match, now)) return null;
  if (typeof match.minute === 'number' && Number.isFinite(match.minute) && match.minute > 0) {
    return `${formatCount(Math.min(Math.floor(match.minute), 115))}′`;
  }

  const elapsed = elapsedMinutes(match, now);
  if (!elapsed || elapsed < 1) return null;
  return `${formatCount(Math.min(elapsed, isGroupStage(match) ? 115 : 150))}′`;
}

function getMatchHref(match: HomeMatch) {
  return match.id ? `/matches/${encodeURIComponent(String(match.id))}` : '/matches';
}

function getInteractiveHref(match: HomeMatch) {
  return match.animationMatchId
    ? `/animation-live?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=simple&teamPanel=1`
    : '/animation-live';
}

function matchKey(match?: HomeMatch | null) {
  return String(match?.id || `${teamLabel(match?.homeTeam)}-${teamLabel(match?.awayTeam)}-${match?.matchDate || ''}`);
}

function TeamFlag({ team, className = 'h-9 w-9 rounded-xl' }: { team?: Team | null; className?: string }) {
  const src = team?.image?.startsWith('http') ? team.image : getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);

  return (
    <div className={`inline-flex items-center justify-center overflow-hidden border border-white/10 bg-white/[0.07] ${className}`}>
      {src ? (
        <img src={src} alt={`علم ${teamLabel(team)}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-xs font-black text-[#FFD700]">{teamCode(team)}</span>
      )}
    </div>
  );
}

function InlineMatchTimer({ match, now }: { match: HomeMatch; now: Date }) {
  const timing = matchTiming(match, now);
  const clock = matchClock(match, now);

  return (
    <span className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${timing.live ? 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' : timing.waiting ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
      <span className="min-w-0 truncate">{timing.label}</span>
      {clock ? <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] text-white">{clock}</span> : null}
    </span>
  );
}

function TeamSide({ team, align }: { team?: Team | null; align: 'right' | 'left' }) {
  return (
    <Link
      href={getTeamHref(team)}
      className={`group/team block min-w-0 rounded-2xl border border-transparent p-1.5 transition hover:border-[#FFD700]/25 hover:bg-white/[0.055] ${align === 'right' ? 'text-right' : 'text-left'}`}
      title={`فتح صفحة ${teamLabel(team)}`}
    >
      <div className={`mb-1.5 inline-flex items-center gap-1.5 ${align === 'left' ? 'flex-row-reverse' : ''}`}>
        <TeamFlag team={team} />
      </div>
      <h3 className="truncate text-sm font-black text-white transition group-hover/team:text-[#FFD700]">{teamLabel(team)}</h3>
      <p className="mt-0.5 text-[11px] font-bold text-gray-500 transition group-hover/team:text-gray-300">{teamCode(team)}</p>
    </Link>
  );
}

function ScoreBox({ value }: { value?: number | null }) {
  return (
    <span className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-2 text-lg font-black leading-none text-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.08)]" dir="ltr">
      {formatScore(value)}
    </span>
  );
}

function MatchScoreCenter({ homeScore, awayScore }: { homeScore?: number | null; awayScore?: number | null }) {
  return (
    <div className="flex min-w-[5.75rem] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/30 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" aria-label="نتيجة المباراة" dir="ltr">
      <ScoreBox value={homeScore} />
      <span className="h-6 w-px rounded-full bg-white/15" />
      <ScoreBox value={awayScore} />
    </div>
  );
}

function MatchCard({ match, now }: { match: HomeMatch; now: Date }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-h-7 min-w-7 items-center justify-center rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 text-[11px] font-black text-[#FFD700]">{matchGroup(match)}</span>
        <InlineMatchTimer match={match} now={now} />
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-gray-300">{formatMatchDate(match.matchDate)}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <TeamSide team={match.homeTeam} align="right" />
        <MatchScoreCenter homeScore={match.homeScore} awayScore={match.awayScore} />
        <TeamSide team={match.awayTeam} align="left" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={getMatchHref(match)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-[11px] font-black text-gray-200 transition hover:bg-white/[0.1]">
          تفاصيل المباراة
        </Link>
        <Link href={getInteractiveHref(match)} className="rounded-xl bg-[#0FF0FC] px-3 py-2 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">
          البث التفاعلي
        </Link>
      </div>
    </article>
  );
}

function CountdownMini({ match, now }: { match: HomeMatch; now: Date }) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  const diffMs = date && !Number.isNaN(date.getTime()) ? date.getTime() - now.getTime() : 0;
  const parts = countdownParts(diffMs);
  const items = [
    { label: 'يوم', value: parts.days },
    { label: 'ساعة', value: parts.hours },
    { label: 'دقيقة', value: parts.minutes },
    { label: 'ثانية', value: parts.seconds },
  ];

  if (!date || Number.isNaN(date.getTime()) || diffMs <= 0) return null;

  return (
    <div className="grid grid-cols-4 gap-2" dir="ltr" aria-label="العد التنازلي للمباراة المرتقبة">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/10 bg-black/35 px-2 py-2 text-center">
          <div className="font-mono text-base font-black text-[#0FF0FC] md:text-xl">{String(item.value).padStart(2, '0')}</div>
          <div className="mt-1 text-[9px] font-black text-gray-500">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function NextMatchSpotlight({ match, now }: { match?: HomeMatch | null; now: Date }) {
  if (!match) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold leading-7 text-gray-400">
        لم يتم تحديد مباراة مرتقبة بعد. سيظهر هنا أقرب لقاء بمجرد وصوله من قاعدة البيانات.
      </div>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-3xl border border-[#0FF0FC]/20 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_30%),rgba(255,255,255,0.045)] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/70 to-transparent" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0FF0FC]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0FF0FC]" />
            المباراة المرتقبة داخل مركز المباريات
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight text-white md:text-3xl">
            {teamLabel(match.homeTeam)} <span className="text-[#FFD700]">ضد</span> {teamLabel(match.awayTeam)}
          </h2>
          <p className="mt-2 text-xs font-bold text-gray-400 md:text-sm">
            {matchGroup(match)} • {formatMatchDate(match.matchDate)}
          </p>
        </div>
        <InlineMatchTimer match={match} now={now} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr_1fr] lg:items-center">
        <Link href={getTeamHref(match.homeTeam)} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-[#FFD700]/30 hover:bg-white/[0.07]">
          <TeamFlag team={match.homeTeam} className="h-14 w-14 rounded-2xl" />
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-white group-hover:text-[#FFD700]">{teamLabel(match.homeTeam)}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">{teamCode(match.homeTeam)}</div>
          </div>
        </Link>

        <div className="space-y-3 text-center">
          <MatchScoreCenter homeScore={match.homeScore} awayScore={match.awayScore} />
          <CountdownMini match={match} now={now} />
          <div className="grid grid-cols-2 gap-2">
            <Link href={getMatchHref(match)} className="rounded-2xl bg-[#FFD700] px-4 py-3 text-xs font-black text-black transition hover:bg-[#FFE55C]">
              دخول المباراة
            </Link>
            <Link href="/matches" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-black text-white transition hover:bg-white/[0.12]">
              جدول المباريات
            </Link>
          </div>
        </div>

        <Link href={getTeamHref(match.awayTeam)} className="group flex items-center justify-end gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-[#FFD700]/30 hover:bg-white/[0.07]">
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-white group-hover:text-[#FFD700]">{teamLabel(match.awayTeam)}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">{teamCode(match.awayTeam)}</div>
          </div>
          <TeamFlag team={match.awayTeam} className="h-14 w-14 rounded-2xl" />
        </Link>
      </div>
    </article>
  );
}

function uniqueMatches(matches: HomeMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = matchKey(match);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function HomeMatchCenterCard({ fallbackMatches = [], upcomingMatchesCount = 0, nextMatch = null }: { fallbackMatches?: HomeMatch[]; upcomingMatchesCount?: number; nextMatch?: HomeMatch | null }) {
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

  const sourceMatches = matches.length ? matches : fallbackMatches;
  const mergedMatches = useMemo(() => uniqueMatches([...(nextMatch ? [nextMatch] : []), ...sourceMatches]), [nextMatch, sourceMatches]);
  const todayCount = mergedMatches.filter((match) => isSameCalendarDay(match.matchDate, now)).length;
  const liveCount = mergedMatches.filter((match) => isLive(match, now)).length;
  const upcomingCount = matches.length ? mergedMatches.filter((match) => isScheduled(match) && !isFinished(match, now)).length : upcomingMatchesCount;
  const finishedCount = mergedMatches.filter((match) => isFinished(match, now)).length;

  const spotlightMatch = useMemo(() => {
    if (nextMatch) return nextMatch;
    const sorted = [...mergedMatches].sort((a, b) => matchTime(a) - matchTime(b));
    return sorted.find((match) => isLive(match, now)) || sorted.find((match) => isScheduled(match) && !isFinished(match, now)) || sorted[0] || null;
  }, [nextMatch, mergedMatches, now]);

  const featuredMatches = useMemo(() => {
    const spotlightKey = spotlightMatch ? matchKey(spotlightMatch) : null;
    const sorted = [...mergedMatches].sort((a, b) => matchTime(a) - matchTime(b));
    const priority = [
      ...sorted.filter((match) => isLive(match, now)),
      ...sorted.filter((match) => !isLive(match, now) && isSameCalendarDay(match.matchDate, now) && !isFinished(match, now)),
      ...sorted.filter((match) => !isLive(match, now) && !isSameCalendarDay(match.matchDate, now) && isScheduled(match)),
      ...sorted.filter((match) => isFinished(match, now)),
    ];

    return uniqueMatches(priority).filter((match) => matchKey(match) !== spotlightKey).slice(0, 3);
  }, [mergedMatches, now, spotlightMatch]);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4" aria-label="مركز المباريات">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Match Center</p>
          <h1 className="mt-1 text-xl font-black text-white md:text-2xl">مركز المباريات</h1>
          <p className="mt-1 text-xs font-bold text-gray-400 md:text-sm">المباراة المرتقبة، حالة اليوم، واللقاءات الأهم في لوحة واحدة.</p>
        </div>
        <Link href="/matches" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.14]">عرض الكل</Link>
      </div>

      <NextMatchSpotlight match={spotlightMatch} now={now} />

      <div className="my-4 grid grid-cols-4 gap-2">
        <Link href="/matches?filter=today" className="rounded-2xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(todayCount)}</div><div className="text-[10px] font-black text-white">اليوم</div></Link>
        <Link href="/matches?filter=live" className="rounded-2xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(liveCount)}</div><div className="text-[10px] font-black text-white">مباشر</div></Link>
        <Link href="/matches?filter=upcoming" className="rounded-2xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(upcomingCount)}</div><div className="text-[10px] font-black text-white">متبقية</div></Link>
        <Link href="/matches?filter=finished" className="rounded-2xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(finishedCount)}</div><div className="text-[10px] font-black text-white">انتهت</div></Link>
      </div>

      {featuredMatches.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featuredMatches.map((match, index) => (
            <div key={match.id || index} className={index === 0 ? '' : 'hidden sm:block'}>
              <MatchCard match={match} now={now} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-bold leading-6 text-gray-400">لا توجد مباريات إضافية جاهزة للعرض الآن. سيظهر هنا أقرب لقاء عند تحديث مركز المباريات.</div>
      )}
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
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-card backdrop-blur">
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

function RegionalMapCard({ region }: { region: TeamRegion }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#FFD700]">{region.title}</h3>
          <p className="mt-1 text-[11px] font-bold leading-5 text-gray-400">{region.subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-gray-300">{formatCount(region.teams.length)} منتخبات</span>
      </div>

      <div className="relative min-h-[185px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.045),rgba(0,0,0,0.22))]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:24px_24px]" />
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full p-6 opacity-80" aria-hidden="true">
          <path d={region.mapPath} fill="rgba(15,240,252,0.12)" stroke="rgba(15,240,252,0.45)" strokeWidth="2" />
          <path d={region.mapPath} fill="none" stroke="rgba(255,215,0,0.16)" strokeWidth="7" />
        </svg>
        {region.teams.map((team) => (
          <Link
            key={`${region.title}-${team.name}`}
            href={`/teams?search=${encodeURIComponent(team.name)}`}
            title={team.name}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/70 px-1.5 py-1 text-base shadow-[0_8px_22px_rgba(0,0,0,0.35)] transition hover:z-20 hover:scale-125 hover:border-[#FFD700]/60 hover:bg-[#FFD700]/20"
            style={{ left: `${team.x}%`, top: `${team.y}%` }}
          >
            <span className="sr-only">{team.name}</span>
            <span aria-hidden="true">{team.flag}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function WorldMapSection() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_30%),rgba(255,255,255,0.04)] p-4 shadow-card backdrop-blur">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0FF0FC]">Tournament Map</p>
          <h2 className="mt-1 text-2xl font-black text-white">خريطة البطولة</h2>
          <p className="mt-1 text-sm font-semibold text-gray-400">كل منطقة أصبحت خريطة مصغرة مرسوم عليها المنتخبات المشاركة بأعلامها.</p>
        </div>
        <Link href="/teams" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-gray-200 transition hover:bg-white/[0.08]">كل المنتخبات</Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {teamRegions.map((region) => <RegionalMapCard key={region.title} region={region} />)}
      </div>
    </section>
  );
}

export default function HomeClientSportsNext({
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
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-4 lg:px-6">
      <HomeLiveMatchTicker matches={safeTickerMatches} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <HomeMatchCenterCard fallbackMatches={safeUpcomingMatches} upcomingMatchesCount={upcomingMatchesCount} nextMatch={safeNextMatch} />
        </div>
        <div className="lg:col-span-1">
          <HomeGroupStandingsWidget />
        </div>
      </div>

      <HomeTournamentStatsCard playersCount={playersCount} teamsCount={teamsCount} upcomingMatchesCount={upcomingMatchesCount} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ContentHubCard />
        <WorldMapSection />
      </div>
    </main>
  );
}
