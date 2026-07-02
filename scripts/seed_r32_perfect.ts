import { PrismaClient } from '@prisma/client';
import { getHomeGroupStandings } from '../lib/homeGroupStandings';

const prisma = new PrismaClient();
const GROUPS = 'ABCDEFGHIJKL'.split('');

const R32 = [
  [73, '2A', '2B'], [75, '1F', '2C'], [74, '1E', '3ABCDF'], [77, '1I', '3CDFGH'],
  [83, '2K', '2L'], [84, '1H', '2J'], [81, '1D', '3BEFIJ'], [82, '1G', '3AEHIJ'],
  [76, '1C', '2F'], [78, '2E', '2I'], [79, '1A', '3CEFHI'], [80, '1L', '3EHIJK'],
  [86, '1J', '2H'], [88, '2D', '2G'], [85, '1B', '3EFGIJ'], [87, '1K', '3DEIJL'],
];

function buildQualifiers(groups) {
  const byGroup = new Map(groups.map((group) => [String(group.key).toUpperCase(), group]));
  const all = [];
  GROUPS.forEach((group) => {
    const rows = byGroup.get(group)?.standings || [];
    if (rows[0]) all.push({ group, rank: 1, row: rows[0] });
    if (rows[1]) all.push({ group, rank: 2, row: rows[1] });
    if (rows[2]) all.push({ group, rank: 3, row: rows[2] });
  });
  const bestThirds = all
    .filter((item) => item.rank === 3)
    .sort((a, b) => b.row.points - a.row.points || b.row.goalDifference - a.row.goalDifference || b.row.goalsFor - a.row.goalsFor || a.row.team.localeCompare(b.row.team))
    .slice(0, 8)
    .map((item, index) => ({ ...item, thirdRank: index + 1 }));
  return { direct: all.filter((item) => item.rank !== 3), bestThirds };
}

function assignThirds(bestThirds) {
  const assigned = new Map();
  const officialMapping = { 
    74: 'PAR',
    77: 'SWE',
    79: 'ECU',
    80: 'COD',
    81: 'BIH',
    82: 'SEN',
    85: 'ALG',
    87: 'GHA'
  };
  
  Object.entries(officialMapping).forEach(([matchNo, code]) => {
    const candidate = bestThirds.find(t => t.row?.code === code);
    if (candidate) {
      assigned.set(Number(matchNo), candidate);
    }
  });

  return assigned;
}

function resolveSlot(slot, direct, thirds, matchNo) {
  const q = String(slot).startsWith('3') ? thirds.get(matchNo) || null : direct.find((item) => `${item.rank}${item.group}` === slot) || null;
  return q?.row || null;
}

async function run() {
  await prisma.match.deleteMany({ where: { stage: { in: ['round_of_32', 'last_32'] } } });
  
  const groups = await getHomeGroupStandings();
  const { direct, bestThirds } = buildQualifiers(groups);
  const thirds = assignThirds(bestThirds);
  
  const officialDates: Record<number, string> = {
    73: '2026-06-28T18:00:00Z',
    74: '2026-06-28T22:00:00Z',
    75: '2026-06-29T16:00:00Z',
    76: '2026-06-29T20:00:00Z',
    77: '2026-06-29T00:00:00Z', // Technically Jun 30 depending on TZ, let's use 20:00 UTC etc. Let's space them.
    78: '2026-06-29T22:00:00Z',
    79: '2026-06-30T16:00:00Z',
    80: '2026-06-30T19:00:00Z',
    81: '2026-06-30T22:00:00Z',
    82: '2026-07-01T01:00:00Z',
    83: '2026-07-01T16:00:00Z',
    84: '2026-07-01T19:00:00Z',
    85: '2026-07-01T22:00:00Z',
    86: '2026-07-02T01:00:00Z',
    87: '2026-07-02T18:00:00Z',
    88: '2026-07-02T22:00:00Z',
  };
  
  for (let i = 0; i < R32.length; i++) {
    const [no, s1, s2] = R32[i];
    const row1 = resolveSlot(s1, direct, thirds, no);
    const row2 = resolveSlot(s2, direct, thirds, no);
    
    if (row1 && row2) {
      let hCode = row1.code.toLowerCase();
      let aCode = row2.code.toLowerCase();
      if (hCode === 'zaf') hCode = 'rsa';
      if (aCode === 'zaf') aCode = 'rsa';
      const homeTeamId = `team-${hCode}`;
      const awayTeamId = `team-${aCode}`;
      
      const homeAsset = await prisma.asset.findUnique({ where: { id: homeTeamId } });
      const awayAsset = await prisma.asset.findUnique({ where: { id: awayTeamId } });

      if (!homeAsset || !awayAsset) {
        console.error(`Missing asset: ${homeTeamId} (${!!homeAsset}) or ${awayTeamId} (${!!awayAsset})`);
        continue;
      }
      
      let homeScore = 0;
      let awayScore = 0;
      let status = 'SCHEDULED';
      
      if (no === 73) { homeScore = 0; awayScore = 1; status = 'FINISHED'; }
      if (no === 74) { homeScore = 1; awayScore = 2; status = 'FINISHED'; } // Paraguay won on pens (Germany 1-2 Paraguay)
      if (no === 75) { homeScore = 1; awayScore = 2; status = 'FINISHED'; } // Morocco won on pens (Netherlands 1-2 Morocco)
      if (no === 76) { homeScore = 2; awayScore = 1; status = 'FINISHED'; } // Brazil 2-1 Japan
      if (no === 77) { homeScore = 3; awayScore = 0; status = 'FINISHED'; } // France 3-0 Sweden
      if (no === 78) { homeScore = 1; awayScore = 2; status = 'FINISHED'; } // Norway 2-1 Ivory Coast
      if (no === 79) { homeScore = 2; awayScore = 0; status = 'FINISHED'; } // Mexico 2-0 Ecuador
      if (no === 80) { homeScore = 2; awayScore = 1; status = 'FINISHED'; } // England 2-1 DR Congo
      if (no === 81) { homeScore = 2; awayScore = 0; status = 'FINISHED'; } // USA 2-0 Bosnia
      if (no === 82) { homeScore = 3; awayScore = 2; status = 'FINISHED'; } // Belgium 3-2 Senegal
      
      const matchDateStr = officialDates[no];
      const matchDate = new Date(matchDateStr);
      
      await prisma.match.create({
        data: {
          externalId: `sim-r32-${no}`,
          stage: 'round_of_32',
          status,
          homeTeamId,
          awayTeamId,
          homeScore,
          awayScore,
          matchDate,
        }
      });
      
      console.log(`Created match ${no}: ${row1.team} vs ${row2.team} on ${matchDateStr}`);
    }
  }
  
  console.log("Successfully seeded 16 round of 32 matches!");
}

// We need to run this with tsx because it imports from lib.
run().catch(console.error).finally(() => prisma.$disconnect());
