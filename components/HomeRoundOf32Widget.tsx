'use client';

import { usePathname } from 'next/navigation';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Row = { team: string; code: string; points: number; goalDifference: number; goalsFor: number };
type Group = { key: string; standings: Row[] };
type Qualifier = { group: string; rank: 1 | 2 | 3; row: Row; thirdRank?: number };
type Props = { groups?: Group[] | unknown[] };
type Future = { no: number; from: [number, number] };
type Section = { title: string; r32: readonly number[]; r16: readonly number[]; qf: number };

const nf = new Intl.NumberFormat('ar-EG');
const GROUPS = 'ABCDEFGHIJKL'.split('');

const R32 = [
  [73, '2A', '2B'], [74, '1E', '3ABCDF'], [75, '1F', '2C'], [76, '1C', '2F'],
  [77, '1I', '3CDFGH'], [78, '2E', '2I'], [79, '1A', '3CEFHI'], [80, '1L', '3EHIJK'],
  [81, '1D', '3BEFIJ'], [82, '1G', '3AEHIJ'], [83, '2K', '2L'], [84, '1H', '2J'],
  [85, '1B', '3EFGIJ'], [86, '1J', '2H'], [87, '1K', '3DEIJL'], [88, '2D', '2G'],
] as const;

const R16: Future[] = [[89, 73, 75], [90, 74, 77], [91, 76, 78], [92, 79, 80], [93, 83, 84], [94, 81, 82], [95, 86, 88], [96, 85, 87]].map(([no, a, b]) => ({ no, from: [a, b] as [number, number] }));
const QF: Future[] = [[97, 89, 90], [98, 93, 94], [99, 91, 92], [100, 95, 96]].map(([no, a, b]) => ({ no, from: [a, b] as [number, number] }));
const SF: Future[] = [[101, 97, 98], [102, 99, 100]].map(([no, a, b]) => ({ no, from: [a, b] as [number, number] }));
const FINAL: Future = { no: 104, from: [101, 102] };
const THIRD: Future = { no: 103, from: [101, 102] };

const COLUMNS = [
  { title: 'النصف الأيسر', subtitle: 'المسار المؤدي إلى نصف النهائي ١٠١', semi: 101, sections: [{ title: 'مسار ١', r32: [73, 75, 74, 77], r16: [89, 90], qf: 97 }, { title: 'مسار ٢', r32: [83, 84, 81, 82], r16: [93, 94], qf: 98 }] },
  { title: 'النصف الأيمن', subtitle: 'المسار المؤدي إلى نصف النهائي ١٠٢', semi: 102, sections: [{ title: 'مسار ٣', r32: [76, 78, 79, 80], r16: [91, 92], qf: 99 }, { title: 'مسار ٤', r32: [86, 88, 85, 87], r16: [95, 96], qf: 100 }] },
] as const;

function isGroups(value: unknown): value is Group[] {
  return Array.isArray(value) && value.every((group) => group && typeof (group as Group).key === 'string' && Array.isArray((group as Group).standings));
}

function matchLabel(no: number) { return `مباراة ${nf.format(no)}`; }
function winner(no: number) { return `الفائز من ${matchLabel(no)}`; }
function loser(no: number) { return `الخاسر من ${matchLabel(no)}`; }
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
    seed: q ? `${q.rank}${q.group}` : slot.startsWith('3') ? `3 من ${slot.slice(1).split('').join('/')}` : slot,
    name: teamName(q?.row),
    note: q?.rank === 3 ? `أفضل ثالث رقم ${nf.format(q.thirdRank || 0)}` : 'حسب ترتيب المجموعة',
    row: q?.row || null,
  };
}

function nextOf(no: number) { return [...R16, ...QF, ...SF, FINAL].find((match) => match.from.includes(no)) || null; }
function findFuture(no: number, list: Future[]) { return list.find((match) => match.no === no) || null; }

function TeamPill({ side, align }: { side: ReturnType<typeof resolveSlot>; align: 'left' | 'right' }) {
  const flag = flagUrl(side.row);
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.96] px-2 py-1.5 text-black shadow-[0_10px_28px_rgba(0,0,0,0.28)] ${align === 'right' ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <span className="flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-slate-200">
        {flag ? <img src={flag} alt={`علم ${side.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-[9px]">{side.seed}</b>}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[10px] leading-3">{side.name}</b>
        <span className="block truncate text-[8px] font-black text-slate-500">{side.seed}</span>
      </span>
    </div>
  );
}

function Round32Pair({ no, direct, thirds, align }: { no: number; direct: Qualifier[]; thirds: Map<number, Qualifier>; align: 'left' | 'right' }) {
  const item = R32.find(([matchNo]) => matchNo === no);
  if (!item) return null;
  return (
    <article className="relative rounded-2xl border border-white/10 bg-black/35 p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-[8px] font-black text-[#FFD700]"><span>{matchLabel(no)}</span><span>R32</span></div>
      <div className="space-y-1.5">
        <TeamPill side={resolveSlot(item[1], direct, thirds, no)} align={align} />
        <TeamPill side={resolveSlot(item[2], direct, thirds, no)} align={align} />
      </div>
    </article>
  );
}

function WinnerBox({ item, stage, useLoser = false }: { item: Future; stage: string; useLoser?: boolean }) {
  const next = useLoser ? null : nextOf(item.no);
  const other = next?.from.find((matchNo) => matchNo !== item.no) || null;
  const sideLabel = useLoser ? loser : winner;
  return (
    <article className="rounded-2xl border border-white/10 bg-white px-3 py-2 text-black shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
      <div className="mb-1 flex items-center justify-between gap-2 text-[8px] font-black text-slate-500"><span>{stage}</span><span>{matchLabel(item.no)}</span></div>
      <div className="space-y-1 text-[10px] font-black leading-4">
        <div className="rounded-lg bg-slate-100 px-2 py-1">{sideLabel(item.from[0])}</div>
        <div className="rounded-lg bg-slate-100 px-2 py-1">{sideLabel(item.from[1])}</div>
      </div>
      {other ? <div className="mt-1 text-[8px] font-black text-emerald-700">ثم يقابل {winner(other)}</div> : null}
    </article>
  );
}

function HalfBracket({ column, direct, thirds, side }: { column: (typeof COLUMNS)[number]; direct: Qualifier[]; thirds: Map<number, Qualifier>; side: 'left' | 'right' }) {
  const r32 = column.sections.flatMap((section) => section.r32);
  const r16 = column.sections.flatMap((section) => section.r16);
  const qf = column.sections.map((section) => section.qf);
  const semi = findFuture(column.semi, SF);
  const round32Column = <div className="grid gap-2">{r32.map((no) => <Round32Pair key={no} no={no} direct={direct} thirds={thirds} align={side} />)}</div>;
  const round16Column = <div className="grid content-center gap-5">{r16.map((no) => { const item = findFuture(no, R16); return item ? <WinnerBox key={no} item={item} stage="دور الـ١٦" /> : null; })}</div>;
  const finalColumn = <div className="grid content-center gap-8">{qf.map((no) => { const item = findFuture(no, QF); return item ? <WinnerBox key={no} item={item} stage="ربع النهائي" /> : null; })}{semi ? <WinnerBox item={semi} stage="نصف النهائي" /> : null}</div>;
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 text-center"><h3 className="text-sm font-black text-white">{column.title}</h3><p className="text-[9px] font-bold text-gray-500">{column.subtitle}</p></div>
      <div className={`grid gap-3 ${side === 'left' ? 'xl:grid-cols-[1.45fr_1fr_.9fr]' : 'xl:grid-cols-[.9fr_1fr_1.45fr]'}`}>
        {side === 'left' ? <>{round32Column}{round16Column}{finalColumn}</> : <>{finalColumn}{round16Column}{round32Column}</>}
      </div>
    </section>
  );
}

function CenterPodium() {
  return (
    <aside className="flex flex-col items-center justify-between gap-4 rounded-[2rem] border border-[#FFD700]/20 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.18),transparent_42%),rgba(0,0,0,0.45)] p-4 text-center">
      <div className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-black shadow-[0_14px_34px_rgba(0,0,0,0.35)]"><div className="text-[10px] font-black uppercase text-slate-500">البطل</div><div className="mt-1 text-xs font-black">{winner(FINAL.no)}</div></div>
      <div className="relative flex h-56 w-44 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,215,0,0.24),transparent_65%)]">
        <div className="text-8xl drop-shadow-[0_18px_25px_rgba(0,0,0,0.55)]">🏆</div>
      </div>
      <WinnerBox item={FINAL} stage="النهائي" />
      <WinnerBox item={THIRD} stage="المركز الثالث" useLoser />
    </aside>
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
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_28%),linear-gradient(135deg,#080808,#101010_45%,#050505)] p-3 text-white shadow-[0_20px_70px_rgba(0,0,0,0.35)]" aria-label="مسار التصفيات النهائية">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div><div className="inline-flex rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2 py-0.5 text-[8px] font-black text-[#0FF0FC]">KNOCKOUT BRACKET</div><h2 className="mt-1.5 text-xl font-black md:text-2xl">مسار دور الـ٣٢ حتى النهائي</h2><p className="mt-1 max-w-3xl text-[11px] font-bold leading-5 text-gray-400">تصميم بصري قريب من لوحة التصفيات: المنتخبات على الأطراف، مسارات الفوز للداخل، والكأس في المنتصف.</p></div>
        <div className="grid gap-1 text-[10px] font-bold text-gray-400 sm:grid-cols-3"><span>المباشرون: <b className="text-white">{nf.format(direct.length)}</b></span><span>أفضل الثوالث: <b className="text-[#FFD700]">{nf.format(bestThirds.length)}</b></span><span>الإجمالي: <b className="text-[#00FF88]">{nf.format(direct.length + bestThirds.length)}</b></span></div>
      </div>
      {!ready ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">بيانات المجموعات غير كافية لبناء مسار دور الـ٣٢ الآن.</div> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]"><HalfBracket column={COLUMNS[0]} direct={direct} thirds={thirds} side="left" /><CenterPodium /><HalfBracket column={COLUMNS[1]} direct={direct} thirds={thirds} side="right" /></div>}
    </section>
  );
}
