'use client';

import { usePathname } from 'next/navigation';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Row = { team: string; code: string; points: number; goalDifference: number; goalsFor: number };
type Group = { key: string; standings: Row[] };
type Qualifier = { group: string; rank: 1 | 2 | 3; row: Row; thirdRank?: number };
type Props = { groups?: Group[] | unknown[]; matches?: any[] };
type Future = { no: number; from: [number, number] };

const nf = new Intl.NumberFormat('ar-EG');
const GROUPS = 'ABCDEFGHIJKL'.split('');

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

function matchLabel(no: number) { return `مباراة ${nf.format(no)}`; }
function winner(no: number) { return `فائز ${nf.format(no)}`; }
function loser(no: number) { return `خاسر ${nf.format(no)}`; }
function teamName(row?: Row | null) { return row ? getArabicTeamName(row.code, row.team) : 'غير محدد'; }
function flagUrl(row?: Row | null) { return row ? getTeamFlagUrl({ code: row.code, name: teamName(row), image: null }, 64) : null; }

function buildQualifiers(groups: Group[]) {
  const byGroup = new Map(groups.map((group) => [String(group.key).toUpperCase().replace('GROUP_', ''), group]));
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
  // Official FIFA pairings for the specific 8 teams that advanced
  const officialMapping: Record<number, string> = { 
    74: 'PAR', // Paraguay
    77: 'SWE', // Sweden
    79: 'ECU', // Ecuador
    80: 'COD', // DR Congo
    81: 'BIH', // Bosnia
    82: 'SEN', // Senegal
    85: 'ALG', // Algeria
    87: 'GHA'  // Ghana
  };
  
  Object.entries(officialMapping).forEach(([matchNo, code]) => {
    const candidate = bestThirds.find(t => t.row?.code === code);
    if (candidate) {
      assigned.set(Number(matchNo), candidate);
    }
  });

  return assigned;
}

function resolveSlot(slot: string, direct: Qualifier[], thirds: Map<number, Qualifier>, matchNo: number) {
  const q = slot.startsWith('3') ? thirds.get(matchNo) || null : direct.find((item) => `${item.rank}${item.group}` === slot) || null;
  return {
    seed: q ? `${q.rank}${q.group}` : slot.startsWith('3') ? `3 ${slot.slice(1).split('').join('/')}` : slot,
    name: teamName(q?.row),
    row: q?.row || null,
  };
}

function findR32(no: number) { return R32.find(([matchNo]) => matchNo === no) || null; }
function findFuture(no: number, list: Future[]) { return list.find((match) => match.no === no) || null; }

function FlagTeam({ side, reverse = false, score }: { side: ReturnType<typeof resolveSlot>; reverse?: boolean; score?: number | null }) {
  const flag = flagUrl(side.row);
  return (
    <div className={`flex h-8 items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-1.5 ${reverse ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <span className="flex h-5 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-white/20 bg-white shadow-sm">
        {flag ? <img src={flag} alt={`علم ${side.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-[8px] text-black">{side.seed}</b>}
      </span>
      <span className={`min-w-0 flex-1 flex items-center ${reverse ? 'flex-row-reverse' : ''} justify-between`}>
        <span className="min-w-0">
          <b className="block truncate text-[9px] leading-[14px] text-white">{side.name}</b>
          <span className="block text-[7px] font-black text-gray-500">{side.seed}</span>
        </span>
        {score !== undefined && score !== null && (
          <span className="ml-1 flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-[3px] bg-[#0FF0FC]/15 px-1 text-[9px] font-black text-[#0FF0FC] shadow-[0_0_8px_rgba(15,240,252,0.2)]">
            {score}
          </span>
        )}
      </span>
    </div>
  );
}

function getMatchWinner(no: number, matches: any[], direct: Qualifier[], thirds: Map<number, Qualifier>, getLoser = false): ReturnType<typeof resolveSlot> | null {
  const r32 = findR32(no);
  if (r32) {
    const homeSide = resolveSlot(r32[1], direct, thirds, no);
    const awaySide = resolveSlot(r32[2], direct, thirds, no);
    if (!homeSide.row || !awaySide.row) return null;
    let hCode = homeSide.row.code.toLowerCase();
    let aCode = awaySide.row.code.toLowerCase();
    if (hCode === 'zaf') hCode = 'rsa';
    if (aCode === 'zaf') aCode = 'rsa';
    const match = matches.find(m => 
      (m.homeTeamId === `team-${hCode}` && m.awayTeamId === `team-${aCode}`) || 
      (m.homeTeamId === `team-${aCode}` && m.awayTeamId === `team-${hCode}`)
    );
    if (match && match.status === 'FINISHED') {
       const homeWon = match.homeTeamId === `team-${hCode}` ? match.homeScore > match.awayScore : match.awayScore > match.homeScore;
       if (getLoser) return homeWon ? awaySide : homeSide;
       return homeWon ? homeSide : awaySide;
    }
    return null;
  }
  
  const future = findFuture(no, [...R16, ...QF, ...SF, FINAL, THIRD]);
  if (future) {
    const isThird = no === 103;
    const homeSide = getMatchWinner(future.from[0], matches, direct, thirds, isThird);
    const awaySide = getMatchWinner(future.from[1], matches, direct, thirds, isThird);
    if (!homeSide?.row || !awaySide?.row) return null;
    let hCode = homeSide.row.code.toLowerCase();
    let aCode = awaySide.row.code.toLowerCase();
    if (hCode === 'zaf') hCode = 'rsa';
    if (aCode === 'zaf') aCode = 'rsa';
    const match = matches.find(m => 
      (m.homeTeamId === `team-${hCode}` && m.awayTeamId === `team-${aCode}`) || 
      (m.homeTeamId === `team-${aCode}` && m.awayTeamId === `team-${hCode}`)
    );
    if (match && match.status === 'FINISHED') {
       const homeWon = match.homeTeamId === `team-${hCode}` ? match.homeScore > match.awayScore : match.awayScore > match.homeScore;
       if (getLoser) return homeWon ? awaySide : homeSide;
       return homeWon ? homeSide : awaySide;
    }
  }
  return null;
}

function R32MatchBlock({ no, direct, thirds, side, matches }: { no: number; direct: Qualifier[]; thirds: Map<number, Qualifier>; side: 'left' | 'right'; matches?: any[] }) {
  const item = findR32(no);
  if (!item) return null;
  
  const homeSide = resolveSlot(item[1], direct, thirds, no);
  const awaySide = resolveSlot(item[2], direct, thirds, no);
  
  let homeScore = null;
  let awayScore = null;
  
  if (matches && homeSide.row && awaySide.row) {
    let hCode = homeSide.row.code.toLowerCase();
    let aCode = awaySide.row.code.toLowerCase();
    if (hCode === 'zaf') hCode = 'rsa';
    if (aCode === 'zaf') aCode = 'rsa';
    const match = matches.find(m => 
      (m.homeTeamId === `team-${hCode}` && m.awayTeamId === `team-${aCode}`) || 
      (m.homeTeamId === `team-${aCode}` && m.awayTeamId === `team-${hCode}`)
    );
    if (match && (match.status === 'FINISHED' || match.status === 'IN_PLAY')) {
       if (match.homeTeamId === `team-${hCode}`) {
         homeScore = match.homeScore;
         awayScore = match.awayScore;
       } else {
         homeScore = match.awayScore;
         awayScore = match.homeScore;
       }
    }
  }

  const teams = (
    <div className="grid gap-1">
      <FlagTeam side={homeSide} reverse={side === 'right'} score={homeScore} />
      <FlagTeam side={awaySide} reverse={side === 'right'} score={awayScore} />
    </div>
  );
  return (
    <div className="grid items-center gap-1.5">
      {teams}
    </div>
  );
}

function TinyFlagTeam({ side, score }: { side: ReturnType<typeof resolveSlot>; score?: number | null }) {
  const flag = flagUrl(side.row);
  return (
    <div className="flex items-center justify-between px-1 bg-white/5 rounded-[3px] mx-1 h-3.5">
      <div className="flex items-center gap-1 min-w-0">
        <span className="flex h-2.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-white">
          {flag && <img src={flag} alt="" className="h-full w-full object-cover" />}
        </span>
        <b className="truncate text-[6.5px] text-white">{side.name}</b>
      </div>
      {score !== null && score !== undefined && <span className="text-[6.5px] font-black text-[#0FF0FC]">{score}</span>}
    </div>
  );
}

function WinnerSlot({ item, stage, useLoser = false, big = false, matches = [], direct = [], thirds = new Map() }: { item: Future; stage: string; useLoser?: boolean; big?: boolean; matches?: any[]; direct?: Qualifier[]; thirds?: Map<number, Qualifier> }) {
  const isThird = item.no === 103;
  const team1 = getMatchWinner(item.from[0], matches, direct, thirds, isThird);
  const team2 = getMatchWinner(item.from[1], matches, direct, thirds, isThird);

  let homeScore = null;
  let awayScore = null;
  if (team1?.row && team2?.row) {
    let hCode = team1.row.code.toLowerCase();
    let aCode = team2.row.code.toLowerCase();
    if (hCode === 'zaf') hCode = 'rsa';
    if (aCode === 'zaf') aCode = 'rsa';
    const match = matches.find(m => 
      (m.homeTeamId === `team-${hCode}` && m.awayTeamId === `team-${aCode}`) || 
      (m.homeTeamId === `team-${aCode}` && m.awayTeamId === `team-${hCode}`)
    );
    if (match && (match.status === 'FINISHED' || match.status === 'IN_PLAY')) {
       if (match.homeTeamId === `team-${hCode}`) {
         homeScore = match.homeScore;
         awayScore = match.awayScore;
       } else {
         homeScore = match.awayScore;
         awayScore = match.homeScore;
       }
    }
  }

  return (
    <div className={`flex flex-col justify-center rounded-lg border border-white/5 bg-white/[0.03] shadow-[0_8px_18px_rgba(0,0,0,.35)] ${big ? 'h-[56px] w-[86px]' : 'h-[48px] w-[76px]'}`}>
      <div className="text-[6px] font-black text-slate-500 text-center mb-0.5">{stage} · {nf.format(item.no)}</div>
      <div className="flex flex-col gap-[1.5px]">
        {team1 ? <TinyFlagTeam side={team1} score={homeScore} /> : <div className="text-[7px] text-gray-400 text-center">{useLoser ? loser(item.from[0]) : winner(item.from[0])}</div>}
        {team2 ? <TinyFlagTeam side={team2} score={awayScore} /> : <div className="text-[7px] text-gray-400 text-center">{useLoser ? loser(item.from[1]) : winner(item.from[1])}</div>}
      </div>
    </div>
  );
}

function SideBracket({ side, direct, thirds, matches }: { side: 'left' | 'right'; direct: Qualifier[]; thirds: Map<number, Qualifier>; matches?: any[] }) {
  const r32 = side === 'left' ? LEFT_R32 : RIGHT_R32;
  const r16 = side === 'left' ? LEFT_R16 : RIGHT_R16;
  const qf = side === 'left' ? LEFT_QF : RIGHT_QF;
  const semiNo = side === 'left' ? 101 : 102;
  const r32Col = <div className="grid gap-[9px]">{r32.map((no) => <R32MatchBlock key={no} no={no} direct={direct} thirds={thirds} side={side} matches={matches} />)}</div>;
  const r16Col = <div className="grid content-center gap-[2.8rem]">{r16.map((no) => { const item = findFuture(no, R16); return item ? <WinnerSlot key={no} item={item} stage="R16" matches={matches} direct={direct} thirds={thirds} /> : null; })}</div>;
  const qfCol = <div className="grid content-center gap-[6.8rem]">{qf.map((no) => { const item = findFuture(no, QF); return item ? <WinnerSlot key={no} item={item} stage="QF" big matches={matches} direct={direct} thirds={thirds} /> : null; })}</div>;
  const sf = findFuture(semiNo, SF);
  const sfCol = <div className="grid content-center">{sf ? <WinnerSlot item={sf} stage="SF" big matches={matches} direct={direct} thirds={thirds} /> : null}</div>;
  return (
    <div className={`grid h-full gap-4 overflow-hidden min-w-max ${side === 'left' ? 'grid-cols-[150px_76px_86px_86px]' : 'grid-cols-[86px_86px_76px_150px]'}`}>
      {side === 'left' ? <>{r32Col}{r16Col}{qfCol}{sfCol}</> : <>{sfCol}{qfCol}{r16Col}{r32Col}</>}
    </div>
  );
}

function PosterCorners() {
  return <><div className="absolute -left-10 -top-10 h-28 w-56 rotate-[-8deg] rounded-[40%] bg-[#ff4b00] opacity-95" /><div className="absolute left-16 -top-10 h-24 w-60 rotate-[6deg] rounded-[45%] bg-[#1d63ff] opacity-95" /><div className="absolute right-0 -top-10 h-24 w-64 rotate-[-12deg] rounded-[45%] bg-[#7c00ff] opacity-95" /><div className="absolute -right-8 -top-5 h-16 w-60 rotate-[-18deg] rounded-[45%] bg-[#00f0c8] opacity-95" /><div className="absolute -bottom-10 left-0 h-24 w-64 rotate-[5deg] rounded-[45%] bg-[#00f0c8] opacity-95" /><div className="absolute -bottom-12 right-0 h-24 w-80 rotate-[-7deg] rounded-[45%] bg-[#ff2b00] opacity-95" /></>;
}

function CenterColumn({ matches, direct, thirds }: { matches: any[]; direct: Qualifier[]; thirds: Map<number, Qualifier> }) {
  const champion = getMatchWinner(FINAL.no, matches, direct, thirds, false);
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-between py-6 text-center">
      <div>
        <div className="text-3xl font-black tracking-tight text-white drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]">البطل</div>
        <div className="mt-2 flex h-[68px] w-[132px] items-center justify-center rounded-lg bg-white/5 border border-[#FFD700]/30 text-[11px] font-black text-white shadow-[0_10px_30px_rgba(255,215,0,.15)] overflow-hidden relative">
          {champion ? (
            <div className="flex flex-col items-center gap-1.5 z-10">
              {flagUrl(champion.row) && <img src={flagUrl(champion.row)!} className="w-8 h-5.5 rounded-sm shadow-md" />}
              <span>{champion.name}</span>
            </div>
          ) : (
            <span className="text-[#FFD700] z-10">{winner(FINAL.no)}</span>
          )}
          {champion && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#FFD700_0%,transparent_70%)] opacity-20" />}
        </div>
      </div>
      <div className="relative flex h-[270px] w-[190px] items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,215,0,.23),transparent_65%)]"><div className="text-[8.5rem] drop-shadow-[0_22px_28px_rgba(0,0,0,.65)]">🏆</div></div>
      <div><div className="mb-2 text-xl font-black text-white drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]">المركز الثالث</div><WinnerSlot item={THIRD} stage="3RD" useLoser big matches={matches} direct={direct} thirds={thirds} /></div>
    </div>
  );
}

export default function HomeRoundOf32Widget({ groups = [], matches = [] }: Props) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  const safeGroups = isGroups(groups) ? groups : [];
  const { direct, bestThirds } = buildQualifiers(safeGroups);
  const thirds = assignThirds(bestThirds);
  const ready = safeGroups.length > 0 && direct.length >= 24;
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-black p-2 shadow-[0_20px_70px_rgba(0,0,0,.38)]" aria-label="مسار التصفيات النهائية">
      <div className="w-full overflow-x-auto pb-6">
        <div className="relative w-[1180px] xl:mx-auto min-h-[760px] overflow-hidden rounded-[1.7rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,.06),transparent_38%),linear-gradient(180deg,#151515,#070707)] px-4 py-8">
          <PosterCorners />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.25)_42%,rgba(0,0,0,.72)_100%)]" />
          <div className="relative z-10 mb-5 flex items-center justify-between px-4 text-[9px] font-black text-gray-400"><span>دور الـ٣٢</span><span>R16</span><span>QF</span><span>SF</span><span>FINAL</span><span>SF</span><span>QF</span><span>R16</span><span>دور الـ٣٢</span></div>
          {!ready ? <div className="relative z-10 mt-32 rounded-2xl border border-dashed border-white/10 bg-black/35 p-6 text-center text-sm font-bold text-gray-400">بيانات المجموعات غير كافية لبناء مسار دور الـ٣٢ الآن.</div> : <div className="relative z-10 flex w-full justify-between gap-3 h-[650px]"><div className="w-[440px]"><SideBracket side="left" direct={direct} thirds={thirds} matches={matches} /></div><div className="w-[240px]"><CenterColumn matches={matches} direct={direct} thirds={thirds} /></div><div className="w-[440px]"><SideBracket side="right" direct={direct} thirds={thirds} matches={matches} /></div></div>}
        </div>
      </div>
    </section>
  );
}
