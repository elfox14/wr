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

type RoundMatch = { matchNo: number; home: Slot; away: Slot };

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

function assignThirdSlots(bestThirds: Qualifier[]) {
  const thirdSlotIndexes = ROUND_OF_32
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => match.home.kind === 'third' || match.away.kind === 'third')
    .map(({ match, index }) => {
      const slot = match.home.kind === 'third' ? match.home : match.away;
      return { index, slot };
    });

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

function MatchCard({ match, index, direct, thirdAssignments }: { match: RoundMatch; index: number; direct: Qualifier[]; thirdAssignments: Map<number, Qualifier> }) {
  const home = resolveSide(match.home, direct, thirdAssignments, index);
  const away = resolveSide(match.away, direct, thirdAssignments, index);
  return (
    <article className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/25 p-2.5 transition hover:border-[#FFD700]/25">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-0.5 text-[9px] font-black text-[#FFD700]">مباراة {ar.format(match.matchNo)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] font-bold text-gray-400">دور الـ٣٢</span>
      </div>
      <div className="space-y-1.5">
        <SideCard side={home} />
        <div className="px-2 text-center text-[10px] font-black text-gray-500">ضد</div>
        <SideCard side={away} />
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
            CURRENT BRACKET
          </div>
          <h2 className="mt-1.5 text-lg font-black leading-tight text-white md:text-xl">دور الـ٣٢ حسب النتائج الحالية</h2>
          <p className="mt-1 max-w-3xl text-[11px] font-bold leading-5 text-gray-400">محاكاة فورية: أوائل وثواني المجموعات + أفضل ٨ ثوالث. خانات الثوالث موزعة داخل المجموعات المسموحة لكل مباراة وقد تتغير مع أي نتيجة جديدة.</p>
        </div>
        <Link href="/groups" className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1.5 text-[10px] font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">تفاصيل المجموعات</Link>
      </div>

      {!ready ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">بيانات المجموعات غير كافية لبناء كارت دور الـ٣٢ الآن.</div>
      ) : (
        <>
          <div className="mb-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 text-[10px] font-bold text-gray-400 sm:grid-cols-3">
            <span>المتأهلون المباشرون: <b className="text-white">{ar.format(direct.length)}</b></span>
            <span>أفضل الثوالث الحالية: <b className="text-[#FFD700]">{ar.format(bestThirds.length)}</b></span>
            <span>إجمالي دور الـ٣٢: <b className="text-[#00FF88]">{ar.format(direct.length + bestThirds.length)}</b></span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {ROUND_OF_32.map((match, index) => <MatchCard key={match.matchNo} match={match} index={index} direct={direct} thirdAssignments={thirdAssignments} />)}
          </div>
        </>
      )}
    </section>
  );
}
