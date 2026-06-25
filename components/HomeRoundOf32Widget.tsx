'use client';

import Link from 'next/link';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

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

type GroupData = { key: string; arName: string; standings: TableRow[] };
type Props = { groups?: GroupData[] | unknown[] };
type GroupKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';
type Qualifier = { groupKey: GroupKey; groupNumber: number; rank: 1 | 2 | 3; bestThirdRank?: number; row: TableRow };
type Slot =
  | { kind: 'rank'; group: GroupKey; rank: 1 | 2 }
  | { kind: 'third'; allowedGroups: GroupKey[] };
type ThirdSlot = Extract<Slot, { kind: 'third' }>;

type RoundMatch = { matchNo: number; home: Slot; away: Slot };
type FutureMatch = { matchNo: number; from: [number, number] };
type BracketSection = { title: string; subtitle: string; roundOf32: number[]; roundOf16: number[]; quarterFinal: number; semiFinal: number };

type ResolvedSide = {
  label: string;
  qualifier: Qualifier | null;
  note?: string;
};

const GROUPS: GroupKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ar = new Intl.NumberFormat('ar-EG');

const ROUND_OF_32: RoundMatch[] = [
  { matchNo: 73, home: { kind: 'rank', group: 'A', rank: 2 }, away: { kind: 'rank', group: 'B', rank: 2 } },
  { matchNo: 74, home: { kind: 'rank', group: 'E', rank: 1 }, away: { kind: 'third', allowedGroups: ['A', 'B', 'C', 'D', 'F'] } },
  { matchNo: 75, home: { kind: 'rank', group: 'F', rank: 1 }, away: { kind: 'rank', group: 'C', rank: 2 } },
  { matchNo: 76, home: { kind: 'rank', group: 'C', rank: 1 }, away: { kind: 'rank', group: 'F', rank: 2 } },
  { matchNo: 77, home: { kind: 'rank', group: 'I', rank: 1 }, away: { kind: 'third', allowedGroups: ['C', 'D', 'F', 'G', 'H'] } },
  { matchNo: 78, home: { kind: 'rank', group: 'E', rank: 2 }, away: { kind: 'rank', group: 'I', rank: 2 } },
  { matchNo: 79, home: { kind: 'rank', group: 'A', rank: 1 }, away: { kind: 'third', allowedGroups: ['C', 'E', 'F', 'H', 'I'] } },
  { matchNo: 80, home: { kind: 'rank', group: 'L', rank: 1 }, away: { kind: 'third', allowedGroups: ['E', 'H', 'I', 'J', 'K'] } },
  { matchNo: 81, home: { kind: 'rank', group: 'D', rank: 1 }, away: { kind: 'third', allowedGroups: ['B', 'E', 'F', 'I', 'J'] } },
  { matchNo: 82, home: { kind: 'rank', group: 'G', rank: 1 }, away: { kind: 'third', allowedGroups: ['A', 'E', 'H', 'I', 'J'] } },
  { matchNo: 83, home: { kind: 'rank', group: 'K', rank: 2 }, away: { kind: 'rank', group: 'L', rank: 2 } },
  { matchNo: 84, home: { kind: 'rank', group: 'H', rank: 1 }, away: { kind: 'rank', group: 'J', rank: 2 } },
  { matchNo: 85, home: { kind: 'rank', group: 'B', rank: 1 }, away: { kind: 'third', allowedGroups: ['E', 'F', 'G', 'I', 'J'] } },
  { matchNo: 86, home: { kind: 'rank', group: 'J', rank: 1 }, away: { kind: 'rank', group: 'H', rank: 2 } },
  { matchNo: 87, home: { kind: 'rank', group: 'K', rank: 1 }, away: { kind: 'third', allowedGroups: ['D', 'E', 'I', 'J', 'L'] } },
  { matchNo: 88, home: { kind: 'rank', group: 'D', rank: 2 }, away: { kind: 'rank', group: 'G', rank: 2 } },
];

const ROUND_OF_16: FutureMatch[] = [
  { matchNo: 89, from: [73, 75] },
  { matchNo: 90, from: [74, 77] },
  { matchNo: 91, from: [76, 78] },
  { matchNo: 92, from: [79, 80] },
  { matchNo: 93, from: [83, 84] },
  { matchNo: 94, from: [81, 82] },
  { matchNo: 95, from: [86, 88] },
  { matchNo: 96, from: [85, 87] },
];

const QUARTER_FINALS: FutureMatch[] = [
  { matchNo: 97, from: [89, 90] },
  { matchNo: 98, from: [93, 94] },
  { matchNo: 99, from: [91, 92] },
  { matchNo: 100, from: [95, 96] },
];

const SEMI_FINALS: FutureMatch[] = [
  { matchNo: 101, from: [97, 98] },
  { matchNo: 102, from: [99, 100] },
];

const FINAL_MATCH: FutureMatch = { matchNo: 104, from: [101, 102] };
const THIRD_PLACE_MATCH: FutureMatch = { matchNo: 103, from: [101, 102] };

const BRACKET_SECTIONS: BracketSection[] = [
  { title: 'المسار الأول', subtitle: 'الفائز يصعد إلى نصف النهائي ١٠١', roundOf32: [73, 75, 74, 77], roundOf16: [89, 90], quarterFinal: 97, semiFinal: 101 },
  { title: 'المسار الثاني', subtitle: 'الفائز يصعد إلى نصف النهائي ١٠١', roundOf32: [83, 84, 81, 82], roundOf16: [93, 94], quarterFinal: 98, semiFinal: 101 },
  { title: 'المسار الثالث', subtitle: 'الفائز يصعد إلى نصف النهائي ١٠٢', roundOf32: [76, 78, 79, 80], roundOf16: [91, 92], quarterFinal: 99, semiFinal: 102 },
  { title: 'المسار الرابع', subtitle: 'الفائز يصعد إلى نصف النهائي ١٠٢', roundOf32: [86, 88, 85, 87], roundOf16: [95, 96], quarterFinal: 100, semiFinal: 102 },
];

function isGroupDataList(value: unknown): value is GroupData[] {
  return Array.isArray(value) && value.every((group) => group && typeof (group as GroupData).key === 'string' && Array.isArray((group as GroupData).standings));
}

function groupNumber(group: GroupKey) {
  return GROUPS.indexOf(group) + 1;
}

function teamName(row?: TableRow | null) {
  if (!row) return 'غير محدد';
  return getArabicTeamName(row.code, row.team);
}

function teamFlag(row?: TableRow | null, width = 48) {
  if (!row) return null;
  const name = teamName(row);
  return getTeamFlagUrl({ code: row.code, name, image: null }, width);
}

function teamHref(row?: TableRow | null) {
  return row?.code ? `/teams/team-${row.code.toLowerCase()}` : '/teams';
}

function seedLabel(qualifier: Qualifier) {
  const rankLabel = qualifier.rank === 1 ? '1' : qualifier.rank === 2 ? '2' : '3';
  return `${rankLabel}${qualifier.groupKey}`;
}

function slotPlaceholder(slot: Slot) {
  if (slot.kind === 'rank') return `${slot.rank}${slot.group}`;
  return `3 من ${slot.allowedGroups.join('/')}`;
}

function matchLabel(matchNo: number) {
  return `مباراة ${ar.format(matchNo)}`;
}

function winnerLabel(matchNo: number) {
  return `الفائز من ${matchLabel(matchNo)}`;
}

function loserLabel(matchNo: number) {
  return `الخاسر من ${matchLabel(matchNo)}`;
}

function rankThirds(qualifiers: Qualifier[]) {
  return qualifiers
    .filter((item) => item.rank === 3)
    .sort((a, b) => {
      if (b.row.points !== a.row.points) return b.row.points - a.row.points;
      if (b.row.goalDifference !== a.row.goalDifference) return b.row.goalDifference - a.row.goalDifference;
      if (b.row.goalsFor !== a.row.goalsFor) return b.row.goalsFor - a.row.goalsFor;
      return teamName(a.row).localeCompare(teamName(b.row), 'ar');
    })
    .map((item, index) => ({ ...item, bestThirdRank: index + 1 }));
}

function buildQualifiers(groups: GroupData[]) {
  const byGroup = new Map<GroupKey, GroupData>();
  for (const group of groups) {
    const key = String(group.key || '').toUpperCase() as GroupKey;
    if (GROUPS.includes(key)) byGroup.set(key, group);
  }

  const qualifiers: Qualifier[] = [];
  for (const key of GROUPS) {
    const group = byGroup.get(key);
    const rows = group?.standings || [];
    if (rows[0]) qualifiers.push({ groupKey: key, groupNumber: groupNumber(key), rank: 1, row: rows[0] });
    if (rows[1]) qualifiers.push({ groupKey: key, groupNumber: groupNumber(key), rank: 2, row: rows[1] });
    if (rows[2]) qualifiers.push({ groupKey: key, groupNumber: groupNumber(key), rank: 3, row: rows[2] });
  }

  const bestThirds = rankThirds(qualifiers).slice(0, 8);
  return {
    direct: qualifiers.filter((item) => item.rank === 1 || item.rank === 2),
    bestThirds,
  };
}

function thirdSlotFor(match: RoundMatch): ThirdSlot | null {
  if (match.home.kind === 'third') return match.home;
  if (match.away.kind === 'third') return match.away;
  return null;
}

function assignThirdSlots(bestThirds: Qualifier[]) {
  const thirdSlotIndexes = ROUND_OF_32
    .map((match, index) => ({ index, slot: thirdSlotFor(match) }))
    .filter((item): item is { index: number; slot: ThirdSlot } => Boolean(item.slot));

  const assignments = new Map<number, Qualifier>();
  const orderedSlots = [...thirdSlotIndexes].sort((a, b) => {
    const aCount = bestThirds.filter((third) => a.slot.allowedGroups.includes(third.groupKey)).length;
    const bCount = bestThirds.filter((third) => b.slot.allowedGroups.includes(third.groupKey)).length;
    return aCount - bCount;
  });

  function solve(position: number, usedGroups: Set<GroupKey>): boolean {
    if (position >= orderedSlots.length) return true;
    const current = orderedSlots[position];
    const candidates = bestThirds
      .filter((third) => current.slot.allowedGroups.includes(third.groupKey) && !usedGroups.has(third.groupKey))
      .sort((a, b) => (a.bestThirdRank || 99) - (b.bestThirdRank || 99));

    for (const candidate of candidates) {
      assignments.set(current.index, candidate);
      usedGroups.add(candidate.groupKey);
      if (solve(position + 1, usedGroups)) return true;
      usedGroups.delete(candidate.groupKey);
      assignments.delete(current.index);
    }
    return false;
  }

  solve(0, new Set<GroupKey>());
  return assignments;
}

function findRoundOf32(matchNo: number) {
  return ROUND_OF_32.find((match) => match.matchNo === matchNo) || null;
}

function findFutureMatch(list: FutureMatch[], matchNo: number) {
  return list.find((match) => match.matchNo === matchNo) || null;
}

function findNextMatch(matchNo: number) {
  const roundOf16 = ROUND_OF_16.find((match) => match.from.includes(matchNo));
  if (roundOf16) return { stage: 'دور الـ١٦', matchNo: roundOf16.matchNo, pairedWith: roundOf16.from.find((number) => number !== matchNo) || null };
  const quarter = QUARTER_FINALS.find((match) => match.from.includes(matchNo));
  if (quarter) return { stage: 'ربع النهائي', matchNo: quarter.matchNo, pairedWith: quarter.from.find((number) => number !== matchNo) || null };
  const semi = SEMI_FINALS.find((match) => match.from.includes(matchNo));
  if (semi) return { stage: 'نصف النهائي', matchNo: semi.matchNo, pairedWith: semi.from.find((number) => number !== matchNo) || null };
  if (FINAL_MATCH.from.includes(matchNo)) return { stage: 'النهائي', matchNo: FINAL_MATCH.matchNo, pairedWith: FINAL_MATCH.from.find((number) => number !== matchNo) || null };
  return null;
}

function resolveRankSlot(slot: Extract<Slot, { kind: 'rank' }>, direct: Qualifier[]): ResolvedSide {
  const qualifier = direct.find((item) => item.groupKey === slot.group && item.rank === slot.rank) || null;
  return { label: qualifier ? seedLabel(qualifier) : `${slot.rank}${slot.group}`, qualifier };
}

function resolveSide(slot: Slot, direct: Qualifier[], thirdAssignments: Map<number, Qualifier>, matchIndex: number): ResolvedSide {
  if (slot.kind === 'rank') return resolveRankSlot(slot, direct);
  const qualifier = thirdAssignments.get(matchIndex) || null;
  return {
    label: qualifier ? seedLabel(qualifier) : slotPlaceholder(slot),
    qualifier,
    note: qualifier ? `أفضل ثالث رقم ${ar.format(qualifier.bestThirdRank || 0)}` : 'ينتظر تركيبة الثوالث',
  };
}

function SideCard({ side }: { side: ResolvedSide }) {
  const row = side.qualifier?.row || null;
  const flag = teamFlag(row, 64);
  return (
    <Link href={teamHref(row)} className="mobile-tap flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2 transition hover:border-[#0FF0FC]/30 hover:bg-white/[0.07]">
      <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/35">
        {flag ? <img src={flag} alt={`علم ${teamName(row)}`} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[10px] font-black text-[#FFD700]">{side.label}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="team-name-full block truncate text-[11px] font-black text-white">{teamName(row)}</span>
        <span className="mt-0.5 block text-[9px] font-black text-gray-500">{side.note || `المركز ${side.label}`}</span>
      </span>
      <span className="shrink-0 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/10 px-1.5 py-1 text-[9px] font-black text-[#FFD700]">{side.label}</span>
    </Link>
  );
}

function NextNote({ matchNo }: { matchNo: number }) {
  const next = findNextMatch(matchNo);
  if (!next) return null;
  return (
    <div className="mt-2 rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/10 px-2 py-1.5 text-[9px] font-black leading-4 text-[#0FF0FC]">
      الفائز يقابل {next.pairedWith ? winnerLabel(next.pairedWith) : 'الفائز من المسار المقابل'} في {matchLabel(next.matchNo)} — {next.stage}
    </div>
  );
}

function MatchCard({ matchNo, direct, thirdAssignments }: { matchNo: number; direct: Qualifier[]; thirdAssignments: Map<number, Qualifier> }) {
  const match = findRoundOf32(matchNo);
  if (!match) return null;
  const matchIndex = ROUND_OF_32.findIndex((item) => item.matchNo === match.matchNo);
  const home = resolveSide(match.home, direct, thirdAssignments, matchIndex);
  const away = resolveSide(match.away, direct, thirdAssignments, matchIndex);
  return (
    <article className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/25 p-2.5 transition hover:border-[#FFD700]/25">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-0.5 text-[9px] font-black text-[#FFD700]">{matchLabel(match.matchNo)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] font-bold text-gray-400">دور الـ٣٢</span>
      </div>
      <div className="space-y-1.5">
        <SideCard side={home} />
        <div className="px-2 text-center text-[10px] font-black text-gray-500">ضد</div>
        <SideCard side={away} />
      </div>
      <NextNote matchNo={match.matchNo} />
    </article>
  );
}

function FuturePathCard({ match, stage }: { match: FutureMatch; stage: string }) {
  const next = findNextMatch(match.matchNo);
  return (
    <article className="rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/[0.06] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-0.5 text-[9px] font-black text-[#FFD700]">{matchLabel(match.matchNo)}</span>
        <span className="text-[9px] font-black text-gray-500">{stage}</span>
      </div>
      <div className="space-y-1.5 text-[10px] font-black text-white">
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">{winnerLabel(match.from[0])}</div>
        <div className="text-center text-[9px] text-gray-500">ضد</div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">{winnerLabel(match.from[1])}</div>
      </div>
      {next ? (
        <div className="mt-2 rounded-xl border border-[#00FF88]/15 bg-[#00FF88]/10 px-2 py-1.5 text-[9px] font-black leading-4 text-[#00FF88]">
          الفائز يقابل {next.pairedWith ? winnerLabel(next.pairedWith) : 'الفائز من المسار المقابل'} في {matchLabel(next.matchNo)} — {next.stage}
        </div>
      ) : null}
    </article>
  );
}

function BracketSectionCard({ section, direct, thirdAssignments }: { section: BracketSection; direct: Qualifier[]; thirdAssignments: Map<number, Qualifier> }) {
  const roundOf16Matches = section.roundOf16.map((matchNo) => findFutureMatch(ROUND_OF_16, matchNo)).filter((match): match is FutureMatch => Boolean(match));
  const quarterFinal = findFutureMatch(QUARTER_FINALS, section.quarterFinal);
  return (
    <section className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white">{section.title}</h3>
          <p className="mt-0.5 text-[9px] font-bold text-gray-500">{section.subtitle}</p>
        </div>
        <span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2 py-0.5 text-[9px] font-black text-[#0FF0FC]">مسار إقصائي</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <div>
          <div className="mb-1.5 text-[9px] font-black text-gray-500">دور الـ٣٢</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {section.roundOf32.map((matchNo) => <MatchCard key={matchNo} matchNo={matchNo} direct={direct} thirdAssignments={thirdAssignments} />)}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[9px] font-black text-gray-500">دور الـ١٦</div>
          <div className="grid gap-2">
            {roundOf16Matches.map((match) => <FuturePathCard key={match.matchNo} match={match} stage="دور الـ١٦" />)}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[9px] font-black text-gray-500">ربع النهائي</div>
          {quarterFinal ? <FuturePathCard match={quarterFinal} stage="ربع النهائي" /> : null}
        </div>
      </div>
    </section>
  );
}

function FinalPathCard({ match, stage, loser = false }: { match: FutureMatch; stage: string; loser?: boolean }) {
  const sideLabel = loser ? loserLabel : winnerLabel;
  return (
    <article className={`rounded-2xl border p-3 ${loser ? 'border-white/10 bg-white/[0.04]' : 'border-[#FFD700]/20 bg-[#FFD700]/10'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${loser ? 'border-white/10 bg-white/[0.05] text-gray-300' : 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]'}`}>{matchLabel(match.matchNo)}</span>
        <span className="text-[9px] font-black text-gray-500">{stage}</span>
      </div>
      <div className="space-y-1.5 text-[10px] font-black text-white">
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">{sideLabel(match.from[0])}</div>
        <div className="text-center text-[9px] text-gray-500">ضد</div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">{sideLabel(match.from[1])}</div>
      </div>
    </article>
  );
}

export default function HomeRoundOf32Widget({ groups = [] }: Props) {
  const safeGroups = isGroupDataList(groups) ? groups : [];
  const { direct, bestThirds } = buildQualifiers(safeGroups);
  const thirdAssignments = assignThirdSlots(bestThirds);
  const ready = safeGroups.length > 0 && direct.length >= 24;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.10),transparent_26%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur" aria-label="دور 32 كأس العالم">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#0FF0FC]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0FF0FC] shadow-[0_0_12px_rgba(15,240,252,0.8)]" />
            CURRENT KNOCKOUT PATH
          </div>
          <h2 className="mt-1.5 text-lg font-black leading-tight text-white md:text-xl">مسار التصفيات النهائية حسب النتائج الحالية</h2>
          <p className="mt-1 max-w-3xl text-[11px] font-bold leading-5 text-gray-400">محاكاة فورية: أوائل وثواني المجموعات + أفضل ٨ ثوالث. كل مباراة توضح الفائز سيقابل الفائز من أي مباراة لاحقة حتى النهائي.</p>
        </div>
        <Link href="/groups" className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1.5 text-[10px] font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">تفاصيل المجموعات</Link>
      </div>

      {!ready ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">بيانات المجموعات غير كافية لبناء مسار دور الـ٣٢ الآن.</div>
      ) : (
        <>
          <div className="mb-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 text-[10px] font-bold text-gray-400 sm:grid-cols-3">
            <span>المتأهلون المباشرون: <b className="text-white">{ar.format(direct.length)}</b></span>
            <span>أفضل الثوالث الحالية: <b className="text-[#FFD700]">{ar.format(bestThirds.length)}</b></span>
            <span>إجمالي دور الـ٣٢: <b className="text-[#00FF88]">{ar.format(direct.length + bestThirds.length)}</b></span>
          </div>
          <div className="grid gap-3">
            {BRACKET_SECTIONS.map((section) => <BracketSectionCard key={section.title} section={section} direct={direct} thirdAssignments={thirdAssignments} />)}
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            {SEMI_FINALS.map((match) => <FuturePathCard key={match.matchNo} match={match} stage="نصف النهائي" />)}
            <FinalPathCard match={THIRD_PLACE_MATCH} stage="مباراة المركز الثالث" loser />
            <FinalPathCard match={FINAL_MATCH} stage="النهائي" />
          </div>
        </>
      )}
    </section>
  );
}
