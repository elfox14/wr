'use client';

import { usePathname } from 'next/navigation';
import { getArabicTeamName } from '@/lib/teamDisplay';

type Row = { team: string; code: string; points: number; goalDifference: number; goalsFor: number };
type Group = { key: string; standings: Row[] };
type Qualifier = { group: string; rank: 1 | 2 | 3; row: Row; thirdRank?: number };
type Props = { groups?: Group[] | unknown[] };
type Future = { no: number; from: [number, number] };
type Section = { title: string; r32: number[]; r16: number[]; qf: number };

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
  { title: 'العمود الأول', subtitle: 'نصف مسار البطولة المؤدي إلى نصف النهائي ١٠١', semi: 101, sections: [{ title: 'مسار ١', r32: [73, 75, 74, 77], r16: [89, 90], qf: 97 }, { title: 'مسار ٢', r32: [83, 84, 81, 82], r16: [93, 94], qf: 98 }] },
  { title: 'العمود الثاني', subtitle: 'نصف مسار البطولة المؤدي إلى نصف النهائي ١٠٢', semi: 102, sections: [{ title: 'مسار ٣', r32: [76, 78, 79, 80], r16: [91, 92], qf: 99 }, { title: 'مسار ٤', r32: [86, 88, 85, 87], r16: [95, 96], qf: 100 }] },
] as const;

function isGroups(value: unknown): value is Group[] {
  return Array.isArray(value) && value.every((group) => group && typeof (group as Group).key === 'string' && Array.isArray((group as Group).standings));
}

function matchLabel(no: number) { return `مباراة ${nf.format(no)}`; }
function winner(no: number) { return `الفائز من ${matchLabel(no)}`; }
function loser(no: number) { return `الخاسر من ${matchLabel(no)}`; }
function teamName(row?: Row | null) { return row ? getArabicTeamName(row.code, row.team) : 'غير محدد'; }

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
  };
}

function nextOf(no: number) { return [...R16, ...QF, ...SF, FINAL].find((match) => match.from.includes(no)) || null; }
function findFuture(no: number, list: Future[]) { return list.find((match) => match.no === no) || null; }

function Side({ side }: { side: ReturnType<typeof resolveSlot> }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2"><div className="truncate text-[11px] font-black text-white">{side.name}</div><div className="mt-0.5 text-[9px] font-black text-gray-500">{side.seed} — {side.note}</div></div>;
}

function R32Card({ no, direct, thirds }: { no: number; direct: Qualifier[]; thirds: Map<number, Qualifier> }) {
  const item = R32.find(([matchNo]) => matchNo === no);
  if (!item) return null;
  const next = nextOf(no);
  const other = next?.from.find((matchNo) => matchNo !== no) || null;
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-2.5"><div className="mb-2 flex items-center justify-between"><b className="text-[10px] text-[#FFD700]">{matchLabel(no)}</b><span className="text-[9px] text-gray-500">دور الـ٣٢</span></div><Side side={resolveSlot(item[1], direct, thirds, no)} /><div className="py-1 text-center text-[9px] font-black text-gray-500">ضد</div><Side side={resolveSlot(item[2], direct, thirds, no)} />{next ? <div className="mt-2 rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/10 px-2 py-1.5 text-[9px] font-black leading-4 text-[#0FF0FC]">الفائز يقابل {other ? winner(other) : 'الفائز من المسار المقابل'} في {matchLabel(next.no)}</div> : null}</article>;
}

function FutureCard({ item, stage, useLoser = false }: { item: Future; stage: string; useLoser?: boolean }) {
  const next = useLoser ? null : nextOf(item.no);
  const other = next?.from.find((matchNo) => matchNo !== item.no) || null;
  const sideLabel = useLoser ? loser : winner;
  return <article className="rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/[0.06] p-2.5"><div className="mb-2 flex items-center justify-between"><b className="text-[10px] text-[#FFD700]">{matchLabel(item.no)}</b><span className="text-[9px] text-gray-500">{stage}</span></div><div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-[10px] font-black text-white">{sideLabel(item.from[0])}</div><div className="py-1 text-center text-[9px] text-gray-500">ضد</div><div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-[10px] font-black text-white">{sideLabel(item.from[1])}</div>{next ? <div className="mt-2 rounded-xl border border-[#00FF88]/15 bg-[#00FF88]/10 px-2 py-1.5 text-[9px] font-black leading-4 text-[#00FF88]">الفائز يقابل {other ? winner(other) : 'الفائز من المسار المقابل'} في {matchLabel(next.no)}</div> : null}</article>;
}

function SectionCard({ section, direct, thirds }: { section: Section; direct: Qualifier[]; thirds: Map<number, Qualifier> }) {
  return <section className="rounded-[1.35rem] border border-white/10 bg-black/20 p-2.5"><div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-black text-white">{section.title}</h4><span className="text-[9px] font-black text-[#0FF0FC]">دور ٣٢ ← ربع النهائي</span></div><div className="grid gap-2 xl:grid-cols-[2fr_1fr_0.9fr]"><div><div className="mb-1.5 text-[9px] font-black text-gray-500">دور الـ٣٢</div><div className="grid gap-2 sm:grid-cols-2">{section.r32.map((no) => <R32Card key={no} no={no} direct={direct} thirds={thirds} />)}</div></div><div><div className="mb-1.5 text-[9px] font-black text-gray-500">دور الـ١٦</div><div className="grid gap-2">{section.r16.map((no) => { const item = findFuture(no, R16); return item ? <FutureCard key={no} item={item} stage="دور الـ١٦" /> : null; })}</div></div><div><div className="mb-1.5 text-[9px] font-black text-gray-500">ربع النهائي</div>{findFuture(section.qf, QF) ? <FutureCard item={findFuture(section.qf, QF)!} stage="ربع النهائي" /> : null}</div></div></section>;
}

function ColumnCard({ column, direct, thirds }: { column: (typeof COLUMNS)[number]; direct: Qualifier[]; thirds: Map<number, Qualifier> }) {
  const semi = findFuture(column.semi, SF);
  return <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-3"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-black text-white">{column.title}</h3><p className="text-[10px] font-bold text-gray-500">{column.subtitle}</p></div><span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-0.5 text-[9px] font-black text-[#FFD700]">نصف البطولة</span></div><div className="grid gap-3">{column.sections.map((section) => <SectionCard key={section.title} section={section} direct={direct} thirds={thirds} />)}{semi ? <FutureCard item={semi} stage="نصف النهائي" /> : null}</div></section>;
}

export default function HomeRoundOf32Widget({ groups = [] }: Props) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  const safeGroups = isGroups(groups) ? groups : [];
  const { direct, bestThirds } = buildQualifiers(safeGroups);
  const thirds = assignThirds(bestThirds);
  const ready = safeGroups.length > 0 && direct.length >= 24;
  return <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.10),transparent_26%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.28)]" aria-label="مسار التصفيات النهائية"><div className="mb-3"><div className="inline-flex rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2 py-0.5 text-[8px] font-black text-[#0FF0FC]">CURRENT KNOCKOUT PATH</div><h2 className="mt-1.5 text-lg font-black md:text-xl">مسار التصفيات النهائية حسب النتائج الحالية</h2><p className="mt-1 max-w-3xl text-[11px] font-bold leading-5 text-gray-400">محاكاة وفق طريقة التأهل الرسمية: أول وثاني كل مجموعة + أفضل ٨ ثوالث. العرض مقسوم إلى عمودين، كل عمود يصل إلى نصف نهائي، والفائزان يلتقيان في النهائي.</p></div>{!ready ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">بيانات المجموعات غير كافية لبناء مسار دور الـ٣٢ الآن.</div> : <><div className="mb-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 text-[10px] font-bold text-gray-400 sm:grid-cols-3"><span>المتأهلون المباشرون: <b className="text-white">{nf.format(direct.length)}</b></span><span>أفضل الثوالث الحالية: <b className="text-[#FFD700]">{nf.format(bestThirds.length)}</b></span><span>إجمالي دور الـ٣٢: <b className="text-[#00FF88]">{nf.format(direct.length + bestThirds.length)}</b></span></div><div className="grid gap-3 2xl:grid-cols-2">{COLUMNS.map((column) => <ColumnCard key={column.title} column={column} direct={direct} thirds={thirds} />)}</div><div className="mt-3 grid gap-2 lg:grid-cols-2"><FutureCard item={THIRD} stage="مباراة المركز الثالث" useLoser /><FutureCard item={FINAL} stage="النهائي" /></div></>}</section>;
}
