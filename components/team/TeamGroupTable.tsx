import { Trophy } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { formatNumber, isFinished, matches } from './teamData';
import type { TeamAsset, TeamMatch } from './teamPageTypes';

type Row = {
  team: TeamAsset;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

function uniqueMatches(teams: TeamAsset[]) {
  const map = new Map<string, TeamMatch>();
  for (const team of teams) {
    for (const match of matches(team)) {
      if (!map.has(match.id)) map.set(match.id, match);
    }
  }
  return Array.from(map.values());
}

function buildRows(groupTeams: TeamAsset[]) {
  const ids = new Set(groupTeams.map((team) => team.id));
  const rows = new Map<string, Row>();
  for (const team of groupTeams) {
    rows.set(team.id, { team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
  }

  for (const match of uniqueMatches(groupTeams)) {
    if (!isFinished(match)) continue;
    if (!match.homeTeamId || !match.awayTeamId || !ids.has(match.homeTeamId) || !ids.has(match.awayTeamId)) continue;
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (homeScore < awayScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(rows.values()).sort((a, b) => {
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    return b.points - a.points || gdB - gdA || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name, 'ar');
  });
}

export default function TeamGroupTable({ team }: { team: TeamAsset }) {
  const groupTeams = (team.groupTeams || []).filter((item) => item.type === 'TEAM');

  if (!team.group || groupTeams.length < 2) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#101217] p-5">
        <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-black text-primary"><Trophy size={15} /> المجموعة</div>
        <h3 className="text-xl font-black text-white">ترتيب المجموعة</h3>
        <p className="mt-3 text-sm leading-7 text-slate-400">غير متوفر في المصادر: لا توجد فرق كافية مرتبطة بنفس المجموعة داخل قاعدة البيانات لحساب جدول كامل.</p>
      </section>
    );
  }

  const rows = buildRows(groupTeams);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#101217] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-black text-primary"><Trophy size={15} /> GROUP CONTEXT</div>
          <h3 className="text-xl font-black text-white">ترتيب المجموعة {team.group}</h3>
        </div>
        <p className="text-xs leading-6 text-slate-500">محسوب من نتائج المباريات المخزنة في Prisma، وليس من توقعات.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-right text-xs">
          <thead className="bg-black/35 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-black">#</th>
              <th className="px-4 py-3 font-black">المنتخب</th>
              <th className="px-4 py-3 font-black">لعب</th>
              <th className="px-4 py-3 font-black">ف</th>
              <th className="px-4 py-3 font-black">ت</th>
              <th className="px-4 py-3 font-black">خ</th>
              <th className="px-4 py-3 font-black">له</th>
              <th className="px-4 py-3 font-black">عليه</th>
              <th className="px-4 py-3 font-black">فارق</th>
              <th className="px-4 py-3 font-black">نقاط</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row, index) => {
              const active = row.team.id === team.id;
              const gd = row.goalsFor - row.goalsAgainst;
              return (
                <tr key={row.team.id} className={active ? 'bg-primary/10 text-white' : 'bg-white/[0.02] text-slate-300'}>
                  <td className="px-4 py-3 font-black tabular-nums">{formatNumber(index + 1)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AssetImage image={row.team.image || ''} type="TEAM" name={row.team.name} width={30} height={30} className="h-8 w-8 rounded-xl object-cover" />
                      <span className="font-black">{row.team.name}{active ? ' (هذا المنتخب)' : ''}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-black tabular-nums">{formatNumber(row.played)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.wins)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.draws)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.losses)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.goalsFor)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatNumber(row.goalsAgainst)}</td>
                  <td className="px-4 py-3 tabular-nums">{gd > 0 ? '+' : ''}{formatNumber(gd)}</td>
                  <td className="px-4 py-3 text-base font-black tabular-nums text-primary">{formatNumber(row.points)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
