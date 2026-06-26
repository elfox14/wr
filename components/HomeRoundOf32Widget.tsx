'use client';

import { usePathname } from 'next/navigation';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Row = { team: string; code: string; points: number; goalDifference: number; goalsFor: number };
type Group = { key: string; standings: Row[] };
type Qualifier = { group: string; rank: 1 | 2 | 3; row: Row; thirdRank?: number };
type Props = { groups?: Group[] | unknown[] };
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
  return {
    seed: q ? `${q.rank}${q.group}` : slot.startsWith('3') ? `3 ${slot.slice(1).split('').join('/')}` : slot,
    name: teamName(q?.row),
    row: q?.row || null,
  };
}

function findR32(no: number) { return R32.find(([matchNo]) => matchNo === no) || null; }
function findFuture(no: number, list: Future[]) { return list.find((match) => match.no === no) || null; }

function FlagTeam({ side, reverse = false }: { side: ReturnType<typeof resolveSlot>; reverse?: boolean }) {
  const flag = flagUrl(side.row);
  return (
    <div className={`flex h-8 items-center gap-1.5 ${reverse ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <span className="flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/20 bg-white">
        {flag ? <img src={flag} alt={`علم ${side.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-[8px] text-black">{side.seed}</b>}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[9px] leading-3 text-white">{side.name}</b>
        <span className="block text-[7px] font-black text-gray-500">{side.seed}</span>
      </span>
    </div>
  );
}

function R32MatchBlock({ no, direct, thirds, side }: { no: number; direct: Qualifier[]; thirds: Map<number, Qualifier>; side: 'left' | 'right' }) {
  const item = findR32(no);
  if (!item) return null;
  const teams = (
    <div className="grid gap-0.5">
      <FlagTeam side={resolveSlot(item[1], direct, thirds, no)} reverse={side === 'right'} />
      <FlagTeam side={resolveSlot(item[2], direct, thirds, no)} reverse={side === 'right'} />
    </div>
  );
  const win = (
    <div className="flex h-[54px] w-[78px] items-center justify-center rounded-lg border border-black/10 bg-white text-center text-black shadow-[0_8px_18px_rgba(0,0,0,.35)]">
      <div><div className="text-[7px] font-black text-slate-400">الفائز</div><div className="text-[9px] font-black">{winner(no)}</div></div>
    </div>
  );
  return (
    <div className={`grid items-center gap-2 ${side === 'left' ? 'grid-cols-[minmax(0,1fr)_78px]' : 'grid-cols-[78px_minmax(0,1fr)]'}`}>
      {side === 'left' ? <>{teams}{win}</> : <>{win}{teams}</>}
    </div>
  );
}

function WinnerSlot({ item, stage, useLoser = false, big = false }: { item: Future; stage: string; useLoser?: boolean; big?: boolean }) {
  const label = useLoser ? `${loser(item.from[0])} / ${loser(item.from[1])}` : `${winner(item.from[0])} / ${winner(item.from[1])}`;
  return (
    <div className={`flex items-center justify-center rounded-lg border border-black/10 bg-white px-2 text-center text-black shadow-[0_8px_18px_rgba(0,0,0,.35)] ${big ? 'h-[70px] w-[112px]' : 'h-[56px] w-[92px]'}`}>
      <div className="min-w-0"><div className="text-[7px] font-black text-slate-400">{stage} · {nf.format(item.no)}</div><div className="mt-0.5 truncate text-[9px] font-black">{label}</div></div>
    </div>
  );
}

function SideBracket({ side, direct, thirds }: { side: 'left' | 'right'; direct: Qualifier[]; thirds: Map<number, Qualifier> }) {
  const r32 = side === 'left' ? LEFT_R32 : RIGHT_R32;
  const r16 = side === 'left' ? LEFT_R16 : RIGHT_R16;
  const qf = side === 'left' ? LEFT_QF : RIGHT_QF;
  const semiNo = side === 'left' ? 101 : 102;
  const r32Col = <div className="grid gap-3">{r32.map((no) => <R32MatchBlock key={no} no={no} direct={direct} thirds={thirds} side={side} />)}</div>;
  const r16Col = <div className="grid content-center gap-[3.35rem]">{r16.map((no) => { const item = findFuture(no, R16); return item ? <WinnerSlot key={no} item={item} stage="R16" /> : null; })}</div>;
  const qfCol = <div className="grid content-center gap-[8.75rem]">{qf.map((no) => { const item = findFuture(no, QF); return item ? <WinnerSlot key={no} item={item} stage="QF" big /> : null; })}</div>;
  const sf = findFuture(semiNo, SF);
  const sfCol = <div className="grid content-center">{sf ? <WinnerSlot item={sf} stage="SF" big /> : null}</div>;
  return (
    <div className={`grid h-full gap-4 ${side === 'left' ? 'grid-cols-[245px_105px_120px_120px]' : 'grid-cols-[120px_120px_105px_245px]'}`}>
      {side === 'left' ? <>{r32Col}{r16Col}{qfCol}{sfCol}</> : <>{sfCol}{qfCol}{r16Col}{r32Col}</>}
    </div>
  );
}

function PosterCorners() {
  return <><div className="absolute -left-10 -top-10 h-36 w-72 rotate-[-8deg] rounded-[40%] bg-[#ff4b00] opacity-95" /><div className="absolute left-20 -top-12 h-28 w-72 rotate-[6deg] rounded-[45%] bg-[#1d63ff] opacity-95" /><div className="absolute right-0 -top-12 h-28 w-80 rotate-[-12deg] rounded-[45%] bg-[#7c00ff] opacity-95" /><div className="absolute -right-8 -top-5 h-20 w-72 rotate-[-18deg] rounded-[45%] bg-[#00f0c8] opacity-95" /><div className="absolute -bottom-12 left-0 h-28 w-80 rotate-[5deg] rounded-[45%] bg-[#00f0c8] opacity-95" /><div className="absolute -bottom-14 right-0 h-28 w-96 rotate-[-7deg] rounded-[45%] bg-[#ff2b00] opacity-95" /></>;
}

function CenterColumn() {
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-between py-8 text-center">
      <div><div className="text-4xl font-black tracking-tight text-white drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]">البطل</div><div className="mt-3 flex h-[86px] w-[160px] items-center justify-center rounded-lg bg-white text-xs font-black text-black shadow-[0_10px_30px_rgba(0,0,0,.45)]">{winner(FINAL.no)}</div></div>
      <div className="relative flex h-[360px] w-[250px] items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,215,0,.23),transparent_65%)]"><div className="text-[12rem] drop-shadow-[0_22px_28px_rgba(0,0,0,.65)]">🏆</div></div>
      <div><div className="mb-2 text-2xl font-black text-white drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]">المركز الثالث</div><WinnerSlot item={THIRD} stage="3RD" useLoser big /></div>
    </div>
  );
}

export default function HomeRoundOf32Widget({ groups = [] }: Props) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  const safeGroups = isGroups(groups) ? groups : [];
  const { direct, bestThirds } = buildQualifiers(safeGroups);
  const thirds = assignThirds(bestThirds);
  const ready = safeGroups.length > 0 && direct.length >= 24;
  return (
    <section className="overflow-x-auto rounded-[2rem] border border-white/10 bg-black p-2 shadow-[0_20px_70px_rgba(0,0,0,.38)]" aria-label="مسار التصفيات النهائية">
      <div className="relative min-h-[980px] w-[1500px] overflow-hidden rounded-[1.7rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,.06),transparent_38%),linear-gradient(180deg,#151515,#070707)] px-6 py-10">
        <PosterCorners />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.25)_42%,rgba(0,0,0,.72)_100%)]" />
        <div className="relative z-10 mb-6 flex items-center justify-between px-6 text-[10px] font-black text-gray-400"><span>دور الـ٣٢</span><span>R16</span><span>QF</span><span>SF</span><span>FINAL</span><span>SF</span><span>QF</span><span>R16</span><span>دور الـ٣٢</span></div>
        {!ready ? <div className="relative z-10 mt-32 rounded-2xl border border-dashed border-white/10 bg-black/35 p-6 text-center text-sm font-bold text-gray-400">بيانات المجموعات غير كافية لبناء مسار دور الـ٣٢ الآن.</div> : <div className="relative z-10 grid h-[850px] grid-cols-[590px_280px_590px] gap-4"><SideBracket side="left" direct={direct} thirds={thirds} /><CenterColumn /><SideBracket side="right" direct={direct} thirds={thirds} /></div>}
      </div>
    </section>
  );
}
