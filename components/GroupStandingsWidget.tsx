import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type TeamRow = {
  id: string;
  name: string;
  code?: string | null;
  image?: string | null;
};

type MatchData = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: TeamRow | null;
  awayTeam?: TeamRow | null;
  homeScore: number;
  awayScore: number;
  status: string;
  stage?: string | null;
};

type GroupStandingsWidgetProps = {
  team: {
    id: string;
    group?: string | null;
    homeMatches?: MatchData[] | null;
    awayMatches?: MatchData[] | null;
  };
  allGroupTeams: TeamRow[];
};

type StandingRow = {
  team: TeamRow;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

function buildStandings(allGroupTeams: TeamRow[], allMatches: MatchData[]): StandingRow[] {
  const teamIds = new Set(allGroupTeams.map((t) => t.id));
  const groupMatches = allMatches.filter(
    (m) => m.status === 'FINISHED' && teamIds.has(m.homeTeamId) && teamIds.has(m.awayTeamId)
  );

  const map = new Map<string, StandingRow>();
  for (const t of allGroupTeams) {
    map.set(t.id, { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
  }

  for (const m of groupMatches) {
    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    home.mp += 1;
    away.mp += 1;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.w += 1; home.pts += 3;
      away.l += 1;
    } else if (m.homeScore < m.awayScore) {
      away.w += 1; away.pts += 3;
      home.l += 1;
    } else {
      home.d += 1; home.pts += 1;
      away.d += 1; away.pts += 1;
    }
  }

  for (const row of map.values()) {
    row.gd = row.gf - row.ga;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.name.localeCompare(b.team.name);
  });
}

export default function GroupStandingsWidget({ team, allGroupTeams }: GroupStandingsWidgetProps) {
  if (!team.group || allGroupTeams.length === 0) return null;

  const allMatches = [...(team.homeMatches || []), ...(team.awayMatches || [])];
  // We also need matches between other group teams. Since we only have this team's matches,
  // we compute what we can. For a complete table, the page should pass all group matches.
  const standings = buildStandings(allGroupTeams, allMatches);

  const totalGroupMatches = allGroupTeams.length <= 4 ? 3 : 3; // Each team plays 3 in groups of 4
  const thisTeamRow = standings.find((r) => r.team.id === team.id);
  const remainingMatches = thisTeamRow ? Math.max(0, totalGroupMatches - thisTeamRow.mp) : totalGroupMatches;

  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-accent" />
          <h3 className="text-lg font-black text-white">ترتيب المجموعة {team.group}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">
            متبقي {remainingMatches} مباريات
          </span>
          <Link
            href="/groups"
            className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary hover:bg-primary hover:text-black transition"
          >
            كل المجموعات
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[520px] text-right text-sm">
          <thead className="bg-black/40 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-right font-black">#</th>
              <th className="px-4 py-3 text-right font-black">المنتخب</th>
              <th className="px-3 py-3 text-center font-black">لعب</th>
              <th className="px-3 py-3 text-center font-black">ف</th>
              <th className="px-3 py-3 text-center font-black">ت</th>
              <th className="px-3 py-3 text-center font-black">خ</th>
              <th className="px-3 py-3 text-center font-black">له</th>
              <th className="px-3 py-3 text-center font-black">عليه</th>
              <th className="px-3 py-3 text-center font-black">فارق</th>
              <th className="px-4 py-3 text-center font-black">نقاط</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {standings.map((row, index) => {
              const isCurrent = row.team.id === team.id;
              const qualifies = index < 2; // top 2 advance (+ some 3rd)
              return (
                <tr
                  key={row.team.id}
                  className={`transition ${isCurrent
                    ? 'bg-primary/8 border-r-2 border-r-primary'
                    : qualifies
                      ? 'bg-success/3'
                      : 'bg-white/[0.01] hover:bg-white/[0.04]'
                    }`}
                >
                  <td className="px-4 py-3 font-black text-gray-300">{index + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/asset/${row.team.id}`}
                      className="flex items-center gap-2 hover:text-primary transition"
                    >
                      <AssetImage
                        image={row.team.image || ''}
                        type="TEAM"
                        name={row.team.name}
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded"
                      />
                      <span className={`font-black ${isCurrent ? 'text-primary' : 'text-white'}`}>
                        {row.team.name}
                      </span>
                      {isCurrent && (
                        <span className="rounded-lg bg-primary/20 px-1.5 py-0.5 text-[9px] font-black text-primary">
                          أنت هنا
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-300 tabular-nums">{row.mp}</td>
                  <td className="px-3 py-3 text-center font-bold text-success tabular-nums">{row.w}</td>
                  <td className="px-3 py-3 text-center text-gray-300 tabular-nums">{row.d}</td>
                  <td className="px-3 py-3 text-center font-bold text-danger tabular-nums">{row.l}</td>
                  <td className="px-3 py-3 text-center text-gray-300 tabular-nums">{row.gf}</td>
                  <td className="px-3 py-3 text-center text-gray-300 tabular-nums">{row.ga}</td>
                  <td className={`px-3 py-3 text-center font-bold tabular-nums ${row.gd > 0 ? 'text-success' : row.gd < 0 ? 'text-danger' : 'text-gray-400'}`}>
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg font-black ${isCurrent ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}>
                      {row.pts}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
