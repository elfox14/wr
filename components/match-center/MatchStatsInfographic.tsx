'use client';

import type { FC } from 'react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

// ─── Types ───────────────────────────────────────────────────────────────────
type Pair = { home: number | null; away: number | null } | null;
type Side = 'home' | 'away';
type PlayerCard = { name: string; number?: string | number | null; image?: string | null };

// ─── Arabic Team Names ────────────────────────────────────────────────────────
const AR_TEAM_NAMES: Record<string, string> = {
  swe: 'السويد', sweden: 'السويد', tun: 'تونس', tunisia: 'تونس',
  egy: 'مصر', egypt: 'مصر', arg: 'الأرجنتين', argentina: 'الأرجنتين',
  bra: 'البرازيل', brazil: 'البرازيل', fra: 'فرنسا', france: 'فرنسا',
  ger: 'ألمانيا', germany: 'ألمانيا', esp: 'إسبانيا', spain: 'إسبانيا',
  eng: 'إنجلترا', england: 'إنجلترا', por: 'البرتغال', portugal: 'البرتغال',
  bel: 'بلجيكا', belgium: 'بلجيكا', ned: 'هولندا', netherlands: 'هولندا',
  usa: 'أمريكا', 'united states': 'أمريكا', mex: 'المكسيك', mexico: 'المكسيك',
  can: 'كندا', canada: 'كندا', mar: 'المغرب', morocco: 'المغرب',
  ksa: 'السعودية', 'saudi arabia': 'السعودية', qat: 'قطر', qatar: 'قطر',
  irn: 'إيران', iran: 'إيران', nzl: 'نيوزيلندا', 'new zealand': 'نيوزيلندا',
  jor: 'الأردن', jordan: 'الأردن', irq: 'العراق', iraq: 'العراق',
  lbn: 'لبنان', lebanon: 'لبنان', pse: 'فلسطين', palestine: 'فلسطين',
  sau: 'السعودية', uae: 'الإمارات', 'united arab emirates': 'الإمارات',
  por2: 'البرتغال', jpn: 'اليابان', japan: 'اليابان', kor: 'كوريا الجنوبية',
  'south korea': 'كوريا الجنوبية', aus: 'أستراليا', australia: 'أستراليا',
  nig: 'نيجيريا', nigeria: 'نيجيريا', sen: 'السنغال', senegal: 'السنغال',
  civ: 'كوت ديفوار', cmr: 'الكاميرون', cameroon: 'الكاميرون',
  mex2: 'المكسيك', col: 'كولومبيا', colombia: 'كولومبيا',
  uru: 'أوروغواي', uruguay: 'أوروغواي', cro: 'كرواتيا', croatia: 'كرواتيا',
  srb: 'صربيا', serbia: 'صربيا', sui: 'سويسرا', switzerland: 'سويسرا',
  pol: 'بولندا', poland: 'بولندا', den: 'الدنمارك', denmark: 'الدنمارك',
};

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'ET'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

// ─── Utility Helpers ─────────────────────────────────────────────────────────
function n(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value: unknown, suffix = '') {
  const number = n(value);
  return number === null ? '—' : `${number.toLocaleString('ar-EG')}${suffix}`;
}

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function arr(...values: unknown[]) {
  for (const value of values) if (Array.isArray(value)) return value;
  return [];
}

function text(value: unknown) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function teamName(team: any, fallback: string) {
  const raw = String(team?.name || team?.code || fallback);
  const byName = AR_TEAM_NAMES[text(raw)];
  const byCode = AR_TEAM_NAMES[String(team?.code || '').toLowerCase()];
  return byName || byCode || raw;
}

function latest(match: any, provider: string) {
  return (match.statsSnapshots || []).find((s: any) => String(s.provider || '').toUpperCase().includes(provider));
}

function fallbackSnapshot(match: any) {
  return (match.statsSnapshots || []).find((s: any) => !String(s.provider || '').toUpperCase().includes('THE_STATS')) || match.statsSnapshots?.[0] || null;
}

function normalizeStatus(value: unknown) {
  return String(value || '').toUpperCase().trim();
}

function firstNumber(...values: unknown[]) {
  for (const value of values) { const number = n(value); if (number !== null) return number; }
  return null;
}

function rawData(snapshot: any) { return obj(snapshot?.rawData); }
function rawStats(snapshot: any) { const raw = rawData(snapshot); const nested = obj(raw.theStatsApi); return obj(raw.stats || raw.providerStats || nested.stats || nested.providerStats); }
function rawDerived(snapshot: any) { const raw = rawData(snapshot); const nested = obj(raw.theStatsApi); return obj(raw.derived || nested.derived); }
function rawLineup(snapshot: any) { const raw = rawData(snapshot); const nested = obj(raw.theStatsApi); return obj(raw.lineup || raw.lineups || nested.lineup || nested.lineups); }
function sideLineup(lineup: Record<string, any>, side: Side) { return obj(lineup[side]); }

function snapshotStatus(snapshot: any) {
  const raw = rawData(snapshot);
  const nested = obj(raw.theStatsApi);
  const fixtureStatus = obj(obj(raw.fixture).status);
  const nestedFixtureStatus = obj(obj(nested.fixture).status);
  return normalizeStatus(snapshot?.status || raw.status || obj(raw.status).short || raw.match_status || raw.matchStatus || fixtureStatus.short || fixtureStatus.long || nested.status || obj(nested.status).short || nested.match_status || nested.matchStatus || nestedFixtureStatus.short || nestedFixtureStatus.long);
}

function snapshotMinute(snapshot: any) {
  const raw = rawData(snapshot);
  const nested = obj(raw.theStatsApi);
  const fixtureStatus = obj(obj(raw.fixture).status);
  const nestedFixtureStatus = obj(obj(nested.fixture).status);
  return firstNumber(snapshot?.minute, snapshot?.elapsed, snapshot?.time, raw.minute, raw.elapsed, raw.matchMinute, raw.currentMinute, obj(raw.time).minute, fixtureStatus.elapsed, nested.minute, nested.elapsed, nested.matchMinute, nested.currentMinute, obj(nested.time).minute, nestedFixtureStatus.elapsed);
}

function matchClockLabel(match: any, ...snapshots: any[]) {
  const statuses = [normalizeStatus(match?.status), ...snapshots.map(snapshotStatus)].filter(Boolean);
  const status = statuses.find((v) => v) || '';
  if (FINISHED_STATUSES.includes(status)) return 'نهاية المباراة';
  if (HALF_TIME_STATUSES.includes(status)) return 'الاستراحة';
  if (LIVE_STATUSES.includes(status)) {
    if (status === '1H') return 'الشوط الأول';
    if (status === '2H') return 'الشوط الثاني';
    if (status === 'ET') return 'وقت إضافي';
    return 'مباشرة الآن';
  }
  if (SCHEDULED_STATUSES.includes(status) || !status) {
    const startMs = new Date(match?.matchDate || match?.startTime || '').getTime();
    if (Number.isFinite(startMs) && Date.now() > startMs + 5 * 60_000) return 'تأخر البدء';
    return 'لم تبدأ بعد';
  }
  return status;
}

function eventMinuteLabel(event: any) {
  return event?.minute !== null && event?.minute !== undefined ? `د${fmt(event.minute)}` : '—';
}

function pair(snapshot: any, stats: Record<string, any>, key: string, homeKey: string, awayKey: string): Pair {
  const home = n(snapshot?.[homeKey]);
  const away = n(snapshot?.[awayKey]);
  if (home !== null || away !== null) return { home, away };
  const stat = obj(stats[key]);
  const statHome = n(stat.home);
  const statAway = n(stat.away);
  return statHome === null && statAway === null ? null : { home: statHome, away: statAway };
}

function statPair(stats: Record<string, any>, key: string): Pair {
  const stat = obj(stats[key]);
  const home = n(stat.home);
  const away = n(stat.away);
  return home === null && away === null ? null : { home, away };
}

function derivedPair(value: unknown): Pair {
  const data = obj(value);
  const home = n(data.home);
  const away = n(data.away);
  return home === null && away === null ? null : { home, away };
}

function share(value: Pair) {
  const home = Math.max(0, Number(value?.home ?? 0));
  const away = Math.max(0, Number(value?.away ?? 0));
  const total = home + away;
  if (!total) return { home: 50, away: 50 };
  return { home: Math.max(4, Math.min(96, (home / total) * 100)), away: 0 };
}

function parsePlayer(row: any): PlayerCard | null {
  const player = obj(row?.player || row?.athlete || row?.person);
  const name = player.name || player.full_name || row?.name || row?.playerName || row?.display_name;
  if (!name) return null;
  return {
    name: String(name),
    number: player.shirt_number || player.jersey_number || player.number || row?.shirt_number || row?.jersey_number || row?.number || null,
    image: player.image || player.photo || player.image_url || row?.image || row?.photo || row?.image_url || null,
  };
}

function matchAsset(player: PlayerCard, squad: any[]) {
  const key = text(player.name);
  return squad.find((a) => text(a.name) === key || text(a.code) === key) || squad.find((a) => text(a.name).includes(key) || key.includes(text(a.name)));
}

function withImages(players: PlayerCard[], squad: any[]) {
  return players.map((p) => { const a = matchAsset(p, squad); return { ...p, image: p.image || a?.image || null }; });
}

function lineupPlayers(lineup: Record<string, any>, squad: any[]) {
  const official = arr(lineup.startingXi, lineup.startingXI, lineup.starting_xi, lineup.starters, lineup.lineup).map(parsePlayer).filter(Boolean) as PlayerCard[];
  if (official.length) return withImages(official.slice(0, 11), squad);
  return squad.slice(0, 11).map((p) => ({ name: p.name, image: p.image, number: p.code }));
}

function usedSubs(lineup: Record<string, any>, squad: any[]) {
  const rows = arr(lineup.usedSubstitutes, lineup.substitutesUsed, lineup.substitutedIn, lineup.used_substitutes, lineup.substitutions).map(parsePlayer).filter(Boolean) as PlayerCard[];
  return withImages(rows, squad);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('');
}

function formationRows(formation?: string | null) {
  const rows = String(formation || '').split(/[-–—]/).map((p) => Number(p.trim())).filter((v) => Number.isFinite(v) && v > 0 && v <= 6);
  return rows.length ? [1, ...rows] : [1, 4, 3, 3];
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
function PlayerDot({ player, side }: { player: PlayerCard; side: Side }) {
  const ring = side === 'home' ? '#3B8BFF' : '#FFD700';
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <div
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-black/70"
        style={{ border: `2px solid ${ring}66`, boxShadow: `0 0 10px ${ring}33` }}
      >
        {player.image ? (
          <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[9px] font-black text-white">{initials(player.name)}</span>
        )}
        {player.number ? (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#FFD700] px-0.5 text-[7px] font-black text-black">{player.number}</span>
        ) : null}
      </div>
      <p className="max-w-[48px] truncate text-[8px] font-bold text-white/80">{player.name}</p>
    </div>
  );
}

function Pitch({ players, formation, side }: { players: PlayerCard[]; formation?: string | null; side: Side }) {
  const padded = [...players];
  while (padded.length < 11) padded.push({ name: '؟' });
  let cursor = 0;
  const lines = formationRows(formation).map((count) => { const line = padded.slice(cursor, cursor + count); cursor += count; return line; });
  return (
    <div
      className="relative h-[280px] overflow-hidden rounded-xl p-2"
      style={{
        background: 'linear-gradient(180deg, #0a1a0a 0%, #0d2b0d 50%, #0a1a0a 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {/* field lines */}
      <div className="absolute inset-2 rounded-lg border border-white/10" />
      <div className="absolute left-1/2 top-2 h-[calc(100%-16px)] w-px -translate-x-1/2 bg-white/10" />
      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-2 h-8 w-16 -translate-x-1/2 rounded-b-lg border-b border-l border-r border-white/10" />
      <div className="absolute bottom-2 left-1/2 h-8 w-16 -translate-x-1/2 rounded-t-lg border-l border-r border-t border-white/10" />
      <div className="relative z-10 flex h-full flex-col-reverse justify-between pb-1 pt-1">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-center justify-around">
            {line.map((player, pidx) => <PlayerDot key={`${player.name}-${pidx}`} player={player} side={side} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfographicStatRow({ label, value, suffix = '', icon }: { label: string; value: Pair; suffix?: string; icon?: string }) {
  const homeVal = value?.home ?? 0;
  const awayVal = value?.away ?? 0;
  const total = Number(homeVal) + Number(awayVal);
  const homeW = total ? Math.max(4, Math.min(96, (Number(homeVal) / total) * 100)) : 50;
  const awayW = 100 - homeW;
  return (
    <div
      className="grid items-center gap-3 border-b py-3 last:border-b-0"
      style={{
        gridTemplateColumns: '64px 1fr auto 1fr 64px',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Home value */}
      <div className="text-center">
        <span className="text-xl font-black tabular-nums" style={{ color: '#3B8BFF' }}>
          {fmt(value?.home, suffix)}
        </span>
      </div>
      {/* Home bar */}
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${homeW}%`, marginLeft: 'auto', background: 'linear-gradient(to left, #3B8BFF, #74b0ff)' }}
        />
      </div>
      {/* Label */}
      <div
        className="min-w-[100px] rounded-lg px-2 py-1.5 text-center text-[11px] font-black text-white"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {icon ? <span className="mr-1">{icon}</span> : null}{label}
      </div>
      {/* Away bar */}
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${awayW}%`, background: 'linear-gradient(to right, #FFD700, #ffe566)' }}
        />
      </div>
      {/* Away value */}
      <div className="text-center">
        <span className="text-xl font-black tabular-nums" style={{ color: '#FFD700' }}>
          {fmt(value?.away, suffix)}
        </span>
      </div>
    </div>
  );
}

function InfographicAdvancedRow({ label, homeVal, awayVal }: { label: string; homeVal: string; awayVal: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="text-lg font-black tabular-nums" style={{ color: '#3B8BFF' }}>{homeVal}</span>
      <span className="text-[11px] font-bold text-white/70">{label}</span>
      <span className="text-lg font-black tabular-nums" style={{ color: '#FFD700' }}>{awayVal}</span>
    </div>
  );
}

function EventTimeline({ events }: { events: any[] }) {
  const goalEvents = events.filter((e) => {
    const type = String(e.type || e.detail || '').toLowerCase();
    return type.includes('goal') || type.includes('هدف');
  });
  const cornerEvents = events.filter((e) => {
    const type = String(e.type || e.detail || '').toLowerCase();
    return type.includes('corner') || type.includes('ركنية');
  });
  const allEv = events.slice(0, 10);
  return (
    <div className="space-y-2">
      {allEv.map((event, idx) => {
        const type = String(event.type || event.detail || '');
        const isGoal = type.toLowerCase().includes('goal') || type.toLowerCase().includes('هدف');
        const isCard = type.toLowerCase().includes('card') || type.toLowerCase().includes('بطاقة');
        const isCorner = type.toLowerCase().includes('corner') || type.toLowerCase().includes('ركنية');
        const icon = isGoal ? '⚽' : isCard ? '🟨' : isCorner ? '🚩' : '•';
        const side = event.teamSide === 'home' || event.homeTeam ? 'home' : 'away';
        return (
          <div key={idx} className="flex items-center gap-2 py-1">
            <span className="w-8 text-center text-[11px] font-black" style={{ color: '#FFD700' }}>{eventMinuteLabel(event)}</span>
            <span className="text-sm">{icon}</span>
            <span className="flex-1 text-[11px] font-bold text-white/80 truncate">{event.playerName || event.detail || event.type || 'حدث'}</span>
            <span className="text-[10px] font-bold" style={{ color: side === 'home' ? '#3B8BFF' : '#FFD700' }}>{side === 'home' ? '●' : '●'}</span>
          </div>
        );
      })}
      {events.length === 0 && <p className="py-4 text-center text-sm font-bold text-white/30">لا توجد أحداث</p>}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function MatchStatsInfographic({ match }: { match: any }) {
  const baseSnapshot = latest(match, 'ISPORTS') || fallbackSnapshot(match);
  const theStats = latest(match, 'THE_STATS');
  const stats = rawStats(theStats);
  const lineup = rawLineup(theStats);
  const derived = rawDerived(theStats);
  const homeSquad = (match.squadPlayers || []).filter((p: any) => p.teamId === match.homeTeamId);
  const awaySquad = (match.squadPlayers || []).filter((p: any) => p.teamId === match.awayTeamId);
  const matchClock = matchClockLabel(match, baseSnapshot, theStats);

  const xg = statPair(stats, 'xg');
  const npxg = statPair(stats, 'npxg');
  const bigChances = statPair(stats, 'bigChances');
  const shotsOffTarget = derivedPair(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked) || pair(baseSnapshot, stats, 'shotsOffTarget', 'homeShotsOffTarget', 'awayShotsOffTarget');

  const statRows = [
    { label: 'الاستحواذ', value: pair(baseSnapshot, stats, 'possession', 'homePossession', 'awayPossession'), suffix: '%', icon: '⏱' },
    { label: 'الهجمات', value: pair(baseSnapshot, stats, 'attacks', 'homeAttacks', 'awayAttacks'), icon: '⚡' },
    { label: 'الهجمات الخطيرة', value: pair(baseSnapshot, stats, 'dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks'), icon: '🎯' },
    { label: 'التسديدات', value: pair(baseSnapshot, stats, 'shots', 'homeShots', 'awayShots'), icon: '🦵' },
    { label: 'على المرمى', value: pair(baseSnapshot, stats, 'shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget'), icon: '🟦' },
    { label: 'تسديدات خارج المرمى', value: shotsOffTarget, icon: '↗' },
    { label: 'الركنيات', value: pair(baseSnapshot, stats, 'corners', 'homeCorners', 'awayCorners'), icon: '🚩' },
    { label: 'بطاقات صفراء', value: pair(baseSnapshot, stats, 'yellowCards', 'homeYellowCards', 'awayYellowCards'), icon: '🟨' },
    { label: 'بطاقات حمراء', value: pair(baseSnapshot, stats, 'redCards', 'homeRedCards', 'awayRedCards'), icon: '🟥' },
  ];

  const homeLineup = sideLineup(lineup, 'home');
  const awayLineup = sideLineup(lineup, 'away');
  const homePlayers = lineupPlayers(homeLineup, homeSquad);
  const awayPlayers = lineupPlayers(awayLineup, awaySquad);
  const homeFormation = String(homeLineup.formation || homeLineup.shape || '') || null;
  const awayFormation = String(awayLineup.formation || awayLineup.shape || '') || null;
  const homeSubs = usedSubs(homeLineup, homeSquad);
  const awaySubs = usedSubs(awayLineup, awaySquad);

  const homeFlagUrl = getTeamFlagUrl({ code: match.homeTeam?.code, name: match.homeTeam?.name, image: match.homeTeam?.image }, 160);
  const awayFlagUrl = getTeamFlagUrl({ code: match.awayTeam?.code, name: match.awayTeam?.name, image: match.awayTeam?.image }, 160);

  const homeNameAr = teamName(match.homeTeam, 'الفريق الأول');
  const awayNameAr = teamName(match.awayTeam, 'الفريق الثاني');

  const isLive = LIVE_STATUSES.includes(normalizeStatus(match?.status));
  const isFinished = FINISHED_STATUSES.includes(normalizeStatus(match?.status));

  return (
    <main
      className="min-h-screen px-3 py-4 text-white"
      dir="rtl"
      style={{
        background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1220 50%, #080c18 100%)',
        fontFamily: "'Tajawal', 'Cairo', 'Segoe UI', sans-serif",
      }}
    >
      <div className="mx-auto max-w-5xl space-y-4">
        {/* ── Header ── */}
        <section
          className="relative overflow-hidden rounded-2xl px-5 py-5 text-center"
          style={{
            background: 'linear-gradient(135deg, #0d1a2e 0%, #111827 100%)',
            border: '1px solid rgba(59,139,255,0.20)',
            boxShadow: '0 0 60px rgba(59,139,255,0.08), 0 0 60px rgba(255,215,0,0.06)',
          }}
        >
          {/* bg decoration */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 15% 10%, rgba(59,139,255,0.15) 0%, transparent 45%), radial-gradient(ellipse at 85% 10%, rgba(255,215,0,0.12) 0%, transparent 45%)',
            }}
          />
          <div className="relative">
            <h1 className="text-2xl font-black sm:text-4xl" style={{ color: '#FFD700', letterSpacing: '0.03em' }}>
              إحصائيـات المباراة
            </h1>
            <p className="mt-1 text-[11px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              عرض موحد للأرقام والاحداث في مكان واحد
            </p>
          </div>

          {/* Score Row */}
          <div className="relative mt-6 grid items-center gap-4" style={{ gridTemplateColumns: '1fr auto 1fr' }} dir="ltr">
            {/* Home */}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div
                className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-2xl sm:h-20 sm:w-24"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '2px solid rgba(59,139,255,0.45)',
                  boxShadow: '0 0 30px rgba(59,139,255,0.20)',
                }}
              >
                {homeFlagUrl ? (
                  <img src={homeFlagUrl} alt={homeNameAr} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-lg font-black" style={{ color: '#3B8BFF' }}>{match.homeTeam?.code || '?'}</span>
                )}
              </div>
              <p className="text-lg font-black text-white sm:text-2xl">{homeNameAr}</p>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex items-center gap-3 rounded-2xl px-5 py-2"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <span className="text-5xl font-black tabular-nums sm:text-6xl" style={{ color: '#3B8BFF' }}>{fmt(match.homeScore)}</span>
                <span className="text-3xl font-black text-white/40">-</span>
                <span className="text-5xl font-black tabular-nums sm:text-6xl" style={{ color: '#FFD700' }}>{fmt(match.awayScore)}</span>
              </div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1 text-[11px] font-black"
                style={{
                  background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(255,215,0,0.10)',
                  border: isLive ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,215,0,0.25)',
                  color: isLive ? '#ef4444' : '#FFD700',
                }}
              >
                {isLive && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                {matchClock}
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-end gap-2 sm:flex-row-reverse sm:items-center sm:gap-4">
              <div
                className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-2xl sm:h-20 sm:w-24"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '2px solid rgba(255,215,0,0.45)',
                  boxShadow: '0 0 30px rgba(255,215,0,0.18)',
                }}
              >
                {awayFlagUrl ? (
                  <img src={awayFlagUrl} alt={awayNameAr} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-lg font-black" style={{ color: '#FFD700' }}>{match.awayTeam?.code || '?'}</span>
                )}
              </div>
              <p className="text-lg font-black text-white sm:text-2xl">{awayNameAr}</p>
            </div>
          </div>
        </section>

        {/* ── Stats Board ── */}
        <section
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, #0d1626 0%, #111827 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Header row */}
          <div className="mb-3 grid items-center gap-2" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            <span className="font-black" style={{ color: '#3B8BFF' }}>{homeNameAr}</span>
            <div
              className="rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/50"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              الإحصاءات
            </div>
            <span className="text-left font-black" style={{ color: '#FFD700' }}>{awayNameAr}</span>
          </div>
          <div className="rounded-xl px-1 sm:px-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
            {statRows.map((row) => (
              <InfographicStatRow key={row.label} label={row.label} value={row.value} suffix={row.suffix} icon={row.icon} />
            ))}
          </div>
        </section>

        {/* ── Advanced Stats + Events ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Advanced */}
          <section
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, #0d1626 0%, #111827 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black" style={{ color: '#3B8BFF' }}>إحصائيات متقدمة</h2>
              <div className="flex gap-6 text-[10px] font-black">
                <span style={{ color: '#3B8BFF' }}>{homeNameAr}</span>
                <span className="text-white/30">xG / npxG</span>
                <span style={{ color: '#FFD700' }}>{awayNameAr}</span>
              </div>
            </div>
            <div className="space-y-2">
              <InfographicAdvancedRow label="xG الأهداف المتوقعة" homeVal={xg ? `${n(xg.home)?.toFixed(2) ?? '—'}` : '—'} awayVal={xg ? `${n(xg.away)?.toFixed(2) ?? '—'}` : '—'} />
              <InfographicAdvancedRow label="npxG بدون ركلات جزاء" homeVal={npxg ? `${n(npxg.home)?.toFixed(2) ?? '—'}` : '—'} awayVal={npxg ? `${n(npxg.away)?.toFixed(2) ?? '—'}` : '—'} />
              <InfographicAdvancedRow label="الفرص الكبيرة Big Chances" homeVal={bigChances ? `${fmt(bigChances.home)}` : '—'} awayVal={bigChances ? `${fmt(bigChances.away)}` : '—'} />
            </div>
          </section>

          {/* Events */}
          <section
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, #0d1626 0%, #111827 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black" style={{ color: '#FFD700' }}>أحداث المباراة</h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-black text-white/50"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {match.events?.length ?? 0} حدث
              </span>
            </div>
            <EventTimeline events={match.events || []} />
          </section>
        </div>

        {/* ── Lineups ── */}
        <section
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, #0d1626 0%, #111827 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 className="mb-4 text-base font-black text-white">التشكيلات المؤكدة</h2>
          <div className="grid gap-4 lg:grid-cols-2" dir="ltr">
            {/* Home Lineup */}
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(59,139,255,0.04)', border: '1px solid rgba(59,139,255,0.15)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">{homeNameAr}</p>
                  <p className="text-[10px] font-bold text-white/40">١١ لاعبًا أساسيًا • {homeSubs.length} بديل</p>
                </div>
                <span
                  className="rounded-lg px-2.5 py-1 text-base font-black"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.10)', color: '#3B8BFF' }}
                >
                  {homeFormation || '—'}
                </span>
              </div>
              <Pitch players={homePlayers} formation={homeFormation} side="home" />
              {homeSubs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {homeSubs.map((p, i) => <PlayerDot key={i} player={p} side="home" />)}
                </div>
              )}
            </div>
            {/* Away Lineup */}
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">{awayNameAr}</p>
                  <p className="text-[10px] font-bold text-white/40">١١ لاعبًا أساسيًا • {awaySubs.length} بديل</p>
                </div>
                <span
                  className="rounded-lg px-2.5 py-1 text-base font-black"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.10)', color: '#FFD700' }}
                >
                  {awayFormation || '—'}
                </span>
              </div>
              <Pitch players={awayPlayers} formation={awayFormation} side="away" />
              {awaySubs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {awaySubs.map((p, i) => <PlayerDot key={i} player={p} side="away" />)}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Intelligence Footer ── */}
        <section
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, #0d1626 0%, #111827 100%)',
            border: '1px solid rgba(255,215,0,0.15)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: 'rgba(255,215,0,0.2)' }} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: '#FFD700' }}>Match Intelligence</span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,215,0,0.2)' }} />
          </div>
          <p className="mb-3 text-center text-lg font-black text-white">قراءة ذكية للمباراة</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 – Dangerous attacks diff */}
            {(() => {
              const da = pair(baseSnapshot, stats, 'dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks');
              const diff = da ? Math.abs(Number(da.home ?? 0) - Number(da.away ?? 0)) : 0;
              const leader = da && Number(da.home ?? 0) > Number(da.away ?? 0) ? homeNameAr : awayNameAr;
              return (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-2xl">🎯</p>
                  <p className="mt-1 text-[11px] font-bold text-white/60">أكثر خطورة</p>
                  <p className="mt-1 text-sm font-black text-white">{leader}</p>
                  <p className="text-[11px] font-bold" style={{ color: '#FFD700' }}>بفارق {diff} هجمة خطيرة</p>
                </div>
              );
            })()}
            {/* Card 2 – xG diff */}
            {(() => {
              const homeXg = n(xg?.home);
              const awayXg = n(xg?.away);
              const diff = homeXg !== null && awayXg !== null ? Math.abs(homeXg - awayXg).toFixed(2) : null;
              const leader = homeXg !== null && awayXg !== null && homeXg > awayXg ? homeNameAr : awayNameAr;
              return (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-2xl">📊</p>
                  <p className="mt-1 text-[11px] font-bold text-white/60">صنع أعلى جودة</p>
                  <p className="mt-1 text-sm font-black text-white">{leader}</p>
                  <p className="text-[11px] font-bold" style={{ color: '#FFD700' }}>بفارق {diff ?? '—'} xG</p>
                </div>
              );
            })()}
            {/* Card 3 – Possession */}
            {(() => {
              const poss = pair(baseSnapshot, stats, 'possession', 'homePossession', 'awayPossession');
              const homeP = n(poss?.home);
              const awayP = n(poss?.away);
              const leader = homeP !== null && awayP !== null && homeP > awayP ? homeNameAr : awayNameAr;
              const leaderVal = homeP !== null && awayP !== null ? Math.max(homeP, awayP) : null;
              const otherVal = homeP !== null && awayP !== null ? Math.min(homeP, awayP) : null;
              return (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-2xl">⏱</p>
                  <p className="mt-1 text-[11px] font-bold text-white/60">أفضل في الاستحواذ</p>
                  <p className="mt-1 text-sm font-black text-white">{leader}</p>
                  <p className="text-[11px] font-bold" style={{ color: '#3B8BFF' }}>{leaderVal ?? '—'}% مقابل {otherVal ?? '—'}%</p>
                </div>
              );
            })()}
            {/* Card 4 – Shots on target */}
            {(() => {
              const sot = pair(baseSnapshot, stats, 'shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget');
              const homeS = n(sot?.home);
              const awayS = n(sot?.away);
              const leader = homeS !== null && awayS !== null && homeS > awayS ? homeNameAr : awayNameAr;
              return (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-2xl">🥅</p>
                  <p className="mt-1 text-[11px] font-bold text-white/60">أكثر فاعلية على المرمى</p>
                  <p className="mt-1 text-sm font-black text-white">{leader}</p>
                  <p className="text-[11px] font-bold" style={{ color: '#3B8BFF' }}>{fmt(sot?.home)} مقابل {fmt(sot?.away)}</p>
                </div>
              );
            })()}
          </div>
        </section>
      </div>
    </main>
  );
}
