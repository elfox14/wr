'use client';

import { usePathname } from 'next/navigation';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Row = { team: string; code: string; points: number; goalDifference: number; goalsFor: number };
type Group = { key: string; standings: Row[] };
type Qualifier = { group: string; rank: 1 | 2 | 3; row: Row; thirdRank?: number };
type Future = { no: number; from: [number, number] };
type TeamLite = { id?: string | null; name?: string | null; code?: string | null; image?: string | null; group?: string | null };
type KnockoutMatch = {
  id?: string | null;
  externalId?: string | null;
  animationMatchId?: number | null;
  externalIds?: unknown;
  matchDate?: string | Date | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  groupPhase?: string | null;
  stage?: string | null;
  syncSource?: string | null;
  lastSyncedAt?: string | Date | null;
  homeTeam?: TeamLite | null;
  awayTeam?: TeamLite | null;
};
type Props = { groups?: Group[] | unknown[]; knockoutMatches?: KnockoutMatch[] | unknown[] };
type DisplayTeam = { id?: string | null; name: string; code?: string | null; image?: string | null; seed?: string; row?: Row | null };

const nf = new Intl.NumberFormat('ar-EG');
const GROUPS = 'ABCDEFGHIJKL'.split('');
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'BT'];
const HALF = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const SCHEDULED = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

const R32 = [
  [73, '2A', '2B'], [75, '1F', '2C'], [74, '1E', '3ABCDF'], [77, '1I', '3CDFGH'],
  [83, '2K', '2L'], [84, '1H', '2J'], [81, '1D', '3BEFIJ'], [82, '1G', '3AEHIJ'],
  [76, '1C', '2F'], [78, '2E', '2I'], [79, '1A', '3CEFHI'], [80, '1L', '3EHIJK'],
  [86, '1J', '2H'], [88, '2D', '2G'], [85, '1B', '3EFGIJ'], [87, '1K', '3DEIJL'],
] as const;

const R16: Future[] = [[89, 73, 75], [90, 74, 77], [93, 83, 84], [94, 81, 82], [91, 76, 78], [92, 79, 80], [95, 86, 88], [96, 85, 87]].map(([no, a, b]) => ({ no, from: [a, b] as [number, number] }));
const QF: Future[] = [[97, 89, 90], [98, 93, 94], [99, 91, 92], [100, 95, 96]].map(([no, a, b]) => ({ no, from: [a, b] as [number, number] }));
const SF: Future[] = [[101, 97, 98], [102, 99, 100]].map(([no, a, b]) => ({ no, from: [a, b] as [number, number] }));
const FINAL: Future = { no: 104, from: [101, 102] };
const THIRD: Future = { no: 103, from: [101, 102] };

const LEFT_R32 = [73, 75, 74, 77, 83, 84, 81, 82];
const RIGHT_R32 = [76, 78, 79, 80, 86, 88, 85, 87];
const LEFT_R16 = [89, 90, 93, 94];
const RIGHT_R16 = [91, 92, 95, 96];
const LEFT_QF = [97, 98];
const RIGHT_QF = [99, 100];

function isGroups(value: unknown): value is Group[] {
  return Array.isArray(value) && value.every((group) => group && typeof (group as Group).key === 'string' && Array.isArray((group as Group).standings));
}

function isMatches(value: unknown): value is KnockoutMatch[] {
  return Array.isArray(value) && value.every((match) => match && typeof match === 'object');
}

function statusValue(match?: KnockoutMatch | null) { return String(match?.status || '').trim().toUpperCase(); }
function isFinished(match?: KnockoutMatch | null) { return FINISHED.includes(statusValue(match)); }
function isLive(match?: KnockoutMatch | null) { return LIVE.includes(statusValue(match)) || HALF.includes(statusValue(match)); }
function isScheduled(match?: KnockoutMatch | null) { return !match || SCHEDULED.includes(statusValue(match)); }
function matchLabel(no: number) { return `مباراة ${nf.format(no)}`; }
function winner(no: number) { return `فائز ${nf.format(no)}`; }
function loser(no: number) { return `خاسر ${nf.format(no)}`; }
function teamName(row?: Row | null) { return row ? getArabicTeamName(row.code, row.team) : 'غير محدد'; }
function normalize(value?: string | number | null) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ''); }
function codeKey(value?: string | null) { return String(value || '').trim().toUpperCase(); }
function dateTime(value?: string | Date | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(date);
}

function stageKey(match: KnockoutMatch): 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'third' | 'other' {
  const raw = `${match.stage || ''} ${match.groupPhase || ''}`.toLowerCase();
  if (raw.includes('third') || raw.includes('المركز الثالث')) return 'third';
  if (raw.includes('semi') || raw.includes('نصف')) return 'sf';
  if (raw.includes('quarter') || raw.includes('ربع')) return 'qf';
  if (raw.includes('32') || raw.includes('r32') || raw.includes('last_32')) return 'r32';
  if (raw.includes('16') || raw.includes('r16') || raw.includes('last_16')) return 'r16';
  if (raw.includes('final') || raw.includes('النهائي')) return 'final';
  return 'other';
}

function formatStatus(match?: KnockoutMatch | null) {
  if (!match) return 'بانتظار المصدر';
  const status = statusValue(match);
  if (HALF.includes(status)) return 'استراحة';
  if (isLive(match)) return 'مباشر';
  if (isFinished(match)) return status === 'PEN' ? 'حُسمت بركلات الترجيح' : 'انتهت';
  if (isScheduled(match)) return 'لم تبدأ';
  return status || 'مباراة';
}

function displayTeamFromRow(row: Row | null | undefined, seed: string): DisplayTeam {
  return { name: teamName(row), code: row?.code || null, image: null, seed, row: row || null };
}

function displayTeamFromMatch(team?: TeamLite | null, seed?: string): DisplayTeam {
  const name = getArabicTeamName(team?.code || null, team?.name || '') || 'غير محدد';
  return { id: team?.id || null, name, code: team?.code || null, image: team?.image || null, seed };
}

function flagUrl(team?: DisplayTeam | null) {
  if (!team) return null;
  return team.image || getTeamFlagUrl({ code: team.code || null, name: team.name, image: null }, 64);
}

function teamKey(team?: DisplayTeam | TeamLite | null) {
  if (!team) return '';
  const code = codeKey(team.code);
  return code || normalize(team.name);
}

function pairKey(a?: DisplayTeam | TeamLite | null, b?: DisplayTeam | TeamLite | null) {
  return [teamKey(a), teamKey(b)].filter(Boolean).sort().join('|');
}

function scoreVisible(match?: KnockoutMatch | null) { return Boolean(match) && !isScheduled(match); }
function scoreText(match?: KnockoutMatch | null) { return scoreVisible(match) ? `${nf.format(Number(match?.homeScore ?? 0))} - ${nf.format(Number(match?.awayScore ?? 0))}` : 'VS'; }

function winnerSide(match?: KnockoutMatch | null): 'home' | 'away' | null {
  if (!match || !isFinished(match)) return null;
  const home = Number(match.homeScore ?? 0);
  const away = Number(match.awayScore ?? 0);
  if (home > away) return 'home';
  if (away > home) return 'away';
  return null;
}

function winnerTeam(match?: KnockoutMatch | null) {
  const side = winnerSide(match);
  if (side === 'home') return displayTeamFromMatch(match?.homeTeam);
  if (side === 'away') return displayTeamFromMatch(match?.awayTeam);
  return null;
}

function extractNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 73 && value <= 104) return value;
  if (typeof value === 'string') {
    const exact = Number(value.trim());
    if (Number.isInteger(exact) && exact >= 73 && exact <= 104) return exact;
    const named = value.match(/(?:match|fixture|game)[_\s-]*(7[3-9]|8\d|9\d|10[0-4])/i)?.[1];
    if (named) return Number(named);
  }
  return null;
}

function extractMatchNumber(match: KnockoutMatch) {
  const direct = extractNumber(match.externalId) || extractNumber(match.animationMatchId);
  if (direct) return direct;
  const stack: unknown[] = [match.externalIds];
  while (stack.length) {
    const item = stack.pop();
    const n = extractNumber(item);
    if (n) return n;
    if (item && typeof item === 'object') Object.values(item as Record<string, unknown>).forEach((value) => stack.push(value));
  }
  return null;
}

function buildQualifiers(groups: Group[]) {
  const byGroup = new Map(groups.map((group) => [String(group.key).toUpperCase(), group]));
  const all: Qualifier[] = [];
  GROUPS.forEach((group) => {
    const rows = byGroup.get(group)?.standings || [];
    if (rows[0]) all.push({ group, rank: 1, row: rows[0] });
    if (rows[1]) all.push({ group, rank: 2, row: rows[1] });
    if (rows[2]) all.push({ group, rank: 3, row: rows[2] });
  });
  const bestThirds = all
    .filter((item) => item.rank === 3)
    .sort((a, b) => b.row.points - a.row.points || b.row.goalDifference - a.row.goalDifference || b.row.goalsFor - a.row.goalsFor || teamName(a.row).localeCompare(teamName(b.row), 'ar'))
    .slice(0, 8)
    .map((item, index) => ({ ...item, thirdRank: index + 1 }));
  return { direct: all.filter((item) => item.rank !== 3), bestThirds };
}

function assignThirds(bestThirds: Qualifier[]) {
  const assigned = new Map<number, Qualifier>();
  const used = new Set<string>();
  const thirdSlots = R32.map(([no, home, away]) => ({ no, slot: home.startsWith('3') ? home : away.startsWith('3') ? away : '' })).filter((item) => item.slot);
  thirdSlots.forEach(({ no, slot }) => {
    const candidate = bestThirds.find((item) => slot.includes(item.group) && !used.has(item.group));
    if (candidate) {
      assigned.set(no, candidate);
      used.add(candidate.group);
    }
  });
  return assigned;
}

function resolveSlot(slot: string, direct: Qualifier[], thirds: Map<number, Qualifier>, matchNo: number) {
  const q = slot.startsWith('3') ? thirds.get(matchNo) || null : direct.find((item) => `${item.rank}${item.group}` === slot) || null;
  const seed = q ? `${q.rank}${q.group}` : slot.startsWith('3') ? `3 ${slot.slice(1).split('').join('/')}` : slot;
  return displayTeamFromRow(q?.row || null, seed);
}

function groupMatches(matches: KnockoutMatch[]) {
  const buckets = { r32: [] as KnockoutMatch[], r16: [] as KnockoutMatch[], qf: [] as KnockoutMatch[], sf: [] as KnockoutMatch[], final: [] as KnockoutMatch[], third: [] as KnockoutMatch[] };
  matches.forEach((match) => {
    const key = stageKey(match);
    if (key in buckets) buckets[key as keyof typeof buckets].push(match);
  });
  Object.values(buckets).forEach((list) => list.sort((a, b) => new Date(a.matchDate || 0).getTime() - new Date(b.matchDate || 0).getTime()));
  return buckets;
}

function makeIndexes(matches: KnockoutMatch[]) {
  const byNo = new Map<number, KnockoutMatch>();
  const byPair = new Map<string, KnockoutMatch>();
  matches.forEach((match) => {
    const no = extractMatchNumber(match);
    if (no) byNo.set(no, match);
    const key = pairKey(match.homeTeam, match.awayTeam);
    if (key) byPair.set(key, match);
  });
  return { byNo, byPair };
}

function TeamLine({ team, score, winner = false, reverse = false }: { team: DisplayTeam; score?: number | null; winner?: boolean; reverse?: boolean }) {
  const flag = flagUrl(team);
  return (
    <div className={`flex h-8 items-center gap-1.5 rounded-md border px-1.5 ${winner ? 'border-[#FFD700]/45 bg-[#FFD700]/15' : 'border-white/10 bg-white/[0.035]'} ${reverse ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <span className="flex h-6 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/20 bg-white">
        {flag ? <img src={flag} alt={`علم ${team.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-[8px] text-black">{team.seed || team.code || '—'}</b>}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[8px] leading-3 text-white">{team.name}</b>
        <span className="block text-[7px] font-black text-gray-500">{team.seed || team.code || '—'}</span>
      </span>
      {score !== null && score !== undefined ? <b className="shrink-0 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-[#FFD700]">{nf.format(score)}</b> : null}
    </div>
  );
}

function StatusPill({ match }: { match?: KnockoutMatch | null }) {
  const live = isLive(match);
  const finished = isFinished(match);
  return <span className={`rounded-full px-2 py-0.5 text-[7px] font-black ${live ? 'bg-[#00FF88]/15 text-[#00FF88]' : finished ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-white/10 text-gray-300'}`}>{formatStatus(match)}</span>;
}

function WinnerBox({ no, match }: { no: number; match?: KnockoutMatch | null }) {
  const team = winnerTeam(match);
  const flag = flagUrl(team);
  return (
    <div className="flex h-[54px] w-[70px] items-center justify-center rounded-lg border border-black/10 bg-white text-center text-black shadow-[0_8px_18px_rgba(0,0,0,.35)]">
      <div className="min-w-0 px-1">
        <div className="text-[6px] font-black text-slate-400">الفائز</div>
        {team ? <div className="mt-0.5 flex items-center justify-center gap-1"><span className="h-4 w-5 overflow-hidden rounded-sm border border-black/10 bg-slate-100">{flag ? <img src={flag} alt={team.name} className="h-full w-full object-cover" /> : null}</span><b className="truncate text-[8px]">{team.name}</b></div> : <div className="text-[8px] font-black">{winner(no)}</div>}
      </div>
    </div>
  );
}

function R32MatchBlock({ no, direct, thirds, side, match }: { no: number; direct: Qualifier[]; thirds: Map<number, Qualifier>; side: 'left' | 'right'; match?: KnockoutMatch | null }) {
  const item = R32.find(([matchNo]) => matchNo === no);
  if (!item) return null;
  const homeSeed = resolveSlot(item[1], direct, thirds, no);
  const awaySeed = resolveSlot(item[2], direct, thirds, no);
  const home = match ? displayTeamFromMatch(match.homeTeam, homeSeed.seed) : homeSeed;
  const away = match ? displayTeamFromMatch(match.awayTeam, awaySeed.seed) : awaySeed;
  const winningSide = winnerSide(match);
  const showScore = scoreVisible(match);
  const teams = (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-1 text-[7px] font-black text-gray-500"><span>{matchLabel(no)}</span><StatusPill match={match} /></div>
      <TeamLine team={home} score={showScore ? match?.homeScore : null} winner={winningSide === 'home'} reverse={side === 'right'} />
      <TeamLine team={away} score={showScore ? match?.awayScore : null} winner={winningSide === 'away'} reverse={side === 'right'} />
      {match ? <div className="truncate text-[7px] font-bold text-gray-500">{dateTime(match.matchDate)}{match.syncSource ? ` · ${match.syncSource}` : ''}</div> : null}
    </div>
  );
  const win = <WinnerBox no={no} match={match} />;
  return <div className={`grid items-center gap-1.5 ${side === 'left' ? 'grid-cols-[minmax(0,1fr)_70px]' : 'grid-cols-[70px_minmax(0,1fr)]'}`}>{side === 'left' ? <>{teams}{win}</> : <>{win}{teams}</>}</div>;
}

function FutureMatchBox({ item, stage, match, useLoser = false, big = false }: { item: Future; stage: string; match?: KnockoutMatch | null; useLoser?: boolean; big?: boolean }) {
  const label = useLoser ? `${loser(item.from[0])} / ${loser(item.from[1])}` : `${winner(item.from[0])} / ${winner(item.from[1])}`;
  const team = winnerTeam(match);
  return (
    <div className={`flex items-center justify-center rounded-lg border border-black/10 bg-white px-1.5 text-center text-black shadow-[0_8px_18px_rgba(0,0,0,.35)] ${big ? 'h-[62px] w-[96px]' : 'h-[52px] w-[80px]'}`}>
      <div className="min-w-0">
        <div className="text-[6px] font-black text-slate-400">{stage} · {nf.format(item.no)}</div>
        {match ? <><div className="mt-0.5 truncate text-[8px] font-black">{scoreText(match)}</div><div className="truncate text-[7px] font-bold text-slate-500">{team?.name || formatStatus(match)}</div></> : <div className="mt-0.5 truncate text-[8px] font-black">{label}</div>}
      </div>
    </div>
  );
}

function SideBracket({ side, direct, thirds, buckets, byNo, byPair, qualifiersReady }: { side: 'left' | 'right'; direct: Qualifier[]; thirds: Map<number, Qualifier>; buckets: ReturnType<typeof groupMatches>; byNo: Map<number, KnockoutMatch>; byPair: Map<string, KnockoutMatch>; qualifiersReady: boolean }) {
  const r32 = side === 'left' ? LEFT_R32 : RIGHT_R32;
  const r16 = side === 'left' ? LEFT_R16 : RIGHT_R16;
  const qf = side === 'left' ? LEFT_QF : RIGHT_QF;
  const semiNo = side === 'left' ? 101 : 102;
  const getR32Match = (no: number) => {
    const item = R32.find(([matchNo]) => matchNo === no);
    if (!item) return null;
    const byNumber = byNo.get(no);
    if (byNumber) return byNumber;
    const a = resolveSlot(item[1], direct, thirds, no);
    const b = resolveSlot(item[2], direct, thirds, no);
    const byTeams = byPair.get(pairKey(a, b));
    if (byTeams) return byTeams;
    return qualifiersReady ? null : buckets.r32[R32.findIndex(([matchNo]) => matchNo === no)] || null;
  };
  const futureMatch = (no: number, list: Future[], bucket: KnockoutMatch[]) => byNo.get(no) || bucket[list.findIndex((match) => match.no === no)] || null;
  const r32Col = <div className="grid gap-2">{r32.map((no) => <R32MatchBlock key={no} no={no} direct={direct} thirds={thirds} side={side} match={getR32Match(no)} />)}</div>;
  const r16Col = <div className="grid content-center gap-[2.6rem]">{r16.map((no) => { const item = R16.find((match) => match.no === no); return item ? <FutureMatchBox key={no} item={item} stage="R16" match={futureMatch(no, R16, buckets.r16)} /> : null; })}</div>;
  const qfCol = <div className="grid content-center gap-[6.35rem]">{qf.map((no) => { const item = QF.find((match) => match.no === no); return item ? <FutureMatchBox key={no} item={item} stage="QF" match={futureMatch(no, QF, buckets.qf)} big /> : null; })}</div>;
  const sf = SF.find((match) => match.no === semiNo);
  const sfCol = <div className="grid content-center">{sf ? <FutureMatchBox item={sf} stage="SF" match={futureMatch(semiNo, SF, buckets.sf)} big /> : null}</div>;
  return <div className={`grid h-full gap-3 ${side === 'left' ? 'grid-cols-[206px_86px_98px_98px]' : 'grid-cols-[98px_98px_86px_206px]'}`}>{side === 'left' ? <>{r32Col}{r16Col}{qfCol}{sfCol}</> : <>{sfCol}{qfCol}{r16Col}{r32Col}</>}</div>;
}

function PosterCorners() {
  return <><div className="absolute -left-10 -top-10 h-28 w-56 rotate-[-8deg] rounded-[40%] bg-[#ff4b00] opacity-95" /><div className="absolute left-16 -top-10 h-24 w-60 rotate-[6deg] rounded-[45%] bg-[#1d63ff] opacity-95" /><div className="absolute right-0 -top-10 h-24 w-64 rotate-[-12deg] rounded-[45%] bg-[#7c00ff] opacity-95" /><div className="absolute -right-8 -top-5 h-16 w-60 rotate-[-18deg] rounded-[45%] bg-[#00f0c8] opacity-95" /><div className="absolute -bottom-10 left-0 h-24 w-64 rotate-[5deg] rounded-[45%] bg-[#00f0c8] opacity-95" /><div className="absolute -bottom-12 right-0 h-24 w-80 rotate-[-7deg] rounded-[45%] bg-[#ff2b00] opacity-95" /></>;
}

function CenterColumn({ finalMatch, thirdMatch }: { finalMatch?: KnockoutMatch | null; thirdMatch?: KnockoutMatch | null }) {
  const champion = winnerTeam(finalMatch);
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-between py-6 text-center">
      <div><div className="text-3xl font-black tracking-tight text-white drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]">البطل</div><div className="mt-2 flex h-[72px] w-[140px] items-center justify-center rounded-lg bg-white px-2 text-[10px] font-black text-black shadow-[0_10px_30px_rgba(0,0,0,.45)]">{champion?.name || winner(FINAL.no)}</div></div>
      <div className="relative flex h-[270px] w-[190px] items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,215,0,.23),transparent_65%)]"><div className="text-[8.5rem] drop-shadow-[0_22px_28px_rgba(0,0,0,.65)]">🏆</div></div>
      <div><div className="mb-2 text-xl font-black text-white drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]">المركز الثالث</div><FutureMatchBox item={THIRD} stage="3RD" useLoser match={thirdMatch} big /></div>
    </div>
  );
}

export default function HomeRoundOf32Widget({ groups = [], knockoutMatches = [] }: Props) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  const safeGroups = isGroups(groups) ? groups : [];
  const safeMatches = isMatches(knockoutMatches) ? knockoutMatches : [];
  const { direct, bestThirds } = buildQualifiers(safeGroups);
  const thirds = assignThirds(bestThirds);
  const buckets = groupMatches(safeMatches);
  const { byNo, byPair } = makeIndexes(safeMatches);
  const qualifiersReady = safeGroups.length > 0 && direct.length >= 24;
  const ready = qualifiersReady || buckets.r32.length > 0;
  const latestSync = safeMatches.map((match) => match.lastSyncedAt || match.matchDate).filter(Boolean).sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] || null;
  const finalMatch = byNo.get(104) || buckets.final[0] || null;
  const thirdMatch = byNo.get(103) || buckets.third[0] || null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-black p-2 shadow-[0_20px_70px_rgba(0,0,0,.38)]" aria-label="مسار التصفيات النهائية">
      <div className="mb-2 grid gap-2 rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-3 text-xs font-bold text-gray-400 sm:grid-cols-3">
        <span><b className="text-[#FFD700]">دور الـ٣٢:</b> {nf.format(buckets.r32.length)} مباراة من قاعدة البيانات</span>
        <span><b className="text-[#00FF88]">النتائج:</b> {nf.format(buckets.r32.filter(isFinished).length)} مؤكدة/منتهية</span>
        <span><b className="text-[#0FF0FC]">آخر مزامنة:</b> {latestSync ? dateTime(latestSync) : 'غير متوفر'}</span>
      </div>
      <div className="relative mx-auto min-h-[760px] w-full max-w-[1240px] overflow-auto rounded-[1.7rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,.06),transparent_38%),linear-gradient(180deg,#151515,#070707)] px-4 py-8">
        <PosterCorners />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.25)_42%,rgba(0,0,0,.72)_100%)]" />
        <div className="relative z-10 mb-5 grid min-w-[1180px] grid-cols-9 px-4 text-center text-[9px] font-black text-gray-400"><span>دور الـ٣٢</span><span>R16</span><span>QF</span><span>SF</span><span>FINAL</span><span>SF</span><span>QF</span><span>R16</span><span>دور الـ٣٢</span></div>
        {!ready ? <div className="relative z-10 mt-32 rounded-2xl border border-dashed border-white/10 bg-black/35 p-6 text-center text-sm font-bold text-gray-400">لا توجد مباريات دور الـ٣٢ مؤكدة في قاعدة البيانات الآن.</div> : <div className="relative z-10 grid h-[650px] min-w-[1180px] grid-cols-[500px_180px_500px] gap-3"><SideBracket side="left" direct={direct} thirds={thirds} buckets={buckets} byNo={byNo} byPair={byPair} qualifiersReady={qualifiersReady} /><CenterColumn finalMatch={finalMatch} thirdMatch={thirdMatch} /><SideBracket side="right" direct={direct} thirds={thirds} buckets={buckets} byNo={byNo} byPair={byPair} qualifiersReady={qualifiersReady} /></div>}
      </div>
    </section>
  );
}
