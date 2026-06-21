'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
  current_price?: number | null;
  marketPrice?: number | null;
  change?: number | null;
};

type Match = {
  id?: string | number | null;
  status?: string | null;
  displayStatus?: string | null;
  matchDate?: string | Date | null;
  groupPhase?: string | null;
  stage?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  minute?: number | null;
  liveLabel?: string | null;
  isLiveNow?: boolean;
  isHalfTime?: boolean;
  scoreSource?: string | null;
  dataSource?: string | null;
  snapshotCapturedAt?: string | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  events?: any[];
  statsSnapshots?: any[];
};

type TableRow = {
  team: string;
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type GroupData = {
  key: string;
  arName: string;
  finishedMatches?: number;
  liveMatches?: number;
  scheduledMatches?: number;
  standings: TableRow[];
};

type ThirdRow = TableRow & { groupKey: string; groupNumber: number; rank: number };

type DemoData = {
  ok?: boolean;
  generatedAt?: string;
  health?: Record<string, number>;
  matches?: Match[];
  turningPoints?: any[];
  tacticalSnapshots?: any[];
  marketNews?: any[];
  movers?: any[];
};

const REFRESH_MS = 30_000;
const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function ar(value?: number | null, fallback = '—') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return new Intl.NumberFormat('ar-EG').format(value);
}

function arDecimal(value?: number | null, fallback = '—') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function pct(value?: number | null, fallback = '—') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return `${arDecimal(value)}%`;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const number = numberValue(value);
    if (number !== null && number > 0) return number;
  }
  for (const value of values) {
    const number = numberValue(value);
    if (number !== null) return number;
  }
  return null;
}

function percent(numerator?: number | null, denominator?: number | null) {
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function short(value?: string | null, max = 46) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeStatus(match?: Match | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function isLive(match?: Match | null) {
  const status = normalizeStatus(match);
  return Boolean(match && !FINISHED_STATUSES.includes(status) && !HALF_TIME_STATUSES.includes(status) && (LIVE_STATUSES.includes(status) || match.isLiveNow));
}

function isHalfTime(match?: Match | null) {
  const status = normalizeStatus(match);
  return Boolean(match && (HALF_TIME_STATUSES.includes(status) || match.isHalfTime));
}

function isFinished(match?: Match | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(match));
}

function isScheduled(match?: Match | null) {
  return Boolean(match && !isFinished(match) && SCHEDULED_STATUSES.includes(normalizeStatus(match)));
}

function teamName(team?: Team | null) {
  return team?.name || team?.code || 'منتخب غير محدد';
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function teamHref(team?: Team | null) {
  return team?.id ? `/teams/${encodeURIComponent(String(team.id))}` : '/teams';
}

function matchHref(match?: Match | null) {
  return match?.id ? `/match-center/${encodeURIComponent(String(match.id))}` : '/matches';
}

function teamFlag(team?: Team | null, size = 64) {
  return team?.image?.startsWith('http') ? team.image : getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, size);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function timeAgo(value?: string | Date | null) {
  if (!value) return 'غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير متوفر';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${ar(minutes)} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${ar(hours)} س`;
  return `منذ ${ar(Math.floor(hours / 24))} ي`;
}

function gd(value: number) {
  return value > 0 ? `+${ar(value)}` : ar(value);
}

function rankThirds(groups: GroupData[]) {
  return groups
    .map((group, index) => {
      const row = group.standings?.[2];
      return row ? { ...row, groupKey: group.key, groupNumber: index + 1, rank: 0 } : null;
    })
    .filter((row): row is ThirdRow => Boolean(row))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team, 'ar'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function matchTitle(match?: Match | null) {
  if (!match) return 'مباراة غير محددة';
  return `${teamName(match.homeTeam)} × ${teamName(match.awayTeam)}`;
}

function currentMatchSnapshot(match?: Match | null, demo?: DemoData | null) {
  const matchId = String(match?.id || '');
  const fromMatch = Array.isArray(match?.statsSnapshots) ? match?.statsSnapshots?.[0] : null;
  if (fromMatch) return fromMatch;
  const fromDemo = demo?.matches?.find((item) => String(item.id || '') === matchId)?.statsSnapshots?.[0];
  return fromDemo || null;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
  return response.json();
}

function SectionShell({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.045] p-3 text-white shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {eyebrow ? <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">{eyebrow}</div> : null}
          <h2 className="mt-0.5 text-base font-black sm:text-lg">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ match }: { match?: Match | null }) {
  if (!match) return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-400">بانتظار البيانات</span>;
  if (isLive(match)) return <span className="rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-2.5 py-1 text-[10px] font-black text-[#00FF88]">{match.liveLabel || (match.minute ? `مباشر د${ar(match.minute)}` : 'مباشر الآن')}</span>;
  if (isHalfTime(match)) return <span className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">استراحة</span>;
  if (isFinished(match)) return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-300">انتهت</span>;
  if (isScheduled(match)) return <span className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2.5 py-1 text-[10px] font-black text-[#0FF0FC]">قادمة</span>;
  return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-300">{normalizeStatus(match) || 'غير محدد'}</span>;
}

function TeamMini({ team, align = 'right' }: { team?: Team | null; align?: 'right' | 'left' }) {
  const src = teamFlag(team, 80);
  return (
    <Link href={teamHref(team)} className={`flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-2 transition hover:border-[#0FF0FC]/35 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 bg-cover bg-center" style={src ? { backgroundImage: `url(${src})` } : undefined}>
        {!src ? <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#FFD700]">{teamCode(team)}</span> : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">{teamName(team)}</span>
        <span className="mt-0.5 block text-[10px] font-bold text-gray-500">{teamCode(team)}</span>
      </span>
    </Link>
  );
}

function MetricBar({ label, home, away, homeLabel, awayLabel }: { label: string; home?: number | null; away?: number | null; homeLabel?: string; awayLabel?: string }) {
  const left = numberValue(home) || 0;
  const right = numberValue(away) || 0;
  const total = left + right;
  const homeWidth = total > 0 ? Math.max(6, Math.min(94, (left / total) * 100)) : 50;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-2.5">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-black text-gray-400">
        <span>{homeLabel || ar(left)}</span>
        <span className="text-white">{label}</span>
        <span>{awayLabel || ar(right)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10" dir="rtl">
        <div className="h-full bg-[#0FF0FC]" style={{ width: `${homeWidth}%` }} />
        <div className="h-full bg-[#FFD700]" style={{ width: `${100 - homeWidth}%` }} />
      </div>
    </div>
  );
}

function MatchPulse({ match, demo }: { match?: Match | null; demo?: DemoData | null }) {
  const snapshot = currentMatchSnapshot(match, demo);
  const homeScore = pickNumber(match?.homeScore, snapshot?.homeScore) ?? 0;
  const awayScore = pickNumber(match?.awayScore, snapshot?.awayScore) ?? 0;
  const latestEvent = (match?.events?.[0] || demo?.matches?.find((item) => String(item.id) === String(match?.id))?.events?.[0] || demo?.turningPoints?.[0]) as any;
  const leader = (numberValue(snapshot?.homeDangerousAttacks) || 0) > (numberValue(snapshot?.awayDangerousAttacks) || 0)
    ? teamName(match?.homeTeam)
    : (numberValue(snapshot?.awayDangerousAttacks) || 0) > (numberValue(snapshot?.homeDangerousAttacks) || 0)
      ? teamName(match?.awayTeam)
      : 'ضغط متوازن';

  return (
    <SectionShell
      title="نبض المباراة الآن"
      eyebrow="MATCH PULSE"
      action={<StatusPill match={match} />}
    >
      {match ? (
        <div className="space-y-3">
          <div className="rounded-[1.4rem] border border-[#FFD700]/20 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.14),transparent_36%),rgba(0,0,0,0.26)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-black text-gray-400">
              <span>{formatDateTime(match.matchDate)}</span>
              <span>مصدر النتيجة: {match.scoreSource || match.dataSource || snapshot?.provider || 'قاعدة البيانات'}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <TeamMini team={match.homeTeam} />
              <Link href={matchHref(match)} className="rounded-2xl border border-[#FFD700]/30 bg-black/45 px-3 py-2 text-center transition hover:border-[#FFD700]/60">
                <div className="text-3xl font-black text-[#FFD700]" dir="ltr">{ar(homeScore)} - {ar(awayScore)}</div>
                <div className="mt-1 text-[10px] font-black text-[#0FF0FC]">فتح مركز المباراة</div>
              </Link>
              <TeamMini team={match.awayTeam} align="left" />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <MetricBar label="الاستحواذ" home={snapshot?.homePossession} away={snapshot?.awayPossession} homeLabel={snapshot?.homePossession != null ? `${ar(snapshot.homePossession)}%` : '—'} awayLabel={snapshot?.awayPossession != null ? `${ar(snapshot.awayPossession)}%` : '—'} />
            <MetricBar label="التسديدات" home={snapshot?.homeShots} away={snapshot?.awayShots} />
            <MetricBar label="على المرمى" home={snapshot?.homeShotsOnTarget} away={snapshot?.awayShotsOnTarget} />
            <MetricBar label="هجمات خطيرة" home={snapshot?.homeDangerousAttacks} away={snapshot?.awayDangerousAttacks} />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-3">
              <div className="text-[10px] font-black text-[#00FF88]">مين ضاغط؟</div>
              <div className="mt-1 text-lg font-black text-white">{leader}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 md:col-span-2">
              <div className="text-[10px] font-black text-gray-400">آخر حدث مهم</div>
              <div className="mt-1 text-sm font-bold text-white">{latestEvent ? short(latestEvent.detail || latestEvent.bodyAr || latestEvent.titleAr || 'حدث مسجل', 110) : 'لا توجد أحداث حديثة محفوظة لهذه المباراة.'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-gray-400">لا توجد مباراة جاهزة للعرض في نافذة الديمو.</div>
      )}
    </SectionShell>
  );
}

function TournamentRadar({ summary, demo }: { summary: any; demo?: DemoData | null }) {
  const finalStats = summary?.finalStats || {};
  const totalMatches = pickNumber(summary?.totalMatches);
  const finished = pickNumber(summary?.finishedMatches);
  const live = pickNumber(summary?.liveMatches);
  const goals = pickNumber(summary?.totalGoals);
  const cards = (pickNumber(summary?.yellowCards) || 0) + (pickNumber(summary?.redCards) || 0);
  const xg = pickNumber(finalStats?.totalXg, summary?.powerStats?.totalXg);
  const recentEvents = demo?.health?.recentEvents || demo?.turningPoints?.length || 0;

  const tiles = [
    { label: 'تقدم البطولة', value: totalMatches && finished !== null ? `${ar(finished)} / ${ar(totalMatches)}` : ar(totalMatches), sub: 'مباريات منتهية / إجمالي', tone: 'border-white/10 bg-white/[0.045] text-white' },
    { label: 'مباشر الآن', value: ar(live), sub: 'مباريات جارية', tone: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' },
    { label: 'أهداف البطولة', value: ar(goals), sub: 'من النتائج المؤكدة/المحفوظة', tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' },
    { label: 'xG محفوظ', value: arDecimal(xg), sub: 'إثراء إحصائي', tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]' },
    { label: 'الكروت', value: ar(cards), sub: 'صفراء + حمراء', tone: 'border-red-300/25 bg-red-400/10 text-red-100' },
    { label: 'أحداث 24 ساعة', value: ar(recentEvents), sub: 'نقاط تحول محفوظة', tone: 'border-white/10 bg-black/25 text-white' },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className={`rounded-2xl border p-3 ${tile.tone}`}>
          <div className="text-[10px] font-black opacity-80">{tile.label}</div>
          <div className="mt-1 text-2xl font-black leading-none">{tile.value}</div>
          <div className="mt-1 text-[9px] font-bold text-gray-400">{tile.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ThirdsLiveCard({ groups }: { groups: GroupData[] }) {
  const thirds = useMemo(() => rankThirds(groups), [groups]);
  const rows = thirds.slice(0, 10);

  return (
    <SectionShell title="أفضل الثوالث — Live Qualification" eyebrow="TOP THIRD PLACES" action={<span className="rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-2.5 py-1 text-[10px] font-black text-[#00FF88]">أول ٨ يتأهلون الآن</span>}>
      {rows.length ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.3rem_2.5rem_2.3rem_4.8rem] gap-1.5 px-1 text-[9px] font-black text-gray-500">
            <span>#</span><span>المنتخب</span><span className="text-center">ن</span><span className="text-center">فارق</span><span className="text-center">أهداف</span><span className="text-center">الحالة</span>
          </div>
          {rows.map((row) => {
            const safe = row.rank <= 8;
            const flag = getTeamFlagUrl({ code: row.code, name: row.team }, 32);
            return (
              <Link key={`${row.groupKey}-${row.code}`} href={`/teams/team-${String(row.code || '').toLowerCase()}`} className={`grid grid-cols-[2rem_minmax(0,1fr)_2.3rem_2.5rem_2.3rem_4.8rem] items-center gap-1.5 rounded-xl border px-2 py-2 transition hover:border-[#0FF0FC]/35 ${safe ? 'border-[#00FF88]/18 bg-[#00FF88]/7' : 'border-white/10 bg-black/20'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black ${safe ? 'bg-[#00FF88]/15 text-[#00FF88]' : 'bg-white/5 text-gray-400'}`}>{ar(row.rank)}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <img src={flag || undefined} alt="" className="h-4 w-5 shrink-0 rounded-sm object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-black text-white">{row.team}</span>
                    <span className="block text-[9px] font-bold text-gray-500">المجموعة {ar(row.groupNumber)} • لعب {ar(row.played)}</span>
                  </span>
                </span>
                <span className="text-center text-[11px] font-black text-[#FFD700]">{ar(row.points)}</span>
                <span className="text-center text-[11px] font-bold text-gray-300">{gd(row.goalDifference)}</span>
                <span className="text-center text-[11px] font-bold text-gray-300">{ar(row.goalsFor)}</span>
                <span className={`rounded-lg px-1.5 py-1 text-center text-[8px] font-black ${safe ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-red-400/10 text-red-100'}`}>{safe ? 'يتأهل' : 'خارج'}</span>
              </Link>
            );
          })}
          <div className="pt-1 text-[9px] font-bold text-gray-500">الترتيب التجريبي: نقاط ثم فارق أهداف ثم أهداف مسجلة. يمكن إضافة قواعد FIFA التفصيلية لاحقًا.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400">بيانات الثوالث غير متوفرة الآن.</div>
      )}
    </SectionShell>
  );
}

function RoundOf32Preview({ groups }: { groups: GroupData[] }) {
  const thirds = rankThirds(groups).slice(0, 8);
  const fixtures = groups.slice(0, 8).map((group, index) => ({
    label: `مسار ${ar(index + 1)} — تجريبي`,
    a: group.standings?.[0] || null,
    b: index % 2 === 0 ? thirds[index] || group.standings?.[1] || null : group.standings?.[1] || thirds[index] || null,
  })).filter((item) => item.a && item.b);

  return (
    <SectionShell title="لو انتهت الآن: شكل دور الـ32" eyebrow="BRACKET SIMULATOR" action={<span className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-1 text-[9px] font-black text-[#FFD700]">محاكاة غير رسمية</span>}>
      <div className="space-y-2">
        {fixtures.length ? fixtures.slice(0, 6).map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 p-2.5">
            <div className="mb-1 text-[9px] font-black text-gray-500">{item.label}</div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[11px] font-black">
              <span className="truncate text-white">{item.a?.team}</span>
              <span className="rounded-lg bg-white/5 px-2 py-1 text-[#0FF0FC]">ضد</span>
              <span className="truncate text-left text-white">{item.b?.team}</span>
            </div>
          </div>
        )) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400">يظهر بعد توفر ترتيب المجموعات.</div>}
      </div>
    </SectionShell>
  );
}

function DramaIndex({ summary, demo }: { summary: any; demo?: DemoData | null }) {
  const finalStats = summary?.finalStats || {};
  const events = demo?.turningPoints || [];
  const goals = pickNumber(summary?.totalGoals) || 0;
  const xg = pickNumber(finalStats.totalXg, summary?.powerStats?.totalXg) || 0;
  const redCards = pickNumber(summary?.redCards) || 0;
  const penalties = summary?.penalties?.available ? pickNumber(summary.penalties.total) || 0 : 0;
  const varEvents = pickNumber(finalStats.totalVarReviews) || events.filter((item) => item.impactType === 'var').length;
  const score = Math.max(8, Math.min(100, Math.round(goals * 4 + Math.min(28, xg * 2) + redCards * 10 + penalties * 7 + varEvents * 6 + events.length * 1.5)));
  const label = score >= 75 ? 'بطولة مولعة' : score >= 50 ? 'إيقاع عالي' : score >= 30 ? 'تسخين تدريجي' : 'هدوء نسبي';

  return (
    <SectionShell title="مؤشر دراما البطولة" eyebrow="DRAMA INDEX">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border border-[#FFD700]/25 bg-[#FFD700]/10 text-center shadow-[0_0_40px_rgba(255,215,0,0.12)]">
          <div>
            <div className="text-4xl font-black text-[#FFD700]">{ar(score)}</div>
            <div className="text-[10px] font-black text-gray-400">من ١٠٠</div>
          </div>
        </div>
        <div>
          <div className="text-xl font-black text-white">{label}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35"><div className="h-full rounded-full bg-[#FFD700]" style={{ width: `${score}%` }} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-300">
            <span className="rounded-xl bg-black/25 p-2">أهداف: {ar(goals)}</span>
            <span className="rounded-xl bg-black/25 p-2">xG: {arDecimal(xg)}</span>
            <span className="rounded-xl bg-black/25 p-2">جزاء: {ar(penalties)}</span>
            <span className="rounded-xl bg-black/25 p-2">VAR: {ar(varEvents)}</span>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function MomentumBoard({ demo }: { demo?: DemoData | null }) {
  const movers = demo?.movers || [];
  const news = demo?.marketNews || [];
  const top = movers.length ? movers : news.map((item) => ({ ...item.asset, changePercent: item.changePercent, direction: item.changePercent > 0 ? 'up' : item.changePercent < 0 ? 'down' : 'flat', reason: item.titleAr }));

  return (
    <SectionShell title="الساخن والهابط فنيًا" eyebrow="MOMENTUM BOARD">
      <div className="space-y-2">
        {top.length ? top.slice(0, 6).map((item: any, index: number) => {
          const up = item.direction === 'up' || Number(item.changePercent) > 0;
          return (
            <Link key={item.id || `${item.name}-${index}`} href={item.id ? `/asset/${encodeURIComponent(String(item.id))}` : '/market'} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 p-2.5 transition hover:border-[#0FF0FC]/35">
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{item.name || 'أصل غير محدد'}</span>
                <span className="block truncate text-[10px] font-bold text-gray-500">{short(item.reason || item.type || 'حركة محفوظة في قاعدة البيانات', 54)}</span>
              </span>
              <span className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-black ${up ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-red-400/10 text-red-100'}`}>{up ? '+' : ''}{pct(Number(item.changePercent || item.change || 0))}</span>
            </Link>
          );
        }) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400">لا توجد حركة سعرية/فنية محفوظة بعد.</div>}
      </div>
    </SectionShell>
  );
}

function TacticalSnapshot({ demo, match }: { demo?: DemoData | null; match?: Match | null }) {
  const reports = demo?.tacticalSnapshots || [];
  const byMatchTeam = reports.find((report: any) => [match?.homeTeam?.id, match?.awayTeam?.id].filter(Boolean).map(String).includes(String(report.team?.id || '')));
  const report = byMatchTeam || reports[0];

  return (
    <SectionShell title="لقطة تكتيكية قبل المباراة" eyebrow="TACTICAL SNAPSHOT" action={report?.confidence ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-gray-300">ثقة {report.confidence}</span> : undefined}>
      {report ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
            <img src={teamFlag(report.team, 72) || undefined} alt="" className="h-12 w-12 rounded-2xl border border-white/10 object-cover" />
            <div className="min-w-0">
              <div className="truncate text-base font-black text-white">{teamName(report.team)}</div>
              <div className="truncate text-[10px] font-bold text-[#0FF0FC]">{report.title}</div>
            </div>
          </div>
          <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm font-bold leading-6 text-gray-200">{report.summary}</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-3">
              <div className="text-[10px] font-black text-[#00FF88]">نقاط قوة</div>
              <div className="mt-1 text-xs font-bold text-white">{report.strengths?.length ? report.strengths.map((x: string) => short(x, 34)).join(' • ') : 'غير متوفر في المصادر'}</div>
            </div>
            <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3">
              <div className="text-[10px] font-black text-red-100">نقاط ضعف</div>
              <div className="mt-1 text-xs font-bold text-white">{report.weaknesses?.length ? report.weaknesses.map((x: string) => short(x, 34)).join(' • ') : 'غير متوفر في المصادر'}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(report.tacticalTags || []).slice(0, 6).map((tag: string) => <span key={tag} className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-[9px] font-black text-[#FFD700]">{tag}</span>)}
          </div>
          <div className="text-[9px] font-bold text-gray-500">المصدر: {report.sourceName || 'مصدر تحريري'} • {timeAgo(report.publishedAt)}</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400">لا توجد تقارير تكتيكية منشورة بعد.</div>
      )}
    </SectionShell>
  );
}

function DataTrustPanel({ summary, demo, liveMatches }: { summary: any; demo?: DemoData | null; liveMatches: Match[] }) {
  const items = [
    { label: 'Live Card', value: liveMatches.length ? 'نشط' : 'بانتظار', sub: 'قاعدة البيانات + snapshots', ok: liveMatches.length > 0 },
    { label: 'TheStatsAPI', value: summary?.provider === 'THE_STATS_API' ? 'إثراء نشط' : 'Fallback', sub: summary?.cache?.source || summary?.source || 'database summary', ok: Boolean(summary?.ok) },
    { label: 'Snapshots', value: ar(demo?.health?.snapshotCount || 0), sub: 'لقطات محفوظة', ok: Boolean((demo?.health?.snapshotCount || 0) > 0) },
    { label: 'Events', value: ar(demo?.health?.eventCount || 0), sub: 'أحداث محفوظة', ok: Boolean((demo?.health?.eventCount || 0) > 0) },
  ];

  return (
    <SectionShell title="مصباح الثقة في البيانات" eyebrow="DATA TRUST">
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-3 ${item.ok ? 'border-[#00FF88]/20 bg-[#00FF88]/10' : 'border-[#FFD700]/20 bg-[#FFD700]/10'}`}>
            <div className="text-[10px] font-black text-gray-400">{item.label}</div>
            <div className={`mt-1 text-base font-black ${item.ok ? 'text-[#00FF88]' : 'text-[#FFD700]'}`}>{item.value}</div>
            <div className="mt-1 text-[9px] font-bold text-gray-500">{item.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-[10px] font-bold leading-5 text-gray-400">الصفحة لا تقرأ من provider خارجي مباشرة في الواجهة؛ تعرض ما تم حفظه أو تلخيصه في قاعدة البيانات، مع توضيح المصدر كلما أمكن.</div>
    </SectionShell>
  );
}

function TurningPoints({ demo }: { demo?: DemoData | null }) {
  const events = demo?.turningPoints || [];
  const priority = ['goal', 'red_card', 'penalty', 'var', 'yellow_card'];
  const rows = [...events].sort((a: any, b: any) => priority.indexOf(a.impactType) - priority.indexOf(b.impactType)).slice(0, 8);

  return (
    <SectionShell title="أكبر تحولات آخر ٢٤ ساعة" eyebrow="TURNING POINTS">
      <div className="space-y-2">
        {rows.length ? rows.map((event: any) => (
          <Link key={event.id} href={event.match?.id ? `/match-center/${encodeURIComponent(String(event.match.id))}` : '/matches'} className="block rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-[#FFD700]/30">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-0.5 text-[9px] font-black text-[#FFD700]">{event.minute != null ? `د${ar(event.minute)}` : event.impactType}</span>
              <span className="text-[9px] font-bold text-gray-500">{event.sourceName || 'قاعدة البيانات'} • {timeAgo(event.updatedAt)}</span>
            </div>
            <div className="text-sm font-black text-white">{event.match ? `${teamName(event.match.homeTeam)} ${event.match.score} ${teamName(event.match.awayTeam)}` : 'حدث عام'}</div>
            <div className="mt-1 text-xs font-bold leading-5 text-gray-300">{event.playerName ? `${event.playerName}: ` : ''}{event.detail}</div>
          </Link>
        )) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400">لا توجد نقاط تحول محفوظة في آخر ٢٤ ساعة.</div>}
      </div>
    </SectionShell>
  );
}

function PlayerRace({ leaders, summary }: { leaders: any; summary: any }) {
  const topScorer = leaders?.leaders?.topScorer || null;
  const topAssister = leaders?.leaders?.topAssister || null;
  const finalStats = summary?.finalStats || {};
  const cards = [
    { title: 'الهداف', player: topScorer, metric: 'هدف', tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' },
    { title: 'صانع الأهداف', player: topAssister, metric: 'أسيست', tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]' },
  ];

  return (
    <SectionShell title="سباق النجوم" eyebrow="PLAYER RACE" action={<Link href="/players" className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-300 transition hover:text-white">كل اللاعبين</Link>}>
      <div className="grid gap-2 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.title} href={card.player?.id && !String(card.player.id).startsWith('provider-') ? `/players/${encodeURIComponent(String(card.player.id))}` : '/players'} className={`rounded-2xl border p-3 transition hover:border-white/25 ${card.tone}`}>
            <div className="text-[10px] font-black opacity-85">{card.title}</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                {card.player?.image ? <img src={card.player.image} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-black">{String(card.player?.name || '—').slice(0, 2)}</span>}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-black text-white">{card.player?.name || 'غير متوفر'}</span>
                <span className="block text-[10px] font-bold text-gray-400">{ar(numberValue(card.player?.value))} {card.metric}</span>
                <span className="block truncate text-[10px] font-bold text-current">{teamName(card.player?.team)}</span>
              </span>
            </div>
          </Link>
        ))}
        <div className="rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-3 text-[#00FF88]">
          <div className="text-[10px] font-black">أكثر جودة فرص</div>
          <div className="mt-1 text-2xl font-black">{arDecimal(pickNumber(finalStats.totalXg))}</div>
          <div className="mt-1 text-[9px] font-bold text-gray-400">إجمالي xG محفوظ</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-white">
          <div className="text-[10px] font-black text-gray-400">تصديات الحراس</div>
          <div className="mt-1 text-2xl font-black">{ar(pickNumber(finalStats.totalSaves, summary?.powerStats?.saves))}</div>
          <div className="mt-1 text-[9px] font-bold text-gray-400">من لقطات الإحصائيات</div>
        </div>
      </div>
    </SectionShell>
  );
}

export default function HomeDemoCommandCenter() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [providerSummary, setProviderSummary] = useState<any>(null);
  const [databaseSummary, setDatabaseSummary] = useState<any>(null);
  const [leaders, setLeaders] = useState<any>(null);
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [liveResult, groupsResult, providerResult, databaseResult, leadersResult, demoResult] = await Promise.allSettled([
          fetchJson('/api/matches/live-card'),
          fetchJson('/api/groups/standings'),
          fetchJson('/api/matches/cached-the-stats-summary'),
          fetchJson('/api/matches/summary-stats'),
          fetchJson('/api/players/leaders'),
          fetchJson('/api/home-demo/command-center'),
        ]);

        if (cancelled) return;
        if (liveResult.status === 'fulfilled') {
          const value = liveResult.value;
          setLiveMatches(Array.isArray(value) ? value : Array.isArray(value?.matches) ? value.matches : []);
        }
        if (groupsResult.status === 'fulfilled' && groupsResult.value?.ok && Array.isArray(groupsResult.value.groups)) setGroups(groupsResult.value.groups);
        if (providerResult.status === 'fulfilled' && providerResult.value?.ok) setProviderSummary(providerResult.value);
        if (databaseResult.status === 'fulfilled' && databaseResult.value?.ok) setDatabaseSummary(databaseResult.value);
        if (leadersResult.status === 'fulfilled' && leadersResult.value?.ok) setLeaders(leadersResult.value);
        if (demoResult.status === 'fulfilled' && demoResult.value?.ok) setDemo(demoResult.value);
        setLastLoadedAt(new Date().toISOString());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const summary = providerSummary || databaseSummary || {};
  const primaryMatch = useMemo(() => {
    const all = [...liveMatches, ...(demo?.matches || [])];
    return all.find((match) => isLive(match) || isHalfTime(match)) || all.find((match) => isScheduled(match)) || all[0] || null;
  }, [liveMatches, demo]);

  return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.14),transparent_28%),radial-gradient(circle_at_top_left,rgba(15,240,252,0.12),transparent_28%),linear-gradient(180deg,#07140f,#020706)] px-3 py-4 text-white sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <section className="overflow-hidden rounded-[2rem] border border-[#FFD700]/20 bg-[linear-gradient(135deg,rgba(255,215,0,0.13),rgba(15,240,252,0.06),rgba(0,0,0,0.28))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#00FF88]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00FF88]" /> DEMO HOME COMMAND CENTER
              </div>
              <h1 className="mt-3 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">رئيسية تجريبية ذكية قبل الاعتماد</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-300">نسخة مستقلة تجمع كل الاقتراحات: نبض المباراة، أفضل الثوالث، محاكاة دور الـ٣٢، مؤشر الدراما، الثقة في البيانات، التحولات، واللقطة التكتيكية — بدون لمس الرئيسية الحالية.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black">
              <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-gray-300 transition hover:text-white">الرئيسية الحالية</Link>
              <Link href="/statistics" className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-2 text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">كل الإحصائيات</Link>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-gray-400">آخر تحديث: {loading ? 'جاري التحميل' : timeAgo(lastLoadedAt)}</span>
            </div>
          </div>
        </section>

        <TournamentRadar summary={summary} demo={demo} />

        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">
            <MatchPulse match={primaryMatch} demo={demo} />
          </div>
          <div className="space-y-4">
            <DataTrustPanel summary={summary} demo={demo} liveMatches={liveMatches} />
            <RoundOf32Preview groups={groups} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">
            <ThirdsLiveCard groups={groups} />
          </div>
          <DramaIndex summary={summary} demo={demo} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <TacticalSnapshot demo={demo} match={primaryMatch} />
          <MomentumBoard demo={demo} />
          <PlayerRace leaders={leaders} summary={summary} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <TurningPoints demo={demo} />
          <SectionShell title="ملاحظات الموافقة قبل النقل" eyebrow="APPROVAL NOTES">
            <div className="space-y-2 text-sm font-bold leading-7 text-gray-300">
              <p className="rounded-2xl border border-white/10 bg-black/25 p-3">هذه الصفحة مستقلة على `/home-demo` ويمكن تعديلها بحرية قبل نقل أي جزء إلى الرئيسية.</p>
              <p className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-3 text-[#FFD700]">محاكاة دور الـ٣٢ في الديمو غير رسمية حتى نضيف جدول مواجهات FIFA النهائي وقواعد أفضل الثوالث بالتفصيل.</p>
              <p className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-[#0FF0FC]">أفضل أجزاء جاهزة للنقل السريع: Match Pulse، Data Trust، تطوير أفضل الثوالث، وTournament Radar.</p>
            </div>
          </SectionShell>
        </div>
      </div>
    </main>
  );
}
